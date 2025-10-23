// ==UserScript==
// @name         unified pages for my favourites
// @namespace    https://rubinbaby.github.io/userscripts
// @version      0.0.2
// @description  清空目标网页并显示自己常用的网页
// @author       yinxiao
// @match        https://news.zhibo8.com/zuqiu/
// @run-at       document-start
// @updateURL    https://github.com/rubinbaby/userscripts/blob/main/unified%20pages%20for%20my%20favourites.user.js
// @downloadURL  https://github.com/rubinbaby/userscripts/blob/main/unified%20pages%20for%20my%20favourites.user.js
// @grant        GM.xmlHttpRequest
// @connect      www.nmc.cn
// ==/UserScript==

(function () {
    'use strict';

    // 等到文档可写，直接重置整个 DOM
    document.addEventListener('DOMContentLoaded', init, { once: true });
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        init();
    }

    function init() {
        // 清空原页面
        document.head.innerHTML = '';
        document.body.innerHTML = '';

        // 基础 head 内容（元信息 + 内联样式）
        const meta = document.createElement('meta');
        meta.charset = 'UTF-8';
        document.head.appendChild(meta);

        const viewport = document.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1';
        document.head.appendChild(viewport);

        const title = document.createElement('title');
        title.textContent = 'Unified Pages';
        document.head.appendChild(title);

        // 公共样式（common.css）
        const commonStyle = document.createElement('style');
        commonStyle.textContent = `
/* 通用主题变量与基础布局 */
:root {
  /* 默认主题用日间（可在JS中首次加载时覆盖） */
  --bg: #f7f9fc;
  --card: #ffffff;
  --text: #111827;
  --muted: #6b7280;
  --primary: #2563eb;
  --primary-ghost: rgba(37, 99, 235, 0.15);
  --border: #e5e7eb;
  --hover: #f3f4f6;
}

/* 夜间主题（深色系） */
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

/* 日间主题（浅色系） */
:root[data-theme="light"] {
  --bg: #f7f9fc;
  --card: #ffffff;
  --text: #111827;
  --muted: #6b7280;
  --primary: #2563eb;
  --primary-ghost: rgba(37, 99, 235, 0.15);
  --border: #e5e7eb;
  --hover: #f3f4f6;
}

/* 过渡效果更自然 */
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

/* 顶部主导航 */
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

/* 次级导航（子菜单）通用样式 */
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

/* 卡片与栅格 */
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


/* 首页差异化样式（如首页专属模块） */
.hero {
  display: grid; gap: 12px;
}


/* 体育页差异化样式 */
/* 标签样式（沿用之前） */
.list { display: grid; gap: 10px; }
.tag {
  display: inline-block; padding: 2px 8px; border: 1px dashed var(--border);
  border-radius: 999px; color: var(--muted); font-size: 12px;
}

/* 子菜单内容区布局 */
.section {
  margin-top: 16px;
}

/* 表格样式（用于赛程、积分榜） */
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
.table img{
    height: 20px;
    margin-top: -2px;
    vertical-align: middle;
}

/* 隐藏/显示辅助类 */
.hidden { display: none; }

/* 当前激活的子菜单提示（可选） */
.section.active .title {
  color: var(--primary);
}

/* 体育页过滤器 UI */
.filter-bar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  margin: 10px 0 6px;
}
#schedule-filter-input {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
}
#schedule-filter-input::placeholder { color: var(--muted); }
#schedule-filter-add {
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

/* 第三级侧边菜单 + 内容布局 */
.standing-layout, .weather-layout {
  display: grid;
  grid-template-columns: 220px 1fr; /* 左侧菜单固定宽度，右侧内容自适应 */
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

.side-title {
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 6px;
}

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

.standing-side-item:hover, .weather-side-item:hover {
  background: var(--hover);
}

.standing-side-item.active, .weather-side-item.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-ghost);
  background: linear-gradient(180deg, rgba(79,140,255,0.16), transparent 60%);
}

.standing-content, .weather-content {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0; /* iframe 占满，无需内边距 */
  overflow: hidden;
}

/* iframe 容器与尺寸 */
.sports-news-iframe-wrap,
.standing-iframe-wrap,
.global-news-iframe-wrap
,.weather-iframe-wrap {
  width: 100%;
  height: 90vh; /* 根据需要调整显示高度 */
  background: #fff;
  overflow: hidden;
  border-radius: 12px;
}

.sports-news-iframe-wrap iframe,
.standing-iframe-wrap iframe,
.global-news-iframe-wrap iframe,
.weather-iframe-wrap iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

/* 移动端：侧边菜单与内容纵向堆叠 */
@media (max-width: 768px) {
  .standing-layout {
    grid-template-columns: 1fr;
  }
}
    `;
        document.head.appendChild(commonStyle);

        // 构建体育板块 HTML
        const root = document.createElement('div');
        root.className = 'container';
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
    <a class="subtab" href="#sports-standing" data-subtab="sports-standing">积分排名</a>
  </div>

  <!-- 子菜单内容：赛程 -->
      <div id="section-schedule" class="section">
        <h2 class="title">近期赛程</h2>

        <!-- 过滤区：输入框 + 添加按钮 + 已选标签 -->
        <div id="schedule-filter-bar" class="filter-bar" role="group" aria-label="赛程过滤器">
          <input id="schedule-filter-input" type="text" placeholder="输入过滤词（如：篮球、蒙BA、乌兰察布队）后回车或点添加" />
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
          <tbody>
            <!-- JS 动态填充 -->
          </tbody>
        </table>
      </div>

      <!-- 子菜单内容：新闻 -->
      <div id="section-news" class="section hidden">
        <h2 class="title">足球新闻</h2>
        <div class="sports-news-content">
            <!-- JS 动态创建/销毁 iframe；此处不预置固定 iframe -->
            <div class="sports-news-iframe-wrap"></div>
        </div>
      </div>

      <!-- 子菜单内容：积分排名 -->
      <div id="section-standing" class="section hidden">
        <h2 class="title">积分排名</h2>

        <div class="standing-layout">
          <!-- 左侧第三级侧边菜单 -->
          <nav class="standing-side" aria-label="积分排名第三级菜单">
            <div class="side-title">联赛与杯赛</div>

            <!-- 英超 -->
            <button class="standing-side-item active" type="button" data-key="epl"
              data-url="https://data.zhibo8.cc/html/match.html?match=英超&saishi=24">
              英超
            </button>

            <!-- 英足总杯 -->
            <button class="standing-side-item" type="button" data-key="facup"
              data-url="https://data.zhibo8.cc/html/match.html?match=足总杯&saishi=21">
              英足总杯
            </button>

            <button class="standing-side-item" type="button" data-key="facup"
              data-url="https://data.zhibo8.cc/html/match.html?match=英格兰联赛杯&saishi=221">
              英联赛杯
            </button>

            <button class="standing-side-item" type="button" data-key="facup"
              data-url="https://data.zhibo8.cc/html/match.html?match=欧冠&saishi=371">
              欧冠
            </button>

            <button class="standing-side-item" type="button" data-key="facup"
              data-url="https://data.zhibo8.cc/html/match.html?match=欧联杯&saishi=369">
              欧联
            </button>

            <button class="standing-side-item" type="button" data-key="facup"
              data-url="https://data.zhibo8.cc/html/match.html?match=欧协联&saishi=3002">
              欧协联
            </button>

            <button class="standing-side-item" type="button" data-key="facup"
              data-url="https://data.zhibo8.cc/html/match.html?match=欧洲超级杯&saishi=370">
              欧超杯
            </button>

            <button class="standing-side-item" type="button" data-key="facup"
              data-url="https://data.zhibo8.cc/html/match.html?match=世俱杯&saishi=7">
              世俱杯
            </button>

            <button class="standing-side-item" type="button" data-key="facup"
              data-url="https://data.zhibo8.cc/html/match.html?match=欧洲杯&saishi=372">
              欧洲杯
            </button>

            <button class="standing-side-item" type="button" data-key="facup"
              data-url="https://data.zhibo8.cc/html/match.html?match=世界杯&saishi=4">
              世界杯
            </button>
          </nav>

          <!-- 右侧内容区的 iframe 容器 -->
          <div class="standing-content">
            <!-- JS 动态创建/销毁 iframe；此处不预置固定 iframe -->
            <div class="standing-iframe-wrap"></div>
          </div>
        </div>
      </div>
</section>

<section id="global-news" class="card">
    <div class="global-news-content">
        <!-- JS 动态创建/销毁 iframe；此处不预置固定 iframe -->
        <div class="global-news-iframe-wrap"></div>
    </div>
</section>

<section id="weather" class="card">
    <div class="subnav" aria-label="天气子菜单">
        <!-- 天气预报 -->
        <button class="weather-side-item active" type="button" data-key="tianqiyubao"
            data-url="https://www.nmc.cn/publish/forecast/ASH/fengxian.html">
            天气预报
        </button>

        <!-- 雷达图 -->
        <button class="weather-side-item" type="button" data-key="facup"
            data-url="https://www.nmc.cn/publish/radar/shang-hai/qing-pu.htm">
            雷达图
        </button>

        <button class="weather-side-item" type="button" data-key="facup"
            data-url="https://www.nmc.cn/publish/typhoon/probability-img2.html">
            台风
        </button>
    </div>
    <div class="weather-content">
        <!-- JS 动态创建/销毁 iframe；此处不预置固定 iframe -->
        <div class="weather-iframe-wrap"></div>
    </div>
</section>

<section id="about" class="card">
    <h1>关于</h1>
    <p class="about-note">这是一个使用多个 HTML 文件实现“标签页跳转”的示例。每个标签是一个 a 链接，点击后跳转到对应页面。</p>
</section>
    `;
        document.body.appendChild(root);

        // 内联脚本（子菜单、过滤、iframe 资源管理）
        setupScripts();
    }

    function setupScripts() {
        let ALL_ROWS = [];                  // 全量赛程缓存
        let ACTIVE_TAGS = new Set();        // 当前过滤标签集合
        const STORAGE_KEY = 'sportsFilterTags';
        const SITE_THEME_STORAGE_KEY = 'siteThemePreference'; // 'light' | 'dark' | 'auto'
        const CHECK_INTERVAL_MS = 30 * 60 * 1000;       // 每30分钟检查一次

        init();

        function init() {
            // 初始应用主题
            getPreferredTheme().then(theme => applyTheme(theme));
            // 定时按自动模式更新
            setInterval(() => {
                const pref = loadPreference();
                if (pref === 'auto' || !pref) {
                    decideThemeByTimeAndTide().then(theme => {
                        applyTheme(theme);
                    });
                }
            }, CHECK_INTERVAL_MS);

            // 可选：提供简单的 UI 控件（放在页面右上角）
            mountThemeSwitchUI();

            document.querySelector('.nav')?.addEventListener('click', (e) => {
                const a = e.target.closest('.tab');
                if (!a) return;
                e.preventDefault();
                const key = a.dataset.tab;
                document.querySelectorAll('.nav .tab').forEach(t => t.classList.toggle('active', t === a));
                if (key === 'home') {
                    location.hash = '#home';
                } else if (key === 'global-news') {
                    location.hash = '#global-news'; // 复用已有新闻子菜单区
                } else if (key === 'sports') {
                    location.hash = '#sports-news';
                } else if (key === 'weather') {
                    location.hash = '#weather';
                } else if (key === 'about') {
                    location.hash = '#about';
                }
            });

            const tabs = Array.from(document.querySelectorAll('.nav .tab'));
            const subTabs = Array.from(document.querySelectorAll('.subnav .subtab'));
            const sectionEles = Array.from(document.querySelectorAll('section.card'));
            const sections = {
                "sports-schedule": document.getElementById('section-schedule'),
                "sports-news": document.getElementById('section-news'),
                "sports-standing": document.getElementById('section-standing'),
            };

            function setActive(name) {
                tabs.forEach(t => t.classList.toggle('active', name.startsWith(t.dataset.tab)));
                subTabs.forEach(t => t.classList.toggle('active', t.dataset.subtab === name));
                sectionEles.forEach(t => t.classList.toggle('hidden', !name.startsWith(t.id)));
                Object.entries(sections).forEach(([key, el]) => {
                    if (!el) return;
                    const show = key === name;
                    el.classList.toggle('hidden', !show);
                    el.classList.toggle('active', show);
                });
            }

            // 子菜单点击 → 更新哈希（统一通过 hashchange 刷新页面）
            document.querySelector('.subnav')?.addEventListener('click', (e) => {
                const a = e.target.closest('a.subtab');
                if (!a) return;
                e.preventDefault();
                const name = a.dataset.subtab;
                if (!name) return;
                location.hash = `#${name}`;
            });

            function initFromHash() {
                const hash = (location.hash || '#sports-news').slice(1);
                const valid = ['home', 'sports-schedule', 'sports-news', 'sports-standing', 'global-news', 'weather', 'about'];
                const name = valid.includes(hash) ? hash : 'home';
                setActive(name);
                refreshSection(name); // 切换时刷新对应页面
            }

            window.addEventListener('hashchange', initFromHash);
            initFromHash();
        }

        // 站内同源嵌入地址（用你的后端代理或页面），不要写未提供的外链
        const STANDING_DEFAULT_URL = 'https://data.zhibo8.cc/html/match.html?match=英超&saishi=24';

        // 创建并加载积分排名 iframe
        function ensureStandingIframe(url) {
            const wrap = document.querySelector('#section-standing .standing-iframe-wrap');
            if (!wrap) return;

            // 如果已存在，且 URL 与目标一致，则不重复加载
            let iframe = wrap.querySelector('iframe#standing-iframe');
            if (iframe && iframe.dataset.src === url) return;

            // 如已存在但 URL 不同，先销毁，再重建
            if (iframe) {
                destroyIframe();
            }

            iframe = document.createElement('iframe');
            iframe.id = 'standing-iframe';
            iframe.title = '积分排名';
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'no-referrer';
            // 如需在 iframe 内允许脚本/同源访问/弹窗，请设置 sandbox
            iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';

            // 记录源，便于判断是否需要重载
            iframe.dataset.src = url;
            iframe.src = url;

            wrap.appendChild(iframe);
        }

        // 释放 iframe 资源
        function destroyIframe(selector = '#section-standing iframe#standing-iframe') {
            const iframe = document.querySelector(selector);
            if (!iframe) return;
            try {
                iframe.removeAttribute('src'); // 先断开加载
                iframe.remove();               // 再移除 DOM
            } catch (e) {
                iframe.parentNode && iframe.parentNode.removeChild(iframe);
            }
        }

        // 侧边菜单点击：高亮项并加载对应 URL
        function bindStandingSideMenu() {
            const menu = document.querySelector('#section-standing .standing-side');
            if (!menu) return;

            menu.addEventListener('click', (e) => {
                const btn = e.target.closest('.standing-side-item');
                if (!btn) return;

                // 高亮当前项
                menu.querySelectorAll('.standing-side-item').forEach(el => el.classList.toggle('active', el === btn));

                // 读取 data-url 并加载
                const url = btn.dataset.url || STANDING_DEFAULT_URL;
                ensureStandingIframe(url);
            });
        }

        // 根据子菜单刷新对应页面
        function refreshSection(name) {
            // 当离开「新闻」子菜单时，主动释放 iframe 资源；再次切回「新闻」时会重建/重新加载
            if (name !== 'sports-news') {
                destroyIframe('#section-news iframe#sports-news-iframe');
            }

            if (name !== 'global-news') {
                destroyIframe('section#global-news iframe#global-news-iframe');
            }

            if (name !== 'weather') {
                destroyIframe('section#weather iframe#weather-iframe');
            }

            if (name === 'sports-schedule') {
                const tbody = document.querySelector('#section-schedule .table tbody');
                // 先恢复过滤标签并渲染标签 UI（不依赖赛程数据）
                setupInputTagFilter();

                // 可选：若希望每次切换都重新获取赛程，取消注释
                if (tbody) {
                    hydrateScheduleForNextMonth();
                }
            } else if (name === 'sports-news') {
                const url = 'https://news.zhibo8.com/zuqiu/more.htm?label=%E6%9B%BC%E8%81%94';
                ensureSportsNewsIframe(url);
            } else if (name === 'sports-standing') {
                // 初始高亮项（如果没有 active，则默认选第一个）
                const first = document.querySelector('#section-standing .standing-side-item.active')
                    || document.querySelector('#section-standing .standing-side-item');
                const url = first ? (first.dataset.url || STANDING_DEFAULT_URL) : STANDING_DEFAULT_URL;

                // 加载默认或当前选中的页面
                ensureStandingIframe(url);

                // 绑定侧边菜单点击（只需绑定一次，事件代理不重复）
                bindStandingSideMenu();
            }
            else if (name === 'global-news') {
                const url = 'https://www.kankanews.com/k24';
                ensureGlobalNewsIframe(url);
            } else if (name === 'weather') {
                // const url = 'https://www.nmc.cn/publish/forecast/ASH/fengxian.html';
                // ensureWeatherIframe(url);

                // 初始高亮项（如果没有 active，则默认选第一个）
                const first = document.querySelector('section#weather .weather-side-item.active')
                    || document.querySelector('section#weather .weather-side-item');
                const url = first ? (first.dataset.url || WEATHER_DEFAULT_URL) : WEATHER_DEFAULT_URL;

                // 加载默认或当前选中的页面
                ensureWeatherIframe(url);

                // 绑定侧边菜单点击（只需绑定一次，事件代理不重复）
                bindWeatherSideMenu();
            }
        }

        // 创建并加载体育新闻 iframe
        function ensureSportsNewsIframe(url) {
            const wrap = document.querySelector('#section-news .sports-news-iframe-wrap');
            if (!wrap) return;

            let iframe = document.createElement('iframe');
            iframe.id = 'sports-news-iframe';
            iframe.title = '体育新闻';
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'no-referrer';
            // 如需在 iframe 内允许脚本/同源访问/弹窗，请设置 sandbox
            iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';

            // 记录源，便于判断是否需要重载
            iframe.dataset.src = url;
            iframe.src = url;

            wrap.appendChild(iframe);
        }

        function scrollInto(selector) {
            const el = document.querySelector(selector);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // 拉取并渲染未来一个月赛程（应用 ACTIVE_TAGS）
        async function hydrateScheduleForNextMonth() {
            const section = document.getElementById('section-schedule');
            if (!section) return;
            const tbody = section.querySelector('.table tbody');
            const titleEl = section.querySelector('.title');
            if (!tbody) return;

            const statusEl = document.createElement('div');
            statusEl.style.marginTop = '8px';
            statusEl.style.color = 'var(--muted)';
            section.insertBefore(statusEl, section.querySelector('.table'));
            statusEl.textContent = '正在加载未来一个月赛程…';

            const startDate = new Date();
            const endDate = addDays(startDate, 30);
            const dateList = enumerateDates(startDate, endDate);

            // 请替换为真实接口地址；若有跨域限制需代理
            const makeUrl = (dateStr) => `https://api.qiumibao.com/application/saishi/index.php?_url=/getMatchByDate&date=${encodeURIComponent(dateStr)}&index_v2=1&_env=pc&_platform=pc`;

            const batchSize = 6;
            const allResults = [];
            try {
                for (let i = 0; i < dateList.length; i += batchSize) {
                    const batch = dateList.slice(i, i + batchSize);
                    const batchPromises = batch.map(async (d) => {
                        try {
                            const res = await fetchWithTimeout(makeUrl(d), { method: 'GET', headers: { 'Accept': 'application/json' } }, 12000);
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            const json = await res.json();
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
                statusEl.textContent = `加载失败：${err.message}`;
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
                        liveHtmls: parsed.liveHtmls || []
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

            // 应用当前过滤标签
            const filtered = filterRowsByInputTags(ALL_ROWS, Array.from(ACTIVE_TAGS));
            renderScheduleTable(tbody, filtered);
            statusEl.textContent = '';
        }

        // 输入框 + 添加按钮 + 标签 UI 与逻辑（含 storage 持久化）
        function setupInputTagFilter() {
            const inputEl = document.getElementById('schedule-filter-input');
            const addBtn = document.getElementById('schedule-filter-add');
            const tagsEl = document.getElementById('schedule-filter-tags');
            const tbody = document.querySelector('#section-schedule .table tbody');

            if (!inputEl || !addBtn || !tagsEl || !tbody) return;

            // 恢复标签（storage）
            const savedTags = loadTagsFromStorage();
            savedTags.forEach(t => ACTIVE_TAGS.add(t));
            drawTags(); // 先画 UI

            function addTagFromInput() {
                const val = (inputEl.value || '').trim();
                if (!val) return;
                const normalized = normalizeTag(val);
                if (ACTIVE_TAGS.has(normalized)) {
                    inputEl.value = '';
                    return;
                }
                ACTIVE_TAGS.add(normalized);
                inputEl.value = '';
                saveTagsToStorage(Array.from(ACTIVE_TAGS));
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
                    const hint = document.createElement('span');
                    hint.className = 'filter-hint';
                    hint.textContent = '未添加过滤标签：当前显示全部赛程';
                    tagsEl.appendChild(hint);
                    return;
                }
                ACTIVE_TAGS.forEach((tag) => {
                    const chip = document.createElement('span');
                    chip.className = 'filter-chip';
                    chip.textContent = tag;
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'filter-chip-remove';
                    removeBtn.setAttribute('aria-label', `移除过滤标签 ${tag}`);
                    removeBtn.textContent = '×';
                    removeBtn.addEventListener('click', () => {
                        ACTIVE_TAGS.delete(tag);
                        saveTagsToStorage(Array.from(ACTIVE_TAGS));
                        drawTags();
                        applyFilter();
                    });
                    chip.appendChild(removeBtn);
                    tagsEl.appendChild(chip);
                });

                const clearBtn = document.createElement('button');
                clearBtn.className = 'filter-clear';
                clearBtn.textContent = '清空标签';
                clearBtn.addEventListener('click', () => {
                    ACTIVE_TAGS.clear();
                    saveTagsToStorage([]);
                    drawTags();
                    applyFilter();
                });
                tagsEl.appendChild(clearBtn);
            }

            function applyFilter() {
                const arrTags = Array.from(ACTIVE_TAGS);
                const filtered = filterRowsByInputTags(ALL_ROWS, arrTags);
                renderScheduleTable(tbody, filtered);
            }
        }

        // 过滤（OR 逻辑：命中任一标签即保留）
        function filterRowsByInputTags(rows, tags) {
            if (!tags || tags.length === 0) return rows;
            const normTags = tags.map(normalizeTag);
            return rows.filter((r) => {
                const rowLabels = (r.labels || []).map(normalizeTag);
                return normTags.some(tag => rowLabels.some(l => l === tag || l.toLowerCase() === tag.toLowerCase()
                    //  || l.includes(tag) || tag.includes(l)
                ));
            });
        }

        function renderScheduleTable(tbody, rows) {
            tbody.innerHTML = '';
            if (!rows || rows.length === 0) {
                const tr = document.createElement('tr');
                const tdEl = document.createElement('td');
                tdEl.colSpan = 5;
                tdEl.textContent = '未找到匹配的赛程';
                tr.appendChild(tdEl);
                tbody.appendChild(tr);
                return;
            }
            rows.forEach((r) => {
                const tr = document.createElement('tr');
                tr.appendChild(td(`${r.date} ${r.time || ''}`.trim(), ''));
                tr.appendChild(td(r.tournament || '-', ''));
                const tdMatchup = document.createElement('td');
                tdMatchup.style.whiteSpace = 'pre-wrap';
                tdMatchup.innerHTML = r.matchupHtml || '-';
                tr.appendChild(tdMatchup);

                const tdLive = document.createElement('td');
                tdLive.style.whiteSpace = 'pre-wrap';
                tdLive.innerHTML = r.liveHtmls.join('') || '-';
                tr.appendChild(tdLive);
                tbody.appendChild(tr);
            });

            function td(text, cls) {
                const el = document.createElement('td');
                if (cls === 'prewrap') el.style.whiteSpace = 'pre-wrap';
                el.textContent = text;
                return el;
            }
        }

        // 解析单条 li 片段，附带 label 列表
        function parseLiEntry(liHtml) {
            if (typeof liHtml !== 'string') return null;
            const wrapper = document.createElement('div');
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
            let matchupHtml = '';
            if (teamsEl) {
                matchupHtml = teamsEl.innerHTML.trim().replaceAll("//", "https://");
            }

            const labelAttr = li.getAttribute('label') || '';
            const labels = labelAttr.split(',').map(s => s.trim()).filter(Boolean);

            const liveHtmls = getAllAnchorHTMLByKeywords(li);

            return { time, tournament, matchupHtml, labels, liveHtmls };
        }

        function getAllAnchorHTMLByKeywords(liElement, keywords = ['互动直播', '文字']) {
            if (!liElement) return [];
            const anchors = liElement.querySelectorAll('a');
            const newAnchors = [];
            for (const a of anchors) {
                const html = (a.innerHTML || '').trim();
                if (keywords.some(kw => html.includes(kw))) {
                    return newAnchors;
                }
                newAnchors.push(a.outerHTML.trim().replaceAll('/zhibo', 'https://www.zhibo8.com/zhibo'));
            }
            return newAnchors;
        }

        // 统一响应
        function normalizeDailyEntries(json, dateStr, key = "data") {
            if (!json) return { date: dateStr, entries: [] };
            if (Array.isArray(json)) return { date: dateStr, entries: json };
            if (json[key]) {
                if (Array.isArray(json[key])) return { date: dateStr, entries: json[key] };
                if (typeof json[key] === 'object' && Array.isArray(json[key][dateStr])) {
                    return { date: dateStr, entries: json[key][dateStr] };
                }
                if (typeof json[key] === 'object') {
                    const merged = Object.values(json[key]).flat().filter((x) => typeof x === 'string');
                    return { date: dateStr, entries: merged };
                }
            }
            return { date: dateStr, entries: [] };
        }

        // fetch + 超时
        function fetchWithTimeout(url, options, ms) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), ms);
            return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
        }

        // 日期工具
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

        function addDays(date, days) {
            const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            d.setDate(d.getDate() + days);
            return d;
        }

        function formatDate(d) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }

        function normalizeTag(s) {
            return String(s).trim();
        }

        // 持久化：保存/加载过滤标签
        function saveTagsToStorage(tags) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
            } catch (e) {
                // 忽略 storage 写入错误
            }
        }

        function loadTagsFromStorage() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return [];
                const arr = JSON.parse(raw);
                return Array.isArray(arr) ? arr.map(normalizeTag).filter(Boolean) : [];
            } catch (e) {
                return [];
            }
        }

        // 创建并加载全球新闻 iframe
        function ensureGlobalNewsIframe(url) {
            const wrap = document.querySelector('section#global-news .global-news-iframe-wrap');
            if (!wrap) return;

            let iframe = document.createElement('iframe');
            iframe.id = 'global-news-iframe';
            iframe.title = '全球新闻';
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'no-referrer';
            // 如需在 iframe 内允许脚本/同源访问/弹窗，请设置 sandbox
            iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';

            // 记录源，便于判断是否需要重载
            iframe.dataset.src = url;
            iframe.src = url;

            wrap.appendChild(iframe);
        }

        // 站内同源嵌入地址（用你的后端代理或页面），不要写未提供的外链
        const WEATHER_DEFAULT_URL = 'https://www.nmc.cn/publish/forecast/ASH/fengxian.html';

        // 创建并加载天气 iframe
        function ensureWeatherIframe(url) {
            const wrap = document.querySelector('section#weather .weather-iframe-wrap');
            if (!wrap) return;

            // 如果已存在，且 URL 与目标一致，则不重复加载
            let iframe = wrap.querySelector('iframe#weather-iframe');
            if (iframe && iframe.dataset.src === url) return;

            // 如已存在但 URL 不同，先销毁，再重建
            if (iframe) {
                destroyIframe('section#weather iframe#weather-iframe');
            }

            iframe = document.createElement('iframe');
            iframe.id = 'weather-iframe';
            iframe.title = '天气';
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'no-referrer';
            // 如需在 iframe 内允许脚本/同源访问/弹窗，请设置 sandbox
            iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';

            // 记录源，便于判断是否需要重载
            iframe.dataset.src = url;
            iframe.src = url;

            wrap.appendChild(iframe);
        }

        // 侧边菜单点击：高亮项并加载对应 URL
        function bindWeatherSideMenu() {
            const menu = document.querySelector('section#weather .subnav');
            if (!menu) return;

            menu.addEventListener('click', (e) => {
                const btn = e.target.closest('.weather-side-item');
                if (!btn) return;

                // 高亮当前项
                menu.querySelectorAll('.weather-side-item').forEach(el => el.classList.toggle('active', el === btn));

                // 读取 data-url 并加载
                const url = btn.dataset.url || WEATHER_DEFAULT_URL;
                ensureWeatherIframe(url);
            });
        }

        // 读取用户偏好：'light' | 'dark' | 'auto' | null
        function loadPreference() {
            try {
                const v = localStorage.getItem(SITE_THEME_STORAGE_KEY);
                return v || null;
            } catch {
                return null;
            }
        }

        // 保存用户偏好
        function savePreference(v) {
            try { localStorage.setItem(SITE_THEME_STORAGE_KEY, v); } catch { }
        }

        // 获取最终应该应用的主题（包含用户偏好与自动模式）
        async function getPreferredTheme() {
            const pref = loadPreference();
            if (pref === 'light' || pref === 'dark') return pref;
            // 默认与 'auto' 模式
            const theme = await decideThemeByTimeAndTide();
            return theme;
        }

        // 应用主题到 :root
        function applyTheme(theme) {
            const root = document.documentElement;
            if (!root) return;
            console.log('Applying theme:', theme);
            const t = theme === 'dark' ? 'dark' : 'light';
            root.setAttribute('data-theme', t);
        }

        // 时间 + 日出日落决定主题
        async function decideThemeByTimeAndTide() {
            // 1) 时间段判断：夜间 19:00-06:00 用深色，其余浅色
            const now = new Date();
            const hour = now.getHours();
            const byTime = (hour >= 19 || hour < 6) ? 'dark' : 'light';

            // 2) 日出日落辅助判断（可覆盖 byTime）
            // 示例：如果 tideThemeForNow 返回 'dark' 或 'light'，用它；返回 null 则用 byTime
            const byTide = await tideThemeForNow(now);
            console.log({ byTime, byTide }, byTide || byTime);
            return byTide || byTime;
        }

        // GM.xmlHttpRequest wrapped in a Promise
        function promiseRequest(config) {
            return new Promise((resolve, reject) => {
                GM.xmlHttpRequest({
                    ...config,
                    onload: res => {
                        try {
                            resolve(res.responseText || '');
                        } catch (err) {
                            reject(new Error(`JSON parser failed: ${err.message}`));
                        }
                    },
                    onerror: err => {
                        console.error('Request error:', err);
                        reject(new Error('Network error'));
                    },
                    timeout: 5000,
                    ontimeout: () => {
                        console.warn('Request timeout:', config.url);
                        reject(new Error('Request timeout'));
                    }
                });
            });
        }

        function extractSunHours(json) {
            if (!json || !json.data || !json.data.real || !json.data.real.sunriseSunset) {
                return { sunriseHour: null, sunsetHour: null };
            }
            const { sunrise, sunset } = json.data.real.sunriseSunset;

            // sunrise / sunset 示例："2025-10-23 06:02" 或 "06:02"
            const parseHour = (t) => {
                if (!t || typeof t !== 'string') return null;
                // 提取 HH:mm（兼容前面带日期的格式）
                const m = t.match(/(\d{2}):\d{2}$/);
                if (!m) return null;
                const hh = Number(m[1]);
                return Number.isFinite(hh) ? hh : null;
            };

            return {
                sunriseHour: parseHour(sunrise),
                sunsetHour: parseHour(sunset),
            };
        }

        // 返回 'dark' | 'light' | null（null 表示不覆盖时间判定）
        async function tideThemeForNow(now) {
            const apiUrl = 'https://www.nmc.cn/rest/weather?stationid=BOoen&_=1761204272212';
            const res = await promiseRequest({ url: apiUrl, method: 'GET' });
            const json = JSON.parse(res);
            const { sunriseHour, sunsetHour } = extractSunHours(json);
            const hour = now.getHours();
            const byTime = (hour >= sunsetHour || hour < sunriseHour) ? 'dark' : 'light';
            return byTime;
        }

        // 简单的 UI：让用户手动选择 Light/Dark/Auto，并立即应用
        function mountThemeSwitchUI() {
            const bar = document.createElement('div');
            bar.style.position = 'fixed';
            bar.style.top = '24px';
            bar.style.right = '6px';
            bar.style.zIndex = '9999';
            bar.style.flexDirection = 'column';
            bar.style.display = 'flex';
            bar.style.gap = '6px';
            bar.style.padding = '6px 8px';
            bar.style.borderRadius = '8px';
            bar.style.border = '1px solid var(--border)';
            bar.style.background = 'var(--card)';
            bar.style.color = 'var(--text)';
            bar.style.fontSize = '12px';
            bar.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
            bar.setAttribute('aria-label', '主题切换');

            const btnLight = makeBtn('浅色', () => { savePreference('light'); applyTheme('light'); });
            const btnDark = makeBtn('深色', () => { savePreference('dark'); applyTheme('dark'); });
            const btnAuto = makeBtn('自动', () => {
                savePreference('auto');
                decideThemeByTimeAndTide().then(theme => {
                    applyTheme(theme);
                });
            });

            bar.appendChild(btnLight);
            bar.appendChild(btnDark);
            bar.appendChild(btnAuto);

            document.body.appendChild(bar);

            function makeBtn(text, onClick) {
                const b = document.createElement('button');
                b.textContent = text;
                b.style.padding = '4px 8px';
                b.style.border = '1px solid var(--border)';
                b.style.borderRadius = '6px';
                b.style.background = 'transparent';
                b.style.color = 'var(--text)';
                b.style.cursor = 'pointer';
                b.addEventListener('click', onClick);
                b.addEventListener('mouseenter', () => { b.style.background = 'var(--hover)'; });
                b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
                return b;
            }
        }
    }
})();
