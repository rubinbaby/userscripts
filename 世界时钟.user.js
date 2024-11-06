// ==UserScript==
// @name        世界时钟
// @description world clock
// @match       https://ww2.24timezones.com/*
// @author yinxiao
// @version      0.1
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/%E4%B8%96%E7%95%8C%E6%97%B6%E9%92%9F.user.js
// ==/UserScript==
(function() {
    'use strict';

    // Your code here...
    document.getElementsByClassName("ad-container-top-index")[0].setAttribute("style", "display:none");
    var original_world_config=window.localStorage.worldconfig;
    var new_world_config='{"clocksPage":{"timeformat":12,"cities":[237,136,283]},"mapPage":{"timeformat":12,"mainCities":[237,136,283]}}';
    console.log("original world config: ", original_world_config);
    if(original_world_config!==new_world_config){
        window.localStorage.worldconfig=new_world_config;
        console.log("new world config: ", new_world_config);
        //location.reload();
    }
})();