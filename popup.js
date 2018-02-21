"use strict";

let tweetButton = document.getElementById("action-tweet");
let msgDiv = document.getElementById("msg");

// cheesy little template system, eg:
//   render( "Hello, {{name}}!", {name:"Bob"})
function render(tmpl, values) {
  var regex = /\{\{\s*(.*?)\s*\}\}/gi;
  return tmpl.replace(regex, function(m,p1) {
    return values[p1];
  });
}

function build(content) {
    var frag = document.createDocumentFragment();
    var tmp = document.createElement('div');
    tmp.innerHTML = content;
    while (tmp.firstChild) {
        frag.appendChild(tmp.firstChild);
    }
    return frag;
}


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

    let tweetTxt = null;
    let popupTxt = null;
    let tweetButtonTxt = null;

    if (certain.length>0) {
        popupTxt = "This article is sponsored content";
        tweetTxt = [atRefs, "This article is #sponsored content"].join(" ");
        tweetButtonTxt = "Tweet about it";
    } else if (poss.length>0) {
        popupTxt = "This page contains text which might indicate sponsored content";
        tweetTxt = [atRefs, "This page looks like it might be unmarked #sponsored content"].join(" ");
        tweetButtonTxt = "Tweet about it";
    } else {
        popupTxt = "Is this page sponsored content?";
        tweetTxt = [atRefs, "This article is #sponsored content"].join(" ");
        tweetButtonTxt = "Tweet about it";
    }

    let tweetURL = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(tweetTxt) +"&url=" + encodeURIComponent(pageStatus.url);
    
    tweetButton.href = tweetURL;
    tweetButton.innerHTML = tweetButtonTxt;
    msgDiv.innerHTML = popupTxt;
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

