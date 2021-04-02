// const updateSpark = require(__dirname + "/updateSpark.js");



// const data = updateSpark((result)=>{
//     console.log(result["AAPL"].close);
// });

const updateSpark = require(__dirname + "/updateSpark.js");

let symbolList = [
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
];
updateSpark((result) => {
  for (let i = 0; i < symbolList.length; i++) {
      console.log(symbolList[i]);
      console.log(result[symbolList[i]].symbol)
      console.log(result[symbolList[i]].close)
  }

});
