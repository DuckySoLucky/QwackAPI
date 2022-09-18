// Credits: https://github.com/SkyCryptWebsite/SkyCrypt (Modified)

const { isUuid } = require("../../utils/uuid");
const getSkills = require("../../stats/skills");
const getSlayer = require("../../stats/slayer");
const getPets = require("../../stats/pets");
const getBestiary = require("../../stats/bestiary");
const getDungeons = require("../../stats/dungeons");
const getCakeBag = require('../../stats/cakebag');
const getArmor = require('../../stats/armor');
const getEquipment = require('../../stats/equipment');
const getCollections = require('../../stats/collections');
const { toFixed } = require("../../constants/functions");

const bonuses = require("../../constants/bonuses");
const xp_tables = require('../../constants/xp_tables')
const misc = require("../../constants/misc");
const { symbols } = require('../../constants/symbols');
const { decodeData } = require("../../utils/nbt");

const BASE_STATS = {
    health: 100,
    defense: 0,
    intelligence: 100,
    true_defense: 0,
    effective_health: 100,
    strength: 0,
    speed: 100,
    crit_chance: 30,
    crit_damage: 50,
    bonus_attack_speed: 0,
    intelligence: 100,
    sea_creature_chance: 20,
    magic_find: 0,
    pet_luck: 0,
    ferocity: 0,
    ability_damage: 0,
    mining_speed: 0,
    mining_fortune: 0,
    farming_fortune: 0,
    foraging_fortune: 0,
    pristine: 0,
    damage: 0,
    damage_increase: 0,
    fishing_speed: 0,
    health_regen: 100,
    vitality: 100,
    mending: 100,
    combat_wisdom: 0,
    mining_wisdom: 0,
    farming_wisdom: 0,
    foraging_wisdom: 0,
    fishing_wisdom: 0,
    enchanting_wisdom: 0,
    alchemy_wisdom: 0,
    carpentry_wisdom: 0,
    runecrafting_wisdom: 0,
    social_wisdom: 0,
};

