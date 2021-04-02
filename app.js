const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const date = require(__dirname + "/date.js");
const simpleStat = require(__dirname + "/simpleStat.js");
const path = require("path");
const { find, forEach } = require("async");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const initializeDB = require(__dirname + "/initDB.js");
const updateSpark = require(__dirname + "/updateSpark.js");
const stockSchema = require(__dirname + "/stockSchema.js");

const app = express();
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
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "Ruilin Zhou.",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.set("useUnifiedTopology", true);
mongoose.connect("mongodb://localhost:27017/stockmarket", {
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

app.get("/", function (req, res) {
  if (req.isAuthenticated()) {
    let userInfo = { username: req.user.username };
    User.findOne({ username: req.user.username }, function (err, foundUser) {
      Stock.find(
        { symbol: { $in: foundUser.watchlist } },
        function (err, foundStocks) {
          res.render("index", {
            watchListStocks: foundStocks,
            userInfo: userInfo,
            errMessage: "None",
          });
        }
      );
    });
  } else {
    Stock.find({}, function (err, foundStocks) {
      res.render("index", {
        watchListStocks: foundStocks,
        userInfo: undefined,
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
        res.render("err-register",{errMessage:"Username is already been used."})
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
      res.render("err-login",{errMessage:"Username and password combination is incorrect."});
    } else  {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/");
      });
    }
  });
});


function getProfit(investments, callback) {
  let profit = [];
  let profitRate = [];
  let currentPrice = [];
  let investmentInfo = {
    profit: profit,
    profitRate: profitRate,
    currentPrice: currentPrice,
  };
  getProfitHelper(investments, 0, investmentInfo, callback);
}

function getProfitHelper(investments, index, investmentInfo, callback) {
  if (investmentInfo.profit.length === investments.length) {
    callback(investmentInfo);
    return;
  }
  let item = investments[index];
  Stock.findOne({ symbol: item.symbol }, function (err, foundStock) {
    if (err) {
      console.log(err);
    } else {
      //item: investments[index]
      investmentInfo.profit.push(
        foundStock.currentPrice * item.amount - item.cost
      );
      investmentInfo.profitRate.push(
        ((foundStock.currentPrice * item.amount - item.cost) / item.cost) * 100
      );
      investmentInfo.currentPrice.push(foundStock.currentPrice);
      getProfitHelper(investments, index + 1, investmentInfo, callback);
      return;
    }
  });
}

app.get("/stock-market", function (req, res) {
  if (req.isAuthenticated()) {
    let userInfo = { username: req.user.username };
    Stock.find({}, function (err, foundStocks) {
      res.render("index", {
        watchListStocks: foundStocks,
        userInfo: userInfo,
        errMessage: "None",
      });
    });
  } else {
    Stock.find({}, function (err, foundStocks) {
      res.render("index", {
        watchListStocks: foundStocks,
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
      getProfit(foundUser.investments, function (investmentInfo) {
        res.render("myinvestment", {
          username: username,
          investments: foundUser.investments,
          profit: investmentInfo.profit,
          profitRate: investmentInfo.profitRate,
          currentPrice: investmentInfo.currentPrice,
          userInfo: { username: username },
          errMessage: "None",
        });
      });
    });
  } else {
    res.render("err-login",{errMessage:"Please Login First."});
  }
});

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
            errMessage: errMessage,
          });
        }
      }
    });
  } else {
    res.render("err-login",{errMessage:"Please Login First."});
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
              if(result.amount<=0){
                res.render("index", {
                  watchListStocks: [],
                  userInfo: { username: username },
                  errMessage:
                    "Invalid Amount. Please Try Again.",
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
                        userInfo: { username: username },
                        errMessage:
                          "You are trying to sell shares more than you owned.",
                      });
                      // sell all the stock owned
                    } else {
                      Stock.findOne(
                        { symbol: targetSymbol },
                        function (err, foundStock) {
                          foundInvestment.cost += foundStock.currentPrice * changeAmountBy;
                          foundInvestment.amount += changeAmountBy;
                          foundUser.balance -= foundStock.currentPrice * changeAmountBy;
                          //not enough balance
                          if (foundUser.balance < 0) {
                            res.render("index", {
                              watchListStocks: [],
                              userInfo: { username: username },
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
                                    userInfo: { username: username },
                                    errMessage: errMessage,
                                  });
                                }
                              );
                            });
                          } else {
                            for (let i = 0;i < foundUser.investments.length;i++) {
                              if (foundUser.investments[i].symbol === targetSymbol) {
                                foundUser.investments[i] = foundInvestment;
                                break;
                              }
                            }
                            foundInvestment.save(()=>{
                              foundUser.save(()=>{
                                res.render("index", {
                                  watchListStocks: [],
                                  userInfo: { username: username },
                                  errMessage: errMessage,
                                });
                              })
                            })

                          }
                        }
                      );
                    }
                      
                  });
                // if the investment doesn't exist
              } else {
                if(changeAmountBy<0){
                  res.render("index", {
                    watchListStocks: [],
                    userInfo: { username: username },
                    errMessage:
                      "You are trying to sell shares more than you owned.",
                  });
                } else{
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
    res.render("err-login",{errMessage:"Please Login First."});
  }
});

app.listen(3000, function () {
  console.log("server has started");
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
