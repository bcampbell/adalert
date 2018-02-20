"use strict";

function onError(error) {
  console.error(`Error: ${error}`);
}

function sendMessageToTabs(tabs) {
  for (let tab of tabs) {
    chrome.tabs.sendMessage(
      tab.id,
      {greeting: "Hi from background script"}
    ).then(response => {
      console.log("popup.js: response from content.js:");
      console.log(response.twits);
      document.getElementById("twits").innerText = response.twits.toString();
    }).catch(onError);
  }
}

//browser.browserAction.onClicked.addListener(() => {
  chrome.tabs.query({
    currentWindow: true,
    active: true
  }).then(sendMessageToTabs).catch(onError);
//});


