"use strict";

console.log("background.js: HELLO");

var foobar = 0;

// handle message from the content script
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log("background.js: got ", request);
        chrome.browserAction.setBadgeText({text: "XYZ", tabId: sender.tab.id});
        var n = request.warnings.length;
        if (n<0) {
            return;
        }
        var badgeTxt = n.toString();
        chrome.browserAction.setBadgeText({text: badgeTxt, tabId: sender.tab.id});
    });
