// 设置不活动时间（毫秒） 
const timeoutDuration = 5000; // 5分钟 
const intervalDurationInMinutes = 5; // 5分钟
const intervalDuration = intervalDurationInMinutes * 60 * 1000;
const discardedDuration = 45 * 60 * 1000;
const videoDiscardedDuration = 2 * 60 * 60 * 1000;
const whiteList = ["chrome:", "chrome-extension:", "www.188bifen.com"];
const videoList = ["www.youtube.com", "www.bilibili.com"];

chrome.runtime.onInstalled.addListener(async () => {
    await chrome.alarms.create('tab-discard-alarm', { periodInMinutes: intervalDurationInMinutes });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('Alarm fired:', alarm.name);
    discardTabs();
});

// function resetTimer() {
//     setInterval(() => { console.log('Tab discard fired'); discardTabs(); }, intervalDuration);
// }

// resetTimer(); // 初始化计时器

const containsChinese = (str, substring) => {
    const regex = new RegExp(substring, 'u');
    return regex.test(str);
}

const query = options => {
    return new Promise(resolve => chrome.tabs.query(options, resolve));
}

const discard = tab => {
    if (tab.discarded || tab.active || tab.pinned || tab.audible) return;

    const currentTime = Date.now();
    const currentTimeStr = currentTime.toString();
    let lastAccessed = tab.lastAccessed;
    const lastAccessedStr = lastAccessed.toString().split(".")[0];
    let pref = '💤';
    if ((currentTimeStr.length - lastAccessedStr.length) > 1) {
        lastAccessed = lastAccessed * 1000;
        pref = '';
    }
    const timeDiff = currentTime - lastAccessed;
    if (timeDiff <= discardedDuration) return;

    let isWithinWhiteList = false;
    const tabUrl = tab.url;
    whiteList.forEach(list => {
        if (containsChinese(tabUrl, list)) isWithinWhiteList = true;
    })
    if (isWithinWhiteList) return;

    let isVideo = false;
    videoList.forEach(list => {
        if (containsChinese(tabUrl, list)) isVideo = true;
    })
    if (isVideo && timeDiff <= videoDiscardedDuration) return;

    console.log('tab active time:', timeDiff, 'tab title:', tab.title, 'tab url:', tab.url, tab, 'pref:', pref);
    const tabId = tab.id;

    return new Promise(resolve => {
        Promise.race([
            new Promise(resolve => setTimeout(resolve, 2000, [])),
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (pref2) => {
                    const title = document.title || location.href || '';
                    if (!(pref2 === undefined || pref2 === '') && title.startsWith(pref2) === false) {
                        document.title = pref2 + ' ' + title;
                    }
                    return tabId;
                },
                args: [pref]
            })
        ]).then(r => {
            console.log(r);
        }).catch(e => {
            console.log(e);
        }).finally(() => {
            console.log(tabId);
            chrome.tabs.discard(tabId);
        })
        resolve();
    });
}

const discardTabs = () => {
    query({}).then((tabs = []) => {
        tabs.forEach(discard);
    })
}