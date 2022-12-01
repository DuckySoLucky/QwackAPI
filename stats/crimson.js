const { trophy_fish } = require("../constants/trophyFish.js");

module.exports = (profile) => {
  if (profile.nether_island_player_data) {
    return {
        kuudra: profile.nether_island_player_data.kuudra_completed_tiers,
        dojo: Object.keys(profile.nether_island_player_data.dojo).length > 0 ? profile.nether_island_player_data.dojo : DOJO_CLEAN,
        abiphone: profile.nether_island_player_data.abiphone,
        matriarch: profile.nether_island_player_data.matriarch,
        factions: {
            name: profile.nether_island_player_data.selected_faction,
            barbarians_reputation: profile.nether_island_player_data.barbarians_reputation,
            mages_reputation: profile.nether_island_player_data.mages_reputation,
        },
        trophy_fish: {
            level: formatTrophyFishRank(profile.trophy_fish.rewards.length),
            total_caught: profile.trophy_fish.total_caught || 0,
            fish: Object.keys(profile?.trophy_fish || {}).length > 3 ? formatTrophyFish(profile.trophy_fish) : trophy_fish,
        },
    };
  } else {
    return {
        kuudra: {},
        dojo: {},
        abiphone: {},
        matriarch: {},
        factions: {
            name: {},
            barbarians_reputation: 0,
            mages_reputation: 0,
        },
        trophy_fish: {
            level: 0,
            total_caught: 0,
            fish: trophy_fish,
        },
    };
  }
};

function formatTrophyFishRank(points) {
    if (points === 1) return "Novice Trophy Fisher (Bronze)";
    if (points === 2) return "Adept Trophy Fisher (Silver)";
    if (points === 3) return "Trophy Fisher (Gold)";
    if (points === 4) return "Master Trophy Fisher (Diamond)";
    return "None";
}

const DOJO_CLEAN = {
    dojo_points_mob_kb: 0,
    dojo_time_mob_kb: 0,
    dojo_points_wall_jump: 0,
    dojo_time_wall_jump: 0,
    dojo_points_archer: 0,
    dojo_time_archer: 0,
    dojo_points_sword_swap: 0,
    dojo_time_sword_swap: 0,
    dojo_points_snake: 0,
    dojo_time_snake: 0,
    dojo_points_fireball: 0,
    dojo_time_fireball: 0,
    dojo_points_lock_head: 0,
    dojo_time_lock_head: 0
}

function formatTrophyFish(calculated) {
    const output = {};
    for (const key of Object.keys(calculated).filter((key) => ["rewards", "total_caught"].includes(key) === false)) {
        const ID = key.replace("_bronze", "").replace("_silver", "").replace("_gold", "").replace("_diamond", "").toUpperCase();

        if (output[ID] !== undefined) continue;

        output[ID] = {
            name: trophy_fish[ID].name,
            id: ID,
            description: trophy_fish[ID].description,
            total: calculated[key],
            bronze: calculated[`${key}_bronze`],
            silver: calculated[`${key}_silver`],
            gold: calculated[`${key}_gold`],
            diamond: calculated[`${key}_diamond`],
        }
    }

    return output;
}