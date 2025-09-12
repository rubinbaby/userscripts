// ==UserScript==
// @name         player speed
// @description  Automatically set video playback speed and mode on YouTube/Bilibili
// @match        https://www.youtube.com/*
// @match        https://www.bilibili.com/*
// @match        file:///Users/*
// @author       yinxiao
// @version      0.1.6
// @updateURL    https://github.com/rubinbaby/userscripts/blob/main/player%20speed.user.js
// @downloadURL  https://github.com/rubinbaby/userscripts/blob/main/player%20speed.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Utility: substring check
    function stringContains(str, substring) {
        return str && substring && str.indexOf(substring) !== -1;
    }

    // Set video playback speed based on domain and context
    function changeVideoPlaySpeed(domain) {
        var href = window.location.href;
        var title = document.title;
        var speed = 1;

        if (stringContains(domain, "youtube.com")) {
            var channelNameEle = document.querySelector('#above-the-fold #channel-name .yt-simple-endpoint.style-scope.yt-formatted-string');
            var channelName = channelNameEle ? channelNameEle.textContent : "";
            var channelNames = ["TVBS Talk", "CTITV NEWS", "館長惡名昭彰", "Yahoo風向"];
            var isChannelMatched = channelNames.some(name => stringContains(channelName, name));
            if (isChannelMatched) speed = 1.5;
        }

        if (stringContains(domain, "bilibili.com")) {
            if (stringContains(title, "名侦探柯南")) speed = 1.25;
        }

        if (stringContains(href, "file:///Users/")) {
            speed = 1.5;
        }

        if (speed == 1) return;

        var videos = document.getElementsByTagName('video');
        for (var i = 0; i < videos.length; i++) {
            if (videos[i].playbackRate !== speed) {
                console.log("Setting play speed:", speed, "for video", i);
                videos[i].playbackRate = speed;
            }
        }
    }

    // Set video play mode (cinema/wide) if not already set
    function changeVideoPlayMode(domain) {
        if (stringContains(domain, "youtube.com")) {
            // Cinema mode
            var sizeButtons = document.querySelectorAll(".ytp-size-button.ytp-button");
            sizeButtons.forEach(btn => {
                var tooltip = btn.getAttribute('data-tooltip-title');
                if (tooltip && stringContains(tooltip, "Cinema mode")) {
                    btn.click();
                }
            });
            // Close chat
            var chatCloseButtons = document.querySelectorAll("#close-button > yt-button-renderer button");
            chatCloseButtons.forEach(btn => btn.click());
        }

        if (stringContains(domain, "bilibili.com")) {
            // Wide mode
            var wideButtons = document.querySelectorAll(".bpx-player-ctrl-btn.bpx-player-ctrl-wide");
            wideButtons.forEach(btn => {
                // Only click if not already wide (check for a specific class if possible)
                if (!btn.classList.contains("bpx-state-entered")) {
                    btn.click();
                }
            });
        }
    }

    // Use MutationObserver for better performance (optional)
    function observeVideos(domain) {
        const observer = new MutationObserver(() => {
            changeVideoPlaySpeed(domain);
            changeVideoPlayMode(domain);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Main
    var domain = window.location.hostname;
    // Initial run
    changeVideoPlaySpeed(domain);
    changeVideoPlayMode(domain);

    // Use interval for fallback (shorter interval for responsiveness)
    var interval = setInterval(function () {
        changeVideoPlaySpeed(domain);
        changeVideoPlayMode(domain);
    }, 2000);

    // Optionally use MutationObserver for dynamic pages
    // observeVideos(domain);

})();
