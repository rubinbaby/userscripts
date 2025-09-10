// 设置不活动时间（毫秒） 
const timeoutDuration = 5000; // 5分钟 
const intervalDuration = 5 * 60 * 1000; // 5分钟 
const discardedDuration = 45 * 60 * 1000;
const videoDiscardedDuration = 2 * 60 * 60 * 1000;
const whiteList = ["about:", "www.188bifen.com"];
const videoList = ["www.youtube.com", "www.bilibili.com"];

function resetTimer() {
    setInterval(discardTabs, intervalDuration);
}

function containsChinese(str, substring) {
    const regex = new RegExp(substring, 'u');
    return regex.test(str);
}

function discardTabs() {
    browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
            if (tab.discarded || tab.active || tab.pinned) return;

            const timeDiff = Date.now() - tab.lastAccessed;
            console.log(timeDiff, tab.title, tab.url);
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

            console.log(tab);
            browser.tabs.discard(tab.id);
        });
    });
}

resetTimer(); // 初始化计时器