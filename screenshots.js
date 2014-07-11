"use strict";

var p = require('phantom'),
    resemble = require('resemble').resemble,
	fs = require('fs');

function takeScreenshots(opts, logger, cb) {
	var phpServer = opts.phpServer;
	if (!phpServer) {
		cb("Unknown PHP server to generate PHP parser html screenshot");
		return;
	}

	var psdServer = opts.parsoidServer;
	if (!psdServer) {
		cb("Unknown Parsoid server to generate Parsoid parser html screenshot");
		return;
	}

	var wiki = opts.wiki;
	var title = opts.title;
	var outdir = opts.outdir;
	var prefix = opts.prefix;

	var phpDone = false;
	var parsoidDone = false;
	var phpErr = null;
	var parsoidErr = null;
	var browser;

	function testCompletion(browser, cb) {
		if (phpErr || parsoidErr) {
			browser.exit();
			cb(phpErr || parsoidErr);
		}
		if (phpDone && parsoidDone) {
			browser.exit();
			cb();
		}
	}

	p.create(function (ph) {
	  browser = ph;

	  // PHP output
	  ph.createPage(function (page) {
		page.set('viewportSize', { width: opts.viewportWidth, height: opts.viewportHeight }, function (result) {
		  logger("PHP viewport set to: " + result.width + "x" + result.height);
		});
		page.open(phpServer + title, function (status) {
		  if (status !== "success") {
			  phpErr = "Couldn't open page " + phpServer + title + ". Got result " + status;
			  phpDone = true;
			  testCompletion(browser, cb);
			  return;
		  }

		  page.includeJs("http://ajax.googleapis.com/ajax/libs/jquery/1.6.1/jquery.min.js", function() {
			page.evaluate(function() {
				// Open navboxes
				$("table.collapsible tr").show();

				// Hide navigation
				$("div#mw-page-base").hide();
				$("div#mw-head-base").hide();
				$("div#mw-navigation").hide();
				$("div#footer").hide();
				$("div.suggestions").hide();

				// Hide site notice and other anchors
				$("a#top").hide();
				$("div#siteNotice").hide();

				// Hide top header + site byline + other non-display/navigational elts. not present in parsoid output.
				$("h1.firstHeading").hide();
				$("div#siteSub").hide();
				$("div#contentSub").hide();
				$("div#jump-to-nav").hide();

				// Hide toc
				$("div.toc").hide();

				// Hide edit links
				$("span.mw-editsection").hide();

				// Hide catlinks + footer
				$("div.printFooter").hide();
				$("div#catlinks").hide();
				$("div#catlinks+div.visualClear").hide();

				// Hide show/hide buttons
				$("span.collapseButton").hide();
			});
			page.render(outdir + prefix + ".php.png", function() {
				logger("php done!");
				phpDone = true;
			    testCompletion(browser, cb);
			});
		  });
		});
	  });

	  ph.createPage(function (page) {
		page.set('viewportSize', { width: opts.viewportWidth, height: opts.viewportHeight }, function (result) {
		  logger("Parsoid viewport set to: " + result.width + "x" + result.height);
		});
		page.open(psdServer + wiki + "/" + title, function (status) {
		  if (status !== "success") {
			  parsoidErr = "Couldn't open page " + psdServer + wiki + "/" + title + ". Got result " + status;
			  parsoidDone = true;
			  testCompletion(browser, cb);
			  return;
		  }
		  page.includeJs("http://ajax.googleapis.com/ajax/libs/jquery/1.6.1/jquery.min.js", function() {
			page.evaluate(function(dumpOutput) {
			  var body = document.body;
			  var content = body.firstChild;

			  // Add php-style wrappers around parsoid output
			  var div1 = document.createElement("div");
			  div1.setAttribute("class", "mw-body");
			  div1.setAttribute("id", "content");

			  var div2 = document.createElement("div");
			  div2.setAttribute("class", "mw-body-content");
			  div2.setAttribute("id", "bodyContent");

			  var div3 = document.createElement("div");
			  div3.setAttribute("class", "mw-content-ltr");
			  div3.setAttribute("id", "mw-content-text");

			  // Migrate content into the div
			  while (content) {
				next = content.nextSibling;
				div3.appendChild(content);
				content = next;
			  }

			  div2.appendChild(div3);
			  div1.appendChild(div2);
			  body.appendChild(div1);

			  // Overwrite parsoid classes with php classes on body
			  body.setAttribute("class", "mediawiki ltr sitedir-ltr");

			  // Open navboxes
			  $("table.collapsible tr").show();

			  // Fix problem with parsoid css to reduce rendering diffs
			  $('<style type="text/css">span.reference {line-height: 1;} sup,sub {line-height:1;}</style>').appendTo('head');

			  if (dumpOutput) {
				  var header = document.head.innerHTML.replace(/href="\/\//g, 'href="http://');
			  	  return "<!DOCTYPE html>\n<html><head>" + header + "</head>" + document.body.outerHTML;
			  } else {
				  return "";
			  }
			}, function(result) {
				if (opts.dumpParsoidHTML) {
					var prefix = opts.prefix;
					var dir    = (opts.outdir || "./" + opts.wiki + "/").replace(/\/$/, '') + "/";
					fs.writeFileSync(dir + prefix + ".parsoid.html", result);
				}
			},
			opts.dumpParsoidHTML
			);

			page.render(outdir + prefix + ".parsoid.png", function() {
				logger("parsoid done!");
				parsoidDone = true;
			    testCompletion(browser, cb);
			});
		  });
		});
	  });
	});
}

if (typeof module === "object") {
	module.exports.takeScreenshots = takeScreenshots;
}
