"use strict";

var serverURL = "http://localhost:5000";


console.log("background.js: HELLO");

// handle message from the content script
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log("background.js: got ", request);
        if ( request.action== "scanned") {
            let pageStatus = request.result;
            let n = pageStatus.warnings.length;
            if (n>0) {
                var badgeTxt = n.toString();
                chrome.browserAction.setBadgeText({text: badgeTxt, tabId: sender.tab.id});
            }
        }

        // perform a lookup of the given url on the server
        if (request.action=="lookup") {
            let pageURL = request.url;

            let req = new XMLHttpRequest();
            req.addEventListener("load", function() {
                console.log("loaded", req);
                console.log(this.responseText);
                if (this.status==200) {
                    let inf = JSON.parse(this.responseText);
                    sendResponse({"success":true, "info": inf});
                } else {
                    sendResponse({"success":false, "reason": "http " + this.status });
                }
            });
            req.addEventListener("error", function() {
                //console.log("ERR", req);
                sendResponse({"success":false, "reason": "req failed" })
            });
            // TODO: hash url for sending
            let u = serverURL + "/api/lookup?u=" + encodeURIComponent(pageURL) 
            console.log("Start lookup:", u);
            req.open("GET", u);
            req.send();
            return true;    // keep channel until we call sendResponse()
        }

    });
