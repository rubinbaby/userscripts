// ==UserScript==
// @name         highlight zhibo8
// @namespace    https://github.com/rubinbaby/userscripts
// @match        *://*.zhibo8.com/*
// @match        *://*.zhibo8.cc/*
// @exclude      *://news.zhibo8.com/zuqiu/
// @author       yinxiao
// @version      0.3.1
// @description  Change color of visited Zhibo8 news links to highlight them
// @updateURL    https://github.com/rubinbaby/userscripts/blob/main/hightlight%20zhibo8.user.js
// @downloadURL  https://github.com/rubinbaby/userscripts/blob/main/hightlight%20zhibo8.user.js
// @grant        GM.xmlHttpRequest
// @connect      www.zhibo8.com
// ==/UserScript==

(function () {
    'use strict';

    // Utility: Check if a string contains a substring
    function stringContains(str, substring) {
        return str && substring && str.indexOf(substring) !== -1;
    }

    // Stop auto-refresh
    function stopAutoRefresh() {
        console.log("Disabling auto-refresh...");
        window.stop();
        console.log("Auto-refresh disabled.");
    }

    // Change color of visited links
    function changeLinkColor(visitedLinks) {
        if (!Array.isArray(visitedLinks) || visitedLinks.length === 0) return;
        // Use Set for faster lookup
        const visitedSet = new Set(visitedLinks);
        document.querySelectorAll('a').forEach(a => {
            for (const link of visitedSet) {
                if (a.href && stringContains(a.href, link)) {
                    a.classList.add('zhibo8-visited');
                    break;
                }
            }
        });
    }

    // Add highlight style
    function addHighlightStyle() {
        const style = document.createElement('style');
        style.textContent = `
            a:visited, .zhibo8-visited {
                color: #BC62C2 !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Get past N days as YYYY-MM-DD
    function getPastDays(num) {
        const dates = [];
        const today = new Date();
        for (let i = 0; i < num; i++) {
            const pastDate = new Date(today);
            pastDate.setDate(today.getDate() - i);
            dates.push(pastDate.toISOString().split('T')[0]);
        }
        return dates.reverse();
    }

    // GM.xmlHttpRequest wrapped in a Promise
    function promiseRequest(config) {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                ...config,
                onload: res => {
                    if (res.status >= 200 && res.status < 300) {
                        resolve(res.responseText);
                    } else {
                        reject(new Error(`HTTP ${res.status}`));
                    }
                },
                onerror: err => {
                    console.error('Request error:', err);
                    resolve('{}');
                },
                timeout: 5000,
                ontimeout: () => {
                    console.warn('Request timeout:', config.url);
                    resolve('{}');
                }
            });
        });
    }

    // List all news for the past 14 days
    function listAllNews(visitedLinks) {
        const requests = [];
        const dates = getPastDays(14);
        for (const date of dates) {
            requests.push(promiseRequest({ url: `https://news.zhibo8.com/zuqiu/json/${date}.htm` }));
            requests.push(promiseRequest({ url: `https://www.zhibo8.com/zuqiu/json/${date}.htm` }));
        }

        Promise.all(requests).then(results => {
            const newsList = [];
            for (const data of results) {
                let dataJson;
                try {
                    dataJson = JSON.parse(data);
                } catch (e) {
                    continue;
                }
                let news = [];
                if (Array.isArray(dataJson.video_arr)) news = news.concat(dataJson.video_arr);
                if (Array.isArray(dataJson.video)) news = news.concat(dataJson.video);

                for (const item of news) {
                    if (item && stringContains(item.lable, '曼联')) {
                        if (item.type === 'zuqiu') item.type2 = '新闻';
                        else if (item.type === 'zuqiujijin') item.type2 = '集锦';
                        else if (item.type === 'zuqiuluxiang') item.type2 = '录像';
                        newsList.push(item);
                    }
                }
            }

            // Sort by date and time
            newsList.sort((a, b) => {
                const [aDate, aTime] = a.createtime.split(' ');
                const [bDate, bTime] = b.createtime.split(' ');
                const dateDiff = new Date(bDate) - new Date(aDate);
                if (dateDiff !== 0) return dateDiff;
                return bTime.localeCompare(aTime);
            });

            // Insert news list before footer
            const footerDiv = document.getElementById('footer');
            if (footerDiv) {
                const newDiv = document.createElement('div');
                newDiv.id = 'zhibo8-news-list';
                newDiv.style.margin = '20px';
                const ul = document.createElement('ul');
                ul.style.listStyle = 'none';
                for (const item of newsList) {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = (item.type === 'zuqiu' ? "//news.zhibo8.com" : "//www.zhibo8.com") + item.url;
                    a.textContent = `[${item.type2}] ${item.title} [${item.createtime}]`;
                    a.target = '_blank';
                    li.appendChild(a);
                    ul.appendChild(li);
                }
                newDiv.appendChild(ul);
                footerDiv.parentNode.insertBefore(newDiv, footerDiv);
                changeLinkColor(visitedLinks);
            }
        }).catch(err => console.error('Some requests failed:', err));
    }

    // Main
    addHighlightStyle();

    let visitedLinks = [];
    try {
        const ftArr = localStorage.getItem('F_T_ARR');
        if (ftArr) {
            const visitedLinkObjects = JSON.parse(ftArr);
            Object.values(visitedLinkObjects).forEach(arr => {
                arr.forEach(v => {
                    visitedLinks.push(v.replace('-news-zuqiu-', '/').replaceAll('_', '-'));
                });
            });
        }
    } catch (e) {
        console.warn('Failed to parse visited links:', e);
    }

    changeLinkColor(visitedLinks);

    // Zoom logic
    const hostname = window.location.hostname;
    let zoom = 1;
    if (stringContains(hostname, 'zhibo8.com')) zoom = 1.25;

    const pathname = window.location.pathname;
    if (stringContains(pathname, '/zuqiu/more.htm')) {
        zoom = 1.5;
        listAllNews(visitedLinks);
        setTimeout(stopAutoRefresh, 20000);
    }
    if (stringContains(pathname, '/zuqiu/') &&
        (stringContains(pathname, 'native.htm') || stringContains(pathname, 'video.htm'))) {
        zoom = 1.5;
    }

    if (stringContains(pathname, 'html/match.html')) {
        zoom = 1.1;
        document.querySelector('.menu').parentNode.remove();
        document.querySelector('.main .tb-tlt').remove()
    }
    document.body.style.zoom = zoom;

    // Remove QR code if present
    const qrcodeEle = document.querySelector('.qrcode');
    if (qrcodeEle) qrcodeEle.remove();

    // Remove header if present
    const headerEle = document.querySelector('div#header');
    if (headerEle) headerEle.remove();

})();
