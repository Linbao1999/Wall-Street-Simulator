const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const date = require(__dirname + "/date.js");
const simpleStat = require(__dirname + "/simpleStat.js");
const app = express();
const path = require("path");
const { find } = require("async");
const initializeDB = require(__dirname + "/initDB.js");
const stockSchema = require(__dirname + "/stockSchema.js");
app.set("view engine", "ejs");

mongoose.set('useUnifiedTopology', true);
mongoose.connect("mongodb://localhost:27017/stockmarket",{ useNewUrlParser: true });


Stock = mongoose.model("Stock", stockSchema);

initializeDB(function (stocks) {
    Stock.insertMany(stocks, function (err) {
        if (err) {
          console.log(err);
        } else {
          console.log("Successfully Inserted.");
        }
      });
  });


