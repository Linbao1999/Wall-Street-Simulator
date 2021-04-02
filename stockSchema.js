const mongoose = require("mongoose");
const stockSchema = new mongoose.Schema({ 
    symbol: String,
    longName: String,
    absChange: Number,
    rateChange: String,
    currentPrice: Number,
    rangeLow: Number,
    rangeHigh: Number,
    sparkData: {type: [Number], default:[]},
    sparkShifted: {type: [Number], default:[]}
});

module.exports = stockSchema;
