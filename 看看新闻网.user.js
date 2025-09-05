// ==UserScript==
// @name        看看新闻网
// @match       *://*.kankanews.com/k24
// @author      yinxiao
// @version      0.0.1
// @description 看看新闻网24小时进行时页面更新
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/hightlight%20kankanews.user.js
// @downloadURL https://github.com/rubinbaby/userscripts/blob/main/hightlight%20kankanews.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Your code here...
    var zoom = '1.2';
    document.body.style.zoom = zoom;
    var k24Ele = document.querySelector('.k24');
    if (k24Ele) {
        k24Ele.setAttribute("style", "margin:unset");
    }
})();