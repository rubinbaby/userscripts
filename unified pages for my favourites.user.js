// ==UserScript==
// @name         unified pages for my favourites
// @namespace    https://rubinbaby.github.io/userscripts
// @version      0.0.5
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
// ==/UserScript==

(function () {
    'use strict';

    // -------------------------------
    // Config
    // -------------------------------
    const DEBUG = false;

    const STORAGE = {
        TAGS: 'sportsFilterTags',
        SPORTS_NEWS_TAGS: 'sportsNewsFilterTags',
        THEME: 'siteThemePreference', // 'light' | 'dark' | 'auto'
    };

    const ROUTE = {
        DEFAULT_HASH: '#sports-news',
        VALID: new Set(['home', 'sports-schedule', 'sports-news', 'sports-match-live', 'sports-standing', 'global-news', 'weather', 'about']),
    };

    const URLS = {
        SPORTS_NEWS_DEFAULT: 'https://news.zhibo8.com/zuqiu/more.htm?label=%E6%9B%BC%E8%81%94',
        SPORTS_NEWS_API: (date) => `https://news.zhibo8.com/zuqiu/json/${date}.htm`,
        SPORTS_VIDEOS_API: (date) => `https://www.zhibo8.com/zuqiu/json/${date}.htm`,
        SPORTS_MATCH_LIVE_DEFAULT: 'https://www.188bifen.com/',
        STANDING_DEFAULT: 'https://data.zhibo8.cc/html/match.html?match=英超&saishi=24',
        GLOBAL_NEWS_DEFAULT: 'https://www.kankanews.com/k24',
        WEATHER_DEFAULT: 'https://www.nmc.cn/publish/forecast/ASH/fengxian.html',
        NMC_API: 'https://www.nmc.cn/rest/weather?stationid=BOoen',
        MATCH_API: (dateStr) =>
            `https://api.qiumibao.com/application/saishi/index.php?_url=/getMatchByDate&date=${encodeURIComponent(dateStr)}&index_v2=1&_env=pc&_platform=pc`,
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

    // -------------------------------
    // Net
    // -------------------------------
    function fetchWithTimeout(url, options, ms) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), ms);
        return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
    }

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
            right: '0px',
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
    // Schedule (Sports)
    // -------------------------------
    let ALL_ROWS = [];
    const ACTIVE_TAGS = new Set();

    function normalizeTag(s) {
        return String(s || '').trim();
    }

    function loadTags() {
        const arr = loadJSON(STORAGE.TAGS, []);
        const list = Array.isArray(arr) ? arr.map(normalizeTag).filter(Boolean) : [];
        ACTIVE_TAGS.clear();
        list.forEach((t) => ACTIVE_TAGS.add(t));
    }

    function saveTags() {
        saveJSON(STORAGE.TAGS, Array.from(ACTIVE_TAGS));
    }

    function getAllAnchorHTMLByKeywords(liElement, keywords = ['互动直播', '文字']) {
        if (!liElement) return [];
        const anchors = liElement.querySelectorAll('a');
        const newAnchors = [];
        for (const a of anchors) {
            const html = (a.innerHTML || '').trim();
            if (keywords.some((kw) => html.includes(kw))) {
                return newAnchors; // stop collecting once special keywords encountered
            }
            newAnchors.push(a.outerHTML.trim().replaceAll('/zhibo', 'https://www.zhibo8.com/zhibo'));
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

        const teamsEl = li.querySelector('span._teams');
        const matchupHtml = teamsEl ? teamsEl.innerHTML.trim().replaceAll('//', 'https://') : '';

        const labelAttr = li.getAttribute('label') || '';
        const labels = labelAttr.split(',').map((s) => s.trim()).filter(Boolean);

        const liveHtmls = getAllAnchorHTMLByKeywords(li);
        return { time, tournament, matchupHtml, labels, liveHtmls };
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

    function filterRowsByInputTags(rows, tags) {
        if (!tags || tags.length === 0) return rows;
        const normTags = tags.map(normalizeTag);
        return rows.filter((r) => {
            const rowLabels = (r.labels || []).map(normalizeTag);
            // exact match or case-insensitive exact
            return normTags.some((tag) => rowLabels.some((l) => l === tag || l.toLowerCase() === tag.toLowerCase()));
            // 如需模糊匹配，启用下面一行：
            // return normTags.some(tag => rowLabels.some(l => l.includes(tag) || tag.includes(l)));
        });
    }

    function renderScheduleTable(tbody, rows) {
        tbody.innerHTML = '';
        if (!rows || rows.length === 0) {
            const tr = dom.create('tr');
            const tdEl = dom.create('td', { textContent: '未找到匹配的赛程' });
            tdEl.colSpan = 5;
            tr.appendChild(tdEl);
            tbody.appendChild(tr);
            return;
        }
        rows.forEach((r) => {
            const tr = dom.create('tr');
            const tdDateTime = dom.create('td', { textContent: `${r.date} ${r.time || ''}`.trim() });
            const tdTournament = dom.create('td', { textContent: r.tournament || '-' });
            const tdMatchup = dom.create('td');
            tdMatchup.style.whiteSpace = 'pre-wrap';
            tdMatchup.innerHTML = r.matchupHtml || '-';
            const tdLive = dom.create('td');
            tdLive.style.whiteSpace = 'pre-wrap';
            tdLive.innerHTML = (r.liveHtmls || []).join('') || '-';

            tr.appendChild(tdDateTime);
            tr.appendChild(tdTournament);
            tr.appendChild(tdMatchup);
            tr.appendChild(tdLive);
            tbody.appendChild(tr);
        });
    }

    function setupInputTagFilter() {
        const inputEl = dom.qs('#schedule-filter-input');
        const addBtn = dom.qs('#schedule-filter-add');
        const tagsEl = dom.qs('#schedule-filter-tags');
        const tbody = dom.qs('#section-schedule .table tbody');
        if (!inputEl || !addBtn || !tagsEl || !tbody) return;

        // restore tags
        loadTags();
        drawTags();

        function addTagFromInput() {
            const val = normalizeTag(inputEl.value || '');
            if (!val || ACTIVE_TAGS.has(val)) {
                inputEl.value = '';
                return;
            }
            ACTIVE_TAGS.add(val);
            inputEl.value = '';
            saveTags();
            drawTags();
            applyFilter();
        }

        addBtn.addEventListener('click', addTagFromInput);
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTagFromInput();
            }
        });

        function drawTags() {
            tagsEl.innerHTML = '';
            if (ACTIVE_TAGS.size === 0) {
                const hint = dom.create('span', { className: 'filter-hint', textContent: '未添加过滤标签：当前显示全部赛程' });
                tagsEl.appendChild(hint);
            } else {
                ACTIVE_TAGS.forEach((tag) => {
                    const chip = dom.create('span', { className: 'filter-chip', textContent: tag });
                    const removeBtn = dom.create('button', { className: 'filter-chip-remove', textContent: '×' });
                    removeBtn.setAttribute('aria-label', `移除过滤标签 ${tag}`);
                    removeBtn.addEventListener('click', () => {
                        ACTIVE_TAGS.delete(tag);
                        saveTags();
                        drawTags();
                        applyFilter();
                    });
                    chip.appendChild(removeBtn);
                    tagsEl.appendChild(chip);
                });
                const clearBtn = dom.create('button', { className: 'filter-clear', textContent: '清空标签' });
                clearBtn.addEventListener('click', () => {
                    ACTIVE_TAGS.clear();
                    saveTags();
                    drawTags();
                    applyFilter();
                });
                tagsEl.appendChild(clearBtn);
            }
        }

        function applyFilter() {
            const arrTags = Array.from(ACTIVE_TAGS);
            const filtered = filterRowsByInputTags(ALL_ROWS, arrTags);
            renderScheduleTable(tbody, filtered);
        }
    }

    async function hydrateScheduleForNextMonth() {
        const section = dom.qs('#section-schedule');
        if (!section) return;
        const tbody = dom.qs('#section-schedule .table tbody');
        const titleEl = dom.qs('#section-schedule .title');
        if (!tbody) return;

        // status area
        const statusEl = dom.create('div');
        Object.assign(statusEl.style, { marginTop: '8px', color: 'var(--muted)' });
        const tableEl = dom.qs('#section-schedule .table');
        tableEl.classList.toggle('hidden', true);
        section.insertBefore(statusEl, tableEl);
        statusEl.textContent = '正在加载未来一个月赛程…';

        const startDate = new Date();
        const endDate = addDays(startDate, 30);
        const dateList = enumerateDates(startDate, endDate);
        const batchSize = 6;

        const allResults = [];
        try {
            for (let i = 0; i < dateList.length; i += batchSize) {
                const batch = dateList.slice(i, i + batchSize);
                const batchPromises = batch.map(async (d) => {
                    try {
                        const res = await gmRequestText(URLS.MATCH_API(d), 12000);
                        const json = safeJsonParse(res);
                        return normalizeDailyEntries(json, d);
                    } catch {
                        return { date: d, entries: [] };
                    }
                });
                const batchResults = await Promise.all(batchPromises);
                allResults.push(...batchResults);
            }
        } catch (err) {
            console.error(err);
            statusEl.textContent = `加载失败：${err.message || err}`;
            return;
        }

        const rows = [];
        for (const day of allResults) {
            const { date, entries } = day;
            for (const item of entries) {
                const parsed = parseLiEntry(item);
                if (!parsed) continue;
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

        ALL_ROWS = rows;

        if (titleEl) {
            titleEl.textContent = `近期赛程（${dateList[0]} 至 ${dateList[dateList.length - 1]}）`;
        }

        // Apply current tags then render
        const filtered = filterRowsByInputTags(ALL_ROWS, Array.from(ACTIVE_TAGS));
        renderScheduleTable(tbody, filtered);
        statusEl.textContent = '';
        tableEl.classList.toggle('hidden', false);
    }

    // -------------------------------
    // News (Sports)
    // -------------------------------
    let SPORTS_NEWS_ROWS = [];
    const SPORTS_NEWS_ACTIVE_TAGS = new Set();

    function loadNewsTags() {
        const arr = loadJSON(STORAGE.SPORTS_NEWS_TAGS, []);
        const list = Array.isArray(arr) ? arr.map(normalizeTag).filter(Boolean) : [];
        SPORTS_NEWS_ACTIVE_TAGS.clear();
        list.forEach(t => SPORTS_NEWS_ACTIVE_TAGS.add(t));
    }
    function saveNewsTags() {
        saveJSON(STORAGE.SPORTS_NEWS_TAGS, Array.from(SPORTS_NEWS_ACTIVE_TAGS));
    }

    // 过滤器 UI
    function setupNewsInputTagFilter() {
        const inputEl = dom.qs('#news-filter-input');
        const addBtn = dom.qs('#news-filter-add');
        const tagsEl = dom.qs('#news-filter-tags');
        const tbody = dom.qs('#section-news .table tbody');
        if (!inputEl || !addBtn || !tagsEl || !tbody) return;

        loadNewsTags();
        drawTags();
        applyFilter();

        function addTagFromInput() {
            const val = normalizeTag(inputEl.value || '');
            if (!val || SPORTS_NEWS_ACTIVE_TAGS.has(val)) {
                inputEl.value = '';
                return;
            }
            SPORTS_NEWS_ACTIVE_TAGS.add(val);
            inputEl.value = '';
            saveNewsTags();
            drawTags();
            applyFilter();
        }

        addBtn.addEventListener('click', addTagFromInput);
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTagFromInput();
            }
        });

        function drawTags() {
            tagsEl.innerHTML = '';
            if (SPORTS_NEWS_ACTIVE_TAGS.size === 0) {
                const hint = dom.create('span', { className: 'filter-hint', textContent: '未添加过滤标签：当前显示全部新闻' });
                tagsEl.appendChild(hint);
            } else {
                SPORTS_NEWS_ACTIVE_TAGS.forEach((tag) => {
                    const chip = dom.create('span', { className: 'filter-chip', textContent: tag });
                    const removeBtn = dom.create('button', { className: 'filter-chip-remove', textContent: '×' });
                    removeBtn.setAttribute('aria-label', `移除过滤标签 ${tag}`);
                    removeBtn.addEventListener('click', () => {
                        SPORTS_NEWS_ACTIVE_TAGS.delete(tag);
                        saveNewsTags();
                        drawTags();
                        applyFilter();
                    });
                    chip.appendChild(removeBtn);
                    tagsEl.appendChild(chip);
                });
                const clearBtn = dom.create('button', { className: 'filter-clear', textContent: '清空标签' });
                clearBtn.addEventListener('click', () => {
                    SPORTS_NEWS_ACTIVE_TAGS.clear();
                    saveNewsTags();
                    drawTags();
                    applyFilter();
                });
                tagsEl.appendChild(clearBtn);
            }
        }

        function applyFilter() {
            const tags = Array.from(SPORTS_NEWS_ACTIVE_TAGS);
            const filtered = filterNewsRowsByTags(SPORTS_NEWS_ROWS, tags);
            renderNewsTable(tbody, filtered);
        }
    }

    // 过滤逻辑：标签命中 OR 标题/来源包含
    function filterNewsRowsByTags(rows, tags) {
        if (!tags || tags.length === 0) return rows;
        const normTags = tags.map(normalizeTag);
        return rows.filter((r) => {
            const labelList = (r.labels || []).map(normalizeTag);
            return normTags.some((tag) => labelList.some((l) => l === tag || l.toLowerCase() === tag.toLowerCase()));
        });
    }

    // 表格渲染
    function renderNewsTable(tbody, rows) {
        tbody.innerHTML = '';
        if (!rows || rows.length === 0) {
            const tr = dom.create('tr');
            const tdEl = dom.create('td', { textContent: '未找到匹配的新闻' });
            tdEl.colSpan = 3;
            tr.appendChild(tdEl);
            tbody.appendChild(tr);
            return;
        }
        rows.forEach((r) => {
            const tr = dom.create('tr');
            const tdDateTime = dom.create('td', { textContent: `${r.time || ''}`.trim() });
            const tdType = dom.create('td', { textContent: r.type || '-' });
            const tdTitle = dom.create('td'); tdTitle.style.whiteSpace = 'pre-wrap';
            if (r.url) {
                const a = dom.create('a', { href: r.url, textContent: r.title || '-', target: '_blank', rel: 'noopener noreferrer' });
                tdTitle.appendChild(a);
            } else {
                tdTitle.textContent = r.title || '-';
            }

            tr.appendChild(tdDateTime);
            tr.appendChild(tdType);
            tr.appendChild(tdTitle);
            tbody.appendChild(tr);
        });
    }

    // 统一两个源的返回为统一条目
    function normalizeNewsEntriesFromNews(json) {
        const list = Array.isArray(json) ? json : (Array.isArray(json?.video_arr) ? json.video_arr : []);
        return (list || []).map(item => ({
            time: String(item.createtime || '').trim(),
            title: String(item.title || '').trim(),
            url: String(("//news.zhibo8.com" + item.url) || '').trim(),
            labels: String(item.lable || '').split(',').map((l) => l.trim()).filter(Boolean),
            type: '[新闻]',
        }));
    }
    function normalizeNewsEntriesFromVideos(json) {
        const list = Array.isArray(json) ? json : (Array.isArray(json?.video_arr) ? json.video_arr : []);
        return (list || []).map(item => ({
            time: String(item.createtime || '').trim(),
            title: String(item.title || '').trim(),
            url: String(("//www.zhibo8.com" + item.url) || '').trim(),
            labels: String(item.lable || '').split(',').map((l) => l.trim()).filter(Boolean),
            type: String((item.type === 'zuqiujijin' ? '[集锦]' : (item.type === 'zuqiuluxiang' ? '[录像]' : '')) || '').trim(),
        }));
    }

    // 聚合两个 API：并发拉取 -> 归一化 -> 去重 -> 排序
    async function hydrateSportsNewsFromAPI(days = 7) {
        const section = dom.qs('#section-news');
        if (!section) return;
        const tbody = dom.qs('#section-news .table tbody');
        const titleEl = dom.qs('#section-news .title');
        if (!tbody) return;

        // 状态提示
        const statusEl = dom.create('div');
        Object.assign(statusEl.style, { marginTop: '8px', color: 'var(--muted)' });
        const tableEl = dom.qs('#section-news .table');
        tableEl.classList.toggle('hidden', true);
        section.insertBefore(statusEl, tableEl);
        statusEl.textContent = `正在加载最近 ${days} 天的新闻 …`;

        const startDate = addDays(new Date(), -days + 1);
        const endDate = new Date();
        const dateList = enumerateDates(startDate, endDate);
        const batchSize = 6;

        const mergedRows = [];
        try {
            for (let i = 0; i < dateList.length; i += batchSize) {
                const batch = dateList.slice(i, i + batchSize);
                const batchPromises = batch.map(async (d) => {
                    // 两源并发
                    const pA = (async () => {
                        try {
                            const res = await gmRequestText(`${URLS.SPORTS_NEWS_API(d)}`, 12000);
                            const json = safeJsonParse(res);
                            return normalizeNewsEntriesFromNews(json, d);
                        } catch {
                            return [];
                        }
                    })();
                    const pB = (async () => {
                        try {
                            const res = await gmRequestText(`${URLS.SPORTS_VIDEOS_API(d)}`, 12000);
                            const json = safeJsonParse(res);
                            return normalizeNewsEntriesFromVideos(json, d);
                        } catch {
                            return [];
                        }
                    })();

                    const [rowsA, rowsB] = await Promise.all([pA, pB]);
                    return [...rowsA, ...rowsB];
                });

                const batchResults = await Promise.all(batchPromises);
                batchResults.forEach(rows => mergedRows.push(...rows));
            }
        } catch (err) {
            console.error(err);
            statusEl.textContent = `加载新闻失败：${err.message || err}`;
            return;
        }

        // 排序：日期降序、时间降序
        mergedRows.sort((a, b) => {
            const [aDate, aTime] = a.time.split(' ');
            const [bDate, bTime] = b.time.split(' ');
            const dateDiff = new Date(bDate) - new Date(aDate);
            if (dateDiff !== 0) return dateDiff;
            return bTime.localeCompare(aTime);
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

        const filtered = filterNewsRowsByTags(SPORTS_NEWS_ROWS, Array.from(SPORTS_NEWS_ACTIVE_TAGS));
        renderNewsTable(tbody, filtered);
        statusEl.textContent = '';
        tableEl.classList.toggle('hidden', false);
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
            setupInputTagFilter();
            hydrateScheduleForNextMonth();
        } else if (name === 'sports-news') {
            setupNewsInputTagFilter();
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
            bindStandingSideMenu(); // bind only once; using event delegation
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
            bindWeatherSideMenu();
        }
    }

    function bindStandingSideMenu() {
        const menu = dom.qs('#section-standing .standing-side');
        if (!menu || menu.__bound) return;
        menu.__bound = true;
        menu.addEventListener('click', (e) => {
            const btn = e.target.closest('.standing-side-item');
            if (!btn) return;
            dom.qsa('.standing-side-item', menu).forEach((el) => el.classList.toggle('active', el === btn));
            const url = btn.dataset.url || URLS.STANDING_DEFAULT;
            ensureIframe({
                wrapSelector: '#section-standing .standing-iframe-wrap',
                iframeId: 'standing-iframe',
                title: '积分排名',
                src: url,
            });
        });
    }

    function bindWeatherSideMenu() {
        const menu = dom.qs('section#weather .subnav');
        if (!menu || menu.__bound) return;
        menu.__bound = true;
        menu.addEventListener('click', (e) => {
            const btn = e.target.closest('.weather-side-item');
            if (!btn) return;
            dom.qsa('.weather-side-item', menu).forEach((el) => el.classList.toggle('active', el === btn));
            const url = btn.dataset.url || URLS.WEATHER_DEFAULT;
            ensureIframe({
                wrapSelector: 'section#weather .weather-iframe-wrap',
                iframeId: 'weather-iframe',
                title: '天气',
                src: url,
            });
        });
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
html, body {
  transition: background-color 0.3s ease, color 0.3s ease;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, "Noto Sans", sans-serif;
}
a { color: inherit; text-decoration: none; }

.container {
  box-sizing: border-box;
  width: 100%;
  margin-inline: auto;
  padding: 24px;
}
@media (min-width: 480px)  { .container { max-width: 520px; } }
@media (min-width: 768px)  { .container { max-width: 720px; } }
@media (min-width: 1024px) { .container { max-width: 960px; } }
@media (min-width: 1280px) { .container { max-width: 1200px; } }
@media (min-width: 1500px) { .container { max-width: 1440px; } }
@media (min-width: 1680px) { .container { max-width: 1600px; } }
@media (min-width: 2000px) { .container { max-width: 1920px; } }
@media (min-width: 2100px) { .container { max-width: 2048px; } }

.nav {
  display: flex; gap: 12px; flex-wrap: wrap;
  background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px;
  position: sticky; top: 0; z-index: 10; backdrop-filter: saturate(1.2) blur(6px);
}
.tab {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border);
  background: transparent; color: var(--text); transition: all 0.15s ease; cursor: pointer;
}
.tab:hover { background: var(--hover); }
.tab.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-ghost);
  background: linear-gradient(180deg, rgba(79,140,255,0.16), transparent 60%);
}
.tab .emoji { font-size: 18px; }
.spacer { flex: 1; }
.brand { font-weight: 600; color: var(--muted); }

