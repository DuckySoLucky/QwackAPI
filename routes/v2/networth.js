const { getNetworth, getPrices } = require("skyhelper-networth");
const { isUuid } = require("../../utils/uuid");
const { makeRequest, wrap } = require("../../utils/request");

let prices = {};
getPrices().then((data) => {
  prices = data;
});
setInterval(async () => {
  prices = await getPrices();
}, 1000 * 60 * 5); // 5 minutes

module.exports = wrap(async function (req, res) {
  const profileId = req.params.profileid;
  let uuid = req.params.uuid;

  if (!isUuid(uuid)) {
    const mojang_response = await makeRequest(res, `https://api.ashcon.app/mojang/v2/user/${uuid}`);
    if (mojang_response?.data?.uuid) uuid = mojang_response.data.uuid.replace(/-/g, "");
  }

  const profileRes = (await makeRequest(res,`https://api.hypixel.net/skyblock/profiles?key=${process.env.HYPIXEL_API_KEY}&uuid=${uuid}`)).data;
  for (const data of profileRes.profiles) {
    if (data.cute_name.toLowerCase() == profileId.toLowerCase()) {
      response = {
        uuid: uuid,
        name: data.cute_name,
        id: data.profile_id,
        last_save: data.last_save,
        first_join: data.first_join,
        gamemode: data?.game_mode || "normal",
        purse: data.coin_purse || 0,
        bank: data.banking?.balance || 0,
        networth: await getNetworth(
          data.members[uuid],
          data.banking?.balance,
          { prices }
        ),
      };
    }
  }

  return response?.networth ? res.status(200).json({ status: 200, data: response }) : res.status(404).json({ status: 404, data: response });
});
