// ==UserScript==
// @name         mini-page-preview
// @namespace    https://rubinbaby.github.io/userscripts
// @version      0.0.2
// @description  mini page preview
// @author       yinxiao
// @match        *://*/*
// @run-at       document-end
// @updateURL    https://github.com/rubinbaby/userscripts/blob/main/mini-page-preview.user.js
// @downloadURL  https://github.com/rubinbaby/userscripts/blob/main/mini-page-preview.user.js
// @grant        GM.xmlHttpRequest
// ==/UserScript==

(function () {
    'use strict';

    // -------------------------------
    // Config
    // -------------------------------
    const DEBUG = false; // 是否启用调试日志
    const relEnable = false; // 是否启用链接Rel属性
    const targetEnable = false; // 是否启用链接Target属性

    // -------------------------------
    // Utils
    // -------------------------------
    const debug = (...args) => {
        if (DEBUG) log('[DEBUG]', ...args);
    }

    const log = (...args) => {
        console.log('[MiniPagePreview]', ...args);
    };

    const error = (...args) => {
        log('[ERROR]', ...args);
    };

    // --- Modal Preview (link click to open inline modal with page content) ---
    const MODAL_CFG = {
        // 通过选择器限定需要拦截的链接范围（默认页面内所有 a）
        linkSelector: 'a',
        // 排除不拦截的链接（例如站内导航标签、当前脚本生成的子菜单按钮）
        excludeSelectors: [
        ],
        // 是否只拦截在内容区域内的链接，避免顶部导航等
        limitToContainers: [
        ],
        // 是否只拦截外部链接（以 http(s) 开头）；false 表示所有
        onlyHttpLinks: true,
        // 打开方式：使用 iframe（跨域安全，推荐）
        sandboxDefault: 'allow-scripts allow-same-origin allow-forms',
        sandboxPopups: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox',
        allowPopupsHosts: null, // new Set(['play.sportsteam368.com']), 可按需增减
        // 站点白/黑名单
        hostWhitelist: null, // new Set(['example.com']) 时只启用在这些域
        hostBlacklist: new Set(['gitee.com', 'github.com'])  // new Set(['admin.example.com']) 时这些域禁用
    };

    function injectModalStyles() {
        const css = `
:root {
  --card: #ffffff;
  --text: #111827;
  --border: #e5e7eb;
  --hover: #f3f4f6;
  --radius-sm: 8px;
  --radius-lg: 16px;
}

a.visited-link {
  color: #BC62C2 !important;
}

.preview-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  z-index: 9998;
  opacity: 1;
  transition: opacity 200ms ease;
}

:root[data-theme="dark"] .preview-modal-backdrop {
  background: rgba(0, 0, 0, 0.6);
}

.preview-modal-backdrop.is-hidden {
  opacity: 0;
  pointer-events: none;
}

.preview-modal-wrap {
  position: fixed;
  z-index: 9999;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.preview-modal {
  width: min(2000px, 85vw);
  height: 99vh;
  background: var(--card);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  opacity: 1;
  transform: scale(1);
  transition: opacity 200ms ease, transform 200ms ease;
}

.preview-modal.is-hidden {
  opacity: 0;
  transform: scale(0.96);
  pointer-events: none;
}

.preview-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(79, 140, 255, 0.08), transparent 60%);
  max-width: 100%;
  overflow-x: auto;
}

.preview-modal-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.preview-modal-title-text {
  font-size: 16px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-modal-title-favicon {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex: 0 0 auto;
}

.preview-modal-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  button {
    display: inline-block;
    white-space: nowrap;
  }
}

.preview-modal-copy,
.preview-modal-open,
.preview-modal-close {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  cursor: pointer;
}

.preview-modal-copy:hover,
.preview-modal-open:hover,
.preview-modal-close:hover {
  background: var(--hover);
}

.preview-modal-body {
  background: #fff;
}

.preview-modal-body iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}
`;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    function createModalStructure() {
        // 避免重复
        let backdrop = document.querySelector('.preview-modal-backdrop');
        let wrap = document.querySelector('.preview-modal-wrap');
        if (backdrop && wrap) return { backdrop, wrap };

        backdrop = document.createElement('div');
        backdrop.className = 'preview-modal-backdrop is-hidden';

        wrap = document.createElement('div');
        wrap.className = 'preview-modal-wrap';

        const modal = document.createElement('div');
        modal.className = 'preview-modal is-hidden';

        const header = document.createElement('div');
        header.className = 'preview-modal-header';

        const title = document.createElement('div');
        title.className = 'preview-modal-title';

        // 图标
        const icon = document.createElement('img');
        icon.className = 'preview-modal-title-favicon';
        icon.alt = 'favicon';

        // 文本
        const titleTextEl = document.createElement('span');
        titleTextEl.className = 'preview-modal-title-text';
        titleTextEl.textContent = '预览';

        // 插入到标题容器
        title.appendChild(icon);
        title.appendChild(titleTextEl);

        const actions = document.createElement('div');
        actions.className = 'preview-modal-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'preview-modal-copy';
        copyBtn.type = 'button';
        copyBtn.textContent = '复制链接';

        const openBtn = document.createElement('button');
        openBtn.className = 'preview-modal-open';
        openBtn.type = 'button';
        openBtn.textContent = '打开';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'preview-modal-close';
        closeBtn.type = 'button';
        closeBtn.textContent = '关闭';

        const body = document.createElement('div');
        body.className = 'preview-modal-body';

        actions.appendChild(copyBtn);
        actions.appendChild(openBtn);
        actions.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(actions);
        modal.appendChild(header);
        modal.appendChild(body);
        wrap.appendChild(modal);

        document.body.appendChild(backdrop);
        document.body.appendChild(wrap);

        // 打开动画
        requestAnimationFrame(() => {
            backdrop.classList.remove('is-hidden');
            modal.classList.remove('is-hidden');
            document.body.style.overflow = 'hidden';
        });

        // 关闭逻辑
        function destroy() {
            backdrop.classList.add('is-hidden');
            modal.classList.add('is-hidden');
            const onEnd = (e) => {
                if (e.target !== modal) return;
                modal.removeEventListener('transitionend', onEnd);
                try {
                    const iframe = body.querySelector('iframe#modal-iframe');
                    if (iframe) {
                        iframe.removeAttribute('src');
                        iframe.remove();
                    }
                    wrap.remove();
                    backdrop.remove();
                    document.body.style.overflow = ''; // 恢复滚动
                } catch { /* ignore */ }
            };
            modal.addEventListener('transitionend', onEnd, { once: true });
        }

        // 点击遮罩关闭
        backdrop.addEventListener('click', destroy);
        // 关闭按钮
        closeBtn.addEventListener('click', destroy);
        // ESC 关闭
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') destroy(); }, { once: true });
        modal.addEventListener('click', (e) => e.stopPropagation());

        // 缓存当前 URL，供“打开”按钮使用
        wrap.__modalSetTitle = (text) => { titleTextEl.textContent = String(text || '预览'); };
        wrap.__modalSetFavicon = (url) => {
            try {
                const u = new URL(url, location.href);
                icon.src = `${u.protocol}//${u.hostname}/favicon.ico`;
                icon.style.display = '';

                // 兜底：加载失败则隐藏图标或使用占位图
                icon.onerror = () => {
                    // 可选：使用占位图
                    icon.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>';
                    // 或直接隐藏
                    // icon.style.display = 'none';
                };
            } catch {
                icon.style.display = 'none';
            }
        };
        wrap.__modalSetURL = (url) => { wrap.__modalURL = url; };
        wrap.__modalBody = body;
        wrap.__modalDestroy = destroy;

        // 新窗口打开当前 URL，打开新窗口防抖，避免双击重复
        let openLock = false;
        openBtn.addEventListener('click', () => {
            if (openLock) return;
            openLock = true;
            const u = wrap.__modalURL;
            if (u) {
                // 使用 window.open 并剥离 opener
                const w = window.open(u, '_blank', 'noopener,noreferrer');
                if (w) {
                    // 某些浏览器不识别第三参数的 noopener/noreferrer，手动保护
                    try { w.opener = null; } catch { }
                }
            }
            destroy();
            setTimeout(() => { openLock = false; }, 300);
        });

        // 复制当前 URL，并防抖
        let copyLock = false;
        copyBtn.addEventListener('click', () => {
            if (copyLock) return;
            copyLock = true;
            const u = wrap.__modalURL;
            if (!u) { copyLock = false; return; };
            navigator.clipboard.writeText(u).then(() => {
                copyBtn.textContent = '已复制';
                setTimeout(() => { copyBtn.textContent = '复制链接'; copyLock = false; }, 2000);
            }).catch(() => {
                copyBtn.textContent = '复制失败';
                setTimeout(() => { copyBtn.textContent = '复制链接'; copyLock = false; }, 2000);
            });
        });

        return { backdrop, wrap };
    }

    function openModalWithURL(url, titleText) {
        try {
            const { wrap } = createModalStructure();
            wrap.__modalSetTitle(titleText || url);
            wrap.__modalSetURL(url);
            wrap.__modalSetFavicon(url);

            // 复用或创建 iframe
            let iframe = wrap.__modalBody.querySelector('iframe#modal-iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'modal-iframe';
                iframe.title = '页面预览';
                iframe.referrerPolicy = 'no-referrer';
                wrap.__modalBody.appendChild(iframe);
            }
            iframe.sandbox = sandboxForURL(url);
            iframe.src = url;
        } catch (e) {
            error('Failed to open modal preview:', e);
        }
    }

    const VISITED_KEY = 'miniPageVisitedURLs';
    const VISITED_MAX = 5000; // 最多记录多少条

    // 读取：返回 { set, list }，list 为按时间顺序的数组（旧->新）
    function loadVisited() {
        debug('Loading visited URLs from localStorage...');
        try {
            const raw = localStorage.getItem(VISITED_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            const list = Array.isArray(arr) ? arr.filter(u => typeof u === 'string' && u) : [];
            return { set: new Set(list), list };
        } catch { return { set: new Set(), list: [] }; }
    }

    // 写入：用 list 的顺序持久化（旧->新）
    function saveVisited(list) {
        try {
            localStorage.setItem(VISITED_KEY, JSON.stringify(list));
        } catch { }
    }

    // 规范化 URL：把相对链接转绝对，去掉末尾 # 与多余空白
    function normalizeURL(href) {
        if (!href) return '';
        let abs = href.trim();
        try {
            abs = new URL(href, location.href).href;
        } catch {
            // 保留原始字符串
        }
        // 可选：移除空锚点
        if (abs.endsWith('#')) abs = abs.slice(0, -1);
        return abs;
    }

    function markVisitedURL(href) {
        const url = normalizeURL(href);
        if (!url) return;
        const { set, list } = loadVisited();

        if (!set.has(url)) {
            list.push(url);         // 追加最新
            if (list.length > VISITED_MAX) {
                // 裁剪到最近 VISITED_MAX 条（保留末尾）
                const start = Math.max(0, list.length - VISITED_MAX);
                const sliced = list.slice(start);
                // 由于 slice 后仍唯一，不需要重建 set，但为了保险可以重建
                saveVisited(sliced);
                return;
            }
        }
        saveVisited(list);
    }

    function applyVisitedClasses(root = document, set = loadVisited().set) {
        if (!set || set.size === 0) return;
        let anchors = [];
        if (root.tagName === 'A') anchors = [root]; // 自身是链接
        else anchors = root.querySelectorAll('a[href]:not(.visited-link)'); // 子孙链接
        debug('Applying visited classes to anchors:', anchors, set);
        anchors.forEach(a => {
            const href = a.getAttribute('href') || '';
            const abs = normalizeURL(href);
            if (set.has(abs) || set.has(href)) {
                a.classList.add('visited-link');
            }
        });
    }

    // 统一的增量处理函数：对新增节点做访问态标记
    function applyVisitedForAddedNodes(addedNodes, set = loadVisited().set) {
        if (!addedNodes || addedNodes.length === 0) return;
        addedNodes.forEach(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            applyVisitedClasses(node, set);
        });
    }

    function currentHostAllowed() {
        const host = location.hostname;
        if (MODAL_CFG.hostWhitelist && !MODAL_CFG.hostWhitelist.has(host)) return false;
        if (MODAL_CFG.hostBlacklist && MODAL_CFG.hostBlacklist.has(host)) return false;
        return true;
    }

    function shouldInterceptLink(aEl) {
        if (!aEl || !currentHostAllowed()) return false;
        // href 必须存在
        const href = aEl.getAttribute('href') || '';
        const target = aEl.getAttribute("target") || "";
        const rel = aEl.getAttribute("rel") || "";

        if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
        if (aEl.hasAttribute("download")) return false;
        if (targetEnable && target === "_blank") return false;
        if (relEnable && rel.includes("noopener")) return false;

        // 排除 selector 命中
        if (MODAL_CFG.excludeSelectors.some(sel => aEl.closest(sel))) return false;

        // 限定容器
        if (MODAL_CFG.limitToContainers.length > 0) {
            const inContainer = MODAL_CFG.limitToContainers.some(sel => aEl.closest(sel));
            if (!inContainer) return false;
        }

        // 只拦截 http(s)
        if (MODAL_CFG.onlyHttpLinks) {
            if (!/^\/\//.test(href) && !/^\//.test(href) && !/^https?:\/\//i.test(href)) return false;
        }

        return true;
    }

    function sandboxForURL(href) {
        try {
            const host = new URL(href, location.href).hostname;
            return !MODAL_CFG.allowPopupsHosts || MODAL_CFG.allowPopupsHosts.has(host) ? MODAL_CFG.sandboxPopups : MODAL_CFG.sandboxDefault;
        } catch { return MODAL_CFG.sandboxDefault; }
    }

    function bindModalPreviewForLinks() {
        injectModalStyles();

        // 委托绑定
        document.addEventListener('click', (e) => {
            const a = e.target.closest(MODAL_CFG.linkSelector);
            if (!a) return;

            // 仅左键、无修饰键
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

            if (!shouldInterceptLink(a)) return;

            // 阻止默认跳转
            e.preventDefault();
            e.stopPropagation();

            const href = a.getAttribute('href') || '';
            if (!href) return;

            // 标记为“已访问”样式
            a.classList.add('visited-link');
            markVisitedURL(href);

            // 生成标题（优先文本）
            const titleText = (a.textContent || '').trim() || href;

            openModalWithURL(href, titleText);
        });

        // 路由变更时关闭（避免残留）
        window.addEventListener('hashchange', () => {
            const wrap = document.querySelector('.preview-modal-wrap');
            if (wrap && typeof wrap.__modalDestroy === 'function') wrap.__modalDestroy();
        });
    }

    // -------------------------------
    // Init
    // -------------------------------
    bindModalPreviewForLinks();

    // 观察目标容器；如果是全页动态，传 document.body
    const OBS_TARGET = document.body;

    // 启动 MutationObserver（在你 bindModalPreviewForLinks() 之后调用一次即可）
    function startLinkObserver() {
        const { set } = loadVisited();
        const mo = new MutationObserver((mutations) => {
            const added = [];
            mutations.forEach(m => {
                m.addedNodes && m.addedNodes.forEach(n => added.push(n));
            });
            debug('MutationObserver detected added nodes:', added);
            applyVisitedForAddedNodes(added, set);
        });
        mo.observe(OBS_TARGET, { childList: true, subtree: true });
        // 暴露停止方法
        window.__miniPreviewStopObserver = () => mo.disconnect();
    }

    // 初始化时开启
    startLinkObserver();
})();
