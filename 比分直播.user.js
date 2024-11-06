// ==UserScript==
// @name        比分直播
// @description 比分直播
// @match       https://www.188bifen.com/
// @match       http://www.188bifen.com/
// @author yinxiao
// @version      0.1
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/%E6%AF%94%E5%88%86%E7%9B%B4%E6%92%AD.user.js
// ==/UserScript==
(function() {
    'use strict';

    // Your code here...
    var original_session=window.sessionStorage.selectLeagueIds;
    var new_session='{"zuqiu":{"21":1,"22":1,"24":1,"371":1,"369":1,"395":1,"372":1,"383":1}}';
    console.log("original session: ", original_session);
    if(original_session!==new_session){
        window.sessionStorage.selectLeagueIds=new_session;
        window.sessionStorage.leagueActive='1';
        console.log("new session: ", new_session);
        location.reload();
    }
})();