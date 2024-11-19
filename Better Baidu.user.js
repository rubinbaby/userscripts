// ==UserScript==
// @name        Better Baidu
// @description Remove the 'right' contents. Add Bing and Google search buttons.
// @match     http://www.baidu.com/
// @match     https://www.baidu.com/
// @match     http://www.baidu.com/s*
// @match     https://www.baidu.com/s*
// @match     http://www.baidu.com/baidu*
// @match     https://www.baidu.com/baidu*
// @author yinxiao
// @version      0.1
// @updateURL https://github.com/rubinbaby/userscripts/blob/main/Better%20Baidu.user.js
// ==/UserScript==
(function (window, document, undefined) {
    var hasAdded = false;
    // define search engines' urls.
    var URLS = {
        'Bing': 'http://www.bing.com/search?q=',
        'Google': 'http://www.google.com/search?q='
    };
    // now, let's go implement keywords highlighting.
    var resultContainerQuery = '#content_left';
    var buffer = '';
    watch(resultContainerQuery, buffer);
    var COLORS = [
        '#FFFF00',
        '#FFCC00',
        '#CCCCFF',
        '#00CCFF',
        '#33CCCC',
        '#FF8080',
        '#008000',
        '#FFFF99',
        '#808000',
        '#FFFFCC'
    ];
    var counter = 0;
    var topBtn;
    $(document).scroll(function(){
        var displayStr =$(this).scrollTop() >= 20 ? 'block' : 'none';
        topBtn.setAttribute('style', 'display: ' + displayStr + '; position: fixed; bottom: 10px; right: 10px; line-height: 50px;' +
                            'width: 50px; height: 50px; color: #fff; background: #ED614F; text-align: center;' +
                            'cursor: pointer; font-weight: bold; border-radius: 100%; z-index: 999999;' +
                            'box-shadow: 0 2px 5px grey;');
    });
    function watch(resultContainerQuery, buffer) {
        setInterval(function () {
            // first, remove the annoying right contents.
            if (document.querySelector('#content_right *')) {
                var all = document.querySelectorAll('#content_right *:not(.better-baidu-reserve)');
                all = Array.prototype.slice.apply(all);
                all.map(function (element) {
                    element.remove();
                });
                topBtn = document.createElement('div');
                // now, add go-to-top button.
                topBtn.appendChild(document.createTextNode('TOP'));
                var displayStr = document.body.scrollTop >= 20 ? 'block' : 'none';
                topBtn.setAttribute('style', 'display: ' + displayStr + '; position: fixed; bottom: 10px; right: 10px; line-height: 50px;' +
                                    'width: 50px; height: 50px; color: #fff; background: #ED614F; text-align: center;' +
                                    'cursor: pointer; font-weight: bold; border-radius: 100%; z-index: 999999;' +
                                    'box-shadow: 0 2px 5px grey;');
                topBtn.onclick = function () {
                    document.body.scrollTop=0;
                    this.setAttribute('style', 'display: none; position: fixed; bottom: 10px; right: 10px; line-height: 50px;' +
                                      'width: 50px; height: 50px; color: #fff; background: #ED614F; text-align: center;' +
                                      'cursor: pointer; font-weight: bold; border-radius: 100%; z-index: 999999;' +
                                      'box-shadow: 0 2px 5px grey;');
                };
                document.body.appendChild(topBtn);
            }
            // if Bing and Google are not added yet, add them.
            var hostpage1=document.location.href;
            var isNotBaiduHomepage =
                hostpage1.toUpperCase() !== 'HTTP://WWW.BAIDU.COM' &&
                hostpage1.toUpperCase() !== 'HTTPS://WWW.BAIDU.COM' &&
                hostpage1.toUpperCase() !== 'HTTP://WWW.BAIDU.COM/' &&
                hostpage1.toUpperCase() !== 'HTTPS://WWW.BAIDU.COM/';
            if (!hasAdded && isNotBaiduHomepage) {
                // find container and Baidu button.
                var container = document.querySelector('#form');
                var baidu = document.querySelector('#su').parentElement;
                var current = baidu;
                // now, create and add new buttons.
                for (var item in URLS) {
                    var anchor = document.createElement('a');
                    anchor.textContent = item;
                    anchor.setAttribute('data-url', URLS[item]);
                    anchor.setAttribute('target', '_blank');
                    anchor.onmouseenter = function () {
                        var q = document.querySelector('#kw').value || '';
                        this.setAttribute('href', this.getAttribute('data-url') + q);
                    };
                    anchor.setAttribute('style', 'font-size:medium; cursor: pointer; color: rgb(255, 255, 255);font-weight: bold; display: inline-block;text-decoration: none;background: #4e6ef2 none repeat scroll 0% 0%; text-align: center; line-height: 40px;margin-left: 2px; width: 60px; height: 40px; border-bottom: 1px solid transparent;');
                    container.insertBefore(anchor, current.nextSibling);
                    current = anchor;
                }
                hasAdded = true;
            }
            var resultContainer = document.querySelector(resultContainerQuery);
            if (resultContainer && resultContainer.textContent !== buffer) {
                // update buffer.
                buffer = resultContainer.textContent;
                // first, find all 'em's.
                var ems = document.querySelectorAll('em');
                // if there is no 'em's, do nothing.
                if (ems.length === 0) {
                    return false;
                }
                // convert ems into an array.

                ems = Array.prototype.slice.apply(ems);
                var counter = 0;
                var styles = {
                };
                // iterate through all the keywords in search result,
                // and map the predefined color to them.
                ems.forEach(function (em) {
                    var text = em.innerHTML.toUpperCase().trim();
                    var bg = styles[text];
                    if (!bg) {
                        bg = COLORS[counter++];
                        styles[text] = bg;
                        if (counter === COLORS.length) {
                            counter = 0;
                        }
                    }
                    em.style.background = bg;
                    em.style.color = '#000';
                    em.style.fontWeight = 'bold';
                });
            }
        }, 200);
    }
}) (this, document);