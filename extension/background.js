"use strict";

var serverURL = "http://oddie.scumways.com:4000";
//var serverURL = "http://localhost:4000";


console.log("background.js: HELLO");

// handle message from the content script
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log("background.js: got ", request);
        if ( request.action== "scanned") {
            let pageStatus = request.result;
            let n = pageStatus.warnings.length;
            if (n>0) {
                console.log("BADGERTIME: " + n);
                var badgeTxt = n.toString();
                chrome.browserAction.setBadgeText({text: badgeTxt, tabId: sender.tab.id});
            } else {
                chrome.browserAction.setBadgeText({text: "", tabId: sender.tab.id});
            }
        }

        // perform a lookup of the given url on the server
        if (request.action=="lookup") {
            let pageURL = request.url;

            let req = new XMLHttpRequest();
            req.addEventListener("load", function() {
                let warnings = [];
                console.log("loaded", req);
                console.log(this.responseText);
                if (this.status==200) {
                    if( this.responseText) {
                        let inf = JSON.parse(this.responseText);
                        warnings.push({'kind':'sponsored',
                            'level':'certain',
                            'msg': "Flagged as sponsored content (by " + inf.warns + " people)"
                        });
                    }
                    //sendResponse({"success":true, "info": inf});
                }
                sendResponse(warnings);
            });
            req.addEventListener("error", function() {
                //console.log("ERR", req);
                //sendResponse({"success":false, "reason": "req failed" })
                sendResponse([]);
            });
            // TODO: hash url for sending
            let u = serverURL + "/api/lookup?u=" + encodeURIComponent(pageURL) 
            console.log("Start lookup:", u);
            req.open("GET", u);
            req.send();
            return true;    // keep channel until we call sendResponse()
        }

        // post a warning on a page
        if (request.action=="report") {
            let pageURL = request.url;
            let title = request.title;

            console.log("background.js report:",pageURL,title);

            let req = new XMLHttpRequest();
            req.addEventListener("load", function() {
                if (this.status==200) {
                    sendResponse({"success":true});
                } else {
                    sendResponse({"success":false, "reason": "http " + this.status });
                }
            });
            req.addEventListener("error", function() {
                //console.log("ERR", req);
                sendResponse({"success":false, "reason": "req failed" })
            });
            let u = serverURL + "/api/report";
            req.open("POST", u);
            let data = new FormData();
            data.append('u', pageURL);
            data.append('t', title);

            req.send(data);
            console.log(req);
            return true;    // keep channel until we call sendResponse()
        }

    });
