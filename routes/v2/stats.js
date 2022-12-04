//CREDIT: https://github.com/Senither/hypixel-skyblock-facade (Modified)
const { isUuid } = require("../../utils/uuid");
const { makeRequest, wrap } = require("../../utils/request");
const { parseHypixel } = require("../../utils/hypixel");
const { getStats } = require("../../stats/stats");

module.exports = wrap(async function (req, res) {
  const profileid = req.params.profileid;
  let uuid = req.params.uuid,
    profileId;
  if (!isUuid(uuid)) {
    const mojang_response = await makeRequest(res, `https://api.ashcon.app/mojang/v2/uuid/${uuid}`)
    if (mojang_response?.data) {
      uuid = mojang_response.data.replace(/-/g, "");
    }
  }

  const [playerRes, profileRes] = await Promise.all([
    makeRequest(
      res,
      `https://api.hypixel.net/player?key=${process.env.HYPIXEL_API_KEY}&uuid=${uuid}`
    ),
    makeRequest(
      res,
      `https://api.hypixel.net/skyblock/profiles?key=${process.env.HYPIXEL_API_KEY}&uuid=${uuid}`
    ),
  ]);

  const player = parseHypixel(playerRes, uuid, res);

  if (
    profileRes.data.hasOwnProperty("profiles") &&
    profileRes.data.profiles == null
  )
    return res.status(404).json({
      status: 404,
      reason: `Found no SkyBlock profiles for a user with a UUID of '${uuid}' and profile of '${profileid}'`,
    });

  if (!isUuid(profileid)) {
    for (const profile of profileRes.data?.profiles || []) {
      if (profile.cute_name.toLowerCase() === profileid.toLowerCase())
        profileId = profile.profile_id;
    }
  }

  const profileData = profileRes.data.profiles.find(
    (a) => a.profile_id === profileId
  );

  if (!profileData)
    return res.status(404).json({
      status: 404,
      reason: `Found no SkyBlock profiles for a user with a UUID of '${uuid}' and profile of '${profileid}'`,
    });
  if (
    profileData.hasOwnProperty(uuid) &&
    profileData[uuid].last_save != undefined
  )
    res.status(404).json({
      status: 404,
      reason: `Found no SkyBlock profiles for a user with a UUID of '${uuid}'`,
    });

  const profile = profileData.members[uuid];

  return res.status(200).json({
    status: 200,
    data: await getStats(player, profileData, profile, uuid, res),
  });
});
