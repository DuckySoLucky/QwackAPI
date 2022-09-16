//CREDIT: https://github.com/Senither/hypixel-skyblock-facade (Modified)
const { makeRequest, wrap } = require("../../utils/request");
const fs = require("fs");
const { isUuid } = require("../../utils/uuid");

const retrieveAuctions = async function (res) {
  try {
    const auctions = JSON.parse(fs.readFileSync("./data/auctions.json"));
    return auctions;
  } catch (error) {
    console.log(error);
    if (
      error
        .toString()
        .includes(
          "ENOENT: no such file or directory, open '../data/auctions.json'"
        )
    ) {
      return res
        .status(102)
        .json({
          status: 102,
          data: "Auctions haven't been updated yet. Please wait a bit",
        });
    } else {
      return res.status(404).json({ status: 404, data: error.toString() });
    }
  }
};

module.exports = wrap(async function (req, res) {
  const auctionsRes = await retrieveAuctions(res);

  const queries = req.originalUrl.split("?")[1].split("&");
  let filteredAuctions = [];
  const searchData = {};

  for (let query of queries) {
    if (query.startsWith("key=")) continue;
    if (query.startsWith("name=")) query = query.replaceAll("%20", " ");
    if (query.startsWith("lore=")) query = query.replaceAll("%20", " ");
    if (query.startsWith("player=")) {
      if (!isUuid(query.split("=")[1])) {
        query = `player=${((
          await makeRequest(
            res,
            `https://api.ashcon.app/mojang/v2/user/${query.split("=")[1]}`
          )
        )?.data?.uuid).replace(/-/g, "")}`;
      }
    }
    //if (query.startsWith('filter=')) query = query.replaceAll('%20', ' ');
    searchData[query.split("=")[0]] = query.split("=")[1]?.toLowerCase();
  }

  for (let auction of auctionsRes) {
    if (auction.end < Date.now()) continue;
    if (searchData.name)
      if (!auction.item_name.toLowerCase().includes(searchData.name)) continue;
    if (searchData.lore)
      if (!auction.item_lore.toLowerCase().includes(searchData.lore)) continue;
    if (searchData.rarity)
      if (!auction.tier.toLowerCase().includes(searchData.rarity)) continue;
    if (searchData.tier)
      if (!auction.tier.toLowerCase().includes(searchData.tier)) continue;
    if (searchData.category)
      if (!auction.category.toLowerCase().includes(searchData.category))
        continue;
    if (searchData.bin) if (auction.bin.toString() != searchData.bin) continue;
    if (searchData.player)
      if (auction.auctioneer != searchData.player) continue;
    if (auction.bin) {
      if (searchData.lowest_price)
        if (!(parseInt(searchData.lowest_price) <= auction.starting_bid))
          continue;
      if (searchData.highest_price)
        if (!(parseInt(searchData.highest_price) >= auction.starting_bid))
          continue;
    } else {
      if (searchData.lowest_price)
        if (
          !(
            parseInt(searchData.lowest_price) <= auction.highest_bid_amount !=
              0 ?? !(parseInt(searchData.lowest_price) <= auction.starting_bid)
          )
        )
          continue;
      if (searchData.highest_price)
        if (
          !(
            parseInt(searchData.highest_price) >= auction.highest_bid_amount !=
              0 ?? !(parseInt(searchData.lowest_price) <= auction.starting_bid)
          )
        )
          continue;
    }
    auction.item_lore = auction.item_lore.split("\n");
    filteredAuctions.push(auction);
  }

  if (searchData?.filter) {
    // ? TO-DO
    // * Sort Auctions
    // const highestBid = filteredAuctions.sort((a, b) => b.highest_bid_amount - a.highest_bid_amount);
  }

  return res.status(200).json({
    status: 200,
    found: filteredAuctions.length > 1,
    amount: filteredAuctions.length,
    filter: searchData,
    auctions: filteredAuctions,
  });
});
