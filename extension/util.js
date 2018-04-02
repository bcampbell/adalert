// assorted util fns

function escapeRegexp(str) {
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
    

// cheesy little template system, eg:
//   render( "Hello, {{name}}!", {name:"Bob"})
function render(tmpl, values) {
  var regex = /\{\{\s*(.*?)\s*\}\}/gi;
  return tmpl.replace(regex, function(m,p1) {
    return values[p1];
  });
}

function buildHTML(tmpl,values) {
    let tmp = document.createElement('div');
    let frag = document.createDocumentFragment();
    tmp.innerHTML = render(tmpl,values);
    while (tmp.firstChild) {
        frag.appendChild(tmp.firstChild);
    }
    return frag;
}


//
function currentTab() {
    return new Promise(function(resolve,reject) {
        browser.tabs.query({
            currentWindow: true,
            active: true
        }).then( function(tabs) {
            if( tabs.length>0) {
                resolve(tabs[0]);
            }
            resolve(null);
        });
    });
}

