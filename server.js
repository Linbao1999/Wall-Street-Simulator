const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const simpleStat = require(__dirname + "/simpleStat.js");
const path = require("path");
const { find, forEach } = require("async");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
var CronJob = require("cron").CronJob;
var async = require("async");

const initializeDB = require(__dirname + "/initDB.js");
const updateSpark = require(__dirname + "/updateSpark.js");
const stockSchema = require(__dirname + "/stockSchema.js");

const app = express();

//default list
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

//stocks that get updated in the database
// let wholeList = [
//   "AAPL",
//   "TSLA",
//   "AMZN",
//   "MSFT",
//   "NIO",
//   "NVDA",
//   "MRNA",
//   "NKLA",
//   "AMD",
//   "NFLX",
//   "FB",
//   "GOOG",
//   "AMAT",
//   "BIDU",
//   "CSCO",
//   "ADBE",
//   "INTC",
//   "QCOM",
//   "SBUX",
//   "VOD"
// ]

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.secret,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

const MongoClient = require("mongodb").MongoClient;
const mongodbURL = process.env.mongodbURL;

mongoose.set("useUnifiedTopology", true);
mongoose.connect(mongodbURL, {
  useNewUrlParser: true,
});
mongoose.set("useCreateIndex", true);

const Stock = mongoose.model("Stock", stockSchema);
const transactionSchema = new mongoose.Schema({
  username: String,
  date: String,
  type: String,
  price: String,
  symbol: String,
  amount: Number,
});
const investmentSchema = new mongoose.Schema({
  username: String,
  symbol: String,
  amount: Number,
  cost: { type: Number, default: 0 },
});
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  transactionHistory: { type: [transactionSchema], default: [] },
  balance: { type: Number, default: 100000 },
  investments: { type: [investmentSchema], default: [] },
  watchlist: { type: [String], default: symbolList },
});
const sparkSchema = new mongoose.Schema({
  symbol: String,
  data: { type: [Number], default: [] },
});

userSchema.plugin(passportLocalMongoose);

const Transaction = mongoose.model("Transaction", transactionSchema);
const User = mongoose.model("User", userSchema);
const Investment = mongoose.model("Investment", investmentSchema);
const Spark = mongoose.model("Spark", sparkSchema);
passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

//initialize DB
app.get("/init", function (req, res) {
  // Stock.remove({}, () => {
  //   initializeDB(function (stocks) {
  //     Stock.insertMany(stocks, function (err) {
  //       if (err) {
  //         console.log(err);
  //       } else {
  //         res.redirect("/")
  //       }
  //     });
  //   });
  // });
  Stock.find({}, function (err, foundStocks) {
    let reloadSparks = {};
    for (let i = 0; i < foundStocks.length; i++) {
      reloadSparks[foundStocks[i].symbol] = foundStocks[i].sparkData;
    }
    if(reloadSparks.length!=0){
      console.log("sparks data stored to reloadSparks")
    }
    Stock.remove({}, () => {
      console.log("Stocks removed")
      initializeDB(function (stocks) {
        Stock.insertMany(stocks, function (err) {
          console.log("New Stocks inserted")
          Stock.find({}, function (err, updatedStocks) {
            for (let i = 0; i < updatedStocks.length; i++) {
              updatedStocks[i].sparkData =
              reloadSparks[updatedStocks[i].symbol];
            }
            async.forEachOf(
              updatedStocks,
              function (value, key, callback) {
                updatedStocks[key].save();
                callback();
              },
              () => {
                res.redirect("/");
              }
            );
          });
        });
      });
    });
  });
});

app.get("/updateSpark", function (req, res) {
  Stock.find({}, function (err, foundStocks) {
    updateSpark(function (sparks) {
      for (let i = 0; i < foundStocks.length; i++) {
        foundStocks[i].sparkData = sparks[foundStocks[i].symbol].close;
      }
      async.forEachOf(
        foundStocks,
        function (value, key, callback) {
          console.log(key);
          foundStocks[key].save();
        },
        () => {
          res.redirect("/");
        }
      );
    });
  });
});

