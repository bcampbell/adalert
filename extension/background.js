"use strict";

var serverURL = "http://oddie.scumways.com:4000";
//var serverURL = "http://localhost:4000";


console.log("background.js: HELLO");




// content page has completed its scan - update popup
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
function hitServer(pageURL) {
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
                        // TODO: localisation
                        'msg': "Flagged as sponsored content (by " + inf.warns + " people)",
                        'for': inf.warns,
                        'against': 0    //inf.against
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
function handleReport(pageURL, title) {

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



function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function parseURL(url) {
    var pattern = RegExp("^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#(.*))?");
    var matches =  url.match(pattern);
    return {
        scheme: matches[2],
        host: matches[4],
        path: matches[5],
        query: matches[7],
        fragment: matches[9]
    };
}


// WWW.FOO.com  =>  foo.com
function normaliseDomain(d) {
    d = d.toLowerCase();
    if (d.startsWith("www.")) {
        d = d.substr(4);
    }
    return d;
}
    



// build a lookup table for the whitelist sites
function cookWhitelist(wl) {
    let cooked = {};
    console.log("Cooking whitelist: ",wl);
    wl.forEach( function(domain) {
        domain = normaliseDomain(domain);
        cooked[domain] = true;
    });
    return cooked;
}


let cachedOpts = null;
let cookedWhitelist = null;



function handleIsWhitelisted(pageURL) {
    let domain = parseURL(pageURL).host;
    domain = normaliseDomain(domain);

    let chk = (cookedWhitelist[domain] === true );
    return Promise.resolve(chk);
}


// set new options
// returns a promise
function setOpts(newOpts) {
    console.log("saving ",newOpts);
    // update the cache, then save to storage
    cachedOpts = newOpts;
    cookedWhitelist = cookWhitelist(newOpts.whitelist);
    return browser.storage.local.set(newOpts); // returns a promise
}


// fetches the options, ensuring cachedOpts and
// cookedWhitelist are up-to-date.
// returns a promise, yielding the options.
function getOpts() {
    if (cachedOpts!==null) {
        // Easy. Already resident.
        return Promise.resolve(cachedOpts);
    }

    return new Promise(function(resolve,reject) {
        browser.storage.local.get().then( function(opts) {
            cachedOpts = opts;
            // defaults:
            if(opts.whitelist===undefined) {
                opts.whitelist = ["scumways.com","foo.net"];
            }
            if(opts.checkarts===undefined) {
                opts.checkarts = true;
            }

            cookedWhitelist = cookWhitelist(opts.whitelist);
            resolve(cachedOpts);
        }, reject );
    });
}



// handle message from the content script
browser.runtime.onMessage.addListener(
    function(req, sender) {
        console.log("background.js: got ", req);
        switch (req.action) {
            case "scanned": return handleScanned(sender, req.result);
            case "iswhitelisted": return handleIsWhitelisted(req.url);
            case "lookuppage": return hitServer(req.url);
            case "report": return handleReport(req.url, req.title );
            case "getopts": return getOpts();
            case "setopts": return setOpts(req.opts);
        }
        return Promise.reject("bad action");
    }
);

