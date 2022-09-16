//CREDIT: https://github.com/Senither/hypixel-skyblock-facade (Modified)

// ? v1
const auctionsRoute = require("./routes/v1/auctions");
const bingoRoute = require("./routes/v1/bingo");
const calendarRoute = require("./routes/v1/calendar");
const fetchurRoute = require("./routes/v1/fetchur");
const profileRoute = require("./routes/v1/profile");
const profilesRoute = require("./routes/v1/profiles");
const profileItemsRoute = require("./routes/v1/profileItems");
const profilesItemsRoute = require("./routes/v1/profilesItems");

// ? v2
const profileV2Route = require("./routes/v2/profile");
const profilesV2Route = require("./routes/v2/profiles");
const networthRoute = require("./routes/v2/networth");

const NotFound = require("./middleware/notfound");
const Auth = require("./middleware/auth");
const ErrorHandler = require("./middleware/errorhandler");
const rateLimit = require("express-rate-limit");
const express = require("express");
const app = express();
const refreshCollections = require("./data/refreshCollections");
const refreshPrices = require("./data/refreshPrices");
const refreshAuctions = require("./data/refreshAuctions");
const checkForUpdate = require("./middleware/checkforupdate");
const port = process.env.PORT || 3000;

process.on("uncaughtException", (error) => console.log(error));
process.on("unhandledRejection", (error) => console.log(error));

const limiter = rateLimit({
  windowMs: 1000 * 60, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: "Too many requests, please try again later.",
  },
});

app.use(express.static(__dirname + "/public"));
app.use(limiter);
app.use(Auth);
app.use(require("cors")());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/v1/fetchur", fetchurRoute);
app.get("/v1/profile/:uuid/:profileid", profileRoute);
app.get("/v1/profiles/:uuid", profilesRoute);
app.get("/v1/items/:uuid/:profileid", profileItemsRoute);
app.get("/v1/items/:uuid", profilesItemsRoute);
app.get("/v1/bingo/:uuid", bingoRoute);
app.get("/v1/calendar", calendarRoute);
app.get("/v1/auctions/:uuid", auctionsRoute);
app.get("/v1/auctionhouse", auctionsRoute);

app.get("/v2/profile/:uuid/:profileid", profileV2Route);
app.get("/v2/profiles/:uuid", profilesV2Route);
app.get("/v2/networth", networthRoute);

app.use(NotFound);
app.use(ErrorHandler);

refreshCollections();
refreshPrices();
refreshAuctions();
checkForUpdate();

app.listen(port, () => {
  console.log(`Now listening on port ${port}`);
});
