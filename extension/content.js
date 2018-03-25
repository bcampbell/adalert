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

    var tmpl = `<div>warning:<br/>{{msg}}</div>`;


    if (holder===null) {
        holder = document.createElement('div');
        holder.id = "XYZZY_holder";
        document.body.insertBefore(holder, document.body.childNodes[0]);
    }

    for (var i=0; i<warnings.length; i++) {
        var w = warnings[i];
        var frag = build(render(tmpl, {"msg": w.msg}));
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



function isDefinitelyNotArticle() {
    var notArt = false; // assume article by default
    var m = document.querySelector('meta[property="og:type"]');
    if (m) {
        var txt = m.getAttribute("content");
        if (!txt) {
            txt = m.getAttribute("value");
        }
        if(txt) {
            if(txt=="website" || txt=="homepage") {
                notArt = true;
            }
        }
    }

    return notArt;
}


function scanPage() {
    var pageURL = _window.location.href;


    console.log("content.js: kick off lookup");
    let p = browser.runtime.sendMessage( {'action': "lookup", 'url': pageURL} );
    p.then(function(response) {
        console.log("LOOKUP RESULT: ", response);
    })



    var warnings = [];
    var notes = "";
    var twits = [];

    var indicators = ["scientists have", "scientists say",  "paper published", "research suggests", "latest research", "researchers", "the study"]

    var aus = ["australian", "australia", "aussie"];

    if (isDefinitelyNotArticle()) {
        notes = "not an article, so not checked";
    } else {
        var hits = searchHTML(document.body, aus);
        if (hits.length>0) {
            warnings.push({kind: 'sponsored',
                level: 'possible',      // possible/certain
                msg: "This article looks like it could contain sponsored content" /*,
                indicators: hits*/ } );
        }

        console.log("content.js: checking rules...");
        let rules = getRuleForPage();
        if( rules ) {
            console.log("content.js: applying rules", rules);
            for (var i=0; i<rules.length; i++) {
                var rule = rules[i];
                if (rule.match()) {
                    warnings.push({kind: 'sponsored',
                        level: 'certain',      // possible/certain
                        msg: "This contains sponsored content"
                    });
                    break;
                }
            }
        } else {
            console.log("content.js: no rules to apply");
        }

        twits = twitFinder();
    }

    // TODO: check white-list

    return {
        'url': pageURL,
        'warnings': warnings,
        'twits': twits,
        'notes': notes
    };

}


/**********************************
 * main
 **********************************/

var pageStatus = null;

browser.runtime.onMessage.addListener(request => {
    console.log("content.js: incoming message: ", request);
    if( request.action == "status") {
        // popup is requesting the results of our page scan
        return Promise.resolve(pageStatus);
    }
});


pageStatus = scanPage();
console.log("content.js: pageStatus: ",pageStatus);
// NOTE: trying to send any DOM references here will cause bad things to happen!
browser.runtime.sendMessage( {'action': "scanned", 'result': pageStatus} );

if( pageStatus.warnings.length>0) {
    showWarnings(pageStatus.warnings);
}

console.log("content.js: pageStatus2: ",pageStatus);


// <meta name="twitter:site" value="@WashingtonPost"/>

// other examples (within .social blocks)
// 
// <a href="https://twitter.com/daily_express" rel="external" class="social-icons twitter">Follow us on Twitter</a>
//
// <a class="icon twitter" title="twitter" href="https://twitter.com/DailyMirror" target="_blank" data-provider="twitter" data-tracking="twitter|follow|top"></a>
//
// <a class="soc-tw site-footer-social-icon-link site-footer-social-icon-link-soc-tw" href="https://www.twitter.com/usatoday" data-uotrack="footertwitter" rel="nofollow"></a>
//
