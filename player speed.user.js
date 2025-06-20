// ==UserScript==
// @name        player speed
// @description This is your new file, start writing code
// @match     https://www.youtube.com/*
// @match     https://www.bilibili.com/*
// @match     file:///Users/*
// @author yinxiao
// @version      0.1.3
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/player%20speed.user.js
// @downloadURL https://github.com/rubinbaby/userscripts/blob/main/player%20speed.user.js
// ==/UserScript==
function containsChinese(str, substring) {
    const regex = new RegExp(substring, 'u');
    return regex.test(str);
}

function changeVideoPlaySpeed(domain) {
    var href = window.location.href;
    var title = document.title;
    var speed = 1;
    if (containsChinese(domain, "www.youtube.com")) {
        var channelNameEle = document.querySelector('#above-the-fold #channel-name .yt-simple-endpoint.style-scope.yt-formatted-string');
        var channelName = channelNameEle.text;
        var isChannelMatched = false;
        var channelNames = ["TVBS Talk", "CTITV NEWS"];
        for (var ii = 0; ii < channelNames.length; ii++) {
            isChannelMatched = isChannelMatched || containsChinese(channelName, channelNames[ii]);
        }
        if (isChannelMatched) {
            speed = 1.5;
        }
    }
    if (containsChinese(domain, "www.bilibili.com")) {
        if (containsChinese(title, "名侦探柯南")) {
            speed = 1.25;
        }
    }

    if (containsChinese(href, "file:///Users/")) {
        speed = 1.5;
    }

    var v = document.getElementsByTagName('video');
    for (var i = 0; i < v.length; i++) {
        var original_speed = v[i].playbackRate;
        if (original_speed != speed) {
            console.log("original play speed: ", original_speed, ", current play speed: ", speed);
            v[i].playbackRate = speed;
        }
    }
}

function changeVideoPlayMode(domain) {
    if (containsChinese(domain, "www.youtube.com")) {
        var doms = document.getElementsByClassName("ytp-size-button ytp-button");
        if (doms.length > 0) {
            for (var i = 0; i < doms.length; i++) {
                if (containsChinese(doms[i].title, "Cinema mode")) {
                    doms[i].click();
                }
            }
        }
        var chatCloseDoms = document.querySelectorAll("#close-button > yt-button-renderer button");
        if (chatCloseDoms.length > 0) {
            for (var j = 0; j < chatCloseDoms.length; j++) {
                chatCloseDoms[j].click();
            }
        }
    }
    if (containsChinese(domain, "www.bilibili.com")) {
        doms = document.getElementsByClassName("bpx-player-ctrl-btn bpx-player-ctrl-wide");
        if (doms.length > 0) {
            for (var k = 0; k < doms.length; k++) {
                if (doms[k].classList.length < 3) {
                    doms[k].click();
                }
            }
        }
    }
}

(function () {
    'use strict';

    // Your code here...
    var domain = window.location.hostname;
    window.setInterval(function () {
        changeVideoPlaySpeed(domain);
        changeVideoPlayMode(domain);
    }, 5000);
})();