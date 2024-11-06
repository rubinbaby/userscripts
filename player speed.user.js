// ==UserScript==
// @name        player speed
// @description This is your new file, start writing code
// @match     https://www.youtube.com/*
// @match     https://www.bilibili.com/*
// @author yinxiao
// @version      0.1
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/player%20speed.user.js
// ==/UserScript==
function containsChinese(str, substring) {
  const regex = new RegExp(substring, 'u');
  return regex.test(str);
}

function changeVideoPlaySpeed(speed){
    var v=document.getElementsByTagName('video');
    for (var i=0;i<v.length;i++){
        var original_speed = v[i].playbackRate;
        if(original_speed!=speed){
            console.log("original play speed: ", original_speed, ", current play speed: ",speed);
            v[i].playbackRate = speed;
        }
    }
}

function changeVideoPlayMode(domain){
    if(containsChinese(domain, "www.youtube.com")){
        var doms = document.getElementsByClassName("ytp-size-button ytp-button");
        if(doms.length > 0){
            for(var i=0;i<doms.length;i++){
                if(containsChinese(doms[i].title,"Cinema mode")){
                    doms[i].click();
                }
            }
        }
        var chatCloseDoms = document.querySelectorAll("#close-button > yt-button-renderer button");
        if(chatCloseDoms.length > 0){
            for(var j=0;j<chatCloseDoms.length;j++){
                chatCloseDoms[j].click();
            }
        }
    }
    if(containsChinese(domain, "www.bilibili.com")){
        var doms = document.getElementsByClassName("bpx-player-ctrl-btn bpx-player-ctrl-wide");
        if(doms.length > 0){
            for(var i=0;i<doms.length;i++){
                if(doms[i].classList.length<3){
                    doms[i].click();
                }
            }
        }
    }
}

(function() {
    'use strict';

    // Your code here...
    var domain = window.location.hostname;
    var title = document.title;
    var speed = 1;
    if(containsChinese(domain, "www.youtube.com")){
        var keyword = "list=PLh9lJwqeOuvNPqHfKf10o5Ql9M-OEnoLy";
//         keyword = "kpjOEw8a9K0";
        var isUrlMatched = window.location.href.includes(keyword);
//         console.log("url is matched: "+isUrlMatched);
        if(isUrlMatched){
            speed = 1.5;
        }
    }
    if(containsChinese(domain, "www.bilibili.com")){
        if(containsChinese(title,"名侦探柯南")){
            speed = 1.25;
        }
    }

    window.setInterval(function(){
        changeVideoPlaySpeed(speed);
        changeVideoPlayMode(domain);
    },5000);
})();