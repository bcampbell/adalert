"use strict";


console.log("content.js: HELLO");

var _window = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;



/**********************************
 * warning-label stuff
 **********************************/


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



var holder = null;


function showWarnings(warnings) {

    var tmpl = `<div class="XYZZY-sticker-warning">{{msg}}</div>`;


    if (holder===null) {
        holder = document.createElement('div');
        holder.id = "XYZZY-holder";
        document.body.insertBefore(holder, document.body.childNodes[0]);
    }

    for (var i=0; i<warnings.length; i++) {
        var w = warnings[i];
        var frag = build(render(tmpl, {"msg": w.default_msg}));
        holder.appendChild(frag);
    }
}


/**********************************
 * page scanning stuff
 **********************************/

// recursively search node for strings.
// returns array of matches, of form [node,startpos,endpos,matchingstring]
/*
Based on jquery.highlight work by:
Marshal <beatgates@gmail.com>
Johann Burkard <http://johannburkard.de> <mailto:jb@eaio.com>

MIT license.
 
*/
function searchHTML(node,strings) {
  function reQuote(str) {
    // escape special regexp chars
    return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
  };

    // build strings into a single regexp
    var pats = [];
    for( var i=0; i<strings.length; ++i ) {
      pats.push( '(?:' + reQuote(strings[i]) + ')' );
    }
    var pattxt = "(" + pats.join('|') + ")";
    var pat = new RegExp(pattxt,"gi"); 

    function inner(node) {
      var results = [];
        if (node.nodeType === 3) { // 3 - Text node
          // NOTE: this relies on regexp having parentheses (ie capturing),
          // so the matching part shows up in the list returned by split()
          var m = node.data.split(pat);
          var i=0;
          var pos=0;
          while((i+1)<m.length) {
            // every second item will be matching text
            pos += m[i].length;
            var end = pos + m[i+1].length;
            results.push( [node, pos, end, m[i+1]] );
            pos = end;
            i+=2;
          }
        } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName)) { // 1 - Element node
            for (var i = 0; i < node.childNodes.length; i++) {
                results.push.apply( results, inner(node.childNodes[i]));
            }
        }
        return results;
    }
 
    return inner(node);
};


function twitFinder() {
    var twits = [];

    var m = document.querySelector('meta[name="twitter:site"]');
    if (m) {
        var txt = m.getAttribute("content");
        if (!txt) {
            txt = m.getAttribute("value");
        }
        if(txt) {
            twits.push(txt);
        }
    }
    // TODO: look for twitter accounts in byline and social blocks

    return twits;
}

function getRuleForPage() {
  var domain = _window.location.host;
  domain = domain.replace('www.', '');
  return _window.AD_DETECTOR_RULES[domain];
}



// check page for article-style markup
// +ve = article, -ve = not article
// TODO: add schema.org checks
function calcArtScore() {
    let score = 0;
    var m = document.querySelector('meta[property="og:type"]');
    if (m) {
        var txt = m.getAttribute("content");
        if (!txt) {
            txt = m.getAttribute("value");
        }
        if(txt) {
            if(txt=="website" || txt=="homepage") {
                score--;
            } else if(txt=="article") {
                score++;
            }
        }
    }

    return score;
}


function doCheckContent() {
    // do keyword search of page...
    return new Promise(function(resolve, reject) {
        // TODO: proper indicators!
        let indicators = ["sponsored"];

        let hits = searchHTML(document.body, indicators);

        // promise returns true if page contains indicative words
        resolve( hits.length>0 ? true: false );
    });
}


// promise returns true if any site-specific sponsored-content matches trigger
function doCheckRules() {
    return new Promise(function(resolve,reject) {
        console.log("content.js: checking rules...");
        let hit = false;
        let rules = getRuleForPage();
        if( rules ) {
            console.log("content.js: applying rules", rules);
            for (var i=0; i<rules.length; i++) {
                var rule = rules[i];
                if (rule.match()) {
                    resolve(true);
                }
            }
        }
        resolve(false);
    });
}


function checkPage(force) {
    if (force===undefined) {
        force = false;
    }
    var pageURL = _window.location.href;
    console.log("scanning " + pageURL);

    return browser.runtime.sendMessage( {'action': "getopts"} ).then(function(opts) {
        return browser.runtime.sendMessage( {'action':"iswhitelisted", 'url': pageURL} ).then(function(isWhitelisted) {

            let artScore = null;
            if(isWhitelisted || opts.checkarts || force) {
                artScore = calcArtScore();
            }
            let twits = twitFinder();

            // all the conditions under which we scan the page
            let scan = (isWhitelisted || force || (opts.checkarts && artScore>0) );

            let out = { 'url' : pageURL,
                    'checked': scan,
                    'isWhitelisted': isWhitelisted,
                    'artScore': artScore,
                    'twits': twits,
                    'serverResults': {'status':"none"},
                    'indicative': false,
                    'ruleMatch': false,
                    'warnings': []
            };

            if( !scan ) {
                console.log("content.js: checked (noscan): ",out);
                return Promise.resolve(out);
            }

            let pserv = browser.runtime.sendMessage( {'action': "lookuppage", 'url': pageURL} );
            let prules = doCheckRules();
            let pcontent = doCheckContent();

            return Promise.all([pserv,prules,pcontent]).then( function(results) {

                out.indicative = results[2];
                out.ruleMatch = results[1];
                out.serverResults = results[0];

                out.warnings = out.serverResults.warnings;

                // if there's a site-specific rule match, synthesise a warning
                // TODO: better merge this with server sponsored-content warning
                if( out.ruleMatch) {
                    out.warnings.push({'kind':'sponsored',
                        'default_msg': "Sponsored content",
                        'for': 0,
                        'against': 0});
                }

                return Promise.resolve(out);
            });
        });
    });
}


/**********************************
 * main
 **********************************/

var pageStatus = null;

browser.runtime.onMessage.addListener(request => {
    console.log("content.js: incoming message: ", request);
    switch( request.action ) {
        case "status":
            // popup is requesting the results of our page scan
            return Promise.resolve(pageStatus);
        case "check":
            return checkPage(true).then(function(results){
                pageStatus = results;
                console.log("Scan complete: ", pageStatus);
                browser.runtime.sendMessage( {'action': "scanned", 'result': pageStatus} );
                if( pageStatus.warnings.length>0) {
                    showWarnings(pageStatus.warnings);
                }
                return Promise.resolve(pageStatus);
            });
    }
    console.log("content.js: bad message: ",request);
    return Promise.reject("bad action");
});


checkPage().then(function(results){
    pageStatus = results;
    console.log("Scan complete: ", pageStatus);
    browser.runtime.sendMessage( {'action': "scanned", 'result': pageStatus} );
    if( pageStatus.warnings.length>0) {
        showWarnings(pageStatus.warnings);
    }
});


// <meta name="twitter:site" value="@WashingtonPost"/>

// other examples (within .social blocks)
// 
// <a href="https://twitter.com/daily_express" rel="external" class="social-icons twitter">Follow us on Twitter</a>
//
// <a class="icon twitter" title="twitter" href="https://twitter.com/DailyMirror" target="_blank" data-provider="twitter" data-tracking="twitter|follow|top"></a>
//
// <a class="soc-tw site-footer-social-icon-link site-footer-social-icon-link-soc-tw" href="https://www.twitter.com/usatoday" data-uotrack="footertwitter" rel="nofollow"></a>
//