async function getStats(player, profileData, profile, uuid, res) {
    // TODO: Hard code every reforge (https://wiki.hypixel.net/Powers#Magical_Power)
    // TODO: Add potion effects (every effect has to be hard coded ;-;)
    // TODO: Black Cat Pet Speed Cap
    // TODO: Add Custom pet's abilities, Silverfish, GDrag, Wolf etc..
    // TODO: Add HOTM (Mining speed and fortune)
    // TODO: Add Jacob's farming fortune 
    // TODO: Add Wisdom calculation
    const bestiaryLevel = toFixed(((getBestiary(profile)).level), 0);
    const catacombsLevel = toFixed((getDungeons(player, profile)).catacombs.skill.level, 0);
    const slayer = getSlayer(profile)
    const skills = getSkills(player, profile)
    const miningLevel = skills.mining.level;
    const collection = getCollections(profileData);
    const pets = getPets(profile)
    const statsMultiplier = 0;

    const [armor, equipment, accessories, inventory, cakebag,] =
    await Promise.all([
        getArmor(profile),
        getEquipment(profile),
        decodeData(Buffer.from(profile.talisman_bag.data, "base64")),
        decodeData(Buffer.from(profile.inv_contents.data, "base64")),
        getCakeBag(profile),
    ]);

    // ? Bestiary
    if (bestiaryLevel) BASE_STATS['health'] += (toFixed(bestiaryLevel, 0) * 2);

    // ? Cakebag
    if (cakebag.length > 0) BASE_STATS['health'] += cakebag.length * 2;

    // ? Catacombs
    if (catacombsLevel) toFixed(catacombsLevel, 0) * 2 > 50 ?  BASE_STATS['health'] += 50 : BASE_STATS['health'] += (toFixed(catacombsLevel, 0) * 2);

    // ? Reaper Peppers
    if (profile.reaper_peppers_eaten) BASE_STATS['health'] += (toFixed(profile.reaper_peppers_eaten, 0) * 2);

    // ? Unique Pets
    if (pets.pet) BASE_STATS['magic_find'] += getPetScore(pets.pets)

    // ? Permanent stats from Wither Essence Shop 
    if (profile.perks) {
        for (const [name, perkData] of Object.entries(profile.perks)) {
            if (name.startsWith('permanent_')) {
                BASE_STATS[name.replaceAll('permanent_', '')] += (misc.FORBIDDEN_STATS[name.replaceAll('permanent_', '')] * perkData ?? 0)
            }
        }
    }

    // ? Fairy souls
    if (profile.fairy_exchanges) {
        const bonusStats = getFairyBonus(profile.fairy_exchanges);
        for (const [key, value] of Object.entries(bonusStats)) {
            BASE_STATS[key] += value;
        }

    }

    // ? Slayer
    if (slayer) {
        for (const [name, slayerData] of Object.entries(slayer)) {
            for (let i = 0; i < slayerData.level; i++) {
                const data = bonuses[`slayer_${name}`][i + 1];
                if (!data) continue;
                for (const [key, value] of Object.entries(data)) {
                    BASE_STATS[key] += value;
                }
            }
        }
    }

    // ? Skill bonus stats
    if (skills) {
        for (const [skill, data] of Object.entries(skills)) {
            for (const [key, value] of Object.entries(getBonusStats(data.level, `skill_${skill}`, xp_tables.max_levels[skill]))) {
                BASE_STATS[key] += value;
            }
        }
    }

    // ? Century Cakes
    if (profile.temp_stat_buffs) {
        for (const century_cake of profile.temp_stat_buffs) {
            if (!century_cake.key.startsWith('cake_')) continue;
            BASE_STATS[misc.CENTURY_CAKES[century_cake.key.replaceAll('cake_', '')] ?? century_cake.key.replaceAll('cake_', '')] += century_cake.amount;
        }
    }
  
    // ? Equipment
    for (const [type, data] of Object.entries(equipment)) {
        if (Object.keys(data).length === 0) continue;
        for (const [stat, value] of Object.entries(getStatsFromItem(data))) {
            BASE_STATS[stat] += value;
        }
    }

    // ? Active Pet
    for (const pet of pets.pets) {
        if (!pet.active) continue;
        for (const [stat, value] of Object.entries(pet.stats)) {
            BASE_STATS[stat] += value;
        }
        if (pet.type == 'SILVERFISH') {
            BASE_STATS['true_defense'] += 15;
        }
    }

    // ? Accessories
    for (const item of Object.keys(accessories.i)) {
        const talisman = accessories.i[item]
        if (Object.keys(talisman).length === 0) continue;
        for (const [stat, value] of Object.entries(getStatsFromItem(talisman))) {
            BASE_STATS[stat] += value;
        }
        if (talisman.tag.ExtraAttributes.id == 'NIGHT_CRYSTAL' || talisman.tag.ExtraAttributes.id == 'DAY_CRYSTAL') {
            BASE_STATS['health'] += 5;
            BASE_STATS['strength'] += 5;
        }        
    }

    // ? Tunings
    // TODO: Hard code every reforge (https://wiki.hypixel.net/Powers#Magical_Power)
    /*
    for (const data in profile.accessory_bag_storage) {
        if (data == 'bag_upgrades_purchased' || data == 'unlocked_powers') continue;
        console.log(profile.accessory_bag_storage[data])
    }
    */
    // ? Active Potion Effects
    // TODO: Add potion effects (every effect has to be hard coded ;-;)
    /*
    for (const effect of profile.active_effects) {
        console.log(effect)
    }
    */  

    for (const harp in profile.harp_quest) {
        if (harp.endsWith('_best_completion')) {
            if (harp < 1) continue;
            BASE_STATS['intelligence'] += misc.HARP_QUEST[harp] ?? 0;
        }
    }

    console.log(BASE_STATS['true_defense'])
    // ! Keep armor the latest otherwise, some stats might not work properly.
    // ? Armor
    let itemCount = {}, armorPiece = {};
    for (const [type, data] of Object.entries(armor)) {
        if (Object.keys(data).length === 0) continue;

        for (const [stat, value] of Object.entries(getStatsFromItem(data))) {
            BASE_STATS[stat] += value;
        }

        // *
        // * Armor Pieces
        // *
        if (data.tag.ExtraAttributes.id.includes('BOOTS') || data.tag.ExtraAttributes.id.includes('SLIPPERS') || data.tag.ExtraAttributes.id.includes('SHOES')) {
            armorPiece['boots'] = data ?? null;
        }
        else if (data.tag.ExtraAttributes.id.includes('LEGGINGS')) {
            armorPiece['leggings'] = data ?? null;;
        } else if (data.tag.ExtraAttributes.id.includes('CHESTPLATE')) {
            armorPiece['chestplate'] = data ?? null;;
        } else {
            armorPiece['helmet'] = data ?? null;;
        }
        
        // *
        // * REFORGES
        // *

        // ? Loving (Increases ability damage by 5%)
        // ? Reforge doesn't seem to work, tested with multiple armor pieces. You get 0% boost from reforge.
        //if (data.tag.ExtraAttributes.reforge == 'loving') BASE_STATS['ability_damage'] += 5;

        // ? Renown (Increases most of stats by 1%)
        if (data.tag.ExtraAttributes.reforge == 'renowned') {
            statsMultiplier += 0.01;
        }

        // *
        // * INVENTORY
        // *

        for (const inv of Object.keys(inventory)) {
            for(const item of inventory[inv]) {
                if (Object.keys(item).length === 0) continue;
                if (item.tag.ExtraAttributes.id == 'OBSIDIAN') {
                    itemCount[item.tag.ExtraAttributes.id] ??= 0;
                    itemCount[item.tag.ExtraAttributes.id] += item.Count;
                }
            }
        }
    }
        
    // *
    // * ARMOR ABILTIES
    // *
    if (armorPiece) {
        // ? Superior Dragon Armor
        // Most of your stats are increased by 5%
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'SUPERIOR_DRAGON_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'SUPERIOR_DRAGON_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'SUPERIOR_DRAGON_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'SUPERIOR_DRAGON_BOOTS') {
            statsMultiplier += 0.05;
        }

        // ? Young Dragon Armor
        // Increases speed by 75
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'YOUNG_DRAGON_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'YOUNG_DRAGON_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'YOUNG_DRAGON_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'YOUNG_DRAGON_BOOTS') {
            BASE_STATS['speed'] += 75;
        }

        // ? Holy Dragon Armor
        // Increases health regen by 200
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'HOLY_DRAGON_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'HOLY_DRAGON_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'HOLY_DRAGON_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'HOLY_DRAGON_BOOTS') {
            BASE_STATS['health_regen'] += 200;
        }

        // ? Mastiff Armor
        // +50 Health every 1 Crit Damage
        // Your crit damage is 50% less effective
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'MASTIFF_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'MASTIFF_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'MASTIFF_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'MASTIFF_BOOTS') {
            BASE_STATS['health'] += BASE_STATS['crit_damage'] * 50;
            BASE_STATS['crit_damage'] = BASE_STATS['crit_damage'] / 2;
        }

        // ? Lapis Armor
        // Increases the wearer's maximum health by 60
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'LAPIS_ARMOR_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'LAPIS_ARMOR_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'LAPIS_ARMOR_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'LAPIS_ARMOR_BOOTS') {
            BASE_STATS['health'] += 60;
        }

        // ? Cheap Tuxedo
        // Max health set to 75
        // Deal 50% more damage
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'CHEAP_TUXEDO_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'CHEAP_TUXEDO_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'CHEAP_TUXEDO_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'CHEAP_TUXEDO_BOOTS') {
            BASE_STATS['health'] = 75;
            // BASE_STATS['damage'] = BASE_STATS['damage'] * 1.5;
        }

        // ? Fancy Tuxedo
        // Max health set to 150
        // Deal 100% more damage
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'FANCY_TUXEDO_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'FANCY_TUXEDO_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'FANCY_TUXEDO_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'FANCY_TUXEDO_BOOTS') {
            BASE_STATS['health'] = 150;
            // BASE_STATS['damage'] = BASE_STATS['damage'] * 2;
        }

        // ? Elegant Tuxedo
        // Max health set to 250
        // Deal 150% more damage
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'ELEGANT_TUXEDO_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'ELEGANT_TUXEDO_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'ELEGANT_TUXEDO_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'ELEGANT_TUXEDO_BOOTS') {
            BASE_STATS['health'] = 250;
            // BASE_STATS['damage'] = BASE_STATS['damage'] * 2.5;
        }

        // ? Obsidian Chestplate
        // 1 Speed for every 20 pieces of Obsidian
        if (armorPiece['chestplate']?.tag.ExtraAttributes.id == 'OBSIDIAN_CHESTPLATE') {
            itemCount['OBSIDIAN'] ??= 0;
            BASE_STATS['speed'] += itemCount['OBSIDIAN'] / 20 ? toFixed((itemCount['OBSIDIAN'] / 20), 0) : 0;
        }

        // ? Glacite Armor
        // Gain 1 Mining Speed every Mining Level
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'GLACITE_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'GLACITE_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'GLACITE_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'GLACITE_BOOTS') {
            BASE_STATS['mining_speed'] += miningLevel * 2;
        }

        // ? Fairy Armor
        // Gain 1 Health per Fairy soul
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'FAIRY_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'FAIRY_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'FAIRY_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'FAIRY_BOOTS') {
            BASE_STATS['health'] += profile.fairy_souls_collected ?? 0;
        }

        // ? Emerald Armor
        // Increases Health by +1 and Defense +1 for every 3,000 Emeralds in your collection. Max 350 each.
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'EMERALD_ARMOR_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'EMERALD_ARMOR_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'EMERALD_ARMOR_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'EMERALD_ARMOR_BOOTS') {
            const emeraldCollection = collection.find(c => c.id == 'EMERALD');
            const amount = emeraldCollection.amount ?? 0;
            BASE_STATS['health'] += toFixed((amount / 3000), 0) > 350 ? 350 : toFixed((amount / 3000), 0)
            BASE_STATS['defense'] += toFixed((amount / 3000), 0) > 350 ? 350 : toFixed((amount / 3000), 0)
        }

        // ? Slayer Sets
        for (let piece in armorPiece) {
            piece = armorPiece[piece];
            let defense = 0;

            // ? Enderman
            if (piece?.tag.ExtraAttributes.eman_kills) {
                const kills = piece.tag.ExtraAttributes.eman_kills;
                for (const amountKills of Object.keys(misc.FINAL_DESTIONATION_ARMOR_KILLS)) {
                    if (kills >= amountKills) {
                        defense = misc.FINAL_DESTIONATION_ARMOR_KILLS[amountKills];
                    }
                }
                BASE_STATS['defense'] += defense;
            }

            // ? Tarantula 
            if (piece?.tag.ExtraAttributes.spider_kills) {
                const kills = piece.tag.ExtraAttributes.spider_kills;
                for (const amountKills of Object.keys(misc.TARANTULA_ARMOR_KILLS)) {
                    if (kills >= amountKills) {
                        defense = misc.TARANTULA_ARMOR_KILLS[amountKills];
                    }
                }
                BASE_STATS['defense'] += defense;
            }

            // ? Zombie
            if (piece?.tag.ExtraAttributes.zombie_kills) {
                const kills = piece.tag.ExtraAttributes.zombie_kills;
                for (const amountKills of Object.keys(misc.REVENANT_ARMOR_KILLS)) {
                    if (kills >= amountKills) {
                        defense = misc.REVENANT_ARMOR_KILLS[amountKills];
                    }
                }
                BASE_STATS['defense'] += defense;
            }
        }
    }

    // ? Setting speed cap to 400 if player doesn't have Young Dragon Armor 
    // TODO: Black Cat Pet
    if (armorPiece['helmet']?.tag.ExtraAttributes.id != 'YOUNG_DRAGON_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id != 'YOUNG_DRAGON_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id != 'YOUNG_DRAGON_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id != 'YOUNG_DRAGON_BOOTS') {
        if (BASE_STATS['speed'] > 400) BASE_STATS['speed'] = 400;
    }

    for (const stat of Object.keys(BASE_STATS)) {
        if (stat.includes('fortune' || stat == 'pristine')) continue;
        BASE_STATS[stat] += BASE_STATS[stat] * statsMultiplier;
    }

    return BASE_STATS;

}

