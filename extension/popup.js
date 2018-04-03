"use strict";

let tweetButton = document.getElementById("action-tweet");
let reportButton = document.getElementById("action-report");
let msgDiv = document.getElementById("msg");
let settingsButton = document.getElementById("settings");




function onError(error) {
  console.error(`Error: ${error}`);
}




function configPopup(tab, pageStatus) {
    console.log("configPopup():" ,tab, pageStatus);

    let main = document.getElementById("popup-content");
    // clear anything existing
    while (main.hasChildNodes()) {
        main.removeChild(main.lastChild);
    }

    if (!pageStatus.hitServer) {
        addNotScanned(main, tab.url);
    }

    if (pageStatus.warnings.length > 0) {
        addWarnings(main, tab.url, pageStatus.warnings);
    } else {
        addReportButton(main, tab.url);
    }

    if (!pageStatus.isWhitelisted) {
        addAddToWhiteList(main, tab.url);
    }

    // list any warnings
    if( pageStatus.warnings.length>0) {
        addWarnings(main, pageStatus.warnings);
    }

    let dbugTxt = "debug - page info:\n\n" + JSON.stringify( pageStatus,null,2 );
    document.getElementById("dbug").textContent = dbugTxt;
}



function addNotScanned(container, pageURL) {
    let tmpl = `This page was not scanned.<br/><a id="action-scan" class="btn" href="">Scan it now</a>`;
    let frag = buildHTML(tmpl,{});
    container.append(frag);
    container.querySelector("#action-scan").addEventListener("click", function( event ) {
        event.preventDefault();
        console.log("ACTION-SCAN");
        // TODO: send 'checkpage' action
    }, false);
}

function addAddToWhiteList(container, pageURL) {

    let domain = parseURL(pageURL).host;
    let tmpl = `<a id="action-whitelist" class="" href="">add {{domain}} to whitelist</a>`;
    let frag = buildHTML(tmpl,{'domain':domain});
    container.append(frag);
    let button = container.querySelector("#action-whitelist");
    button.addEventListener("click", function( event ) {
        event.preventDefault();
        console.log("ACTION-WHITELIST");

        // get opts, add site, save opts.
        browser.runtime.sendMessage({'action':"getopts"}).then(
            function(opts) {
                opts.whitelist.push(domain);
                return browser.runtime.sendMessage({'action':"setopts", 'opts': opts });
            }).then( function() {
                frag = buildHTML("added.",{});
                button.parentNode.replaceChild(frag, button);
            });
    }, false);
}

function addReportButton(container, pageURL) {

    let domain = parseURL(pageURL).host;
    let tmpl = `<p>Think this looks like sponsored content? <a id="action-report" class="btn" href="">Flag it</a><p>`;
    let frag = buildHTML(tmpl,{'domain':domain});
    container.append(frag);
    container.querySelector("#action-report").addEventListener("click", function( event ) {
        event.preventDefault();
        console.log("ACTION-REPORT");
        // TODO:
    }, false);
}


function addWarnings(container, pageURL, warnings) {
    let tmpl = `<div>({{conf}}) {{msg}}</div>`;

    for( let i=0; i<warnings.length; i++) {
        let w = warnings[i];
        let el = buildHTML(tmpl, {msg: w.msg, conf: w.confidence});
        container.append(el); 
    }
}





//
browser.tabs.query({
        currentWindow: true,
        active: true
    }).then( function(tabs) {
        for (let tab of tabs) {
            // ask content.js for it's page scan result
            let s = browser.tabs.sendMessage(tab.id, {action: "status"});
            s.then(response => {
                //console.log("popup.js: response from content.js: ", response);
                configPopup(tab, response);
              });
        }
    }).catch(onError);
//});

tweetButton.addEventListener("click", function( event ) {
    event.preventDefault();
    let c = browser.tabs.create({
        url: tweetButton.href,
        active: true
        });
    c.then( function() {
       window.close();
    });
}, false);

reportButton.addEventListener("click", function( event ) {
    event.preventDefault();

    browser.tabs.query({
        currentWindow: true,
        active: true
    }).then( function(tabs) {
        for (let tab of tabs) {
            console.log("report:", tab.url, tab.title);
            let s = browser.runtime.sendMessage({action: "report", url: tab.url, title: tab.title});
            s.then(response => {
                console.log("popup.js: response from background.js: ", response);
              }).catch(function() { console.log("Poop.")});
        }
    }).catch(onError);


}, false);

settingsButton.addEventListener("click", function( event ) {
    event.preventDefault();
    browser.runtime.openOptionsPage();
}, false);

