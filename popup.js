"use strict";

let tweetButton = document.getElementById("action-tweet");

function onError(error) {
  console.error(`Error: ${error}`);
}


function configPopup( pageStatus) {
    document.getElementById("warnings").innerText = pageStatus.warnings.toString();
    document.getElementById("twits").innerText = pageStatus.twits.toString();
    let sponsored = pageStatus.warnings.filter(w => w.kind=='sponsored');
    
    let poss = sponsored.filter(w => w.level=='possible');
    let certain = sponsored.filter(w => w.level=='certain');

    let atRefs = pageStatus.twits.join(" ");

    let tweetTxt = [atRefs, "This looks like unmarked #sponsored content"].join(" ");

    let tweetURL = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(tweetTxt) +"&url=" + encodeURIComponent(pageStatus.url);

    
    tweetButton.href = tweetURL;
/*
    if (certain.length > 0) {
        configCertain(certain, pageStatus);
    } else if (poss.length > 0) {
        configPossible(poss, pageStatus);
    } else {
        configNone(pageStatus);
    }
    */
}




//browser.browserAction.onClicked.addListener(() => {


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
                configPopup(response);
              }).catch(onError);
        }
    }).catch(onError);
//});

tweetButton.addEventListener("click", function( event ) {
    console.log("wibble");
    event.preventDefault();
    let c = browser.tabs.create({
        url: tweetButton.href,
        active: true
        });
    c.then( function() {
       window.close();
    });
}, false);