var stockUpdate = new CronJob(
  "*/30 10-15 * * 1-5",
  function () {
    Stock.find({}, function (err, foundStocks) {
      let reloadSparks = {};
      for (let i = 0; i < foundStocks.length; i++) {
        reloadSparks[foundStocks[i].symbol] = foundStocks[i].sparkData;
      }
  
      Stock.remove({}, () => {
        initializeDB(function (stocks) {
          Stock.insertMany(stocks, function (err) {
            Stock.find({}, function (err, updatedStocks) {
              for (let i = 0; i < updatedStocks.length; i++) {
                updatedStocks[i].sparkData =
                reloadSparks[updatedStocks[i].symbol];
              }
              async.forEachOf(
                updatedStocks,
                function (value, key, callback) {
                  console.log(key);
                  updatedStocks[key].save();
                },
                () => {
                  console.log("stock all updated");;
                }
              );
            });
          });
        });
      });
    });
  },
  null,
  true,
  "America/New_York"
);
stockUpdate.start();

var sparkUpdate = new CronJob(
  "40 9 * * 1-5",
  function () {
    Stock.find({}, function (err, foundStocks) {
      updateSpark(function (sparks) {
        for (let i = 0; i < foundStocks.length; i++) {
          foundStocks[i].sparkData = sparks[foundStocks[i].symbol].close;
        }
        async.forEachOf(
          foundStocks,
          function (value, key, callback) {
            console.log(key);
            foundStocks[key].save();
          },
          () => {
            console.log("updated spark");
          }
        );
      });
    });
  },
  null,
  true,
  "America/New_York"
);
sparkUpdate.start();

app.get("/", function (req, res) {
  if (req.isAuthenticated()) {
    User.findOne({ username: req.user.username }, function (err, foundUser) {
      Stock.find(
        { symbol: { $in: foundUser.watchlist } },
        function (err, foundStocks) {
          getInvestInfo(foundUser.investments, function (investmentInfo) {
            res.render("index", {
              username: req.user.username,
              investmentInfo: investmentInfo,
              watchListStocks: foundStocks,
              userInfo: {
                username: req.user.username,
                balance: foundUser.balance,
              },
              errMessage: "None",
            });
          });
        }
      );
    });
  } else {
    Stock.find({}, function (err, foundStocks) {
      res.render("index", {
        watchListStocks: foundStocks,
        userInfo: undefined,
        investmentInfo: undefined,
        errMessage: "None",
      });
    });
  }
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err) {
      if (err) {
        res.render("err-register", {
          errMessage: "Username is already been used.",
        });
      } else {
        passport.authenticate("local")(req, res, function (err) {
          res.redirect("/");
        });
      }
    }
  );
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      res.render("err-login", {
        errMessage: "Username and password combination is incorrect.",
      });
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/");
      });
    }
  });
});

function getInvestInfo(investments, callback) {
  let symbols = [];
  let dict = {};
  for (let i = 0; i < investments.length; i++) {
    symbols.push(investments[i].symbol);
    dict[symbols[i]] = i;
  }
  let profit = new Array(symbols.length);
  let profitRate = new Array(symbols.length);
  let currentPrice = new Array(symbols.length);
  let totalCost = 0;
  let totalProfit = 0;
  Stock.find({ symbol: { $in: symbols } }, function (err, foundStocks) {
    for (let i = 0; i < foundStocks.length; i++) {
      let stock = foundStocks[i];
      let item = investments[dict[stock.symbol]];
      profit[dict[stock.symbol]] = stock.currentPrice * item.amount - item.cost;

      profitRate[dict[stock.symbol]] =
        ((stock.currentPrice * item.amount - item.cost) / item.cost) * 100;

      currentPrice[dict[stock.symbol]] = stock.currentPrice;

      totalCost += item.cost;

      totalProfit += profit[dict[stock.symbol]];
    }
    let investmentInfo = {
      profit: profit,
      profitRate: profitRate,
      currentPrice: currentPrice,
      totalCost: totalCost,
      totalProfit: totalProfit,
    };

    callback(investmentInfo);
  });
}

