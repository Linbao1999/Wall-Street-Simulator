const express = require("express");
const bodyParser = require("body-parser");
const stockSchema = require(__dirname +"/stockSchema.js");
const app = express();

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

module.exports = function (symbol,callback) {
  var unirest = require("unirest");

  var req = unirest(
    "GET",
    "https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-statistics"
  );

  req.query({
    symbol: symbol,
    region: "US",
  });

  req.headers({
    "x-rapidapi-key": process.env.api_key,
    "x-rapidapi-host": "apidojo-yahoo-finance-v1.p.rapidapi.com",
    useQueryString: true,
  });

  req.end(function (res) {
    const data = res.body;
    const lastPrice = data.price.regularMarketPreviousClose.raw;
    const currentPrice = data.price.regularMarketPrice.raw;
    let absChange = (currentPrice - lastPrice).toFixed(2);
    let rateChange = absChange / lastPrice;
    rateChange = (rateChange * 100).toFixed(2).toString() + "%";
    if (res.error) throw new Error(res.error);
    const result = {
      symbol: data.quoteType.symbol,
      longName: data.quoteType.longName,
      absChange: absChange,
      currentPrice: currentPrice,
      rateChange: rateChange,
      rangeLow: data.quoteData[symbol].fiftyTwoWeekLow.raw,
      rangeHigh: data.quoteData[symbol].fiftyTwoWeekHigh.raw
    };
     callback(result);
  });
};
