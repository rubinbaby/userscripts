// ==UserScript==
// @name        比分直播
// @description 比分直播
// @match       https://www.188bifen.com/
// @match       http://www.188bifen.com/
// @author yinxiao
// @version      0.2.5
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/%E6%AF%94%E5%88%86%E7%9B%B4%E6%92%AD.user.js
// @downloadURL https://github.com/rubinbaby/userscripts/blob/main/%E6%AF%94%E5%88%86%E7%9B%B4%E6%92%AD.user.js
// ==/UserScript==
function containsChinese(str, substring) {
    const regex = new RegExp(substring, 'u');
    return regex.test(str);
}

function stopScoreAlert() {
    console.log("stop score alerts");
    var element = document.querySelector("a.voice-switch");
    var buttonText = element.text;
    if (containsChinese(buttonText, "声音关")) return;
    element.click();
    console.log("succeeded in stopping score alerts");
}

(function () {
    'use strict';

    // Your code here...
    document.querySelector('.vct-menu').setAttribute('style', 'display:none');
    document.querySelector('.vct-container .top-act').setAttribute('style', 'display:none');
    var original_session = window.sessionStorage.selectLeagueIds;
    var new_session = '{"zuqiu":{"21":1,"22":1,"24":1,"371":1,"369":1,"395":1,"372":1,"383":1,"7":1,"352":1,"353":1}}';
    console.log("original session: ", original_session);
    if (original_session !== new_session) {
        window.sessionStorage.selectLeagueIds = new_session;
        window.sessionStorage.leagueActive = '1';
        console.log("new session: ", new_session);
        location.reload();
    }

    setTimeout(stopScoreAlert, 20000);
})();