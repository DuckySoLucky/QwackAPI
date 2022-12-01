const calcSkill = require("../constants/skills.js");
const { capitalize } = require("../other/helper.js");

module.exports = (player, profile) => {
  try {
    const dungeons = profile?.dungeons;
    const catacombs = dungeons?.dungeon_types.catacombs;
    const master_catacombs = dungeons?.dungeon_types.master_catacombs;

    const floors = {};
    const available_floors = Object.keys(dungeons?.dungeon_types.catacombs.times_played || []);

    for (const floor in available_floors) {
      let floor_name = "entrance";
      if (floor != 0) floor_name = `floor_${floor}`;
      floors[floor_name] = {
        times_played: catacombs?.times_played ? catacombs?.times_played[floor] || 0 : 0,
        completions: catacombs?.tier_completions ? catacombs?.tier_completions[floor] || 0 : 0,
        best_score: {
          score: catacombs?.best_score ? catacombs?.best_score[floor] || 0 : 0,
          name: getScoreName(catacombs?.best_score ? catacombs?.best_score[floor] || 0 : 0),
        },
        fastest: catacombs?.fastest_time ? catacombs?.fastest_time[floor] || 0 : 0,
        fastest_s: catacombs?.fastest_time_s ? catacombs?.fastest_time_s[floor] || 0 : 0,
        fastest_s_plus: catacombs?.fastest_time_s_plus ? catacombs?.fastest_time_s_plus[floor] || 0 : 0,
        mobs_killed: catacombs?.mobs_killed ? catacombs?.mobs_killed[floor] || 0 : 0,
        best_run: catacombs?.best_runs[floor]?.[0] || null,
      };

      for (const key of Object.keys(catacombs)) {
        if (key.startsWith("most_damage") || key.startsWith("most_healing")) {
          floors[floor_name][key] = catacombs[key][floor];
        }
      }
    }

    const master_mode_floors = {};

    for (let i = 1; i <= dungeons?.dungeon_types.master_catacombs.highest_tier_completed; i++) {
      master_mode_floors[`floor_${i}`] = {
        completions: master_catacombs?.tier_completions[i] ?? 0,
        best_score: {
          score: master_catacombs?.best_score?.[i] ?? 0,
          name: getScoreName(master_catacombs?.best_score[i] ?? 0),
        },
        fastest: master_catacombs?.fastest_time?.[i] ?? 0,
        fastest_s: master_catacombs?.fastest_time_s?.[i] ?? 0,
        fastest_s_plus: master_catacombs?.fastest_time_s_plus?.[i] ?? 0,
        mobs_killed: master_catacombs?.mobs_killed?.[i] ?? 0,
        best_run: master_catacombs.best_runs[i][0] || null,
      };

      for (const key of Object.keys(master_catacombs)) {
        if (key.startsWith("most_damage") || key.startsWith("most_healing")) {
          master_mode_floors[`floor_${i}`][key] = master_catacombs[key][i];
        }
      }
    }

    const highest_tier_completed = master_catacombs?.highest_tier_completed ? `M${master_catacombs?.highest_tier_completed}` : catacombs?.highest_tier_completed ? `F${catacombs?.highest_tier_completed}` : null;

    return {
      selected_class: capitalize(dungeons?.selected_dungeon_class || "none"),
      secrets_found: player?.achievements?.skyblock_treasure_hunter || 0,
      classes: {
        mage: calcSkill( "dungeoneering", dungeons?.player_classes?.mage?.experience || 0),
        berserk: calcSkill( "dungeoneering", dungeons?.player_classes?.berserk?.experience || 0),
        archer: calcSkill( "dungeoneering", dungeons?.player_classes?.archer?.experience || 0),
        tank: calcSkill( "dungeoneering", dungeons?.player_classes?.tank?.experience || 0),
        healer: calcSkill( "dungeoneering", dungeons?.player_classes?.healer?.experience || 0),
      },
      catacombs: {
        skill: calcSkill("dungeoneering", dungeons?.dungeon_types?.catacombs?.experience || 0),
        highest_tier_completed,
        floors,
        master_mode_floors,
      },
    };
  } catch (error) {
    console.log(error);
    return null;
  }
};

function getScoreName(score) {
  if (score >= 300) return "S+";
  if (score >= 270) return "S";
  if (score >= 240) return "A";
  if (score >= 175) return "B";
  return "C";
}
