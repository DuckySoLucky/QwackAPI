const getSkills = require("../../stats/skills");
const getSlayer = require("../../stats/slayer");
const getPets = require("../../stats/pets");
const getBestiary = require("../../stats/bestiary");
const getDungeons = require("../../stats/dungeons");
const getCakeBag = require('../../stats/cakebag');
const getArmor = require('../../stats/armor');
const getEquipment = require('../../stats/equipment');
const getCollections = require('../../stats/collections');
const getMining = require('../../stats/mining');
const getFarming = require('../../stats/farming')
const getTalismans = require('../../stats/talismans');

const bonuses = require("../../constants/bonuses");
const xp_tables = require('../../constants/xp_tables')
const misc = require("../../constants/misc");
const potions = require('../../constants/potions');
const reforges = require('../../constants/reforges')

const { toFixed } = require("../../constants/functions");
const { symbols } = require('../../constants/symbols');
const { decodeData } = require("../../utils/nbt");

let BASE_STATS = {
    //absorption: 0, Not in hypixel's menu
    health: 100,
    defense: 0,
    effective_health: 100,
    strength: 0,
    intelligence: 0,
    crit_chance: 30,
    crit_damage: 50,
    bonus_attack_speed: 0,
    ability_damage: 0,
    true_defense: 0,
    ferocity: 0,
    health_regen: 100,
    vitality: 100,
    mending: 100,

    mining_speed: 0,
    mining_fortune: 0,
    farming_fortune: 0,
    foraging_fortune: 0,
    pristine: 0,

    speed: 100,
    magic_find: 0,
    pet_luck: 0,
    sea_creature_chance: 20,
    fishing_speed: 0,

    //damage: 0,
    //damage_increase: 0,
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
    // ? https://canary.discord.com/channels/720018827433345138/720024037576933466/1019663965724360775
    // ! INACURRATE DATE:
    // ! - Intelligence, this is due to hypixel not having "Defuse Kit" in an API, so intelligence will be offset by 1-10 points.
    // ! - -15 Magic find and -25 Wisdom, this is due to Hypixel not having booster cookie in API
    // TODO: Crab Hat intelligence

    const bestiaryLevel = toFixed(((getBestiary(profile)).level), 0);
    const catacombsLevel = toFixed((getDungeons(player, profile)).catacombs.skill.level, 0);
    const slayer = getSlayer(profile)
    const skills = getSkills(player, profile)
    const fishingLevel = skills.fishing.level;
    const miningLevel = skills.mining.level;
    const collection = getCollections(profileData);
    const pets = getPets(profile)
    const mining = getMining(player, profile)
    const farming = getFarming(player, profile)
    let statsMultiplier = 0;

    const [armor, talismans, equipment, accessories, inventory, cakebag,] =
    await Promise.all([
        getArmor(profile),
        getTalismans(profile),
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

    // ? Jacob's Farming Shop
    if (farming.jacob.perks.double_drops) BASE_STATS['farming_fortune'] += farming.jacob.perks.double_drops * 2;

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

            // ? Combat Wisdom
            for (const i of Object.keys(slayerData.kills)) {
                if (i <= 3) {
                    BASE_STATS['combat_wisdom'] += 1;
                } else {
                    // ! Hypixel admins forgot to add tier 5 bosses to Wisdom calculation :/
                    if (i == 5) continue;
                    BASE_STATS['combat_wisdom'] += 2;
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

    // ? Accessories
    let talismanDupes = [];
    for (const item of Object.keys(accessories.i)) {
        const talisman = accessories.i[item]
        if (Object.keys(talisman).length === 0) continue;

        for (const [stat, value] of Object.entries(getStatsFromItem(talisman))) {
            BASE_STATS[stat] += value;
        }

        if (talisman.tag.ExtraAttributes.id == 'NIGHT_CRYSTAL' || talisman.tag.ExtraAttributes.id == 'DAY_CRYSTAL') {
            // ? Temporary talisman dupe fix
            if (talismanDupes.includes(talisman.tag.ExtraAttributes.id)) continue;
            talismanDupes.push(talisman.tag.ExtraAttributes.id)

            BASE_STATS['health'] += 5;
            BASE_STATS['strength'] += 5;
        }        
    }

    // ? Tunings
    let magicalPower = 0;
    talismanDupes = [];
    const currentReforge = profile.accessory_bag_storage['selected_power']
    for (const type in talismans) {
        if (type == 'tunings' || type == 'currentReforge' || type == 'talismanBagUpgrades' || type == 'unlockedReforges' || type == 'tuningsSlots') continue;
        for (const talisman of talismans[type]) {
            if (talismanDupes.includes(talisman.id)) continue;
            talismanDupes.push(talisman.id)
            magicalPower += getMagicalPower(talisman.rarity.toLowerCase())
        }
    }

    for (const [stat, value] of Object.entries(reforges[currentReforge].reforge)) {
        BASE_STATS[stat] += value * magicalPower;
    }

    for (const [stat, value] of Object.entries(reforges[currentReforge].power_bonus)) {
        BASE_STATS[stat] += value;
    }

   // ? Heart of the Mountain
   const miningSpeed = (mining.hotM_tree.perks.find(p => p.id == 'mining_speed'))?.level ?? 0; // Level * 20
   const miningSpeed2 = (mining.hotM_tree.perks.find(p => p.id == 'mining_speed_2'))?.level ?? 0; // Level * 40
   const miningFortune = (mining.hotM_tree.perks.find(p => p.id == 'mining_fortune'))?.level ?? 0; // Level * 5
   const miningFortune2 = (mining.hotM_tree.perks.find(p => p.id == 'mining_fortune_2'))?.level ?? 0; // Level * 5
   const miningMadness = (mining.hotM_tree.perks.find(p => p.id == 'mining_madness'))?.level ?? 0; // 50 MF & MS
   const seasonedMineman = (mining.hotM_tree.perks.find(p => p.id == 'seasoned_mineman'))?.level ?? 0; // 5 + (Level * 0.1)

   BASE_STATS['mining_wisdom'] += 5 + seasonedMineman * 0.1;

   BASE_STATS['mining_speed'] += 
       ((mining.hotM_tree.disabled_perks ?? []).includes('mining_speed') ? 0 : miningSpeed * 20) + 
       ((mining.hotM_tree.disabled_perks ?? []).includes('mining_speed_2') ? 0 : miningSpeed2 * 40) + 
       ((mining.hotM_tree.disabled_perks ?? []).includes('mining_madness') ? 0 : 50 * miningMadness);

   BASE_STATS['mining_fortune'] += 
       ((mining.hotM_tree.disabled_perks ?? []).includes('mining_fortune') ? 0 : miningFortune * 5) + 
       ((mining.hotM_tree.disabled_perks ?? []).includes('mining_fortune_2') ? 0 : miningFortune2 * 5) + 
       ((mining.hotM_tree.disabled_perks ?? []).includes('mining_madness') ? 0 : 50 * miningMadness);


    // ? Harp 
    for (const harp in profile.harp_quest) {
        if (harp.endsWith('_best_completion')) {
            if (harp < 1) continue;
            BASE_STATS['intelligence'] += misc.HARP_QUEST[harp] ?? 0;
        }
    }

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
            BASE_STATS['speed_cap'] = 500;
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
            if (piece.tag.ExtraAttributes?.eman_kills) {
                const kills = piece.tag.ExtraAttributes.eman_kills;
                for (const amountKills of Object.keys(misc.FINAL_DESTIONATION_ARMOR_KILLS)) {
                    if (kills >= amountKills) {
                        defense = misc.FINAL_DESTIONATION_ARMOR_KILLS[amountKills];
                    }
                }
                BASE_STATS['defense'] += defense;
            }

            // ? Tarantula 
            if (piece.tag.ExtraAttributes?.spider_kills) {
                const kills = piece.tag.ExtraAttributes.spider_kills;
                for (const amountKills of Object.keys(misc.TARANTULA_ARMOR_KILLS)) {
                    if (kills >= amountKills) {
                        defense = misc.TARANTULA_ARMOR_KILLS[amountKills];
                    }
                }
                BASE_STATS['defense'] += defense;
            }

            // ? Zombie
            if (piece.tag.ExtraAttributes?.zombie_kills) {
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

    // ? Active Pet
    for (const pet of pets.pets) {
        if (!pet.active) continue;
        for (const [stat, value] of Object.entries(pet.stats)) {
            BASE_STATS[stat] += value;
        }

        const petData = getPetData(BASE_STATS, mining, collection, profile, profileData, pet, miningLevel, fishingLevel);

        statsMultiplier += petData.statsMultiplier
        BASE_STATS = petData.BASE_STATS;
        BASE_STATS['strength'] += BASE_STATS['strength'] * petData.strengthMultiplier
        BASE_STATS['health'] += BASE_STATS['health'] * petData.healthMultiplier
        BASE_STATS['defense'] += BASE_STATS['defense'] * petData.defenseMultiplier
        BASE_STATS['bonus_attack_speed'] += BASE_STATS['bonus_attack_speed'] * petData.bonusAttackSpeedMultiplier
    }

    // ? Speed Cap 
    if (BASE_STATS['speed'] > BASE_STATS['speed_cap']) BASE_STATS['speed'] = BASE_STATS['speed_cap'];

    if (statsMultiplier > 0) {
        for (const stat of Object.keys(BASE_STATS)) {
            if (stat.includes('fortune' || stat == 'pristine')) continue;
            BASE_STATS[stat] += BASE_STATS[stat] * statsMultiplier;
        }
    }
    
    // ? Active Potion Effects
    for (const effect of profile.active_effects) {
        for (const [stat, value] of Object.entries(potions.MAXED_EFFECTS[effect.effect][effect.level].bonus)) {
            BASE_STATS[stat] += value;
        }
    }

    BASE_STATS['effective_health'] = BASE_STATS['health'] * ( 1 + (BASE_STATS['defense'] / 100) );

    return BASE_STATS;
}

function getPetData(BASE_STATS, mining, collection, profile, profileData, pet, miningLevel, fishingLevel) {
    let statsMultiplier = 0, healthMultiplier = 0, defenseMultiplier = 0, strengthMultiplier = 0, bonusAttackSpeedMultiplier = 0; 
    // ? OVERALL
    if (pet.type == 'ENDER_DRAGON') {
        if (pet.tier != 'LEGENDARY') {
            statsMultiplier += 0.001 * pet.level;
        }
    } 

    // ? HEALTH
    if (pet.type == 'BLUE_WHALE') {
        if (pet.tier == 'LEGENDARY') {
            healthMultiplier += 0.002 * pet.level;
        }
    }

    // ? DEFENSE (SPEED, HEALTH, FARMING FORTUNE, TRUE DEFENSE)
    if (pet.type == 'AMMONITE') {
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['defense'] += ((miningLevel * (0.02 * pet.level)) + (fishingLevel * (0.02 * pet.level)));
            BASE_STATS['speed'] += ((miningLevel * (0.02 * pet.level)) + (fishingLevel * (0.02 * pet.level)))
        }
    }

    if (pet.type == 'ELEPHANT') {
        if (pet.tier == 'COMMON' || pet.tier == 'UNCOMMON') {
            BASE_STATS['defense'] += (BASE_STATS['speed'] / 100) * 0.15 * pet.level;
        } 
        if (pet.tier == 'RARE') {
            BASE_STATS['defense'] += (BASE_STATS['speed'] / 100) * 0.15 * pet.level;
            BASE_STATS['health'] += (BASE_STATS['defense'] / 10) * 0.01 * pet.level;
        }
        if (pet.tier == 'EPIC') {
            BASE_STATS['defense'] += (BASE_STATS['speed'] / 100) * 0.2 * pet.level;
            BASE_STATS['health'] += (BASE_STATS['defense'] / 10) * 0.01 * pet.level;
        }
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['defense'] += (BASE_STATS['speed'] / 100) * 0.15 * pet.level;
            BASE_STATS['health'] += (BASE_STATS['defense'] / 10) * 0.01 * pet.level;
            BASE_STATS['farming_fortune'] += 1.8 * pet.level
        }
    }

    if (pet.type == 'BABY_YETI') {
        if (pet.tier == 'EPIC') {
            BASE_STATS['defense'] += BASE_STATS['strength'] / (0.5 * pet.level);
        } if (pet.tier == 'LEGENDARY') {
            BASE_STATS['defense'] += BASE_STATS['strength'] / (0.75 * pet.level);
        }
    } 

    if (pet.type == 'SILVERFISH') {
        if (pet.tier == 'COMMON') {
            BASE_STATS['true_defense'] += 0.05 * pet.level;
        }
        if (pet.tier == 'UNCOMMON') {
            BASE_STATS['true_defense'] += 0.1 * pet.level;
        }
        if (pet.tier == 'RARE') {
            BASE_STATS['true_defense'] += 0.1 * pet.level;
            BASE_STATS['mining_wisdom'] += 0.25 * pet.level;
        }
        if (pet.tier == 'EPIC') {
            BASE_STATS['true_defense'] += 0.15 * pet.level;
            BASE_STATS['mining_wisdom'] += 0.3 * pet.level;
        }
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['true_defense'] += 0.15 * pet.level;
            BASE_STATS['mining_wisdom'] += 0.3 * pet.level;
        }
    }

    if (pet.type == 'TURTLE') {
        if (pet.tier == 'EPIC' || pet.tier == 'LEGENDARY') {
            defenseMultiplier += 0.33 + 0.27 * pet.level;
        }
    }

    // ? TRUE DEFENSE (DEFENSE, COMBAT WISDOM)

    if (pet.type.includes('WISP')) {
        const blaze_kills = pet.extra?.blaze_kills ?? 0;

        let maxTier = false;
        let bonusIndex = misc.WISP_PET_KILLS.findIndex((x) => x.kills > blaze_kills);
    
        if (bonusIndex === -1) {
          bonusIndex = misc.WISP_PET_KILLS.length;
          maxTier = true;
        }
    
        const current = misc.WISP_PET_KILLS[bonusIndex - 1];
    
        let next = null;
        if (!maxTier)  next = misc.WISP_PET_KILLS[bonusIndex];
        
        // ! Hypixel does not add pet kill stats unless player is in combat with specific entity (blaze), so this is useless
        // BASE_STATS['true_defense'] += current.true_defense;
        // BASE_STATS['defense'] += current.defense;

        if (pet.type == 'DROPLET_WISP') {
            BASE_STATS['combat_wisdom'] += 0.3 * pet.level;
        }
    
        if (pet.type == 'FROST_WISP') {
            BASE_STATS['combat_wisdom'] += 0.4 * pet.level;
        }
    
        if (pet.type == 'GLACIAL_WISP') {
            BASE_STATS['combat_wisdom'] += 0.45 * pet.level;
        }
    
        if (pet.type == 'SUBZERO_WISP') {
            BASE_STATS['combat_wisdom'] += 0.5 * pet.level;
        }
    }

    // ? STRENGTH (MAGIC FIND)

    if (pet.type == 'GOLDEN_DRAGON') {
        const goldCollection = collection.find(c => c.id == 'GOLD_INGOT');
        const digits = Math.max(Math.floor(Math.log10(Math.abs(goldCollection.amount))), 0) + 1
        BASE_STATS['strength'] += digits * 10;
        BASE_STATS['magic_find'] += digits * 2;
    }

    if (pet.type == 'GRIFFIN') {
        if (pet.tier == 'LEGENDARY') {
            strengthMultiplier += 1 + 0.14 * pet.level
        }
    }

    // ? SPEED (MINING SPEED, MAGIC FIND, PET LUCK, SPEED CAP)

    if (pet.type == 'BLACK_CAT') {
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['speed'] += pet.level;;
            BASE_STATS['magic_find'] += 0.15 * pet.level;
            BASE_STATS['pet_luck'] += 0.15 * pet.level;
            BASE_STATS['speed_cap'] = 500;
        }
    }

    if (pet.type == 'ARMADILO') {
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['speed'] += BASE_STATS['defense'] / (100 - pet.level * 0.5);
            BASE_STATS['mining_speed'] += BASE_STATS['defense'] / (100 - pet.level * 0.5);
        }
    }

    // ? FEROCITY
    if (pet.type == 'TIGER') {
        if (pet.tier == 'COMMON') {
            ferocityMultiplier += 0.1;
        }
        if (pet.tier == 'UNCOMMON' || pet.tier == 'RARE') {
            ferocityMultiplier += 0.2;
        }
        if (pet.tier == 'EPIC' || pet.tier == 'LEGENDARY') {
            ferocityMultiplier += 0.3;
        }
    }

    // ? VITALITY
    if (pet.type == 'GHOUL') {
        if (pet.tier == 'EPIC' || pet.tier == 'LEGENDARY') {
            BASE_STATS['vitality'] += 0.25 * pet.level
        }
    }

    // ? BONUS ATTACK SPEED
    if (pet.type == 'HOUND') {
        if (pet.tier == 'LEGENDARY') {
            bonusAttackSpeedMultiplier += 0.1 * pet.level;
        }
    }
    // ? MINING FORTUNE
    if (pet.type == 'SCATHA') {
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['mining_fortune'] += 1.25 * pet.level;
        }
    }

    // ? FISHING SPEED
    if (pet.type == 'FLYING_FIISH') {
        if (pet.tier == 'RARE') {
            BASE_STATS['fishing_speed'] += 0.60 * pet.level;
        }
        if (pet.tier == 'EPIC' || pet.tier == 'LEGENDARY' || pet.tier == 'MYTHIC') {
            BASE_STATS['fishing_speed'] += 0.75 * pet.level;
        }
    }

    // ? SEA CREATURE CHANCE
    if (pet.type == 'AMMONITE') {
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['sea_creature_chance'] += mining.hotM_tree.level ?? 0;
        }
    }

    // ? FORAGING FORTUNE
    if (pet.type == 'MONKEY') {
        if (pet.tier == 'COMMON') {
            BASE_STATS['foraging_fortune'] += 0.4 * pet.level;
        }
        if (pet.tier == 'UNCOMMON' || pet.tier == 'RARE') {
            BASE_STATS['foraging_fortune'] += 0.5 * pet.level;
        }
        if (pet.tier == 'EPIC' || pet.tier == 'LEGENDARY') {
            BASE_STATS['foraging_fortune'] += 0.6 * pet.level;
        }
    }

    // ? FARMING FORTUNE
    if (pet.type == 'ELEPHANT') {
        if (pet.tier == 'LEGENDARY'){
            BASE_STATS['farming_fortune'] += 1.8 * 100;
        }
    }
        
    if (pet.type == 'MOOSHROOM_COW') {
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['farming_fortune'] += BASE_STATS['strength'] / (40 - pet.level * 0.2);
        }
    }

    return { 
        BASE_STATS: BASE_STATS,
        statsMultiplier: statsMultiplier,
        healthMultiplier: healthMultiplier,
        defenseMultiplier: defenseMultiplier,
        strengthMultiplier: strengthMultiplier,
        bonusAttackSpeedMultiplier: bonusAttackSpeedMultiplier,
    }
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

    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 325) return 10
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 275) return 9
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 225) return 8
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 175) return 7
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 130) return 6
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 100) return 5
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 75) return 4
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 50) return 3
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 25) return 2
    if (Object.values(highestRarity).reduce((a, b) => a + b, 0) > 10) return 1
    return 0;
}

function getMagicalPower(rarity) {
    const power = {
        common: 3,
        uncommon: 5,
        rare: 8,
        epic: 12,
        legendary: 16,
        mythic: 22,
        special: 3,
        very_special: 5,
    };

    return power[rarity];
}

module.exports = { getStats }                                         