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
const stockSchema = require(__dirname + "/stockSchema.js");

const app = express();

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
});

userSchema.plugin(passportLocalMongoose);

const Transaction = mongoose.model("Transaction", transactionSchema);
const User = mongoose.model("User", userSchema);
const Investment = mongoose.model("Investment", investmentSchema);

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
  Stock.find({}, function (err, foundStocks) {
    if (foundStocks.length === 0) {
      initializeDB(function (stocks) {
        Stock.insertMany(stocks, function (err) {
          if (err) {
            console.log(err);
          } else {
            console.log("Successfully Inserted.");
            res.redirect("/");
          }
        });
      });
    } else {
      res.render("index", { watchListStocks: foundStocks });
    }
  });
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
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
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
      console.log(err);
    } else {
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
  let investmentInfo = {profit: profit,
                        profitRate: profitRate,
                        currentPrice: currentPrice}
  getProfitHelper(investments, 0, investmentInfo, callback);
}

function getProfitHelper(investments, index, investmentInfo, callback) {
  if (investmentInfo.profit.length === investments.length) {
    callback(investmentInfo);
    return;
  }
  let item = investments[index];
  console.log(item.symbol)
  Stock.findOne({ symbol: item.symbol }, function (err, foundStock) {
    if (err) {
      console.log(err);
    } else {
      //item: investments[index]
      investmentInfo.profit.push(foundStock.currentPrice*item.amount - item.cost);
      investmentInfo.profitRate.push(((foundStock.currentPrice*item.amount -item.cost) / item.cost)*100);
      investmentInfo.currentPrice.push(foundStock.currentPrice);
      getProfitHelper(investments, index + 1, investmentInfo, callback);
      return;
    }
  });
}

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
          currentPrice:investmentInfo.currentPrice
        });
      });
    });
  }
});

app.post("/trade", function (req, res) {
  if (req.isAuthenticated()) {
    let username = req.user.username;
    let targetSymbol = req.body.symbol;
    let amount = req.body.amount;
    let date = new Date();

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
      transaction.save(function (err, result) {
        User.findOne({ username: username }, function (err, foundUser) {
          foundUser.transactionHistory.push(result);
          Investment.exists(
            { username: username, symbol: targetSymbol },
            function (err, exist) {
              if (err) {
                console.log(err);
              }
              let changeAmountBy = 0;
              if (result.type === "buy") {
                changeAmountBy = result.amount;
              } else {
                changeAmountBy = -result.amount;
              }
              if (exist === true) {
                Investment.findOne(
                  { username: username, symbol: targetSymbol },
                  function (err, foundInvestment) {
                    foundInvestment.amount += changeAmountBy;
                    Stock.findOne(
                      { symbol: targetSymbol },
                      function (err, foundStock) {
                        foundInvestment.cost += foundStock.currentPrice * changeAmountBy;
                        foundInvestment.amount += changeAmountBy;
                        foundUser.balance -= foundStock.currentPrice * changeAmountBy ;

                        foundUser.investments.forEach(function(item){
                            if(item.symbol===targetSymbol){
                                item.cost += foundStock.currentPrice * changeAmountBy;
                                item.amount += changeAmountBy;
                            }
                        })
                        foundInvestment.save(() => {
                            foundUser.save(()=>{
                                res.redirect("/");
                            })
                        });
                      }
                    );
                  }
                );
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
                          foundUser.save(() => {
                            res.redirect("/");
                          });
                        });
                      }
                    );
                  }
                );
              }
            }
          );
        });
      });
    });
  } else {
    res.redirect("/login");
  }
});
app.listen(3000, function () {
  console.log("server has started");
});
