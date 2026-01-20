// ==UserScript==
// @name        页面元素优化
// @match       *://*.kankanews.com/k24
// @match       *://*.kankanews.com/detail/*
// @match       *://zq.titan007.com/cn/*
// @match       *://*.zhibo8.com/*
// @match       *://*.zhibo8.cc/*
// @author      yinxiao
// @version     0.0.4
// @description 多个页面元素优化
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/hightlight%20kankanews.user.js
// @downloadURL https://github.com/rubinbaby/userscripts/blob/main/hightlight%20kankanews.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Your code here...
    const stringContains = (str, substring) => str && substring && str.indexOf(substring) !== -1;
    const changeElementProperty = (selector, property, value) => {
        const ele = document.querySelector(selector);
        if (ele) {
            ele.style[property] = value;
        }
    };
    const changeElementDisplay = (selector, display) => {
        changeElementProperty(selector, 'display', display);
    };
    const hideElement = (selector) => {
        changeElementDisplay(selector, 'none');
    };
    const unsetElementWidth = (selector) => {
        changeElementProperty(selector, 'width', 'unset');
    };

    const domain = window.location.hostname;
    const pathname = window.location.pathname;
    let zoom;
    if (stringContains(domain, 'zq.titan007.com')) {
        hideElement('.navigationMenu');
        hideElement('.sitenav-secondary-wrap');
        hideElement('#lang');
        unsetElementWidth('#info');
        hideElement('#info #left');
        unsetElementWidth('#info #i_main');
        changeElementDisplay('#info #i_main', 'block');
        hideElement('#bottom');
    }

    if (stringContains(domain, 'kankanews.com')) {
        hideElement('header');
        if (stringContains(pathname, '/k24')) {
            zoom = 1.2;
            changeElementProperty('.k24 .k24-list', 'zoom', zoom);
            changeElementProperty('.k24', 'margin', 'unset');
            changeElementProperty('.k24', 'padding', 'unset');
            changeElementProperty('.k24 .k24-content', 'gridColumn', '1/8');
            changeElementProperty('.k24 .k24-aside', 'gridColumn', '8/11');
        }
        if (stringContains(pathname, '/detail/')) {
            hideElement('.detail-bottom');
        }
    }

    if (stringContains(domain, 'zhibo8.com') || stringContains(domain, 'zhibo8.cc')) {
        zoom = 1;
        if (stringContains(domain, 'zhibo8.com')) zoom = 1.25;
        if (stringContains(pathname, '/zuqiu/more.htm')) zoom = 1.5;
        if (stringContains(pathname, '/zuqiu/') &&
            (stringContains(pathname, 'native.htm') || stringContains(pathname, 'video.htm'))) {
            zoom = 1.4;
            hideElement('.menu');
            hideElement('.container #siderbar');
            hideElement('.footer.container');
            hideElement('.advertframe');
            changeElementProperty('.container.margin_top_20', 'marginTop', '0px');
            changeElementProperty('.container.margin_top_20', 'width', '720px');
            unsetElementWidth('#main');
            unsetElementWidth('#main .box');
        }

        // if (stringContains(pathname, 'html/match.html')) {
        //     zoom = 1.1;
        //     hideElement('.menu');
        //     hideElement('.main .tb-tlt');
        // }
        document.querySelectorAll('.container').forEach(el => el.style.zoom = zoom);

        // Remove QR code if present
        hideElement('.qrcode');

        // Remove header if present
        hideElement('div#header');
    }
})();