var cheerio = require("cheerio"),
	request = require("request"),
	fs = require("fs"),
	jz = require("jeezy"),
	_ = require("underscore");

_.rateLimit = function(func, rate, async) {
  var queue = [];
  var timeOutRef = false;
  var currentlyEmptyingQueue = false;
  
  var emptyQueue = function() {
    if (queue.length) {
      currentlyEmptyingQueue = true;
      _.delay(function() {
        if (async) {
          _.defer(function() { queue.shift().call(); });
        } else {
          queue.shift().call();
        }
        emptyQueue();
      }, rate);
    } else {
      currentlyEmptyingQueue = false;
    }
  };
  
  return function() {
    var args = _.map(arguments, function(e) { return e; }); // get arguments into an array
    queue.push( _.bind.apply(this, [func, this].concat(args)) ); // call apply so that we can pass in arguments as parameters as opposed to an array
    if (!currentlyEmptyingQueue) { emptyQueue(); }
  };
};

getUrls("hbgary-emails");

function getUrls(directory){
	var home_url = "https://wikileaks.org/" + directory + "/?q=";

	var crawlPageLimited = _.rateLimit(crawlPage, 2000);
	var makeFileLimited = _.rateLimit(makeFile, 1000);

	request(home_url, (error, response, body) => {
		// handle errors
		if (error) {
			console.log(home_url);
			console.log(error);
			return;
		} 

		// handle bad responses
		else if (response.statusCode !== 200) {
			console.log(home_url);
			console.log(response.statusCode);
			return;
		}

		var $ = cheerio.load(body);

		// get number of pages
		var number_of_pages = +$("#right-pane > div:nth-child(5) > div > ul > li.next").prev().text().trim();
		console.log("Found " + number_of_pages + " pages, or about " + (number_of_pages * 50) + " files.");
		
		for (var i = 1; i <= number_of_pages; i++){
			crawlPageLimited(home_url + "&page=" + i);
		}

	});

	function crawlPage(page_url) {
		request(page_url, (error, response, body) => {
			// handle errors
			if (error) {
				console.log(home_url);
				console.log(error);
				return;
			} 

			// handle bad responses
			else if (response.statusCode !== 200) {
				console.log(home_url);
				console.log(response.statusCode);
				return;
			}

			var $ = cheerio.load(body);

			$("#right-pane > table > tbody").find("tr").each((row_index, row) => {

				makeFileLimited("https://wikileaks.org/" + directory + "/" + $(row).find("td").find("a").attr("href"))

			});
		})
	}

	function makeFile(file_url){
		request(file_url, (error, response, body) => {
			
			// handle errors
			if (error) {
				console.log(file_url);
				console.log(error);
				return;
			} 

			// handle bad responses
			else if (response.statusCode !== 200) {
				console.log(file_url);
				console.log(response.statusCode);
				return;
			}

			var $ = cheerio.load(body);

			var content = $(".tab-content #content").text().trim();

			var file_name = jz.str.replaceAll(file_url.split("wikileaks.org")[1].replace("/", ""), "/", "-") + ".txt";

			console.log("Writing " + file_name);
			fs.writeFileSync(directory + "/" + file_name, content);

		});
	}
}