.subnav {
  display: flex; gap: 10px; flex-wrap: wrap;
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
  transition: background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.subtab:hover { background: var(--hover); }
.subtab.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-ghost);
  background: linear-gradient(180deg, rgba(79,140,255,0.16), transparent 60%);
}

.card {
  background: var(--card); border: 1px solid var(--border); border-radius: 16px;
  padding: 20px; margin-top: 16px;
}
.card h1 { margin: 0 0 8px; font-size: 24px; }
.card h2 { margin: 0 0 8px; font-size: 20px; }
.card p { margin: 8px 0; color: var(--muted); }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 16px; }
@media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
footer { margin: 24px 0; color: var(--muted); text-align: center; font-size: 14px; }

.hero { display: grid; gap: 12px; }

.list { display: grid; gap: 10px; }
.tag {
  display: inline-block; padding: 2px 8px; border: 1px dashed var(--border);
  border-radius: 999px; color: var(--muted); font-size: 12px;
}

.section { margin-top: 16px; }

.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.table th, .table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.table th {
  background: rgba(255,255,255,0.05);
  color: var(--text);
}
.table tr:nth-child(even) td {
  background: rgba(255,255,255,0.03);
}
.table img{ height: 20px; margin-top: -2px; vertical-align: middle; }

.hidden { display: none; }
.section.active .title { color: var(--primary); }

