// ==UserScript==
// @name        Lite Add button for Smooth Scroll to the top and bottom
// @description 为页面添加按钮，平滑的滚动到顶部/底部
// @match       *://*/*
// @author yinxiao
// @version      0.2.0
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/Lite%20Add%20button%20for%20Smooth%20Scroll%20to%20the%20top%20and%20bottom.user.js
// @downloadURL https://github.com/rubinbaby/userscripts/blob/main/Lite%20Add%20button%20for%20Smooth%20Scroll%20to%20the%20top%20and%20bottom.user.js
// ==/UserScript==
// 
//=======快捷键======
//alt+1>>>>>>回到顶部
//alt+2>>>>>>去到底部
//================公共函数区============
(function () {
    // Inject styles
    const css = `
    #scrollMars-troy {
        width: 100px;
        position: fixed;
        right: -75px;
        z-index: 9999999;
        top: 33%;
        display: flex;
        flex-direction: column;
        gap: 10px;
        opacity: 0.3;
        transition: right 0.4s cubic-bezier(.4,0,.2,1), opacity 0.3s;
        pointer-events: auto;
    }
    #scrollMars-troy.visible {
        right: -35px;
        opacity: 1;
    }
    .sroll-btn-troy {
        width: 50px;
        height: 50px;
        text-align: center;
        background: #303030;
        color: #fff;
        opacity: 0.8;
        cursor: pointer;
        border-radius: 50%;
        box-shadow: 2px 2px 40px 2px #303030;
        line-height: 50px;
        font-size: 35px;
        font-weight: bold;
        font-family: "宋体";
        user-select: none;
        transition: background 0.2s;
    }
    .sroll-btn-troy:hover {
        background: #FF0000;
    }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    let hideTimer = null;

    function showButtons() {
        const container = document.getElementById('scrollMars-troy');
        if (!container) return;
        container.classList.add('visible');
        if (hideTimer) clearTimeout(hideTimer);

    }

    function hideButtons() {
        const container = document.getElementById('scrollMars-troy');
        if (!container) return;
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            container.classList.remove('visible');
        }, 3000);
    }

    function createScrollButtons() {
        if (document.getElementById('scrollMars-troy')) return;
        if (document.documentElement.scrollHeight <= document.documentElement.clientHeight) return;

        const container = document.createElement('div');
        container.id = 'scrollMars-troy';
        container.className = 'visible';

        const btnTop = document.createElement('div');
        btnTop.className = 'sroll-btn-troy';
        btnTop.innerText = '↑';
        btnTop.title = '返回顶部';
        btnTop.setAttribute('aria-label', 'Scroll to top');
        btnTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

        const btnBottom = document.createElement('div');
        btnBottom.className = 'sroll-btn-troy';
        btnBottom.innerText = '↓';
        btnBottom.title = '去到底部';
        btnBottom.setAttribute('aria-label', 'Scroll to bottom');
        btnBottom.onclick = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });

        container.appendChild(btnTop);
        container.appendChild(btnBottom);
        document.body.appendChild(container);

        // Mouse events for fade in/out and slide animation
        container.addEventListener('mouseenter', showButtons);
        container.addEventListener('mouseleave', hideButtons);

        // Show on creation, then fade out after 3s
        //showButtons();
        hideButtons();
    }

    // Recreate buttons on resize
    window.addEventListener('resize', () => {
        const el = document.getElementById('scrollMars-troy');
        if (el) el.remove();
        createScrollButtons();
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === '1' || e.keyCode === 49)) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            showButtons();
        } else if (e.altKey && (e.key === '2' || e.keyCode === 50)) {
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
            showButtons();
        }
    });

    // Init
    document.addEventListener('DOMContentLoaded', createScrollButtons);
    createScrollButtons();
})();