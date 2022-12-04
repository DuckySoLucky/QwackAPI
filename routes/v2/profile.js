//CREDIT: https://github.com/Senither/hypixel-skyblock-facade (Modified)
const { isUuid } = require("../../utils/uuid");
const { makeRequest, wrap } = require("../../utils/request");
const { parseHypixel, parseProfile } = require("../../utils/hypixel");

module.exports = wrap(async function (req, res) {
  const profileid = req.params.profileid;
  let uuid = req.params.uuid;
  if (!isUuid(uuid)) {
    const mojang_response = await makeRequest(res, `https://api.ashcon.app/mojang/v2/uuid/${uuid}`);
    if (mojang_response?.data) {
      uuid = mojang_response.data.replace(/-/g, "");
    }
  }

  const [playerRes, profileRes] = await Promise.all([
    makeRequest(res, `https://api.hypixel.net/player?key=${process.env.HYPIXEL_API_KEY}&uuid=${uuid}`),
    makeRequest(res, `https://api.hypixel.net/skyblock/profiles?key=${process.env.HYPIXEL_API_KEY}&uuid=${uuid}`),
  ]);
  
  const player = parseHypixel(playerRes, uuid, res);

  const profile = await parseProfile(player, profileRes, uuid, profileid, res);

  return res.status(200).json({ status: 200, data: profile });
});
