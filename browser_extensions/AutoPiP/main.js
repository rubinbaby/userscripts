var currentTab = 0;
var prevTab = null;
var targetTab = null;
var toggle = true;
var videoQueue = new Set();

const executeScript = (tabId, scriptFile) => {
  return new Promise(resolve => {
    chrome.scripting.executeScript({
      target: { tabId },
      files: scriptFile
    }).then(rs => {
      resolve(rs);
    }).catch(e => {
      console.log(e);
      resolve(null);
    });
  });
}

const checkVideo = (tabId) => {
  console.log("check video of tab", tabId);
  return executeScript(tabId, ['./scripts/check-video.js']);
}

const checkPiP = (tabId) => {
  console.log("check PiP of tab", tabId);
  return executeScript(tabId, ['./scripts/check-pip.js']);
}

const togglePiP = (tabId) => {
  console.log("toggle PiP of tab:", tabId);
  return executeScript(tabId, ['./scripts/pip.js']);
}

const exitPiP = (tabId) => {
  console.log("exit PiP of tab:", tabId);
  return executeScript(tabId, ['./scripts/pip.js']);
}

const getLastVideo = (queue) => {
  if (queue.size < 1) return null;

  const videos = Array.from(queue);
  const video = videos[videos.length - 1];
  console.log('latest video ID:', video);
  return video;
}

const toggleVideo = (tabId) => {
  // [3.1] : Check if there is already a PiP vide
  console.log(">> (CHECK) Toggle PiP")
  checkPiP(tabId).then(rs1 => {
    let isPiPExist = false;
    if (rs1 !== null && rs1.length > 0) isPiPExist = rs1[0].result;
    console.log("PiP Exists:", isPiPExist);
    if (isPiPExist) return;

    // [3.2] : No PiP video ; toggle PiP
    console.log(">> (ACTION) Toggle PiP")
    togglePiP(tabId).then(rs2 => {
      let isPiPToggled = false;
      if (rs2 !== null && rs2.length > 0) isPiPToggled = rs2[0].result;
      console.log("PiP toggled:", isPiPToggled);
    })
  })
}

const getTargetTab = (tabId) => {
  return new Promise(resolve => {
    checkVideo(tabId).then(rs => {
      console.log(rs);
      if (rs !== null) {
        let r = rs[0];
        if (videoQueue.has(tabId)) videoQueue.delete(tabId);
        if (r !== undefined && r !== null) {
          const hasVideo = r.result;
          console.log("Check PiP ->", "Has Video:", hasVideo);
          if (hasVideo) videoQueue.add(tabId);
        }
      }
      console.log(videoQueue);
      targetTab = getLastVideo(videoQueue);
      resolve(targetTab);
    });
  })
}

// Get Settings
chrome.storage.sync.get(['toggle'], function (result) {
  result.toggle ? toggle = true : toggle = false;
  toggle = true;
  console.log("AutoPiP Enabled:", toggle)
});

chrome.tabs.onActivated.addListener(function (tab) {
  // --- [0] : Check settings  --- //
  if (!toggle) return;

  console.clear();
  currentTab = tab.tabId;
  if (prevTab === null) prevTab = currentTab;
  console.log("current:", currentTab, "previous:", prevTab, "target:", targetTab);
  getTargetTab(prevTab).then(r => {
    targetTab = r;
    // --- [1] : Check for playing videos *(set target)  ---
    if (targetTab === null) return;

    // --- [2] : Exit PiP *(if user is in target tab)  ---
    if (currentTab === targetTab) {
      console.log(">> Exit PiP")
      // Execute Exit PiP
      exitPiP(targetTab).then(rs => {
        console.log(rs);
        let isPiPExit = false;
        if (!(rs === null || rs.length < 1)) isPiPExit = (rs[0].result === 'Exit');
        console.log("PiP exit:", isPiPExit);
        if (isPiPExit) {
          videoQueue.delete(currentTab);
          targetTab = getLastVideo(videoQueue);
          if (targetTab !== null) toggleVideo(targetTab);
        }
      })
    }

    // --- [3] : Toggle PiP *(if there is a targetTab AND user is not in target tab)  ---
    if (targetTab !== null && currentTab !== targetTab) {
      toggleVideo(targetTab);
    }
  }).finally(() => {
    // --- [ Update ] ---
    prevTab = tab.tabId;
  })
});