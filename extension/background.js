"use strict";

var serverURL = "https://adalert.org.uk";


var defaultWhitelist = [
    "www.theguardian.com",
    "www.express.co.uk",
    "www.dailymail.co.uk",
    "www.standard.co.uk",
    "www.mirror.co.uk",
    "www.telegraph.co.uk",
    "www.buzzfeed.com",
    "www.telegraph.co.uk",
    "www.thesun.co.uk"
];



// content page has completed its scan - update popup button state accordingly
function handleScanned(sender, pageStatus) {
    let n = pageStatus.warnings.length;
    if (n>0) {
        // there are warnings
        browser.browserAction.setIcon({path: "icons/icon-red-48.png"});
        var badgeTxt = n.toString();
        browser.browserAction.setBadgeBackgroundColor({color:"rgb(217, 0, 0)", tabId: sender.tab.id});
        browser.browserAction.setBadgeText({text: badgeTxt, tabId: sender.tab.id});
    } else if( pageStatus.indicative) {
        browser.browserAction.setIcon({path: "icons/icon-48.png"});
        // show neutralish-looking badge
        browser.browserAction.setBadgeText({text: "?", tabId: sender.tab.id});
        browser.browserAction.setBadgeBackgroundColor({color:"#888", tabId: sender.tab.id});
    } else {
        // nothing to report
        browser.browserAction.setIcon({path: "icons/icon-grey-48.png"});
        browser.browserAction.setBadgeText({text: "", tabId: sender.tab.id});
    }
    return Promise.resolve();
}

// perform a lookup of the given url on the server
function hitServer(pageURL) {


    return new Promise(function(resolve, reject) {
        let req = new XMLHttpRequest();
        req.addEventListener("load", function() {
            if (this.status<200 || this.status >=300) {
                resolve({'status':"error", 'warnings': [], 'error':"HTTP code " + this.status});
                return;
            }

            let inf = JSON.parse(this.responseText);
            console.log("server returns: ",this.responseText);
            if(inf.status != 'ok' ) {
                inf.warnings = [];  // fudge
            }
            resolve(inf);
        });
        req.addEventListener("error", function() {
            resolve({'status':"error", 'warnings': [], 'error':"request failed"});
        });
        // api supports lookup by hash or url
//        let u = serverURL + "/api/lookup?u=" + encodeURIComponent(pageURL) 

        let bits = sjcl.hash.sha256.hash(pageURL);
        let hashed = sjcl.codec.hex.fromBits(bits);
        let u = serverURL + "/api/lookup?h=" + hashed;

        console.log("background.js: server lookup:", u);
        req.open("GET", u);
        req.send();
    });
}


// report a page as sponsored content
function handleReport(kind, pageURL, title, quant) {

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
        data.append('url', pageURL);
        data.append('title', title);
        data.append('kind', kind);
        data.append('quant', quant);    // agree +ve or disagree -ve

        console.log("background.js sending report: ",req);
        req.send(data);
    });
}




// build a lookup table for the whitelist sites
function cookWhitelist(wl) {
    let cooked = {};
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
    console.log("background.js: saving opts ",newOpts);
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
                opts.whitelist = defaultWhitelist;
            }
            if(opts.checkarts===undefined) {
                opts.checkarts = true;
            }

            cookedWhitelist = cookWhitelist(opts.whitelist);
            resolve(cachedOpts);
        }, reject );
    });
}



// handle messages from content script or popup
browser.runtime.onMessage.addListener(
    function(req, sender) {
        console.log("background.js: got ", req);
        switch (req.action) {
            case "scanned": return handleScanned(sender, req.result);
            case "iswhitelisted": return handleIsWhitelisted(req.url);
            case "lookuppage": return hitServer(req.url);
            case "report": return handleReport("sponsored", req.url, (req.title === undefined) ? "" : req.title, req.quant);
            case "getopts": return getOpts();
            case "setopts": return setOpts(req.opts);
        }
        return Promise.reject("bad action");
    }
);

