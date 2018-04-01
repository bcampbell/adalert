function saveOptions(e) {
    e.preventDefault();
    let opts = {
        "whitelist": document.querySelector("#whitelist").value,
        "checkarts": document.querySelector("#checkarts").checked
    };

    browser.runtime.sendMessage({'action':"setopts", 'opts': opts});
}

function loadOptions() {
    console.log("load");

    var getting = browser.runtime.sendMessage({'action': "getopts"});
    getting.then( function(result) {
            console.log("got ",result);
            document.querySelector("#whitelist").value = result.whitelist || "";
            let chkarts = (result.checkarts===undefined) ? true:result.checkarts;
            document.querySelector("#checkarts").checked = chkarts;
        },
        function (err) {
            console.log("loadOptions() failed: " + err );
        }
    );
}

document.addEventListener("DOMContentLoaded", loadOptions);
document.querySelector("form").addEventListener("submit", saveOptions);