function getFairyBonus(fairyExchanges) {
    const bonus = {};
  
    bonus.speed = Math.floor(fairyExchanges / 10);
    bonus.health = 0;
    bonus.defense = 0;
    bonus.strength = 0;
  
    for (let i = 0; i < fairyExchanges; i++) {
      bonus.health += 3 + Math.floor(i / 2);
      bonus.defense += (i + 1) % 5 == 0 ? 2 : 1;
      bonus.strength += (i + 1) % 5 == 0 ? 2 : 1;
    }
  
    return bonus;
}

function getBonusStats(skill, type, maxLvL) {
    const bonus = {};
    const LevelsBonus = bonuses[type];
  
    if (!LevelsBonus) return bonus;
    const levels = Object.keys(LevelsBonus).sort((a, b) => Number(a) - Number(b)).map((a) => Number(a));
  
    for (let x = levels[0]; x <= maxLvL; x += 1) {
      if (skill < x) break;
      const level = levels.slice().reverse().find((a) => a <= x);
      if (!level) continue;
      
      const value = LevelsBonus[level];
      for (const key in value) {
        bonus[key] ??= 0;
        bonus[key] = (bonus[key] || 0) + (value?.[key] ?? 0);
      }
    }

    return bonus;
}

function removeFormatting(string) {
    return string.replaceAll(/§[0-9a-z]/g, "");
}

function getStatsFromItem(piece) {
    if (!piece) return {};
    const regex = /^([A-Za-z ]+): ([+-]([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{0,2})?))/;
    const stats = {};
  
    const lore = (piece.tag?.display?.Lore || []).map((line) => removeFormatting(line));
  
    for (const line of lore) {
      const match = regex.exec(line);
      if (!match) continue;
  
      Object.keys(BASE_STATS).find((key) => {
          if (key && match[1] === symbols[key]?.nameLore) { 
            stats[key] ??= 0;
            stats[key] +=  parseFloat(match[2].replace(/,/g, ""));
        }
      });
    }
  
    return stats;
}

const pet_value = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6,
  };

function getPetScore(pets) {
    const highestRarity = {};
  
    for (const pet of pets) {
      if (!(pet.type in highestRarity) || pet_value[pet.rarity] > highestRarity[pet.type]) highestRarity[pet.type] = pet_value[pet.rarity];
    }

    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 175) return 7
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 130) return 6
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 100) return 5
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 75) return 4
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 50) return 3
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 25) return 2
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 10) return 1
    return 0;
}

module.exports = { getStats }                                         