// ==UserScript==
// @name        hightlight zhibo8
// @match       *://*.zhibo8.com/*
// @author      yinxiao
// @version      0.2.1
// @description 把点击过的直播吧新闻链接颜色改为醒目色
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/hightlight%20zhibo8.user.js
// ==/UserScript==
function containsChinese(str, substring) {
    const regex = new RegExp(substring, 'u');
    return regex.test(str);
}

function stopAutoRefresh() {
    console.log("start to disable auto refrensh");
    window.stop();
    console.log("end to disable auto refrensh");
}

(function () {
    'use strict';

    // Your code here...
    var visitedLinkObjects = JSON.parse(window.localStorage.F_T_ARR);
    var visitedLinks = [];
    $.each(visitedLinkObjects, function (key, value) {
        value.forEach(function (v) {
            visitedLinks.push(v.replace("-news-zuqiu-", "/").replaceAll("_", "-"));
        })
    });
    $("a").each(function (index, element) {
        visitedLinks.forEach(function (link) {
            if (containsChinese(element.href, link)) {
                $(element).attr("style", "color:#BC62C2");
            }
        })
    });
    var hostname = window.location.hostname;
    var zoom = '1';
    if (containsChinese(hostname, 'zhibo8.com')) {
        zoom = '1.25';
    }

    var pathname = window.location.pathname;
    var userAgent = navigator.userAgent;
    if (containsChinese(pathname, '/zuqiu/more.htm')) {
        zoom = '1.5';
        if (containsChinese(userAgent, 'Firefox')) {
            setTimeout(stopAutoRefresh, 20000);
        }
    }
    if (containsChinese(pathname, '/zuqiu/') && containsChinese(pathname, 'native.htm')) {
        zoom = '1.5';
    }
    document.body.style.zoom = zoom;
})();