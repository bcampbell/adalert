"use strict";

//console.log("background.js: HELLO");

// handle message from the content script
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log("background.js: got ", request);
        if ( request.action== "scanned") {
            let pageStatus = request.result;
            let n = pageStatus.warnings.length;
            if (n<0) {
                return;
            }
            var badgeTxt = n.toString();
            chrome.browserAction.setBadgeText({text: badgeTxt, tabId: sender.tab.id});
        }
    });