app.get("/stock-market", function (req, res) {
  if (req.isAuthenticated()) {
    Stock.find({}, function (err, foundStocks) {
      let username = req.user.username;
      User.findOne({ username: username }, function (err, foundUser) {
        getInvestInfo(foundUser.investments, function (investmentInfo) {
          res.render("index", {
            username: username,
            watchListStocks: foundStocks,
            investmentInfo: investmentInfo,
            userInfo: { username: username, balance: foundUser.balance },
            errMessage: "None",
          });
        });
      });
    });
  } else {
    Stock.find({}, function (err, foundStocks) {
      res.render("index", {
        watchListStocks: foundStocks,
        investmentInfo: undefined,
        userInfo: undefined,
        errMessage: "None",
      });
    });
  }
});

app.get("/myinvestment", function (req, res) {
  if (req.isAuthenticated()) {
    let username = req.user.username;
    User.findOne({ username: username }, function (err, foundUser) {
      getInvestInfo(foundUser.investments, function (investmentInfo) {
        res.render("myinvestment", {
          username: username,
          investments: foundUser.investments,
          investmentInfo: investmentInfo,
          userInfo: { username: username, balance: foundUser.balance },
          errMessage: "None",
        });
      });
    });
  } else {
    res.render("err-login", { errMessage: "Please Login First." });
  }
});

// app.get("/history")

app.post("/edit", function (req, res) {
  if (req.isAuthenticated()) {
    let newWatchlist = [];
    User.findOne({ username: req.user.username }, function (err, foundUser) {
      let errMessage = "None";
      let username = req.user.username;
      if (err) {
        errMessage = err;
      } else {
        let targetSymbol = req.body.targetSymbol;
        if (req.body.editType === "remove") {
          let flag = 0;
          for (let i = 0; i < foundUser.watchlist.length; i++) {
            if (!(targetSymbol === foundUser.watchlist[i])) {
              newWatchlist.push(foundUser.watchlist[i]);
            } else {
              flag += 1;
            }
          }
          if (flag === 0) {
            errMessage = targetSymbol + " does not exist in your watchlist.";
          } else {
            foundUser.watchlist = newWatchlist;
          }
        } else {
          let flag = 0;
          for (let i = 0; i < foundUser.watchlist.length; i++) {
            if (targetSymbol === foundUser.watchlist[i]) {
              flag += 1;
            }
          }
          if (flag === 0) {
            foundUser.watchlist.push(targetSymbol);
          } else {
            errMessage = targetSymbol + " is already in your watchlist.";
          }
        }

        if (errMessage === "None") {
          foundUser.save(err, () => {
            res.redirect("/");
          });
        } else {
          res.render("index", {
            watchListStocks: [],
            userInfo: { username: username },
            investmentInfo: undefined,
            errMessage: errMessage,
          });
        }
      }
    });
  } else {
    res.render("err-login", { errMessage: "Please Login First." });
  }
});

