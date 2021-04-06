const express = require("express");
const bodyParser = require("body-parser");
const getSimpleStat = require(__dirname + "/simpleStat.js");

module.exports = function(callback){
    stocks = [];
    var stock_list =  [
        "AAPL",
        "TSLA",
        "AMZN",
        "MSFT",
        "NIO",
        "NVDA",
        "MRNA",
        "NKLA",
        "AMD",
        "NFLX",
        "FB",
        "GOOG",
        "AMAT",
        "BIDU",
        "CSCO",
        "ADBE",
        "INTC",
        "QCOM",
        "SBUX",
        "VOD"
      ];
    function helper(pos){
        let end = (pos+5<=stock_list.length) ? pos+5: stock_list.length;
        for(let i=pos;i<end;i++){
            console.log(stock_list[i]);
            getSimpleStat(stock_list[i],function(result){
                stocks.push(result);
                if(stocks.length===stock_list.length){
                    callback(stocks);
                    console.log("5 stocks updated");
                }
                if(i==end-1){
                    setTimeout(helper, 1*1500,pos+5);
                }
            });
        }
    }

    helper(0);
}






