// ==UserScript==
// @name         unified pages for my favourites
// @namespace    https://rubinbaby.github.io/userscripts
// @version      0.1.0
// @description  清空目标网页并显示自己常用的网页（首页/体育/新闻/天气/关于）
// @author       yinxiao
// @match        https://news.zhibo8.com/zuqiu/
// @run-at       document-start
// @updateURL    https://github.com/rubinbaby/userscripts/blob/main/unified%20pages%20for%20my%20favourites.user.js
// @downloadURL  https://github.com/rubinbaby/userscripts/blob/main/unified%20pages%20for%20my%20favourites.user.js
// @grant        GM.xmlHttpRequest
// @connect      www.nmc.cn
// @connect      www.zhibo8.com
// @connect      api.qiumibao.com
// @connect      www.popozhibo.cc
// ==/UserScript==

(function () {
    'use strict';

    // -------------------------------
    // Config
    // -------------------------------
    const DEBUG = false;

    const STORAGE = {
        SCHEDULE_TAGS: 'sportsFilterTags',
        SPORTS_NEWS_TAGS: 'sportsNewsFilterTags',
        THEME: 'siteThemePreference', // 'light' | 'dark' | 'auto'
    };

    const ROUTE = {
        DEFAULT_HASH: '#sports-news',
        VALID: new Set(['home', 'sports-schedule', 'sports-news', 'sports-match-live', 'sports-standing', 'global-news', 'weather', 'about']),
    };

    const URLS = {
        SPORTS_NEWS_API: (date) => `https://news.zhibo8.com/zuqiu/json/${date}.htm`,
        SPORTS_VIDEOS_API: (date) => `https://www.zhibo8.com/zuqiu/json/${date}.htm`,
        SPORTS_MATCH_LIVE_DEFAULT: 'https://www.188bifen.com/',
        STANDING_DEFAULT: 'https://data.zhibo8.cc/html/match.html?match=英超&saishi=24',
        GLOBAL_NEWS_DEFAULT: 'https://www.kankanews.com/k24',
        WEATHER_DEFAULT: 'https://www.nmc.cn/publish/forecast/ASH/fengxian.html',
        NMC_API: 'https://www.nmc.cn/rest/weather?stationid=BOoen',
        MATCH_API: (dateStr) =>
            `https://api.qiumibao.com/application/saishi/index.php?_url=/getMatchByDate&date=${encodeURIComponent(dateStr)}&index_v2=1&_env=pc&_platform=pc`,
        POPO_ZHIBO: 'http://www.popozhibo.cc',
        ZHIBO8_BASE: 'https://www.zhibo8.com',
    };

    const THEME = {
        CHECK_INTERVAL_MS: 30 * 60 * 1000,
        NIGHT_START_HOUR: 19,
        NIGHT_END_HOUR: 6,
    };

    // -------------------------------
    // Utils
    // -------------------------------
    const log = (...args) => {
        if (DEBUG) console.log('[UnifiedPages]', ...args);
    };

    const warn = (...args) => {
        if (DEBUG) console.warn('[UnifiedPages]', ...args);
    };

    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

    const safeJsonParse = (text, fallback = null) => {
        try {
            return JSON.parse(text);
        } catch {
            return fallback;
        }
    };

    const dom = {
        qs: (sel, root = document) => root.querySelector(sel),
        qsa: (sel, root = document) => Array.from(root.querySelectorAll(sel)),
        create: (tag, props = {}) => Object.assign(document.createElement(tag), props),
    };

    // Date helpers
    function formatDate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function addDays(date, days) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate() + days);
        return d;
    }

    function enumerateDates(start, end) {
        const list = [];
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        while (d <= last) {
            list.push(formatDate(d));
            d.setDate(d.getDate() + 1);
        }
        return list;
    }

    // Storage helpers
    function loadJSON(key, def = null) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : def;
        } catch {
            return def;
        }
    }

    function saveJSON(key, obj) {
        try {
            localStorage.setItem(key, JSON.stringify(obj));
        } catch {
            // ignore
        }
    }

    function normalizeTag(s) {
        return String(s || '').trim();
    }

    // -------------------------------
    // Net
    // -------------------------------

    function gmRequestText(url, timeoutMs = 5000) {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                url,
                method: 'GET',
                timeout: timeoutMs,
                onload: (res) => resolve(res.responseText || ''),
                ontimeout: () => reject(new Error('Request timeout')),
                onerror: (err) => reject(err || new Error('Network error')),
            });
        });
    }

    // -------------------------------
    // Theme
    // -------------------------------
    function applyTheme(theme) {
        const root = document.documentElement;
        if (!root) return;
        const t = theme === 'dark' ? 'dark' : 'light';
        root.setAttribute('data-theme', t);
        log('Applied theme:', t);
    }

    function loadThemePref() {
        const v = loadJSON(STORAGE.THEME, null);
        return v || null;
    }

    function saveThemePref(v) {
        saveJSON(STORAGE.THEME, v);
    }

    function isNightByTime(now) {
        const h = now.getHours();
        return h >= THEME.NIGHT_START_HOUR || h < THEME.NIGHT_END_HOUR;
    }

    function extractSunHours(nmcJson) {
        const sunrise = nmcJson?.data?.real?.sunriseSunset?.sunrise || null;
        const sunset = nmcJson?.data?.real?.sunriseSunset?.sunset || null;
        const parseHour = (t) => {
            if (!t || typeof t !== 'string') return null;
            const m = t.match(/(\d{1,2}):\d{2}$/);
            if (!m) return null;
            const hh = Number(m[1]);
            return Number.isFinite(hh) ? clamp(hh, 0, 23) : null;
        };
        return { sunriseHour: parseHour(sunrise), sunsetHour: parseHour(sunset) };
    }

    async function themeAutoByTimeAndTide(now = new Date()) {
        // Fallback by time
        let theme = isNightByTime(now) ? 'dark' : 'light';
        try {
            const text = await gmRequestText(`${URLS.NMC_API}&_=${Date.now()}`, 5000);
            const json = safeJsonParse(text);
            if (json) {
                const { sunriseHour, sunsetHour } = extractSunHours(json);
                if (sunriseHour != null && sunsetHour != null) {
                    const h = now.getHours();
                    theme = h >= sunsetHour || h < sunriseHour ? 'dark' : 'light';
                }
            }
        } catch (e) {
            // Network issue: keep time-based fallback
            log('NMC API error, using time fallback:', e?.message || e);
        }
        return theme;
    }

    function mountThemeSwitchUI() {
        const bar = dom.create('div');
        Object.assign(bar.style, {
            position: 'fixed',
            top: '24px',
            zIndex: '9999',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '6px 8px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--text)',
            fontSize: '12px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            transition: 'transform 0.2s ease',
        });
        bar.setAttribute('aria-label', '主题切换');

        const makeBtn = (text, onClick) => {
            const b = dom.create('button', { textContent: text });
            Object.assign(b.style, {
                padding: '4px 8px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
            });
            b.addEventListener('click', onClick);
            b.addEventListener('mouseenter', () => (b.style.background = 'var(--hover)'));
            b.addEventListener('mouseleave', () => (b.style.background = 'transparent'));
            return b;
        };

        bar.appendChild(makeBtn('浅色', () => {
            saveThemePref('light');
            applyTheme('light');
        }));
        bar.appendChild(makeBtn('深色', () => {
            saveThemePref('dark');
            applyTheme('dark');
        }));
        bar.appendChild(makeBtn('自动', async () => {
            saveThemePref('auto');
            applyTheme(await themeAutoByTimeAndTide());
        }));

        document.body.appendChild(bar);

        function positionBar() {
            const halfVW = -15;
            bar.style.right = `${halfVW}px`;
            const w = bar.offsetWidth;
            bar.style.transform = `translateX(${-Math.min(w / 2, halfVW)}px)`;
        }

        positionBar();
        window.addEventListener('resize', positionBar);

        let hideTimer = null;
        function expand() {
            bar.style.right = '0px';
            bar.style.transform = 'translateX(0)';
        }
        function scheduleCollapse() {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                positionBar();
            }, 3000);
        }

        bar.addEventListener('mouseenter', () => {
            clearTimeout(hideTimer);
            expand();
        });
        bar.addEventListener('mouseleave', () => {
            scheduleCollapse();
        });
        bar.addEventListener('focusin', () => {
            clearTimeout(hideTimer);
            expand();
        });
        bar.addEventListener('focusout', () => {
            scheduleCollapse();
        });

        scheduleCollapse();
    }

    function initThemeCycle() {
        const pref = loadThemePref();
        if (pref === 'light' || pref === 'dark') {
            applyTheme(pref);
        } else {
            themeAutoByTimeAndTide().then(applyTheme);
        }
        setInterval(async () => {
            const p = loadThemePref();
            if (p === 'auto' || !p) {
                applyTheme(await themeAutoByTimeAndTide());
            }
        }, THEME.CHECK_INTERVAL_MS);
        mountThemeSwitchUI();
    }

    // -------------------------------
    // Iframe Resource Management
    // -------------------------------
    function ensureIframe({ wrapSelector, iframeId, title, src, sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups', reuse = true }) {
        const wrap = dom.qs(wrapSelector);
        if (!wrap) return null;
        let iframe = wrap.querySelector(`iframe#${iframeId}`);
        if (iframe && reuse) {
            if (iframe.dataset.src === src) return iframe;
            // If URL changed, tear down first
            destroyIframe(`#${iframeId}`);
        }
        iframe = dom.create('iframe', {
            id: iframeId,
            title,
            loading: 'lazy',
        });
        iframe.referrerPolicy = 'no-referrer';
        iframe.sandbox = sandbox;
        iframe.dataset.src = src;
        iframe.src = src;
        wrap.appendChild(iframe);
        return iframe;
    }

    function destroyIframe(selector) {
        const iframe = dom.qs(selector);
        if (!iframe) return;
        try {
            iframe.removeAttribute('src'); // stop loading
            iframe.remove();               // remove DOM
        } catch {
            iframe.parentNode && iframe.parentNode.removeChild(iframe);
        }
    }

    // -------------------------------
    // 通用 tag 存储与标签过滤 UI 工厂
    // -------------------------------
    function createTagStore(storageKey) {
        const set = new Set();
        function load() {
            const arr = loadJSON(storageKey, []);
            const list = Array.isArray(arr) ? arr.map(normalizeTag).filter(Boolean) : [];
            set.clear();
            list.forEach(t => set.add(t));
        }
        function save() {
            saveJSON(storageKey, Array.from(set));
        }
        function add(v) { set.add(normalizeTag(v)); save(); }
        function remove(v) { set.delete(v); save(); }
        function clear() { set.clear(); save(); }
        function listAll() { return Array.from(set); }
        function has(v) { return set.has(normalizeTag(v)); }
        return { load, save, add, remove, clear, listAll, has, __set: set };
    }

    function mountTagFilterUI({ tagStore, inputSelector, addBtnSelector, tagsContainerSelector, onChange }) {
        const inputEl = dom.qs(inputSelector);
        const addBtn = dom.qs(addBtnSelector);
        const tagsEl = dom.qs(tagsContainerSelector);
        if (!inputEl || !addBtn || !tagsEl) return;

        tagStore.load();
        drawTags();
        if (typeof onChange === 'function') onChange(tagStore.listAll());

        function addFromInput() {
            const val = normalizeTag(inputEl.value || '');
            if (!val || tagStore.has(val)) { inputEl.value = ''; return; }
            tagStore.add(val);
            inputEl.value = '';
            drawTags();
            onChange && onChange(tagStore.listAll());
        }
        addBtn.addEventListener('click', addFromInput);
        inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFromInput(); } });

        function drawTags() {
            tagsEl.innerHTML = '';
            const list = tagStore.listAll();
            if (list.length === 0) {
                const hint = dom.create('span', { className: 'filter-hint', textContent: '未添加过滤标签：当前显示全部' });
                tagsEl.appendChild(hint);
                return;
            }
            list.forEach(tag => {
                const chip = dom.create('span', { className: 'filter-chip', textContent: tag });
                const removeBtn = dom.create('button', { className: 'filter-chip-remove', textContent: '×' });
                removeBtn.setAttribute('aria-label', `移除过滤标签 ${tag}`);
                removeBtn.addEventListener('click', () => {
                    tagStore.remove(tag);
                    drawTags();
                    onChange && onChange(tagStore.listAll());
                });
                chip.appendChild(removeBtn);
                tagsEl.appendChild(chip);
            });
            const clearBtn = dom.create('button', { className: 'filter-clear', textContent: '清空标签' });
            clearBtn.addEventListener('click', () => {
                tagStore.clear();
                drawTags();
                onChange && onChange(tagStore.listAll());
            });
            tagsEl.appendChild(clearBtn);
        }
    }

    /**
     * 通用：按日期列表分批并发拉取数据
     * @param {string[]} dateList - 已格式化的日期字符串数组
     * @param {object} opts
     *    - batchSize {number} 并发批次大小
     *    - perDateFetch {function(dateStr): Promise<any>} 单日拉取并返回已归一化的结果（可为任意结构）
     *    - onBatchProgress {function({startIndex, batch, batchResults})} 可选，批次完成回调
     * @returns {Promise<any[]>} 按输入日期顺序合并的结果数组（每项为 perDateFetch 返回的项/结构）
     */
    async function batchFetchByDates(dateList, { batchSize = 6, perDateFetch, onBatchProgress = null } = {}) {
        if (!Array.isArray(dateList) || dateList.length === 0) return [];
        if (typeof perDateFetch !== 'function') throw new Error('perDateFetch must be a function');

        const allResults = [];
        for (let i = 0; i < dateList.length; i += batchSize) {
            const batch = dateList.slice(i, i + batchSize);
            // 并发拉取本批次的每个日期
            const promises = batch.map((d) => (async () => {
                try {
                    return await perDateFetch(d);
                } catch (e) {
                    // 每个单日请求错误单独吞掉，返回空的占位结构（由调用方决定如何处理）
                    console.warn('batchFetchByDates: perDateFetch error for', d, e);
                    return null;
                }
            })());

            const batchResults = await Promise.all(promises);
            // 将非空结果按原始日期顺序 push
            batchResults.forEach((r) => {
                if (r != null) {
                    // 如果 perDateFetch 返回的是数组（比如多条条目），合并数组；否则当作单个项加入
                    if (Array.isArray(r)) allResults.push(...r);
                    else allResults.push(r);
                }
            });

            if (typeof onBatchProgress === 'function') {
                try { onBatchProgress({ startIndex: i, batch, batchResults }); } catch { /* ignore progress errors */ }
            }
            // 短暂让出线程以便 UI 更新（可选）
            await new Promise((res) => setTimeout(res, 10));
        }
        return allResults;
    }

    /**
     * 通用侧边菜单绑定
     * containerSelector, itemSelector, onSelect(itemEl)
     */
    function bindSideMenu(containerSelector, itemSelector, onSelect) {
        const menu = dom.qs(containerSelector);
        if (!menu || menu.__bound) return;
        menu.__bound = true;
        menu.addEventListener('click', (e) => {
            const btn = e.target.closest(itemSelector);
            if (!btn) return;
            dom.qsa(itemSelector, menu).forEach((el) => el.classList.toggle('active', el === btn));
            try { onSelect(btn); } catch (err) { console.warn(err); }
        });
    }

    /**
     * 通用按标签过滤行
     * rows: [{ labels: [...] , ... }]
     * tags: ['x','y']
     * matcher?: (rowLabel, tag) => boolean
     */
    function filterRowsByTags(rows, tags, matcher) {
        if (!tags || tags.length === 0) return rows;
        const norm = tags.map(normalizeTag);
        const matchFn = typeof matcher === 'function' ? matcher : ((l, t) => (l === t || l.toLowerCase() === t.toLowerCase()));
        return rows.filter((r) => {
            const labels = (r.labels || []).map(normalizeTag);
            return norm.some(tag => labels.some(l => matchFn(l, tag)));
        });
    }

    /**
     * setupFilterForSection：通用化 tagStore + mountTagFilterUI 初始化并同步到 activeSet
     * opts:
     *   storageKey, inputSelector, addBtnSelector, tagsContainerSelector,
     *   onChangeRender(tags) -> 渲染回调
     */
    function setupFilterForSection({ storageKey, inputSelector, addBtnSelector, tagsContainerSelector, activeSet, onChangeRender }) {
        const store = createTagStore(storageKey);
        mountTagFilterUI({
            tagStore: store,
            inputSelector,
            addBtnSelector,
            tagsContainerSelector,
            onChange: (tags) => {
                if (typeof onChangeRender === 'function') onChangeRender(tags);
            }
        });
        // populate active set from store
        store.listAll().forEach(t => activeSet && activeSet.add(t));
        return store;
    }

    /**
     * mountStatusArea：在 section 中插入 status 元素并控制表格显示/隐藏
     * usage:
     *   const s = mountStatusArea('#section-news', '.table');
     *   s.setText('加载中...');
     *   // 完成后
     *   s.clear();
     */
    function mountStatusArea(sectionSelector, tableSelector) {
        const section = dom.qs(sectionSelector);
        if (!section) return null;
        const tableEl = dom.qs(tableSelector, section);
        const statusEl = dom.create('div');
        Object.assign(statusEl.style, { marginTop: '8px', color: 'var(--muted)' });
        if (tableEl) {
            tableEl.classList.toggle('hidden', true);
            section.insertBefore(statusEl, tableEl);
        } else {
            section.appendChild(statusEl);
        }
        return {
            statusEl,
            tableEl,
            setText(text) { if (statusEl) statusEl.textContent = String(text || ''); },
            clear() {
                if (statusEl && statusEl.parentNode) statusEl.parentNode.removeChild(statusEl);
                if (tableEl) tableEl.classList.toggle('hidden', false);
            }
        };
    }

    /* 通用：创建空结果行 */
    function createEmptyRow(tbody, colspan, text) {
        const tr = dom.create('tr');
        const tdEl = dom.create('td', { textContent: String(text || '') });
        tdEl.colSpan = colspan;
        tr.appendChild(tdEl);
        tbody.appendChild(tr);
    }

    /* 通用表格渲染器
    columns: [{ render: (row)=>NodeOrString, width? }]
    */
    function renderTableGeneric(tbody, rows, columns) {
        tbody.innerHTML = '';
        if (!rows || rows.length === 0) {
            const colspan = columns ? columns.length : 1;
            createEmptyRow(tbody, colspan, '未找到匹配的记录');
            return;
        }
        rows.forEach((r) => {
            const tr = dom.create('tr');
            for (const col of columns) {
                const td = dom.create('td');
                if (col && typeof col.render === 'function') {
                    const v = col.render(r);
                    if (v instanceof Node) td.appendChild(v);
                    else td.innerHTML = String(v == null ? '-' : v);
                } else {
                    td.textContent = '-';
                }
                if (col && col.style) Object.assign(td.style, col.style);
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });
    }

    // -------------------------------
    // Schedule (Sports)
    // -------------------------------
    let SCHEDULE_ROWS = [];
    const SCHEDULE_ACTIVE_TAGS = new Set();

    function getAllAnchorHTMLByKeywords(liElement, keywords = ['互动直播', '文字']) {
        if (!liElement) return [];
        const anchors = liElement.querySelectorAll('a');
        const newAnchors = [];
        for (const a of anchors) {
            const html = (a.innerHTML || '').trim();
            if (keywords.some((kw) => html.includes(kw))) {
                return newAnchors; // stop collecting once special keywords encountered
            }
            newAnchors.push(a.outerHTML.trim().replaceAll('/zhibo', `${URLS.ZHIBO8_BASE}/zhibo`));
        }
        return newAnchors;
    }

    function parseLiEntry(liHtml) {
        if (typeof liHtml !== 'string') return null;
        const wrapper = dom.create('div');
        wrapper.innerHTML = liHtml.trim();
        const li = wrapper.querySelector('li');
        if (!li) return null;

        const dataTime = li.getAttribute('data-time') || '';
        const timeEl = li.querySelector('time');
        const timeText = timeEl ? timeEl.textContent.trim() : '';
        const time = (dataTime.split(' ')[1] || timeText || '').trim();

        const leagueEl = li.querySelector('span._league');
        const tournament = leagueEl ? leagueEl.textContent.trim() : '';

        function extractTeamsFromSpan(span) {
            if (!span) return { left: '', right: '' };
            const nodes = Array.from(span.childNodes).filter(n => {
                if (n.nodeType === Node.TEXT_NODE) return n.textContent.trim() !== '';
                if (n.nodeType === Node.ELEMENT_NODE) return n.textContent.trim() !== '';
                return false;
            });
            // 优先查找单独的分隔元素（如 <span> - </span>）
            let sepIndex = nodes.findIndex(n => n.nodeType === Node.ELEMENT_NODE && /[-—–]/.test(n.textContent));
            if (sepIndex >= 0) {
                const left = nodes.slice(0, sepIndex).map(n => n.textContent).join('').trim();
                const right = nodes.slice(sepIndex + 1).map(n => n.textContent).join('').trim();
                return { left, right };
            }
            // 若没有独立分隔元素，尝试在文本中按常见分隔符拆分
            const full = span.textContent.replace(/\s/g, ' ').trim();
            const parts = full.split(/\s*[-—–]\s*/);
            return { left: (parts[0] || '').trim(), right: (parts[1] || '').trim() };
        }

        const teamsEls = li.querySelectorAll('span._teams');
        const lastTeamEl = teamsEls.length ? teamsEls[teamsEls.length - 1] : null;
        const matchupHtml = lastTeamEl ? lastTeamEl.innerHTML.trim().replaceAll('//', 'https://') : '';
        const { left: leftTeam, right: rightTeam } = extractTeamsFromSpan(lastTeamEl);

        const labelAttr = li.getAttribute('label') || '';
        const labels = labelAttr.split(',').map((s) => s.trim()).filter(Boolean);

        const liveHtmls = getAllAnchorHTMLByKeywords(li);
        return { time, tournament, matchupHtml, leftTeam, rightTeam, labels, liveHtmls };
    }

    function parsePopoMatchLiveEntries(htmlText) {
        const results = [];
        if (typeof htmlText !== 'string' || !htmlText) return results;
        const wrapper = dom.create('div');
        wrapper.innerHTML = htmlText;
        const matchItems = wrapper.querySelectorAll('.score-list li');
        matchItems.forEach((item) => {
            const timeEl = item.querySelector('.game-time');
            const time = timeEl ? timeEl.textContent.trim() : '';
            const leftTeamEl = item.querySelector('.left-team .left-team-name');
            const leftTeam = leftTeamEl ? leftTeamEl.textContent.trim() : '';
            const rightTeamEl = item.querySelector('.right-team .right-team-name');
            const rightTeam = rightTeamEl ? rightTeamEl.textContent.trim() : '';
            const liveLinks = [];
            const linkEls = item.querySelectorAll('.game-play a');
            linkEls.forEach((a) => {
                const href = a.getAttribute('href') || '';
                const gameStatusEl = a.querySelector('.game-status');
                const text = gameStatusEl ? gameStatusEl.textContent.trim() : '';
                if (href && text) {
                    liveLinks.push(`<a href="${URLS.POPO_ZHIBO}${href}" target="_blank">泡泡${text}</a>`);
                }
            });
            results.push({
                time,
                leftTeam,
                rightTeam,
                liveLinks,
            });
        });
        return results;
    }

    function normalizeDailyEntries(json, dateStr, key = 'data') {
        if (!json) return { date: dateStr, entries: [] };
        if (Array.isArray(json)) return { date: dateStr, entries: json };
        const data = json[key];
        if (Array.isArray(data)) return { date: dateStr, entries: data };
        if (typeof data === 'object') {
            if (Array.isArray(data[dateStr])) return { date: dateStr, entries: data[dateStr] };
            const merged = Object.values(data).flat().filter((x) => typeof x === 'string');
            return { date: dateStr, entries: merged };
        }
        return { date: dateStr, entries: [] };
    }

    function renderScheduleTable(tbody, rows) {
        renderTableGeneric(tbody, rows, [
            { render: (r) => `${r.date} ${r.time || ''}`.trim() },
            { render: (r) => r.tournament || '-' },
            { render: (r) => { const td = dom.create('div'); td.style.whiteSpace = 'pre-wrap'; td.innerHTML = r.matchupHtml || '-'; return td; } },
            { render: (r) => { const td = dom.create('div'); td.style.whiteSpace = 'pre-wrap'; td.innerHTML = (r.liveHtmls || []).join('<span class="zhibofenge">|</span>') || '-'; return td; } },
        ]);
    }

    function setupScheduleFilter() {
        setupFilterForSection({
            storageKey: STORAGE.SCHEDULE_TAGS,
            inputSelector: '#schedule-filter-input',
            addBtnSelector: '#schedule-filter-add',
            tagsContainerSelector: '#schedule-filter-tags',
            activeSet: SCHEDULE_ACTIVE_TAGS,
            onChangeRender: (tags) => {
                const tbody = dom.qs('#section-schedule .table tbody');
                if (!tbody) return;
                const filtered = filterRowsByTags(SCHEDULE_ROWS, tags);
                renderScheduleTable(tbody, filtered);
            }
        });
    }

    async function hydrateScheduleForNextMonth() {
        const s = mountStatusArea('#section-schedule', '.table');
        if (!s) return;
        const tbody = dom.qs('#section-schedule .table tbody');
        const titleEl = dom.qs('#section-schedule .title');
        if (!tbody) return;

        s.setText('正在加载未来一个月赛程…');

        const startDate = new Date();
        const endDate = addDays(startDate, 30);
        const dateList = enumerateDates(startDate, endDate);
        const batchSize = 6;

        const allResults = await batchFetchByDates(dateList, {
            batchSize,
            perDateFetch: async (d) => {
                try {
                    const res = await gmRequestText(URLS.MATCH_API(d), 12000);
                    const json = safeJsonParse(res);
                    return normalizeDailyEntries(json, d);
                } catch {
                    return { date: d, entries: [] };
                }
            },
            onBatchProgress: ({ startIndex, batch }) => {
                s.setText(`正在加载未来一个月赛程…（已完成 ${Math.min(startIndex + batch.length, dateList.length)}/${dateList.length}）`);
            }
        });

        const popoMatchLiveHtml = await gmRequestText(URLS.POPO_ZHIBO, 15000);
        const popoMatchLives = parsePopoMatchLiveEntries(popoMatchLiveHtml);
        log(popoMatchLives);

        const rows = [];
        for (const day of allResults) {
            const { date, entries } = day;
            for (const item of entries) {
                const parsed = parseLiEntry(item);
                if (!parsed) continue;
                if (parsed.leftTeam && parsed.rightTeam) {
                    const popoMatch = popoMatchLives.find(m =>
                        (m.leftTeam === parsed.leftTeam && m.rightTeam === parsed.rightTeam) ||
                        (m.leftTeam === parsed.rightTeam && m.rightTeam === parsed.leftTeam) ||
                        (m.leftTeam.includes(parsed.leftTeam) && m.rightTeam.includes(parsed.rightTeam)) ||
                        (m.leftTeam.includes(parsed.rightTeam) && m.rightTeam.includes(parsed.leftTeam)) ||
                        (parsed.leftTeam.includes(m.leftTeam) && parsed.rightTeam.includes(m.rightTeam)) ||
                        (parsed.leftTeam.includes(m.rightTeam) && parsed.rightTeam.includes(m.leftTeam))
                    );
                    if (popoMatch) {
                        parsed.liveHtmls = popoMatch.liveLinks.concat(parsed.liveHtmls);
                    }
                }
                rows.push({
                    date,
                    time: parsed.time,
                    tournament: parsed.tournament,
                    matchupHtml: parsed.matchupHtml,
                    labels: parsed.labels || [],
                    liveHtmls: parsed.liveHtmls || [],
                });
            }
        }

        rows.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return (a.time || '').localeCompare(b.time || '');
        });

        SCHEDULE_ROWS = rows;

        if (titleEl) {
            titleEl.textContent = `近期赛程（${dateList[0]} 至 ${dateList[dateList.length - 1]}）`;
        }

        // Apply current tags then render
        const filtered = filterRowsByTags(SCHEDULE_ROWS, Array.from(SCHEDULE_ACTIVE_TAGS));
        renderScheduleTable(tbody, filtered);
        s.setText('');
        s.clear();
    }

    // -------------------------------
    // News (Sports)
    // -------------------------------
    let SPORTS_NEWS_ROWS = [];
    const SPORTS_NEWS_ACTIVE_TAGS = new Set();

    function setupNewsFilter() {
        setupFilterForSection({
            storageKey: STORAGE.SPORTS_NEWS_TAGS,
            inputSelector: '#news-filter-input',
            addBtnSelector: '#news-filter-add',
            tagsContainerSelector: '#news-filter-tags',
            activeSet: SPORTS_NEWS_ACTIVE_TAGS,
            onChangeRender: (tags) => {
                const tbody = dom.qs('#section-news .table tbody');
                if (!tbody) return;
                const filtered = filterRowsByTags(SPORTS_NEWS_ROWS, tags);
                renderNewsTable(tbody, filtered);
            }
        });
    }

    function renderNewsTable(tbody, rows) {
        renderTableGeneric(tbody, rows, [
            { render: (r) => `${r.time || ''}`.trim() },
            { render: (r) => r.type || '-' },
            {
                render: (r) => {
                    const td = dom.create('div'); td.style.whiteSpace = 'pre-wrap';
                    if (r.url) {
                        const a = dom.create('a', { href: r.url, textContent: r.title || '-', target: '_blank', rel: 'noopener noreferrer' });
                        td.appendChild(a);
                    } else {
                        td.textContent = r.title || '-';
                    }
                    return td;
                }
            },
        ]);
    }

    /**
     * 通用新闻归一化
     * opts: { baseHost, typeMapper: (item)=>typeString, urlPrefix }
     */
    function normalizeNewsList(json, { urlPrefix = '//news.zhibo8.com', typeMapper = () => '[新闻]' } = {}) {
        const list = Array.isArray(json) ? json : (Array.isArray(json?.video_arr) ? json.video_arr : []);
        return (list || []).map(item => {
            const rawUrl = String(item.url || '');
            const url = rawUrl ? (urlPrefix + rawUrl) : '';
            return {
                time: String(item.createtime || '').trim(),
                title: String(item.title || '').trim(),
                url: String(url).trim(),
                labels: String(item.lable || '').split(',').map((l) => l.trim()).filter(Boolean),
                type: String(typeMapper(item) || '').trim(),
            };
        });
    }

    function parseZhibo8RecommandEntries(htmlText) {
        const results = [];
        if (typeof htmlText !== 'string' || !htmlText) return results;
        const wrapper = dom.create('div');
        wrapper.innerHTML = htmlText;
        const videoItems = wrapper.querySelectorAll('.recommend .zuqiu-video ._content a');
        const newVideoItems = [];
        for (const a of videoItems) {
            newVideoItems.push(a.outerHTML.trim().replaceAll('href="/zuqiu', `href="${URLS.ZHIBO8_BASE}/zuqiu`));
        }
        const newsItems = wrapper.querySelectorAll('.recommend .zuqiu-news ._content a');
        const newNewsItems = [];
        for (const a of newsItems) {
            newNewsItems.push(a.outerHTML.trim());
        }
        return { videoItems: newVideoItems, newsItems: newNewsItems };
    }

    function renderHotBlocks(recommends) {
        try {
            const videosWrap = dom.qs('#sports-hot-videos .hot-list');
            const newsWrap = dom.qs('#sports-hot-news .hot-list');
            if (!videosWrap || !newsWrap) return;

            const { videoItems, newsItems } = recommends || { videoItems: [], newsItems: [] };

            const htmlStringToNodeViaTemplate = (html) => {
                if (typeof html !== 'string' || !html.trim()) return null;
                const tpl = document.createElement('template');
                tpl.innerHTML = html.trim();
                // 片段里可能有多个节点，这里取第一个；如需全部，遍历 tpl.content.childNodes
                return tpl.content.firstElementChild || null;
            }

            // 渲染工具
            const renderList = (wrap, items) => {
                wrap.innerHTML = '';
                if (!items.length) {
                    const div = dom.create('div', { textContent: '暂无内容' });
                    wrap.appendChild(div);
                    return;
                }
                items.forEach(item => {
                    const node = htmlStringToNodeViaTemplate(item);
                    if (node) {
                        wrap.appendChild(node);
                    }
                });
            };

            renderList(videosWrap, videoItems);
            renderList(newsWrap, newsItems);
        } catch (e) {
            warn('renderHotBlocks error', e);
        }
    }

    // 聚合两个 API：并发拉取 -> 归一化 -> 去重 -> 排序
    async function hydrateSportsNewsFromAPI(days = 7) {
        const zhibo8RecommendHtml = await gmRequestText(URLS.ZHIBO8_BASE, 15000);
        const zhibo8Recommends = parseZhibo8RecommandEntries(zhibo8RecommendHtml);
        log(zhibo8Recommends);
        renderHotBlocks(zhibo8Recommends);

        const s = mountStatusArea('#section-news', '.table');
        if (!s) return;
        const tbody = dom.qs('#section-news .table tbody');
        const titleEl = dom.qs('#section-news .title');
        if (!tbody) return;
        s.setText(`正在加载最近 ${days} 天的新闻 …`);

        const startDate = addDays(new Date(), -days + 1);
        const endDate = new Date();
        const dateList = enumerateDates(startDate, endDate);
        const batchSize = 6;

        const mergedRows = await batchFetchByDates(dateList, {
            batchSize,
            perDateFetch: async (d) => {
                const pA = (async () => {
                    try {
                        const res = await gmRequestText(URLS.SPORTS_NEWS_API(d), 12000);
                        const json = safeJsonParse(res);
                        return normalizeNewsList(json, { typeMapper: () => '[新闻]' });
                    } catch {
                        return [];
                    }
                })();
                const pB = (async () => {
                    try {
                        const res = await gmRequestText(URLS.SPORTS_VIDEOS_API(d), 12000);
                        const json = safeJsonParse(res);
                        return normalizeNewsList(json, { urlPrefix: '//www.zhibo8.com', typeMapper: (item) => (item.type === 'zuqiujijin' ? '[集锦]' : (item.type === 'zuqiuluxiang' ? '[录像]' : '')) });
                    } catch {
                        return [];
                    }
                })();

                const [rowsA, rowsB] = await Promise.all([pA, pB]);
                return [...(rowsA || []), ...(rowsB || [])]; // 返回数组，helper 会扁平合并
            },
            onBatchProgress: ({ startIndex, batch }) => {
                s.setText(`正在加载最近 ${days} 天的新闻 …（已完成 ${Math.min(startIndex + batch.length, dateList.length)}/${dateList.length}）`);
            }
        });

        // 排序：日期降序、时间降序
        mergedRows.sort((a, b) => {
            const [aDate, aTime = '00:00:00'] = String(a.time || '').split(' ');
            const [bDate, bTime = '00:00:00'] = String(b.time || '').split(' ');
            const ta = new Date(`${aDate}T${aTime}`);
            const tb = new Date(`${bDate}T${bTime}`);
            return tb - ta; // desc
        });

        // 转为渲染结构
        SPORTS_NEWS_ROWS = mergedRows.map(r => ({
            type: r.type,
            time: r.time,
            title: r.title,
            url: r.url,
            labels: r.labels || []
        }));

        if (titleEl) {
            titleEl.textContent = `足球新闻（${dateList[0]} 至 ${dateList[dateList.length - 1]}）`;
        }

        const filtered = filterRowsByTags(SPORTS_NEWS_ROWS, Array.from(SPORTS_NEWS_ACTIVE_TAGS));
        renderNewsTable(tbody, filtered);
        s.setText('');
        s.clear();
    }


    // -------------------------------
    // Router + Sections
    // -------------------------------
    function setActive(name) {
        const tabs = dom.qsa('.nav .tab');
        const subTabs = dom.qsa('.subnav .subtab');
        const sectionEles = dom.qsa('section.card');

        tabs.forEach((t) => t.classList.toggle('active', name.startsWith(t.dataset.tab)));
        subTabs.forEach((t) => t.classList.toggle('active', t.dataset.subtab === name));
        sectionEles.forEach((t) => t.classList.toggle('hidden', !name.startsWith(t.id)));

        const sections = {
            'sports-schedule': dom.qs('#section-schedule'),
            'sports-news': dom.qs('#section-news'),
            'sports-standing': dom.qs('#section-standing'),
            'sports-match-live': dom.qs('#section-match-live'),
        };

        Object.entries(sections).forEach(([key, el]) => {
            if (!el) return;
            const show = key === name;
            el.classList.toggle('hidden', !show);
            el.classList.toggle('active', show);
        });
    }

    function refreshSection(name) {
        // Clean up iframes when leaving sections
        if (name !== 'sports-match-live') destroyIframe('#sports-match-live-iframe');
        if (name !== 'global-news') destroyIframe('#global-news-iframe');
        if (name !== 'weather') destroyIframe('#weather-iframe');

        if (name === 'sports-schedule') {
            setupScheduleFilter();
            hydrateScheduleForNextMonth();
        } else if (name === 'sports-news') {
            setupNewsFilter();
            hydrateSportsNewsFromAPI(14);
        } else if (name === 'sports-match-live') {
            ensureIframe({
                wrapSelector: '#section-match-live .sports-match-live-iframe-wrap',
                iframeId: 'sports-match-live-iframe',
                title: '比赛直播',
                src: URLS.SPORTS_MATCH_LIVE_DEFAULT,
            });
        } else if (name === 'sports-standing') {
            const first = dom.qs('#section-standing .standing-side-item.active') || dom.qs('#section-standing .standing-side-item');
            const src = first ? (first.dataset.url || URLS.STANDING_DEFAULT) : URLS.STANDING_DEFAULT;
            ensureIframe({
                wrapSelector: '#section-standing .standing-iframe-wrap',
                iframeId: 'standing-iframe',
                title: '积分排名',
                src,
            });
            bindSideMenu('#section-standing .standing-side', '.standing-side-item', (btn) => {
                const url = btn.dataset.url || URLS.STANDING_DEFAULT;
                ensureIframe({
                    wrapSelector: '#section-standing .standing-iframe-wrap',
                    iframeId: 'standing-iframe',
                    title: '积分排名',
                    src: url,
                });
            });
        } else if (name === 'global-news') {
            ensureIframe({
                wrapSelector: 'section#global-news .global-news-iframe-wrap',
                iframeId: 'global-news-iframe',
                title: '全球新闻',
                src: URLS.GLOBAL_NEWS_DEFAULT,
            });
        } else if (name === 'weather') {
            const first = dom.qs('section#weather .weather-side-item.active') || dom.qs('section#weather .weather-side-item');
            const src = first ? (first.dataset.url || URLS.WEATHER_DEFAULT) : URLS.WEATHER_DEFAULT;
            ensureIframe({
                wrapSelector: 'section#weather .weather-iframe-wrap',
                iframeId: 'weather-iframe',
                title: '天气',
                src,
            });
            bindSideMenu('section#weather .subnav', '.weather-side-item', (btn) => {
                const url = btn.dataset.url || URLS.WEATHER_DEFAULT;
                ensureIframe({
                    wrapSelector: 'section#weather .weather-iframe-wrap',
                    iframeId: 'weather-iframe',
                    title: '天气',
                    src: url,
                });
            });
        }
    }

    function bindMainNav() {
        const nav = dom.qs('.nav');
        if (!nav) return;
        nav.addEventListener('click', (e) => {
            const a = e.target.closest('.tab');
            if (!a) return;
            e.preventDefault();
            const key = a.dataset.tab;
            if (key === 'home') {
                location.hash = '#home';
            } else if (key === 'global-news') {
                location.hash = '#global-news';
            } else if (key === 'sports') {
                location.hash = '#sports-news';
            } else if (key === 'weather') {
                location.hash = '#weather';
            } else if (key === 'about') {
                location.hash = '#about';
            }
        });
    }

    function bindSubNav() {
        const subnav = dom.qs('.subnav');
        if (!subnav) return;
        subnav.addEventListener('click', (e) => {
            const a = e.target.closest('a.subtab');
            if (!a) return;
            e.preventDefault();
            const name = a.dataset.subtab;
            if (!name) return;
            location.hash = `#${name}`;
        });
    }

    function initRouter() {
        function applyFromHash() {
            const hash = (location.hash || ROUTE.DEFAULT_HASH).slice(1);
            const name = ROUTE.VALID.has(hash) ? hash : 'home';
            setActive(name);
            refreshSection(name);
        }
        window.addEventListener('hashchange', applyFromHash);
        applyFromHash();
    }

    // -------------------------------
    // UI (HTML + CSS)
    // -------------------------------
    function buildHeadAndReset() {
        document.head.innerHTML = '';
        document.body.innerHTML = '';

        const meta = dom.create('meta');
        meta.charset = 'UTF-8';
        document.head.appendChild(meta);

        const viewport = dom.create('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' });
        document.head.appendChild(viewport);

        const title = dom.create('title', { textContent: 'Unified Pages' });
        document.head.appendChild(title);

        const style = dom.create('style');
        style.textContent = `
:root {
  --bg: #f7f9fc;
  --card: #ffffff;
  --text: #111827;
  --muted: #6b7280;
  --primary: #2563eb;
  --primary-ghost: rgba(37, 99, 235, 0.15);
  --border: #e5e7eb;
  --hover: #f3f4f6;
  --bp-sm: 480px;
  --bp-md: 768px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;
  --bp-2xl: 1500px;
  --bp-3xl: 1680px;
  --bp-4xl: 2000px;
  --bp-5xl: 2100px;
}

:root[data-theme="dark"] {
  --bg: #0b0f1a;
  --card: #121826;
  --text: #e6edf3;
  --muted: #9aa5b1;
  --primary: #4f8cff;
  --primary-ghost: rgba(79, 140, 255, 0.15);
  --border: #243043;
  --hover: #182033;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  transition: background-color 0.3s ease, color 0.3s ease;
}

a {
  color: inherit;
  text-decoration: none;
}

.container {
  width: 100%;
  margin-inline: auto;
  padding: 24px;
  max-width: 100vw;
}

.container.flex {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

@media (min-width: var(--bp-sm)) {
  .container {
    max-width: 520px;
  }
}

@media (min-width: var(--bp-md)) {
  .container {
    max-width: 720px;
  }
}

@media (min-width: var(--bp-lg)) {
  .container {
    max-width: 960px;
  }
}

@media (min-width: var(--bp-xl)) {
  .container {
    max-width: 1200px;
  }
}

@media (min-width: var(--bp-2xl)) {
  .container {
    max-width: 1440px;
  }
}

@media (min-width: var(--bp-3xl)) {
  .container {
    max-width: 1600px;
  }
}

@media (min-width: var(--bp-4xl)) {
  .container {
    max-width: 1920px;
  }
}

@media (min-width: var(--bp-5xl)) {
  .container {
    max-width: 2048px;
  }
}

.nav {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: saturate(1.2) blur(6px);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  transition: all 0.15s ease;
  cursor: pointer;
}

.tab:hover {
  background: var(--hover);
}

.tab.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-ghost);
  background: linear-gradient(180deg, rgba(79, 140, 255, 0.16), transparent 60%);
}

.tab .emoji {
  font-size: 18px;
}

.spacer {
  flex: 1;
}

.brand {
  font-weight: 600;
  color: var(--muted);
}

.subnav {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
  background: var(--card);
  border: 1px dashed var(--border);
  border-radius: 10px;
  padding: 8px;
}

.subtab {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  color: var(--text);
  transition: all 0.15s ease;
}

.subtab:hover {
  background: var(--hover);
}

.subtab.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-ghost);
  background: linear-gradient(180deg, rgba(79, 140, 255, 0.16), transparent 60%);
}

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  margin-top: 16px;
}

.card h1 {
  margin: 0 0 8px;
  font-size: 24px;
}

.card h2 {
  margin: 0 0 8px;
  font-size: 20px;
}

.card p {
  margin: 8px 0;
  color: var(--muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 16px;
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

footer {
  margin: 24px 0;
  color: var(--muted);
  text-align: center;
  font-size: 14px;
}

.hero,
.list {
  display: grid;
  gap: 12px;
}

.list {
  gap: 10px;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  border: 1px dashed var(--border);
  border-radius: 999px;
  color: var(--muted);
  font-size: 12px;
}

.section {
  margin-top: 16px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.table th,
.table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.table th {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
}

.table tr:nth-child(even) td {
  background: rgba(255, 255, 255, 0.03);
}

.table img {
  height: 20px;
  margin-top: -2px;
  vertical-align: middle;
}

.hidden {
  display: none;
}

.section.active .title {
  color: var(--primary);
}

.filter-bar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  margin: 10px 0 6px;
}

#schedule-filter-input,
#news-filter-input {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
}

#schedule-filter-input::placeholder,
#news-filter-input::placeholder {
  color: var(--muted);
}

#schedule-filter-add,
#news-filter-add {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.filter-hint {
  color: var(--muted);
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px dashed var(--border);
  border-radius: 999px;
  font-size: 12px;
}

.filter-chip-remove {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.filter-clear {
  margin-left: 8px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
}

.standing-layout,
.weather-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
  margin-top: 12px;
}

.standing-side,
.weather-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
}

.standing-side {
  max-height: 63vh;
  overflow-y: auto;
}

.side-title {
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 6px;
}

.standing-side-item,
.weather-side-item {
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.standing-side-item:hover,
.weather-side-item:hover {
  background: var(--hover);
}

.standing-side-item.active,
.weather-side-item.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-ghost);
  background: linear-gradient(180deg, rgba(79, 140, 255, 0.16), transparent 60%);
}

.standing-content,
.weather-content {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0;
  overflow: hidden;
}

.standing-content {
  display: flex;
}

#sports.card,
#section-match-live.section,
.sports-match-live-content,
#global-news.card,
.global-news-content,
#weather.card,
.weather-content {
  flex: 1 1 auto;
  overflow: auto;
  display: flex;
}

#sports.card,
#weather.card {
  flex-direction: column;
}

#sports.card.hidden,
#section-match-live.section.hidden,
#global-news.card.hidden,
#weather.card.hidden {
  display: none;
}

.sports-match-live-iframe-wrap,
.standing-iframe-wrap,
.global-news-iframe-wrap,
.weather-iframe-wrap {
  width: 100%;
  background: #fff;
  overflow: hidden;
  border-radius: 12px;
}

.sports-match-live-iframe-wrap iframe,
.standing-iframe-wrap iframe,
.global-news-iframe-wrap iframe,
.weather-iframe-wrap iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

#section-schedule .table a {
  margin-right: 12px;
}

/* 热门视频 / 热门新闻样式 */
.hot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 10px 0 8px;
}

.hot-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
}

.hot-title {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--text);
}

.hot-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

#sports-hot-videos,
#sports-hot-news {
  zoom: 1.5;
}

#sports-hot-videos .hot-list {
  display: flex;
  flex-wrap: wrap;
}

#sports-hot-videos .list-item {
  display: block;
  width: 112px
}

#sports-hot-videos .list-item:not( :nth-child(3n+3)) {
  margin-right: 12px
}

#sports-hot-videos .list-item:nth-child(n+4) {
  margin-top: 12px
}

#sports-hot-videos .list-item:hover ._title {
  color: #0082ff
}

#sports-hot-videos .thumb-box {
  width: 112px;
  height: 80px;
  border-radius: 4px;
  background-color: #eee;
  overflow: hidden
}

#sports-hot-videos .thumb-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  transform: scale(1.01);
  transform-origin: center;
  transition: transform .3s;
}

#sports-hot-videos .list-item:hover .thumb-box img {
  transform: scale(1.1)
}

#sports-hot-videos .list-item ._title {
  margin-top: 10px;
  height: 36px;
  line-height: 18px;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2
}

#sports-hot-news .list-item {
  display: block;
  height: 20px;
  line-height: 20px;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hot-list a:visited {
  color: #BC62C2;
}

@media (max-width: 768px) {

  .standing-layout,
  .hot-grid {
    grid-template-columns: 1fr;
  }
}
    `;
        document.head.appendChild(style);

        if (!document.getElementById('larger-table-style')) {
            const largerTableStyle = dom.create('style', { id: 'larger-table-style' });
            largerTableStyle.textContent = `
/* 全局表格字体放大 */
.table {
  zoom: 1.5;
}

.table th {
  font-weight: 600;
}

.table a:visited {
  color: #BC62C2;
}

.table span.zhibofenge {
  margin-right: 12px;
}

/* 小屏适配：略微缩小，避免换行过多 */
@media (max-width: 640px) {
  .table {
    font-size: 14px;
    line-height: 1.55;
  }

  .table th {
    font-size: 14px;
  }
}
`;
            document.head.appendChild(largerTableStyle);
        }

        const root = dom.create('div', { className: 'container flex' });
        root.innerHTML = `
<nav class="nav" aria-label="主导航">
  <a class="tab active" href="#" data-tab="home"><span class="emoji">🏠</span> 首页</a>
  <a class="tab" href="#" data-tab="sports"><span class="emoji">🏟️</span> 体育</a>
  <a class="tab" href="#" data-tab="global-news"><span class="emoji">📰</span> 新闻</a>
  <a class="tab" href="#" data-tab="weather"><span class="emoji">🌤️</span> 天气</a>
  <a class="tab" href="#" data-tab="about"><span class="emoji">ℹ️</span> 关于</a>
  <span class="spacer"></span>
  <span class="brand"></span>
</nav>

<section id="home" class="card hero">
  <h1>欢迎来到首页</h1>
  <p>点击上方标签，跳转到对应页面。</p>
</section>

<section id="sports" class="card">
  <h1>体育频道</h1>
  <p>这里可以展示体育新闻、赛事安排、球队信息等内容。</p>

  <div class="subnav" aria-label="体育子菜单">
    <a class="subtab" href="#sports-news" data-subtab="sports-news">新闻</a>
    <a class="subtab" href="#sports-schedule" data-subtab="sports-schedule">赛程</a>
    <a class="subtab" href="#sports-match-live" data-subtab="sports-match-live">比分直播</a>
    <a class="subtab" href="#sports-standing" data-subtab="sports-standing">积分排名</a>
  </div>

  <div id="section-schedule" class="section">
    <h2 class="title">近期赛程</h2>
    <div id="schedule-filter-bar" class="filter-bar" role="group" aria-label="赛程过滤器">
      <input id="schedule-filter-input" type="text" placeholder="输入过滤词（如：曼联、英超、转会）后回车或点添加" />
      <button id="schedule-filter-add" type="button">添加</button>
      <div id="schedule-filter-tags" class="filter-tags" aria-live="polite"></div>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>日期时间</th>
          <th>赛事名称</th>
          <th>对阵</th>
          <th>转播</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>

  <div id="section-news" class="section hidden">
    <h2 class="title">足球新闻</h2>

    <!-- 热门视频 / 热门新闻（展示区） -->
    <div class="hot-grid" aria-label="热门内容">
        <section class="hot-card" id="sports-hot-videos">
            <h3 class="hot-title">热门视频</h3>
            <div class="hot-list"></div>
        </section>
        <section class="hot-card" id="sports-hot-news">
            <h3 class="hot-title">热门新闻</h3>
            <div class="hot-list"></div>
        </section>
    </div>

    <div id="news-filter-bar" class="filter-bar" role="group" aria-label="新闻过滤器">
        <input id="news-filter-input" type="text" placeholder="输入过滤词（如：曼联、英超、转会）后回车或点添加" />
        <button id="news-filter-add" type="button">添加</button>
        <div id="news-filter-tags" class="filter-tags" aria-live="polite"></div>
    </div>

    <table class="table">
        <thead>
        <tr>
            <th>日期时间</th>
            <th>类型</th>
            <th>标题</th>
        </tr>
        </thead>
        <tbody></tbody>
    </table>
  </div>

  <div id="section-match-live" class="section hidden">
    <h2 class="title hidden">比分直播</h2>
    <div class="sports-match-live-content">
      <div class="sports-match-live-iframe-wrap"></div>
    </div>
  </div>

  <div id="section-standing" class="section hidden">
    <h2 class="title hidden">积分排名</h2>
    <div class="standing-layout">
      <nav class="standing-side" aria-label="积分排名第三级菜单">
        <div class="side-title">联赛与杯赛</div>
        <button class="standing-side-item active" type="button" data-key="epl"
          data-url="https://data.zhibo8.cc/html/match.html?match=英超&saishi=24">英超</button>
        <button class="standing-side-item" type="button" data-key="efacup"
          data-url="https://data.zhibo8.cc/html/match.html?match=足总杯&saishi=21">英足总杯</button>
        <button class="standing-side-item" type="button" data-key="eflcup"
          data-url="https://data.zhibo8.cc/html/match.html?match=英格兰联赛杯&saishi=221">英联赛杯</button>
        <button class="standing-side-item" type="button" data-key="eurochampions"
          data-url="https://data.zhibo8.cc/html/match.html?match=欧冠&saishi=371">欧冠</button>
        <button class="standing-side-item" type="button" data-key="europa"
          data-url="https://data.zhibo8.cc/html/match.html?match=欧联杯&saishi=369">欧联</button>
        <button class="standing-side-item" type="button" data-key="eurocoop"
          data-url="https://data.zhibo8.cc/html/match.html?match=欧协联&saishi=3002">欧协联</button>
        <button class="standing-side-item" type="button" data-key="eurosupercup"
          data-url="https://data.zhibo8.cc/html/match.html?match=欧洲超级杯&saishi=370">欧超杯</button>
        <button class="standing-side-item" type="button" data-key="worldclubcup"
          data-url="https://data.zhibo8.cc/html/match.html?match=世俱杯&saishi=7">世俱杯</button>
        <button class="standing-side-item" type="button" data-key="eurocup"
          data-url="https://data.zhibo8.cc/html/match.html?match=欧洲杯&saishi=372">欧洲杯</button>
        <button class="standing-side-item" type="button" data-key="worldcup"
          data-url="https://data.zhibo8.cc/html/match.html?match=世界杯&saishi=4">世界杯</button>
        <button class="standing-side-item" type="button" data-key="zhcs"
          data-url="https://data.zhibo8.cc/html/match.html?match=中超&saishi=353">中超</button>
        <button class="standing-side-item" type="button" data-key="zhfacup"
          data-url="https://data.zhibo8.cc/html/match.html?match=足协杯&saishi=352">中国足协杯</button>
        <button class="standing-side-item" type="button" data-key="zhfasupercup"
          data-url="https://data.zhibo8.cc/html/match.html?match=足协超级杯&saishi=354">中国足协超级杯</button>
        <button class="standing-side-item" type="button" data-key="asiacup"
          data-url="https://data.zhibo8.cc/html/match.html?match=亚洲杯&saishi=391">亚洲杯</button>
      </nav>
      <div class="standing-content">
        <div class="standing-iframe-wrap"></div>
      </div>
    </div>
  </div>
</section>

<section id="global-news" class="card">
  <div class="global-news-content">
    <div class="global-news-iframe-wrap"></div>
  </div>
</section>

<section id="weather" class="card">
  <div class="subnav" aria-label="天气子菜单">
    <button class="weather-side-item active" type="button" data-key="tianqiyubao"
      data-url="https://www.nmc.cn/publish/forecast/ASH/fengxian.html">天气预报</button>
    <button class="weather-side-item" type="button" data-key="facup"
      data-url="https://www.nmc.cn/publish/radar/shang-hai/qing-pu.htm">雷达图</button>
    <button class="weather-side-item" type="button" data-key="facup"
      data-url="https://www.nmc.cn/publish/typhoon/probability-img2.html">台风</button>
  </div>
  <div class="weather-content">
    <div class="weather-iframe-wrap"></div>
  </div>
</section>

<section id="about" class="card">
  <h1>关于</h1>
  <p class="about-note">这是一个使用多个 HTML 文件实现“标签页跳转”的示例。每个标签是一个 a 链接，点击后跳转到对应页面。</p>
</section>
    `;
        document.body.appendChild(root);
    }

    // -------------------------------
    // Init
    // -------------------------------
    function initApp() {
        buildHeadAndReset();
        bindMainNav();
        bindSubNav();
        initRouter();
        initThemeCycle();
    }

    // Run as early as possible
    document.addEventListener('DOMContentLoaded', initApp, { once: true });
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        initApp();
    }

})();
