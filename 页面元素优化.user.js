// ==UserScript==
// @name        页面元素优化
// @match       *://*.kankanews.com/k24
// @match       *://zq.titan007.com/cn/*
// @author      yinxiao
// @version     0.0.3
// @description 多个页面元素优化
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/hightlight%20kankanews.user.js
// @downloadURL https://github.com/rubinbaby/userscripts/blob/main/hightlight%20kankanews.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Your code here...
    const stringContains = (str, substring) => str && substring && str.indexOf(substring) !== -1;

    const domain = window.location.hostname;
    if (stringContains(domain, 'zq.titan007.com')) {
        var navigationMenuEle = document.querySelector('.navigationMenu');
        if (navigationMenuEle) {
            navigationMenuEle.setAttribute("style", "display:none");
        }
        var siteNavEle = document.querySelector('.sitenav-secondary-wrap');
        if (siteNavEle) {
            siteNavEle.setAttribute("style", "display:none");
        }
        var langEle = document.querySelector('#lang');
        if (langEle) {
            langEle.setAttribute("style", "display:none");
        }
        var infoEle = document.querySelector('#info');
        if (infoEle) {
            infoEle.setAttribute("style", "width:unset");
        }
        var infoLeftEle = document.querySelector('#info #left');
        if (infoLeftEle) {
            infoLeftEle.setAttribute("style", "display:none");
        }
        var infoMainEle = document.querySelector('#info #i_main');
        if (infoMainEle) {
            infoMainEle.setAttribute("style", "display:block;width:unset");
        }
        var bottomEle = document.querySelector('#bottom');
        if (bottomEle) {
            bottomEle.setAttribute("style", "display:none");
        }
    }

    if (stringContains(domain, 'kankanews.com')) {
        var zoom = '1.2';
        document.body.style.zoom = zoom;
        var k24Ele = document.querySelector('.k24');
        if (k24Ele) {
            k24Ele.setAttribute("style", "margin:unset;padding:unset");
        }

        document.querySelector('header').remove();
        document.querySelector('.k24 .k24-content').setAttribute('style', 'grid-column:1/8');
        document.querySelector('.k24 .k24-aside').setAttribute('style', 'grid-column:8/11');
    }
})();