const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const date = require(__dirname + "/date.js");
const simpleStat = require(__dirname + "/simpleStat.js");
const initializeDB = require(__dirname + "/initDB.js");
const stockSchema = require(__dirname + "/stockSchema.js");

const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();


app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

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

const Stock = mongoose.model("Stock", stockSchema);
const userSchema = new mongoose.Schema({
  username: String,
  password: String
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("newUser", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser);
passport.deserializeUser(User.deserializeUser);

app.get("/", function (req, res) {
  Stock.find({}, function (err, foundStocks) {
    console.log(foundStocks.length);
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

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });
  console.log(user)
  req.login(user, function (err) {
    if (err) {
      console.log("no such user");
    } else {
      passport.authenticate("local")(req, res, function () {
        console.log("Successful");
        res.redirect("/");
      });
    }
  });
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


app.listen(3000, function () {
  console.log("server has started");
});