app.post("/trade", function (req, res) {
  if (req.isAuthenticated()) {
    let username = req.user.username;
    let targetSymbol = req.body.symbol;
    let amount = req.body.amount;
    let date = new Date();

    // get stock
    Stock.findOne({ symbol: targetSymbol }, function (err, foundStock) {
      const tradeType = req.body.tradeType;
      let transaction = new Transaction({
        username: username,
        date: date.toUTCString(),
        type: tradeType,
        price: foundStock.currentPrice,
        symbol: targetSymbol,
        amount: amount,
      });

      //get transaction
      transaction.save(function (err, result) {
        User.findOne({ username: username }, function (err, foundUser) {
          foundUser.transactionHistory.push(result);
          Investment.exists(
            { username: username, symbol: targetSymbol },
            function (err, exist) {
              let changeAmountBy = 0;
              if (result.type === "buy") {
                changeAmountBy = result.amount;
              } else {
                changeAmountBy = -result.amount;
              }

              let errMessage = "You have successfully ";
              if (result.type === "buy") {
                errMessage +=
                  "bought " +
                  result.amount +
                  " shares of " +
                  targetSymbol +
                  ".";
              } else {
                errMessage +=
                  "sold " + result.amount + " shares of " + targetSymbol + ".";
              }

              // if the investment exist
              if (result.amount <= 0) {
                res.render("index", {
                  watchListStocks: [],
                  userInfo: { username: username, balance: foundUser.balance },
                  investmentInfo: undefined,
                  errMessage: "Invalid Amount. Please Try Again.",
                });
              } else if (exist === true) {
                Investment.findOne(
                  { username: username, symbol: targetSymbol },
                  function (err, foundInvestment) {
                    if (
                      changeAmountBy < 0 &&
                      foundInvestment.amount < -changeAmountBy
                    ) {
                      res.render("index", {
                        watchListStocks: [],
                        investmentInfo: undefined,
                        userInfo: {
                          username: username,
                          balance: foundUser.balance,
                        },
                        errMessage:
                          "You are trying to sell shares more than you owned.",
                      });
                      // sell all the stock owned
                    } else {
                      Stock.findOne(
                        { symbol: targetSymbol },
                        function (err, foundStock) {
                          foundInvestment.cost +=
                            foundStock.currentPrice * changeAmountBy;
                          foundInvestment.amount += changeAmountBy;
                          foundUser.balance -=
                            foundStock.currentPrice * changeAmountBy;
                          //not enough balance
                          console.log(
                            "balance before check: " + foundUser.balance
                          );
                          console.log("balance<0? ");
                          if (foundUser.balance < 0) {
                            console.log("true");
                            res.render("index", {
                              watchListStocks: [],
                              userInfo: {
                                username: username,
                                balance: foundUser.balance,
                              },
                              investmentInfo: undefined,
                              errMessage: "Your balance is not enough.",
                            });
                          } else if (foundInvestment.amount === 0) {
                            //remove from Investment
                            foundInvestment.remove(() => {
                              //remove from User.Investment
                              updateUserInvest(
                                foundUser,
                                changeAmountBy,
                                foundStock,
                                () => {
                                  res.render("index", {
                                    watchListStocks: [],
                                    userInfo: {
                                      username: username,
                                      balance: foundUser.balance,
                                    },
                                    investmentInfo: undefined,
                                    errMessage: errMessage,
                                  });
                                }
                              );
                            });
                          } else {
                            for (
                              let i = 0;
                              i < foundUser.investments.length;
                              i++
                            ) {
                              if (
                                foundUser.investments[i].symbol === targetSymbol
                              ) {
                                foundUser.investments[i] = foundInvestment;
                                break;
                              }
                            }
                            foundInvestment.save(() => {
                              foundUser.save(() => {
                                res.render("index", {
                                  watchListStocks: [],
                                  userInfo: {
                                    username: username,
                                    balance: foundUser.balance,
                                  },
                                  investmentInfo: undefined,
                                  errMessage: errMessage,
                                });
                              });
                            });
                          }
                        }
                      );
                    }
                  }
                );
                // if the investment doesn't exist
              } else {
                if (changeAmountBy < 0) {
                  res.render("index", {
                    watchListStocks: [],
                    userInfo: { username: username },
                    investmentInfo: undefined,
                    errMessage:
                      "You are trying to sell shares more than you owned.",
                  });
                } else {
                  Investment.create(
                    {
                      username: result.username,
                      symbol: result.symbol,
                      amount: result.amount,
                    },
                    function (err, newInvestment) {
                      Stock.findOne(
                        { symbol: targetSymbol },
                        function (err, foundStock) {
                          newInvestment.cost +=
                            foundStock.currentPrice * newInvestment.amount;
                          newInvestment.save(() => {
                            foundUser.investments.push(newInvestment);
                            foundUser.balance -= newInvestment.cost;
                            foundUser.save(() => {
                              res.render("index", {
                                watchListStocks: [],
                                userInfo: undefined,
                                investmentInfo: undefined,
                                errMessage:
                                  "You have successfully bought " +
                                  changeAmountBy +
                                  " shares of " +
                                  targetSymbol,
                              });
                            });
                          });
                        }
                      );
                    }
                  );
                }
              }
            }
          );
        });
      });
    });
  } else {
    res.render("err-login", { errMessage: "Please Login First." });
  }
});

function updateUserInvest(foundUser, amount, foundStock, callback) {
  for (let i = 0; i < foundUser.investments.length; i++) {
    if (foundUser.investments[i].symbol === foundStock.symbol) {
      foundUser.investments.splice(i, 1);
      break;
    }
  }
  foundUser.balance -= amount * foundStock.currentPrice;
  foundUser.save(() => {
    callback();
  });
}

const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("server has started");
});
