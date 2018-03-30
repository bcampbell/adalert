"use strict";

var serverURL = "http://oddie.scumways.com:4000";
//var serverURL = "http://localhost:4000";


console.log("background.js: HELLO");


// content page has completed its scan
function handleScanned(sender, pageStatus) {
    let n = pageStatus.warnings.length;
    if (n>0) {
        console.log("BADGERTIME: " + n);
        var badgeTxt = n.toString();
        browser.browserAction.setBadgeText({text: badgeTxt, tabId: sender.tab.id});
    } else {
        browser.browserAction.setBadgeText({text: "", tabId: sender.tab.id});
    }
    return Promise.resolve();
}

// perform a lookup of the given url on the server
function handleLookup(sender, pageURL) {
    //console.log("LOOKUP:", request, sender, sendResponse);

    return new Promise(function(resolve, reject) {
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
            }
            resolve(warnings);
        });
        req.addEventListener("error", function() {
            reject("request failed", req);
        });
        // TODO: hash url for sending
        let u = serverURL + "/api/lookup?u=" + encodeURIComponent(pageURL) 
        console.log("Start lookup:", u);
        req.open("GET", u);
        console.log("FOO: sending");
        req.send();
    });
}


// report a page as sponsored content
function handleReport(sender, pageURL, title) {

    console.log("background.js report:",pageURL,title);

    return new Promise(function(resolve, reject) {
        let req = new XMLHttpRequest();
        req.addEventListener("load", function() {
            if (this.status!=200) {
                reject({"success":false, "reason": "http " + this.status });
            }
            resolve({"success":true});
        });
        req.addEventListener("error", function() {
            reject({"success":false, "reason": "req failed" })
        });
        let u = serverURL + "/api/report";
        req.open("POST", u);
        let data = new FormData();
        data.append('u', pageURL);
        data.append('t', title);

        req.send(data);
    });
}


// handle message from the content script
browser.runtime.onMessage.addListener(
    function(request, sender) {
        console.log("background.js: got ", request);
        switch (request.action) {
            case "scanned": return handleScanned(sender, request.result);
            case "lookup": return handleLookup(sender, request.url);
            case "report": return handleReport(sender, request.url, request.title );
        }
        return Promise.reject("bad action");
    }
);

