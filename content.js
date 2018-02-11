"use strict";


var twits = [];


browser.runtime.onMessage.addListener(request => {
  console.log("content.js: Message from popup:");
  console.log(request.greeting);
  console.log("content.js: twits is: ", twits);
  return Promise.resolve({'twits': twits});
});

document.body.style.border = "5px solid red";


function findTwits() {
    var m = document.querySelector('meta[name="twitter:site"]');
    if (m) {
        var txt = m.getAttribute("content");
        if (!txt) {
            var txt = m.getAttribute("value");
        }
        if(txt) {
            twits.push(txt);
            console.log("content.js: twits found", twits);
            browser.runtime.sendMessage({ twits: twits });
        }
    }
}


var label_template = '\
<div class="unsrced-label">\
\
  <img class="unsrced-label-icon" src="{{icon_url}}" alt="{{prettyname}}" />\
  <div class="unsrced-label-bod"><div class="unsrced-label-head">WARNING</div>\
  {{description}}\
  </div>\
</div>\
';


// cheesy little template system, eg "Hello, {{name}}!"
function render(tmpl, values) {
  var regex = /\{\{\s*(.*?)\s*\}\}/gi;
  return tmpl.replace(regex, function(m,p1) {
    return values[p1];
  });
}

function build(tmpl,values) {
    var regex = /\{\{\s*(.*?)\s*\}\}/gi;
    var content = tmpl.replace(regex, function(m,p1) {
        return values[p1];
    });

    var frag = document.createDocumentFragment();
    var tmp = document.createElement('div');
    tmp.innerHTML = content;
    while (tmp.firstChild) {
        frag.appendChild(tmp.firstChild);
    }
    return frag;
}



var holder = null;

var tmpl = `<div>msg is: <strong>{{msg}}</strong></div>`;

function showWarning() {
    if (holder===null) {
        holder = document.createElement('div');
        holder.id = "XYZZY_holder";
        document.body.insertBefore(holder, document.body.childNodes[0]);
    }

    var frag = build(tmpl, {"msg": "Wibble!"});
    holder.appendChild(frag);

}




findTwits();

showWarning();


// <meta name="twitter:site" value="@WashingtonPost"/>

// other examples (within .social blocks)
// 
// <a href="https://twitter.com/daily_express" rel="external" class="social-icons twitter">Follow us on Twitter</a>
//
// <a class="icon twitter" title="twitter" href="https://twitter.com/DailyMirror" target="_blank" data-provider="twitter" data-tracking="twitter|follow|top"></a>
//
// <a class="soc-tw site-footer-social-icon-link site-footer-social-icon-link-soc-tw" href="https://www.twitter.com/usatoday" data-uotrack="footertwitter" rel="nofollow"></a>
//