.filter-bar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  margin: 10px 0 6px;
}
#schedule-filter-input, #news-filter-input {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
}
#schedule-filter-input::placeholder, #news-filter-input::placeholder { color: var(--muted); }
#schedule-filter-add, #news-filter-add {
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
.filter-hint { color: var(--muted); }
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

.standing-layout, .weather-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
  margin-top: 12px;
}
.standing-side, .weather-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
}
.side-title { font-weight: 600; color: var(--muted); margin-bottom: 6px; }
.standing-side-item, .weather-side-item {
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.standing-side-item:hover, .weather-side-item:hover { background: var(--hover); }
.standing-side-item.active, .weather-side-item.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-ghost);
  background: linear-gradient(180deg, rgba(79,140,255,0.16), transparent 60%);
}
.standing-content, .weather-content {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0;
  overflow: hidden;
}

.sports-match-live-iframe-wrap,
.standing-iframe-wrap,
.global-news-iframe-wrap,
.weather-iframe-wrap {
  width: 100%;
  height: 90vh;
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

@media (max-width: 768px) {
  .standing-layout { grid-template-columns: 1fr; }
}
    `;
        document.head.appendChild(style);

        const largerTableStyle = document.createElement('style');
        largerTableStyle.id = 'larger-table-style';
        largerTableStyle.textContent = `
  /* 全局表格字体放大 */
  .table {
    font-size: 20px;        /* 原本约 14px，这里统一调到 16px */
    line-height: 1.8;       /* 增加行高，提升密集数据的可读性 */
  }
  .table th {
    font-size: 20px;
    font-weight: 600;
  }
  .table a:visited { color: #BC62C2; }
  /* 小屏适配：略微缩小，避免换行过多 */
  @media (max-width: 640px) {
    .table {
      font-size: 15px;
      line-height: 1.55;
    }
    .table th {
      font-size: 15px;
    }
  }
`;
        document.head.appendChild(largerTableStyle);

        const root = dom.create('div', { className: 'container' });
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
        <button class="standing-side-item" type="button" data-key="facup"
          data-url="https://data.zhibo8.cc/html/match.html?match=足总杯&saishi=21">英足总杯</button>
        <button class="standing-side-item" type="button" data-key="facup"
          data-url="https://data.zhibo8.cc/html/match.html?match=英格兰联赛杯&saishi=221">英联赛杯</button>
        <button class="standing-side-item" type="button" data-key="facup"
          data-url="https://data.zhibo8.cc/html/match.html?match=欧冠&saishi=371">欧冠</button>
        <button class="standing-side-item" type="button" data-key="facup"
          data-url="https://data.zhibo8.cc/html/match.html?match=欧联杯&saishi=369">欧联</button>
        <button class="standing-side-item" type="button" data-key="facup"
          data-url="https://data.zhibo8.cc/html/match.html?match=欧协联&saishi=3002">欧协联</button>
        <button class="standing-side-item" type="button" data-key="facup"
          data-url="https://data.zhibo8.cc/html/match.html?match=欧洲超级杯&saishi=370">欧超杯</button>
        <button class="standing-side-item" type="button" data-key="facup"
          data-url="https://data.zhibo8.cc/html/match.html?match=世俱杯&saishi=7">世俱杯</button>
        <button class="standing-side-item" type="button" data-key="facup"
          data-url="https://data.zhibo8.cc/html/match.html?match=欧洲杯&saishi=372">欧洲杯</button>
        <button class="standing-side-item" type="button" data-key="facup"
          data-url="https://data.zhibo8.cc/html/match.html?match=世界杯&saishi=4">世界杯</button>
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
