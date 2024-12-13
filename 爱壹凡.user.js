// ==UserScript==
// @name        爱壹帆
// @match       *://*.iyf.tv/*
// @author      yinxiao
// @version      0.1
// @description 优化爱壹帆播放器
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/爱壹帆.user.js
// @downloadURL https://github.com/rubinbaby/userscripts/blob/main/爱壹帆.user.js
// ==/UserScript==
function containsChinese(str, substring) {
    const regex = new RegExp(substring, 'u');
    return regex.test(str);
}

function resizeVideoPlayer() {
    var videoPlayer = document.querySelector('.page-container.video-player');
    videoPlayer.setAttribute('style', 'width:1500px');
    document.querySelector('.ps.pggf').remove();
    document.querySelector('.iconfont.icondanmukai').click();
    document.querySelector('.dabf.d-block.block-mt.ng-star-inserted').remove();
    document.querySelector('.d-flex.w-100.justify-content-center').setAttribute('style', 'height: 850px');
    document.querySelector('.aa-videoplayer-wrap').setAttribute('style', 'height: 800px !important');
    document.querySelector('.video-box.ng-star-inserted').setAttribute('style', 'height: 800px');
}

(function () {
    'use strict';

    // Your code here...
    setTimeout(resizeVideoPlayer, 10000);
})();