// 设置不活动时间（毫秒） 
const intervalDurationInMinutes = 5; // 5分钟
const intervalDuration = intervalDurationInMinutes * 60 * 1000;
const discardedDuration = 45 * 60 * 1000; // 45分钟
const videoDiscardedDuration = 2 * 60 * 60 * 1000; // 2小时
const whiteList = ["chrome:", "chrome-extension:", "www.188bifen.com"];
const videoList = ["www.youtube.com", "www.bilibili.com"];

chrome.runtime.onInstalled.addListener(async () => {
    await chrome.alarms.create('tab-discard-alarm', { periodInMinutes: intervalDurationInMinutes });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('Alarm fired:', alarm.name);
    discardTabs();
});

const containsSubstring = (str, substring) => str.includes(substring);

const query = options => {
    return new Promise(resolve => chrome.tabs.query(options, resolve));
}

const discard = async tab => {
    if (tab.discarded || tab.active || tab.pinned || tab.audible) return;

    const currentTime = Date.now();
    let lastAccessed = tab.lastAccessed;
    // Chrome sometimes reports lastAccessed in seconds, sometimes in ms
    if (lastAccessed < 1e12) { // If in seconds, convert to ms
        lastAccessed = lastAccessed * 1000;
    }
    const timeDiff = currentTime - lastAccessed;
    if (timeDiff <= discardedDuration) return;

    // Whitelist check
    if (whiteList.some(list => containsSubstring(tab.url, list))) return;

    // Video check
    if (videoList.some(list => containsSubstring(tab.url, list)) && timeDiff <= videoDiscardedDuration) return;

    let pref = '💤';
    try {
        await Promise.race([
            new Promise(resolve => setTimeout(resolve, 2000, [])),
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (pref2) => {
                    const title = document.title || location.href || '';
                    if (pref2 && !title.startsWith(pref2)) {
                        document.title = pref2 + ' ' + title;
                    }
                },
                args: [pref]
            })
        ]);
    } catch (e) {
        console.log('Error executing script:', e);
    }
    console.log('Discarding tab:', tab.id, tab.title, tab.url);
    chrome.tabs.discard(tab.id);
}

const discardTabs = async () => {
    const tabs = await query({});
    for (const tab of tabs) {
        await discard(tab);
    }
}
