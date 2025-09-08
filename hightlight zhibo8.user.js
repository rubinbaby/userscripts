// ==UserScript==
// @name        hightlight zhibo8
// @match       *://*.zhibo8.com/*
// @author      yinxiao
// @version      0.2.8
// @description 把点击过的直播吧新闻链接颜色改为醒目色
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/hightlight%20zhibo8.user.js
// @downloadURL https://github.com/rubinbaby/userscripts/blob/main/hightlight%20zhibo8.user.js
// @grant        GM.xmlHttpRequest
// @connect      www.zhibo8.com
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

function changeLinkColor(visitedLinks) {
    $("a").each(function (index, element) {
        visitedLinks.forEach(function (link) {
            if (containsChinese(element.href, link)) {
                $(element).attr("style", "color:#BC62C2");
            }
        })
    });
}

function getPastDays(num) {
    const dates = [];
    const today = new Date();

    for (let i = 0; i < num; i++) {
        const pastDate = new Date(today);
        pastDate.setDate(today.getDate() - i);  // 逐日回退[2](@ref)
        dates.push(pastDate.toISOString().split('T')[0]);  // 格式化为YYYY-MM-DD
    }

    return dates.reverse(); // 按日期升序排列
}

function fetchData(url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onload = () => resolve(xhr.responseText);
        xhr.onerror = () => reject(xhr.statusText);
        xhr.send();
    });
}

function promiseRequest(config) {
    return new Promise((resolve, reject) => {
        GM.xmlHttpRequest({
            ...config,
            onload: (res) => {
                if (res.status >= 200 && res.status < 300) {
                    resolve(res.responseText);
                } else {
                    reject(new Error(`HTTP ${res.status}`));
                }
            },
            onerror: (err) => {
                console.log(err)
                resolve('{}')
            },
            timeout: 5000,
            ontimeout: () => {
                console.log('request timeout: ' + config.url + '!')
                resolve('{}')
            }
        });
    });
}

function listAllNews(visitedLinks) {
    let requests = [];
    const _dates = getPastDays(14);
    _dates.forEach(function (_date) {
        requests.push(promiseRequest({ url: 'https://news.zhibo8.com/zuqiu/json/' + _date + '.htm' }));
        requests.push(promiseRequest({ url: 'https://www.zhibo8.com/zuqiu/json/' + _date + '.htm' }));
    });

    Promise.all(requests).then((results) => {
        var _news = []
        results.forEach(function (data) {
            var dataJson = JSON.parse(data);
            var news = [];
            if ("video_arr" in dataJson) {
                news = [...news, ...dataJson.video_arr];
            }
            if ("video" in dataJson) {
                news = [...news, ...dataJson.video];
            }
            news.forEach(function (_new) {
                var label = _new.lable;
                if (containsChinese(label, '曼联')) {
                    if (_new.type === 'zuqiu') {
                        _new.type2 = '新闻';
                    } else if (_new.type === 'zuqiujijin') {
                        _new.type2 = '集锦';
                    } else if (_new.type === 'zuqiuluxiang') {
                        _new.type2 = '录像';
                    }
                    _news.push(_new);
                }
            });
        });

        _news.sort((a, b) => {
            var a_split = a.createtime.split(" ");
            var b_split = b.createtime.split(" ");
            var dateDiff = new Date(b_split[0]) - new Date(a_split[0]);
            if (dateDiff !== 0) return dateDiff;

            // 日期相同则按时间排序
            return b_split[1].localeCompare(a_split[1]);
        });
        var footerDiv = document.getElementById('footer');
        var newDiv = document.createElement('div');
        newDiv.id = 'body';
        newDiv.style.margin = '20px';
        footerDiv.parentNode.insertBefore(newDiv, footerDiv);
        const ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        _news.forEach(function (_new) {
            const li = document.createElement('li');
            // 创建 a 元素并设置属性
            const a = document.createElement('a');
            a.href = (_new.type == "zuqiu" ? "//news.zhibo8.com" : "//www.zhibo8.com") + _new.url;
            a.textContent = "[" + _new.type2 + "] " + _new.title + " [" + _new.createtime + "]";
            a.target = '_blank';

            // 将 a 元素添加到 li 中
            li.appendChild(a);
            ul.appendChild(li);
        });
        newDiv.appendChild(ul);
        changeLinkColor(visitedLinks);
    }).catch(err => console.log('部分请求失败', err));
}

(function () {
    'use strict';

    // Your code here...
    var visitedLinks = [];
    if ("F_T_ARR" in window.localStorage) {
        var visitedLinkObjects = JSON.parse(window.localStorage.F_T_ARR);
        $.each(visitedLinkObjects, function (key, value) {
            value.forEach(function (v) {
                visitedLinks.push(v.replace("-news-zuqiu-", "/").replaceAll("_", "-"));
            })
        });
    }
    changeLinkColor(visitedLinks);
    var hostname = window.location.hostname;
    var zoom = '1';
    if (containsChinese(hostname, 'zhibo8.com')) {
        zoom = '1.25';
    }

    var pathname = window.location.pathname;
    if (containsChinese(pathname, '/zuqiu/more.htm')) {
        zoom = '1.5';
        listAllNews(visitedLinks);
        setTimeout(stopAutoRefresh, 20000);
    }
    if (containsChinese(pathname, '/zuqiu/')
        && (containsChinese(pathname, 'native.htm') || containsChinese(pathname, 'video.htm'))) {
        zoom = '1.5';
    }
    document.body.style.zoom = zoom;
    var qrcodeEle = document.querySelector('.qrcode');
    if (qrcodeEle) {
        qrcodeEle.remove();
    }
})();