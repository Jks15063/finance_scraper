//Its a scraper!
var util          = require('util')
var debug         = require('debug')('app')
var async         = require('async')
var MongoClient   = require('mongodb').MongoClient
var $             = require('cheerio')
var bhttp         = require("bhttp");
var xlsx          = require('node-xlsx')
var moment        = require('moment')

var changes = "WUT"

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

//var stockSheet = xlsx.parse(__dirname + '/tickers.xlsx')
var stockSheet = xlsx.parse(__dirname + '/Bank\ Tickers\ only.xlsx')
var stockList = stockSheet[0].data.
   map(function(item) {
      return item[0]
   })

var url = 'mongodb://localhost:27017/mydb'

MongoClient.connect(url, function(err, db) {
   if(err) {
      debug(err)
   } else {
      var collection    = db.collection('bank_data_2015');
      var missingStocks = []

      async.eachLimit(stockList, 20, function(stockName, callback) {
         if(stockName && stockName.trim().toLowerCase() !== 'ticker') {
            debug('Stock: ' + stockName)
            debug('http://finance.yahoo.com/q/ks?s=' + stockName + '+Key+Statistics')

            bhttp.get('http://finance.yahoo.com/q/ks?s=' + stockName + '+Key+Statistics', { stream: false }, function(err, res) {
                if(err) {
                  return callback(err)
                } else {
                    $              = $.load(res.body.toString());
                    var newEntry   = {}
                    newEntry.date  = moment().format("YYYY-MM-DD")
                    newEntry.stock = stockName
                    newEntry.price = $('.time_rtq_ticker').text()
                    var titlesObj  = $('.yfnc_tablehead1')
                    var valuesObj  = $('.yfnc_tabledata1')
                    var titles     = []
                    var values     = []

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
                    collection.insert(newEntry, function(err, item) {
                        if(err) {
                            debug(err)
                            return callback(err)
                        } else {
                            return callback()
                        }
                    })
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
})
