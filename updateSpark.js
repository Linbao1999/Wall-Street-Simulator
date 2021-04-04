module.exports = function (callback) {
  var unirest = require("unirest");

  var req = unirest(
    "GET",
    "https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/get-spark"
  );

  let symbols = "";
  let stocks = [
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
  ];;

  for(let i=0;i<stocks.length;i++){
      symbols += stocks[i];
      if(i!=stocks.length-1){
          symbols+=",";
      }
  }
  console.log(symbols)
  req.query({
    symbols: symbols,
    interval: "1d",
    range: "6mo",
  });

  req.headers({
    "x-rapidapi-key": process.env.api_key,
    "x-rapidapi-host": "apidojo-yahoo-finance-v1.p.rapidapi.com",
    useQueryString: true,
  });

  req.end(function (res) {
    if (res.error) throw new Error(res.error);
    callback(res.body);

  });
};

