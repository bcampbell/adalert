
//
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        var badgeTxt = "T" + request.twits.length.toString();
        chrome.browserAction.setBadgeText({text: badgeTxt, tabId: sender.tab.id});
});
