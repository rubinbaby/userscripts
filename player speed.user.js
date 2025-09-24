// ==UserScript==
// @name         player speed
// @description  Automatically set video playback speed and mode on YouTube/Bilibili
// @match        https://www.youtube.com/*
// @match        https://www.bilibili.com/*
// @match        file:///Users/*
// @author       yinxiao
// @version      0.1.8
// @updateURL    https://github.com/rubinbaby/userscripts/blob/main/player%20speed.user.js
// @downloadURL  https://github.com/rubinbaby/userscripts/blob/main/player%20speed.user.js
// ==/UserScript==

(function () {
    'use strict';

    // --- Config ---
    const DEBUG = false;
    const YOUTUBE_CHANNEL_SPEED = {
        "TVBS Talk": 1.5,
        "CTITV NEWS": 1.5,
        "館長惡名昭彰": 1.5,
        "Yahoo風向": 1.5
    };
    const BILIBILI_TITLE_SPEED = {
        "名侦探柯南": 1.25
    };

    // --- Utility ---
    const log = (...args) => { if (DEBUG) console.log('[player speed]', ...args); };
    const stringContains = (str, substring) => str && substring && str.indexOf(substring) !== -1;

    // --- Main Logic ---
    function changeVideoPlaySpeed(domain) {
        let speed = 1;
        const href = window.location.href;
        const title = document.title;

        if (stringContains(domain, "youtube.com")) {
            const channelNameEle = document.querySelector('#above-the-fold #channel-name .yt-simple-endpoint.style-scope.yt-formatted-string');
            const channelName = channelNameEle?.textContent || "";
            speed = YOUTUBE_CHANNEL_SPEED[channelName] || 1;
        }

        if (stringContains(domain, "bilibili.com")) {
            for (const [key, val] of Object.entries(BILIBILI_TITLE_SPEED)) {
                if (stringContains(title, key)) speed = val;
            }
        }

        if (stringContains(href, "file:///Users/")) {
            speed = 1.5;
        }

        if (speed === 1) return;

        const videos = document.getElementsByTagName('video');
        for (let i = 0; i < videos.length; i++) {
            if (videos[i].playbackRate !== speed) {
                log(`Setting play speed: ${speed} for video ${i}`);
                videos[i].playbackRate = speed;
            }
        }
    }

    function changeVideoPlayMode(domain) {
        if (stringContains(domain, "youtube.com")) {
            // Cinema mode
            document.querySelectorAll(".ytp-size-button.ytp-button").forEach(btn => {
                const tooltip = btn.getAttribute('data-tooltip-title');
                if (tooltip && stringContains(tooltip, "Cinema mode")) btn.click();
            });
            // Close chat
            document.querySelectorAll("#close-button > yt-button-renderer button").forEach(btn => btn.click());
        }

        if (stringContains(domain, "bilibili.com")) {
            // Wide mode
            document.querySelectorAll(".bpx-player-ctrl-btn.bpx-player-ctrl-wide").forEach(btn => {
                if (!btn.classList.contains("bpx-state-entered")) btn.click();
            });
        }
    }

    // --- Observer ---
    function observeVideos(domain) {
        const observer = new MutationObserver(() => {
            changeVideoPlaySpeed(domain);
            changeVideoPlayMode(domain);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // --- Playlist Reverse Logic ---
    function getCurrentIndex() {
        const items = Array.from(document.querySelectorAll('ytd-playlist-panel-renderer #items ytd-playlist-panel-video-renderer'));
        return items.findIndex(item => item.hasAttribute('selected') || item.querySelector('#thumbnail[aria-current="true"]'));
    }

    function reversePlaylist(container) {
        const items = Array.from(container.children);
        items.forEach(item => container.removeChild(item));
        items.reverse().forEach(item => container.appendChild(item));
    }

    function scrollToIndexInContainer(container, idx) {
        container = document.querySelector('ytd-playlist-panel-renderer #items');
        const items = Array.from(container.children);
        if (!items[idx]) return;
        const target = items[idx];
        const offsetTop = target.offsetTop;
        const center = offsetTop - container.clientHeight / 2 + target.clientHeight / 2;
        container.scrollTo({ top: center, behavior: "smooth" });
    }

    function reverseAndScrollToCurrent() {
        const container = document.querySelector('ytd-playlist-panel-renderer #items');
        if (!container) return;
        const items = Array.from(container.children);
        const total = items.length;
        const currentIndex = getCurrentIndex();
        if (currentIndex < 0) return;
        reversePlaylist(container);
        const newIndex = total - 1 - currentIndex;
        setTimeout(() => scrollToIndexInContainer(container, newIndex), 1000);
    }

    function observeCurrentChange() {
        const container = document.querySelector('ytd-playlist-panel-renderer #items');
        if (!container) return;
        let lastVideoId = null;
        const observer = new MutationObserver(() => {
            const items = Array.from(container.children);
            const current = items.find(item => item.hasAttribute('selected') || item.querySelector('#thumbnail[aria-current="true"]'));
            if (current) {
                const videoId = current.querySelector('a#thumbnail')?.href?.match(/[?&]v=([^&]+)/)?.[1];
                if (videoId && videoId !== lastVideoId) {
                    lastVideoId = videoId;
                    reverseAndScrollToCurrent();
                }
            }
        });
        observer.observe(container, { subtree: true, attributes: true, childList: true });
    }

    function waitForPlaylistItems(callback) {
        const domain = window.location.hostname;
        if (!stringContains(domain, "youtube.com")) {
            log('Not youtube, ignore...');
            return;
        }
        const interval = setInterval(() => {
            const container = document.querySelector('ytd-playlist-panel-renderer #items');
            if (container && container.children.length > 1) {
                clearInterval(interval);
                callback();
            }
        }, 500);
    }

    // --- Init ---
    const domain = window.location.hostname;
    changeVideoPlaySpeed(domain);
    changeVideoPlayMode(domain);
    observeVideos(domain); // Use observer instead of setInterval

    waitForPlaylistItems(() => {
        observeCurrentChange();
    });

})();
