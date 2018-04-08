"use strict";

//let tweetButton = document.getElementById("action-tweet");
let settingsButton = document.getElementById("settings");




function onError(error) {
  console.error(`Error: ${error}`);
}




function configPopup(tab, pageStatus) {
    console.log("configPopup():" ,tab, pageStatus);

    let atRefs = pageStatus.twits.join(" ");

    let main = document.getElementById("popup-content");
    // clear anything existing
    while (main.hasChildNodes()) {
        main.removeChild(main.lastChild);
    }

    switch( pageStatus.serverResults.status) {
        case "none":
            addNotScanned(main, tab);
            break;
        case "error":
            addServerError(main, tab, pageStatus.serverResults.error);
            break;
        case "ok":
            break;
    }


    if (pageStatus.warnings.length > 0) {
        addWarnings(main, tab.url, pageStatus.warnings);
        let foo = [atRefs, "This looks like #sponsored content"].join(" ");
        addTweetCallToAction(main, tab.url, foo );
    } else {
        if( pageStatus.indicative) {
            addIndicative(main);
        } else {
            addOK(main);
        }

        addReportButton(main, tab);
        let foo = [atRefs, "This looks like unmarked #sponsored content"].join(" ");
        addTweetCallToAction(main, tab.url, foo );
    }

    if (!pageStatus.isWhitelisted) {
        addAddToWhiteList(main, tab.url);
    }

    let dbugTxt = "debug - page info:\n\n" + JSON.stringify( pageStatus,null,2 );
    document.getElementById("dbug").textContent = dbugTxt;
}



function addNotScanned(container, tab ) {
    let pageURL = tab.url;
    let tmpl = `This page was not scanned.<br/><a id="action-scan" class="btn" href="">Scan it now</a>`;
    let frag = buildHTML(tmpl,{});
    container.append(frag);
    container.querySelector("#action-scan").addEventListener("click", function( event ) {
        event.preventDefault();
        browser.tabs.sendMessage(tab.id, {action: "check"})
            .then( function(results) {
               console.log("FOOK:",results);
               configPopup(tab,results);
            });
    }, false);
}


function addServerError(container, tab, errMsg) {
    let PageURL = tab.url;
    let tmpl = 'Server lookup failed (' + errMsg + ')<br/><a id="action-scan" class="btn" href="">try again</a>';
    let frag = buildHTML(tmpl,{});
    container.append(frag);
    container.querySelector("#action-scan").addEventListener("click", function( event ) {
        event.preventDefault();
        browser.tabs.sendMessage(tab.id, {action: "check"})
            .then( function(results) {
               console.log("FOOK:",results);
               configPopup(tab,results);
            });
    }, false);
}



function addIndicative(container) {
    let tmpl = '<div>This page contains terms which might be indicative of sponsored content</div>';
    let frag = buildHTML(tmpl,{});
    container.append(frag);
}

function addOK(container) {
    let tmpl = '<div>No issues found - this page looks OK</div>';
    let frag = buildHTML(tmpl,{});
    container.append(frag);
}




function addAddToWhiteList(container, pageURL) {

    let domain = parseURL(pageURL).host;
    let tmpl = `<a id="action-whitelist" class="" href="">add {{domain}} to list of sites to check</a>`;
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

function addReportButton(container, tab) {

    let pageURL = tab.url;
    let title = tab.title;

    let domain = parseURL(pageURL).host;
    let tmpl = `<p>Think this looks like sponsored content? <a id="action-report" class="btn" href="">Flag it</a><p>`;
    let frag = buildHTML(tmpl,{'domain':domain});
    container.append(frag);

    let button = container.querySelector("#action-report");
    button.addEventListener("click", function( event ) {
        event.preventDefault();
        browser.runtime.sendMessage({'action':"report", 'url': pageURL, 'title': title})
            .then( function() {
                let frag = buildHTML("reported.",{});
                button.parentNode.replaceChild(frag, button);
                // now rescan the page and show the results
                browser.tabs.sendMessage(tab.id, {action: "check"})
                    .then( function(results) {
                        configPopup(tab,results);
                    });
            });
    }, false);
}


function addWarnings(container, pageURL, warnings) {
    let tmpl = `<div><div class="warning-label">{{msg}}</div>
    <div>
        <small>{{agreeCnt}} <a id="action-agree" href="">agree</a>, {{disagreeCnt}} <a id="action-disagree">disagree</a></small>
    </div>
</div>`;

    for( let i=0; i<warnings.length; i++) {
        let w = warnings[i];
        let el = buildHTML(tmpl, {msg: w.default_msg, conf: w.confidence});
        container.append(el); 
    }
}


function addTweetCallToAction(container, pageURL, tweetTxt ) {
    let tmpl = `<a id="action-tweet" class="btn" href="">Tweet about it</a>`;
    let frag = buildHTML(tmpl,{});
    container.append(frag);

//    let atRefs = twits.join(" ");
//    let tweetTxt = [atRefs, "This looks like unmarked #sponsored content"].join(" ");

    let tweetURL = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(tweetTxt) +"&url=" + encodeURIComponent(pageURL);

   
    let button = container.querySelector("#action-tweet");
    button.href = tweetURL;
    button.addEventListener("click", function( event ) {
        event.preventDefault();
        let c = browser.tabs.create({
            url: button.href,
            active: true
            });
        c.then( function() {
           window.close();
        });
    },false);
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

/*
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
*/

/*
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
*/

settingsButton.addEventListener("click", function( event ) {
    event.preventDefault();
    browser.runtime.openOptionsPage();
}, false);

