function saveOptions(e) {
    e.preventDefault();
    let raw = document.querySelector("#whitelist").value;
    let wl = raw.replace(/\r\n/g,"\n").split("\n");

    let opts = {
        "whitelist": wl,
        "checkarts": document.querySelector("#checkarts").checked
    };

    browser.runtime.sendMessage({'action':"setopts", 'opts': opts});
}

function loadOptions() {
    var getting = browser.runtime.sendMessage({'action': "getopts"});
    getting.then( function(result) {
//            console.log("got ",result);
            let raw =  result.whitelist.join("\n");
            document.querySelector("#whitelist").value = raw;
            let chkarts = result.checkarts;
            document.querySelector("#checkarts").checked = result.checkarts;
        },
        function (err) {
            console.log("loadOptions() failed: " + err );
        }
    );
}

document.addEventListener("DOMContentLoaded", loadOptions);
document.querySelector("form").addEventListener("submit", saveOptions);

