var util        = require('util')
var debug       = require('debug')('app')
var async       = require('async')
var MongoClient = require('mongodb').MongoClient
var Nightmare   = require('nightmare')
var $           = require('cheerio')
var xlsx        = require('node-xlsx')
var moment      = require('moment')

Array.prototype.mergeAll = function() {
   var results = []
   this.
      forEach(function(subArray) {
         results.push.apply(results, subArray)
      })
   return results
}

Array.prototype.flatMap = function(projectionFunction) {
   return this.
      map(function(item) {
         return projectionFunction(item)
   }).
   mergeAll()
}

Array.zip = function(left, right, combinerFunction) {
   var counter,
   results = []
   for(counter = 0; counter < Math.min(left.length, right.length); counter++) {
      results.push(combinerFunction(left[counter], right[counter]))
   }
   return results
}

var stockSheet = xlsx.parse(__dirname + '/tickers.xlsx')
var stockList = stockSheet[0].data.
   map(function(item) {
      return item[0]
   })

var url = 'mongodb://localhost:27017/mydb'
MongoClient.connect(url, function(err, db) {
   if(err) {
      debug(err)
   } else {
      var collection = db.collection('finance');
      var missingStocks = []
      async.eachSeries(stockList, function(stockName, callback) {
         var me = this
         if(stockName.trim().toLowerCase() !== 'ticker') {
            debug('Stock: ' + stockName)
            debug('http://finance.yahoo.com/q/ks?s=' + stockName + '+Key+Statistics')
            this.nightmare = new Nightmare({timeout: 20000})

            me.nightmare
            .on('error', function(err) {
               debug('ERROR:: ' + err)
               missingStocks.push(stockName)
               me.nightmare.teardownInstance()
            })
            .on('timeout', function(msg) {
               debug('TIMEOUT: ' + msg)
               missingStocks.push(stockName)
               me.nightmare.teardownInstance()
            })
            .goto('http://finance.yahoo.com/q/ks?s=' + stockName + '+Key+Statistics')
            .evaluate(function() {
               var obj         = {}
               var tempSummary = document.getElementById("yfi_rt_quote_summary")
               obj.summary     = (tempSummary) ? tempSummary.outerHTML : null
               var tempCenter  = document.getElementById("yfncsumtab")
               obj.centerTable = (tempCenter) ? tempCenter.outerHTML : null
               return obj
            }, function(res) {
               if(res && res.summary && res.centerTable) {
                  var newEntry          = {}
                  newEntry.date         = moment().format("YYYY-MM-DD")
                  newEntry.stock        = stockName
                  var parsedSummary     = $.load(res.summary)
                  var parsedCenterTable = $.load(res.centerTable)
                  var ticker            = parsedSummary('.time_rtq_ticker')
                  newEntry.price        = ticker["0"].children[0].children[0].data
                  var titlesObj         = parsedCenterTable('.yfnc_tablehead1')
                  var valuesObj         = parsedCenterTable('.yfnc_tabledata1')
                  var titles            = []
                  var values            = []
                  debug('Price: ' + ticker["0"].children[0].children[0].data)
                  titlesObj.each(function(i, elem) {
                     if(elem.children && elem.children[0].data) {
                        titles.push(elem.children[0].data)
                     }
                  })
                  valuesObj.each(function(i, elem) {
                     if(elem.children) {
                        if(elem.children[0].data) {
                           values.push(elem.children[0].data)
                        } else {
                           values.push(elem.children[0].children[0].data)
                        }
                     }
                  })
                  var combined = Array.zip(titles, values, function(title, value) {
                     newEntry[title] = value
                     return
                  })
                  // TODO fix upsert, it inserts even if record for that day exists
                  //var match = {}
                  //match.stock = stockName
                  //match.date = moment().format("YYYY-MM-DD")
                  //collection.update(match, newEntry, {upsert: true}, function(err, item) {
                  collection.insert(newEntry, function(err, item) {
                     if(err) {
                        debug(err)
                     }
                     me.nightmare.teardownInstance()
                     return callback()
                  })
               } else {
                  debug('Failed to get HTML for ' + stockName)
                  missingStocks.push(stockName)
                  // missing a stock hangs it up for some reason so manually tear it down
                  me.nightmare.teardownInstance()
                  return callback()
               }
            })
            .run(function(err, nightmare) {
               if(err) {
                  debug(err)
               } else {
                  debug('--------------')
               }
            })
         } else {
            return callback()
         }
      }, function(err) {
         if(err) {
            debug(err)
         } else {
            debug('Completed')
            debug('Missing Stocks: ' + missingStocks)
         }
         db.close()
      })
   }
});







