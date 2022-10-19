const getSkills = require("./skills");
const getSlayer = require("./slayer");
const getPets = require("./pets");
const getBestiary = require("./bestiary");
const getDungeons = require("./dungeons");
const getCakeBag = require('./cakebag');
const getArmor = require('./armor');
const getEquipment = require('./equipment');
const getCollections = require('./collections');
const getMining = require('./mining');
const getFarming = require('./farming')
const getTalismans = require('./talismans');

const bonuses = require("../constants/bonuses");
const xp_tables = require('../constants/xp_tables')
const misc = require("../constants/misc");
const potions = require('../constants/potions');
const reforges = require('../constants/reforges')
const armorSets = require('../constants/armor')

const { toFixed, capitalize } = require("../constants/functions");
const { symbols } = require('../constants/symbols');
const { decodeData } = require("../utils/nbt");

let BASE_STATS = {
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

    health_cap: null,
    speed_cap: 400,
};

let calculation = {};
for (const stat in BASE_STATS) {
    calculation[stat] = [];
}

['statsMultiplier', 'strengthMultiplier', 'healthMultiplier', 'defenseMultiplier', 'bonusAttackSpeedMultiplier'].forEach((key) => {
    calculation[key] = [];
});

async function getStats(player, profileData, profile, uuid, res) {
    // ! INACURRATE DATA
    // ! - Intelligence, this is due to hypixel not having "Defuse Kit" in an API, so intelligence will be offset by 1-10 points.
    // ! - 15 Magic find and 25 Wisdom, this is due to Hypixel not having booster cookie in API

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
    let statsMultiplier = 0, temp = 0;

    const [armor, talismans, equipment, accessories, inventory, cakebag,] =
    await Promise.all([
        getArmor(profile),
        getTalismans(profile),
        getEquipment(profile),
        profile?.talisman_bag?.data ? decodeData(Buffer.from(profile?.talisman_bag?.data, "base64")) : null,
        profile?.inv_contents?.data ? decodeData(Buffer.from(profile?.inv_contents?.data, "base64")) : null,
        getCakeBag(profile),   
    ]);

    // ? Bestiary
    if (bestiaryLevel > 0) {
        BASE_STATS['health'] += (toFixed(bestiaryLevel, 0) * 2);
        calculation['health'].push(`Bestiary Level Bonus: ${toFixed(bestiaryLevel, 0) * 2} | ${bestiaryLevel} * 2`);
    }

    // ? Cakebag
    if (cakebag.length > 0) {
        BASE_STATS['health'] += cakebag.length * 2;
        calculation['health'].push(`Cakebag Bonus: ${cakebag.length * 2} | ${cakebag.length} * 2`);
    }

    // ? Catacombs
    if (catacombsLevel > 0) {
        toFixed(catacombsLevel, 0) * 2 > 50 ?  BASE_STATS['health'] += 50 : BASE_STATS['health'] += (toFixed(catacombsLevel, 0) * 2);
        calculation['health'].push(`Catacombs Levels Bonus: ${toFixed(catacombsLevel, 0) * 2} | ${toFixed(catacombsLevel, 0) * 2 > 50 ? 50 : catacombsLevel} * 2`);
    }

    // ? Reaper Peppers
    if (profile.reaper_peppers_eaten) {
        BASE_STATS['health'] += (profile?.reaper_peppers_eaten * 2);
        calculation['health'].push(`Reaper Peppers Eaten: ${profile.reaper_peppers_eaten * 2} | ${profile.reaper_peppers_eaten} * 2`);
    }

    // ? Unique Pets
    if (getPetScore(pets.pets) > 0) {
        BASE_STATS['magic_find'] += getPetScore(pets.pets)
        calculation['magic_find'].push(`Unique Pets Score: ${getPetScore(pets.pets)} | ${getPetScore(pets.pets)} * 2`);
    }

    // ? Jacob's Farming Shop
    if (farming?.jacob.perks?.double_drops) {
        BASE_STATS['farming_fortune'] += farming?.jacob.perks?.double_drops * 2;
        calculation['farming_fortune'].push(`Jacob's Farming Shop: ${farming.jacob?.perks?.double_drops} * 2 = ${farming.jacob?.perks?.double_drops * 2}`);
    }

    // ? Permanent stats from Wither Essence Shop 
    if (profile.perks) {
        for (const [name, perkData] of Object.entries(profile.perks)) {
            if (!name.startsWith('permanent_')) continue;
            BASE_STATS[name.replaceAll('permanent_', '')] += (misc.FORBIDDEN_STATS[name.replaceAll('permanent_', '')] * perkData ?? 0)
            calculation[name.replaceAll('permanent_', '')].push(`Wither Essence Shop: ${misc.FORBIDDEN_STATS[name.replaceAll('permanent_', '')]} * ${perkData ?? 0} = ${misc.FORBIDDEN_STATS[name.replaceAll('permanent_', '')] * perkData ?? 0}`);
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
                    calculation[key].push(`${capitalize(name)} Slayer ${i + 1} Reward: ${value} | ${value}`);
                }
            }

            temp = 0;
            // ? Combat Wisdom
            for (const i of Object.keys(slayerData.kills)) {
                if (i <= 3) {
                    BASE_STATS['combat_wisdom'] += 1;
                    temp += 1;
                } else {
                    // ! Hypixel admins forgot to add tier 5 bosses to Wisdom calculation :/
                    if (i == 5) continue;
                    BASE_STATS['combat_wisdom'] += 2;
                    temp += 2;
                }
            }

            if (temp != 0) calculation['combat_wisdom'].push(`Slayer Tier Completion: ${temp} | ${temp}`);
        }
    }

    // ? Skill bonus stats
    if (skills) {
        for (const [skill, data] of Object.entries(skills)) {
            for (const [key, value] of Object.entries(getBonusStats(data.level, `skill_${skill}`, xp_tables.max_levels[skill]))) {
                BASE_STATS[key] += value;
                calculation[key].push(`${capitalize(skill)} Level: ${value} | ${value}`);
            }
        }
    }

    // ? Century Cakes
    if (profile.temp_stat_buffs) {
        for (const century_cake of profile.temp_stat_buffs) {
            if (!century_cake.key.startsWith('cake_')) continue;
            BASE_STATS[misc.CENTURY_CAKES[century_cake.key.replaceAll('cake_', '')] ?? century_cake.key.replaceAll('cake_', '')] += century_cake.amount;
            calculation[misc.CENTURY_CAKES[century_cake.key.replaceAll('cake_', '')] ?? century_cake.key.replaceAll('cake_', '')].push(`Century Cake: ${century_cake.amount} | ${century_cake.amount}`);
        }
    }

    // ? Equipment
    for (const [type, data] of Object.entries(equipment)) {
        if (Object.keys(data).length === 0) continue;
        for (const [stat, value] of Object.entries(getStatsFromItem(data))) {
            BASE_STATS[stat] += value;
            calculation[stat].push(`Equipment ${capitalize(type)}: ${value} | ${value}`);
        }
    }

    // ? Accessories
    let talismanDupes = [];
    if (accessories?.i.length > 0) {
        for (const item of Object.keys(accessories.i)) {
            const talisman = accessories.i[item]
            if (Object.keys(talisman).length === 0) continue;
    
            // ? Temporary talisman dupe fix
            if (talismanDupes.includes(talisman.tag.ExtraAttributes.id)) continue;
            talismanDupes.push(talisman.tag.ExtraAttributes.id)
    
            for (const [stat, value] of Object.entries(getStatsFromItem(talisman))) {
                BASE_STATS[stat] += value;
                calculation[stat].push(`${capitalize(talisman.tag.ExtraAttributes.id)}: ${value} | ${value}`);
            }
    
            if (talisman.tag.ExtraAttributes.id == 'NIGHT_CRYSTAL' || talisman.tag.ExtraAttributes.id == 'DAY_CRYSTAL') {
                talismanDupes.push('NIGHT_CRYSTAL'); talismanDupes.push('DAY_CRYSTAL');
                BASE_STATS['health'] += 5;
                BASE_STATS['strength'] += 5;
                calculation['health'].push(`${capitalize(talisman.tag.ExtraAttributes.id)} Ability: 5 | 5`);
                calculation['strength'].push(`${capitalize(talisman.tag.ExtraAttributes.id)} Ability: 5 | 5`);
            }        
        }
    } 

    // ? Magical Power
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

    // ? Accessory reforge
    if (reforges[currentReforge]?.reforge) {
        for (const [stat, value] of Object.entries(reforges[currentReforge].reforge)) {
            BASE_STATS[stat] += value * magicalPower;
            calculation[stat].push(`${capitalize(currentReforge)} Reforge: ${value * magicalPower} | ${value} * ${magicalPower}`);
        }
    
         // ? Power Bonus from Reforge
        for (const [stat, value] of Object.entries(reforges[currentReforge].power_bonus)) {
            BASE_STATS[stat] += value;
            calculation[stat].push(`${currentReforge} Reforge Bonus: ${value} | ${value}`);
        }
    }

   // ? Heart of the Mountain
   const miningSpeed = (mining.hotM_tree.perks.find(p => p.id == 'mining_speed'))?.level ?? 0; // Level * 20
   const miningSpeed2 = (mining.hotM_tree.perks.find(p => p.id == 'mining_speed_2'))?.level ?? 0; // Level * 40
   const miningFortune = (mining.hotM_tree.perks.find(p => p.id == 'mining_fortune'))?.level ?? 0; // Level * 5
   const miningFortune2 = (mining.hotM_tree.perks.find(p => p.id == 'mining_fortune_2'))?.level ?? 0; // Level * 5
   const miningMadness = (mining.hotM_tree.perks.find(p => p.id == 'mining_madness'))?.level ?? 0; // 50 MF & MS
   const seasonedMineman = (mining.hotM_tree.perks.find(p => p.id == 'seasoned_mineman'))?.level ?? 0; // 5 + (Level * 0.1)

   BASE_STATS['mining_wisdom'] += 5 + seasonedMineman * 0.1;
   BASE_STATS['mining_speed'] += ((mining.hotM_tree.disabled_perks ?? []).includes('mining_speed') ? 0 : miningSpeed * 20) + ((mining.hotM_tree.disabled_perks ?? []).includes('mining_speed_2') ? 0 : miningSpeed2 * 40) + ((mining.hotM_tree.disabled_perks ?? []).includes('mining_madness') ? 0 : 50 * miningMadness);
   BASE_STATS['mining_fortune'] += ((mining.hotM_tree.disabled_perks ?? []).includes('mining_fortune') ? 0 : miningFortune * 5) + ((mining.hotM_tree.disabled_perks ?? []).includes('mining_fortune_2') ? 0 : miningFortune2 * 5) + ((mining.hotM_tree.disabled_perks ?? []).includes('mining_madness') ? 0 : 50 * miningMadness);

    if (seasonedMineman > 0) calculation['mining_wisdom'].push(`Seasoned Mineman: ${5 + seasonedMineman * 0.1} | 5 + (${seasonedMineman} * 0.1)`);
    if (((mining.hotM_tree.disabled_perks ?? []).includes('mining_speed') ? 0 : miningSpeed * 20) + ((mining.hotM_tree.disabled_perks ?? []).includes('mining_speed_2') ? 0 : miningSpeed2 * 40) + ((mining.hotM_tree.disabled_perks ?? []).includes('mining_madness') ? 0 : 50 * miningMadness) > 0) calculation['mining_speed'].push(`Mining Speed: ${((mining.hotM_tree.disabled_perks ?? []).includes('mining_speed') ? 0 : miningSpeed * 20) + ((mining.hotM_tree.disabled_perks ?? []).includes('mining_speed_2') ? 0 : miningSpeed2 * 40) + ((mining.hotM_tree.disabled_perks ?? []).includes('mining_madness') ? 0 : 50 * miningMadness)} | ${((mining.hotM_tree.disabled_perks ?? []).includes('mining_speed') ? 0 : miningSpeed)} * 20 + ${((mining.hotM_tree.disabled_perks ?? []).includes('mining_speed_2') ? 0 : miningSpeed2)} * 40 + ${((mining.hotM_tree.disabled_perks ?? []).includes('mining_madness') ? 0 : 50)} * ${miningMadness}`);
    if (((mining.hotM_tree.disabled_perks ?? []).includes('mining_fortune') ? 0 : miningFortune * 5) + ((mining.hotM_tree.disabled_perks ?? []).includes('mining_fortune_2') ? 0 : miningFortune2 * 5) + ((mining.hotM_tree.disabled_perks ?? []).includes('mining_madness') ? 0 : 50 * miningMadness) > 0) calculation['mining_fortune'].push(`Mining Fortune: ${((mining.hotM_tree.disabled_perks ?? []).includes('mining_fortune') ? 0 : miningFortune * 5) + ((mining.hotM_tree.disabled_perks ?? []).includes('mining_fortune_2') ? 0 : miningFortune2 * 5) + ((mining.hotM_tree.disabled_perks ?? []).includes('mining_madness') ? 0 : 50 * miningMadness)} | ${((mining.hotM_tree.disabled_perks ?? []).includes('mining_fortune') ? 0 : miningFortune)} * 5 + ${((mining.hotM_tree.disabled_perks ?? []).includes('mining_fortune_2') ? 0 : miningFortune2)} * 5 + ${((mining.hotM_tree.disabled_perks ?? []).includes('mining_madness') ? 0 : 50)} * ${miningMadness}`);
    
    // ? Harp 
    for (const harp in profile.harp_quest) {
        if (harp.endsWith('_best_completion')) {
            if (harp < 1) continue;
            BASE_STATS['intelligence'] += misc.HARP_QUEST[harp] ?? 0;
            calculation['intelligence'].push(`${capitalize(harp)}: ${misc.HARP_QUEST[harp] ?? 0} | ${misc.HARP_QUEST[harp] ?? 0}`);
        }
    }

    // ? Armor
    let itemCount = {}, armorPiece = {};
    for (const [type, data] of Object.entries(armor)) {
        if (Object.keys(data).length === 0) continue;

        for (const [stat, value] of Object.entries(getStatsFromItem(data))) {
            BASE_STATS[stat] += value;
            calculation[stat].push(`${capitalize(data.tag.ExtraAttributes.id)}: ${value} | ${value}`);
        }

        if (data.tag.ExtraAttributes.id.includes('BOOTS') || data.tag.ExtraAttributes.id.includes('SLIPPERS') || data.tag.ExtraAttributes.id.includes('SHOES')) armorPiece['boots'] = data ?? null;
        if (data.tag.ExtraAttributes.id.includes('LEGGINGS')) armorPiece['leggings'] = data ?? null;
        if (data.tag.ExtraAttributes.id.includes('CHESTPLATE')) armorPiece['chestplate'] = data ?? null;
        else armorPiece['helmet'] = data ?? null;
        
        
        // * REFORGES

        // ? Loving (Increases ability damage by 5%)
        // ? Reforge doesn't seem to work, tested with multiple armor pieces. You get 0% boost from reforge.
        // if (data.tag.ExtraAttributes.reforge == 'loving') BASE_STATS['ability_damage'] += 5;

        // ? Renowned (Increases most of stats by 1%)
        if (data.tag.ExtraAttributes.reforge == 'renowned') {
            statsMultiplier += 0.01;
            calculation['statsMultiplier'].push(`Renowned Armor Reforge: 1% | 1%`);
        }

        // * INVENTORY
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
  
    // * ARMOR ABILTIES
    if (armorPiece) {
        for (const armorSet of Object.keys(armorSets)) {
            if (armorPiece['helmet']?.tag.ExtraAttributes.id == armorSets[armorSet].helmet && armorPiece['chestplate']?.tag.ExtraAttributes.id == armorSets[armorSet].chestplate && armorPiece['leggings']?.tag.ExtraAttributes.id == armorSets[armorSet].leggings && armorPiece['boots']?.tag.ExtraAttributes.id == armorSets[armorSet].boots) {
                for (const [stat, value] of Object.entries(armorSets[armorSet].bonus)) { 
                    stat.includes('_cap') ?  BASE_STATS[stat] = value : BASE_STATS[stat] += value;
                    calculation[stat].push(`${armorSets[armorSet].name} Ability: ${value} | ${value}`);
                }
            }
        }

        // TODO: Make Special Abilities work with format above
        // * Special armor abilities
        // ? Mastiff Armor
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'MASTIFF_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'MASTIFF_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'MASTIFF_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'MASTIFF_BOOTS') {
            BASE_STATS['health'] += BASE_STATS['crit_damage'] * 50;
            BASE_STATS['crit_damage'] = BASE_STATS['crit_damage'] / 2;
            calculation['health'].push(`Mastiff Armor: ${BASE_STATS['crit_damage'] * 50} | ${BASE_STATS['crit_damage'] * 50}`);
            calculation['crit_damage'].push(`Mastiff Armor: ${BASE_STATS['crit_damage'] / 2} | ${BASE_STATS['crit_damage'] / 2}`);
        }

        // ? Obsidian Chestplate
        if (armorPiece['chestplate']?.tag.ExtraAttributes.id == 'OBSIDIAN_CHESTPLATE') {
            itemCount['OBSIDIAN'] ??= 0;
            BASE_STATS['speed'] += itemCount['OBSIDIAN'] / 20 ? toFixed((itemCount['OBSIDIAN'] / 20), 0) : 0;
            calculation['speed'].push(`Obsidian Chestplate: ${itemCount['OBSIDIAN'] / 20 ? toFixed((itemCount['OBSIDIAN'] / 20), 0) : 0} | ${itemCount['OBSIDIAN'] / 20 ? toFixed((itemCount['OBSIDIAN'] / 20), 0) : 0}`);
        }

        // ? Glacite Armor
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'GLACITE_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'GLACITE_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'GLACITE_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'GLACITE_BOOTS') {
            BASE_STATS['mining_speed'] += miningLevel * 2;
            calculation['mining_speed'].push(`Glacite Armor: ${miningLevel * 2} | ${miningLevel} * `);
        }

        // ? Fairy Armor
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'FAIRY_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'FAIRY_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'FAIRY_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'FAIRY_BOOTS') {
            BASE_STATS['health'] += profile.fairy_souls_collected ?? 0;
            calculation['health'].push(`Fairy Armor: ${profile.fairy_souls_collected ?? 0} | ${profile.fairy_souls_collected ?? 0}`);
        }

        // ? Emerald Armor
        if (armorPiece['helmet']?.tag.ExtraAttributes.id == 'EMERALD_ARMOR_HELMET' && armorPiece['chestplate']?.tag.ExtraAttributes.id == 'EMERALD_ARMOR_CHESTPLATE' && armorPiece['leggings']?.tag.ExtraAttributes.id == 'EMERALD_ARMOR_LEGGINGS' && armorPiece['boots']?.tag.ExtraAttributes.id == 'EMERALD_ARMOR_BOOTS') {
            const emeraldCollection = collection.find(c => c.id == 'EMERALD');
            const amount = emeraldCollection.amount ?? 0;
            BASE_STATS['health'] += toFixed((amount / 3000), 0) > 350 ? 350 : toFixed((amount / 3000), 0)
            BASE_STATS['defense'] += toFixed((amount / 3000), 0) > 350 ? 350 : toFixed((amount / 3000), 0)
            calculation['health'].push(`Emerald Armor: ${toFixed((amount / 3000), 0) > 350 ? 350 : toFixed((amount / 3000), 0)} | ${amount} / 3000`);
            calculation['defense'].push(`Emerald Armor: ${toFixed((amount / 3000), 0) > 350 ? 350 : toFixed((amount / 3000), 0)} | ${amount} / 3000`);
        }

        // ? Slayer Sets
        for (let piece in armorPiece) {
            piece = armorPiece[piece];
            let defense = 0;
            for (const key of Object.keys(piece.tag.ExtraAttributes)) {
                if (!key.includes('_kills')) continue;
                for (const amountKills of Object.keys(misc[`${key.toUpperCase()}_ARMOR`])) {
                    if (piece.tag.ExtraAttributes[key] >= amountKills) {
                        defense = misc[`${key.toUpperCase()}_ARMOR`][amountKills];
                    }
                }
                BASE_STATS['defense'] += defense;
                calculation['defense'].push(`${capitalize(key.toLowerCase().replaceAll('_kills', ''))} Slayer Armor Kill Bonus: ${defense} | ${piece.tag.ExtraAttributes[key]} Kills`);
            }
        }
    }

    // ? Active Pet
    for (const pet of pets.pets) {
        if (!pet.active) continue;
        for (const [stat, value] of Object.entries(pet.stats)) {
            BASE_STATS[stat] += value;
            calculation[stat].push(`${pet.name} Pet: ${value} | ${value / pet.level} * ${pet.level}`);
        }

        const petData = getPetData(calculation, BASE_STATS, mining, collection, profile, profileData, pet, miningLevel, fishingLevel);
        statsMultiplier += petData.statsMultiplier ?? 0;
        BASE_STATS = petData.BASE_STATS;
        calculation = [];
        calculation = petData.calculation; 

        if (petData.statsMultiplier) calculation['statsMultiplier'].push(`Active Pet: ${petData.statsMultiplier} | ${petData.statsMultiplier}`);

        BASE_STATS['strength'] += BASE_STATS['strength'] * petData.strengthMultiplier
        BASE_STATS['health'] += BASE_STATS['health'] * petData.healthMultiplier
        BASE_STATS['defense'] += BASE_STATS['defense'] * petData.defenseMultiplier
        BASE_STATS['bonus_attack_speed'] += BASE_STATS['bonus_attack_speed'] * petData.bonusAttackSpeedMultiplier
    }

    if (statsMultiplier > 0) {
        for (const stat of Object.keys(BASE_STATS)) {
            if (stat.includes('fortune' || stat == 'pristine' || stat == 'effective_health')) continue;
            BASE_STATS[stat] += BASE_STATS[stat] * statsMultiplier;
        }
    }
    
    // ? Active Potion Effects
    for (const effect of profile.active_effects) {
        if (!potions.MAXED_EFFECTS[effect.effect][effect.level]?.bonus) continue;
        for (const [stat, value] of Object.entries(potions.MAXED_EFFECTS[effect.effect][effect.level]?.bonus)) {
            BASE_STATS[stat] += value;
            calculation[stat].push(`Active Potion Effect: ${value} | ${potions.MAXED_EFFECTS[effect.effect][effect.level]?.name ?? effect.effect}`);
        }
    }

    BASE_STATS['effective_health'] = BASE_STATS['health'] * ( 1 + (BASE_STATS['defense'] / 100));
    calculation['effective_health'].push(`${BASE_STATS['health'] * ( 1 + (BASE_STATS['defense'] / 100))} | ${BASE_STATS['health']} * ( 1 + (${BASE_STATS['defense']} / 100))`);

    // ? Speed Cap 
    if (BASE_STATS['speed'] > BASE_STATS['speed_cap']) BASE_STATS['speed'] = BASE_STATS['speed_cap'];

    // ? Health Cap
    if (BASE_STATS['health_cap']) BASE_STATS['health'] = BASE_STATS['health_cap'];

    return {
        BASE_STATS,
        calculation
    };
}

function getPetData(calculation, BASE_STATS, mining, collection, profile, profileData, pet, miningLevel, fishingLevel) {
    let statsMultiplier = 0, healthMultiplier = 0, defenseMultiplier = 0, strengthMultiplier = 0, bonusAttackSpeedMultiplier = 0; 
    // ? OVERALL
    if (pet.type == 'ENDER_DRAGON') {
        if (pet.tier != 'LEGENDARY') {
            statsMultiplier += 0.001 * pet.level;
            calculation['statsMultiplier'].push(`Ender Dragon Pet: ${0.001 * pet.level} | ${pet.level} * 0.001`);
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
            calculation['defense'].push(`Ammonite Pet: ${((miningLevel * (0.02 * pet.level)) + (fishingLevel * (0.02 * pet.level)))} | (${miningLevel} * (0.02 * ${pet.level})) + (${fishingLevel} * (0.02 * ${pet.level}))`);
            calculation['speed'].push(`Ammonite Pet: ${((miningLevel * (0.02 * pet.level)) + (fishingLevel * (0.02 * pet.level)))} | (${miningLevel} * (0.02 * ${pet.level})) + (${fishingLevel} * (0.02 * ${pet.level}))`);
        }
    }

    if (pet.type == 'ELEPHANT') {
        if (pet.tier == 'COMMON' || pet.tier == 'UNCOMMON') {
            BASE_STATS['defense'] += (BASE_STATS['speed'] / 100) * 0.15 * pet.level;
            calculation['defense'].push(`Elephant Pet: ${((BASE_STATS['speed'] / 100) * 0.15 * pet.level)} | (${BASE_STATS['speed']} / 100) * 0.15 * ${pet.level}`);
        } 
        if (pet.tier == 'RARE') {
            BASE_STATS['defense'] += (BASE_STATS['speed'] / 100) * 0.15 * pet.level;
            BASE_STATS['health'] += (BASE_STATS['defense'] / 10) * 0.01 * pet.level;
            calculation['defense'].push(`Elephant Pet: ${((BASE_STATS['speed'] / 100) * 0.15 * pet.level)} | (${BASE_STATS['speed']} / 100) * 0.15 * ${pet.level}`);
            calculation['health'].push(`Elephant Pet: ${((BASE_STATS['defense'] / 10) * 0.01 * pet.level)} | (${BASE_STATS['defense']} / 10) * 0.01 * ${pet.level}`);
        }
        if (pet.tier == 'EPIC') {
            BASE_STATS['defense'] += (BASE_STATS['speed'] / 100) * 0.2 * pet.level;
            BASE_STATS['health'] += (BASE_STATS['defense'] / 10) * 0.01 * pet.level;
            calculation['defense'].push(`Elephant Pet: ${((BASE_STATS['speed'] / 100) * 0.2 * pet.level)} | (${BASE_STATS['speed']} / 100) * 0.2 * ${pet.level}`);
            calculation['health'].push(`Elephant Pet: ${((BASE_STATS['defense'] / 10) * 0.01 * pet.level)} | (${BASE_STATS['defense']} / 10) * 0.01 * ${pet.level}`);
        }
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['defense'] += (BASE_STATS['speed'] / 100) * 0.15 * pet.level;
            BASE_STATS['health'] += (BASE_STATS['defense'] / 10) * 0.01 * pet.level;
            BASE_STATS['farming_fortune'] += 1.8 * pet.level
            calculation['defense'].push(`Elephant Pet: ${((BASE_STATS['speed'] / 100) * 0.15 * pet.level)} | (${BASE_STATS['speed']} / 100) * 0.15 * ${pet.level}`);
            calculation['health'].push(`Elephant Pet: ${((BASE_STATS['defense'] / 10) * 0.01 * pet.level)} | (${BASE_STATS['defense']} / 10) * 0.01 * ${pet.level}`);
            calculation['farming_fortune'].push(`Elephant Pet: ${1.8 * pet.level} | 1.8 * ${pet.level}`);
        }
    }

    if (pet.type == 'BABY_YETI') {
        if (pet.tier == 'EPIC') {
            BASE_STATS['defense'] += BASE_STATS['strength'] / (0.5 * pet.level);
            calculation['defense'].push(`Baby Yeti Pet: ${BASE_STATS['strength'] / (0.5 * pet.level)} | ${BASE_STATS['strength']} / (0.5 * ${pet.level})`);
        } if (pet.tier == 'LEGENDARY') {
            BASE_STATS['defense'] += BASE_STATS['strength'] / (0.75 * pet.level);
            calculation['defense'].push(`Baby Yeti Pet: ${BASE_STATS['strength'] / (0.75 * pet.level)} | ${BASE_STATS['strength']} / (0.75 * ${pet.level})`);
        }
    } 

    if (pet.type == 'SILVERFISH') {
        if (pet.tier == 'COMMON') {
            BASE_STATS['true_defense'] += 0.05 * pet.level;
            calculation['true_defense'].push(`Silverfish Pet: ${0.05 * pet.level} | 0.05 * ${pet.level}`);
        }
        if (pet.tier == 'UNCOMMON') {
            BASE_STATS['true_defense'] += 0.1 * pet.level;
            calculation['true_defense'].push(`Silverfish Pet: ${0.1 * pet.level} | 0.1 * ${pet.level}`);
        }
        if (pet.tier == 'RARE') {
            BASE_STATS['true_defense'] += 0.1 * pet.level;
            BASE_STATS['mining_wisdom'] += 0.25 * pet.level;
            calculation['true_defense'].push(`Silverfish Pet: ${0.1 * pet.level} | 0.1 * ${pet.level}`);
        }
        if (pet.tier == 'EPIC') {
            BASE_STATS['true_defense'] += 0.15 * pet.level;
            BASE_STATS['mining_wisdom'] += 0.3 * pet.level;
            calculation['true_defense'].push(`Silverfish Pet: ${0.15 * pet.level} | 0.15 * ${pet.level}`);
            calculation['mining_wisdom'].push(`Silverfish Pet: ${0.3 * pet.level} | 0.3 * ${pet.level}`);
        }
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['true_defense'] += 0.15 * pet.level;
            BASE_STATS['mining_wisdom'] += 0.3 * pet.level;
            calculation['true_defense'].push(`Silverfish Pet: ${0.15 * pet.level} | 0.15 * ${pet.level}`);
            calculation['mining_wisdom'].push(`Silverfish Pet: ${0.3 * pet.level} | 0.3 * ${pet.level}`);
        }
    }

    if (pet.type == 'TURTLE') {
        if (pet.tier == 'EPIC' || pet.tier == 'LEGENDARY') {
            defenseMultiplier += 0.33 + 0.27 * pet.level;
            calculation['defenseMultiplier'].push(`Turtle Pet: ${0.33 + 0.27 * pet.level} | 0.33 + 0.27 * ${pet.level}`);
        }
    }

    // ? TRUE DEFENSE (DEFENSE, COMBAT WISDOM)
    if (pet.type == 'DROPLET_WISP') {
        BASE_STATS['combat_wisdom'] += 0.3 * pet.level;
        calculation['combat_wisdom'].push(`Droplet Wisp Pet: ${0.3 * pet.level} | 0.3 * ${pet.level}`);
    }

    if (pet.type == 'FROST_WISP') {
        BASE_STATS['combat_wisdom'] += 0.4 * pet.level;
        calculation['combat_wisdom'].push(`Frost Wisp Pet: ${0.4 * pet.level} | 0.4 * ${pet.level}`);
    }

    if (pet.type == 'GLACIAL_WISP') {
        BASE_STATS['combat_wisdom'] += 0.45 * pet.level;
        calculation['combat_wisdom'].push(`Glacial Wisp Pet: ${0.45 * pet.level} | 0.45 * ${pet.level}`);
    }

    if (pet.type == 'SUBZERO_WISP') {
        BASE_STATS['combat_wisdom'] += 0.5 * pet.level;
        calculation['combat_wisdom'].push(`Subzero Wisp Pet: ${0.5 * pet.level} | 0.5 * ${pet.level}`);
    }
    

    // ? STRENGTH (MAGIC FIND)

    if (pet.type == 'GOLDEN_DRAGON') {
        const goldCollection = collection.find(c => c.id == 'GOLD_INGOT');
        const digits = Math.max(Math.floor(Math.log10(Math.abs(goldCollection.amount))), 0) + 1
        BASE_STATS['strength'] += digits * 10;
        BASE_STATS['magic_find'] += digits * 2;
        calculation['strength'].push(`Golden Dragon Pet: ${digits * 10} | ${digits} * 10`);
        calculation['magic_find'].push(`Golden Dragon Pet: ${digits * 2} | ${digits} * 2`);
    }

    if (pet.type == 'GRIFFIN') {
        if (pet.tier == 'LEGENDARY') {
            strengthMultiplier += 1 + 0.14 * pet.level
            calculation['strengthMultiplier'].push(`Griffin Pet: ${1 + 0.14 * pet.level} | 1 + 0.14 * ${pet.level}`);
        }
    }

    // ? SPEED (MINING SPEED, MAGIC FIND, PET LUCK, SPEED CAP)

    if (pet.type == 'BLACK_CAT') {
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['speed'] += pet.level;;
            BASE_STATS['magic_find'] += 0.15 * pet.level;
            BASE_STATS['pet_luck'] += 0.15 * pet.level;
            BASE_STATS['speed_cap'] = 500;
            calculation['speed'].push(`Black Cat Pet: ${pet.level} | ${pet.level}`);
            calculation['magic_find'].push(`Black Cat Pet: ${0.15 * pet.level} | 0.15 * ${pet.level}`);
            calculation['pet_luck'].push(`Black Cat Pet: ${0.15 * pet.level} | 0.15 * ${pet.level}`);
            calculation['speed_cap'].push(`Black Cat Pet: 500`);
        }
    }

    if (pet.type == 'ARMADILO') {
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['speed'] += BASE_STATS['defense'] / (100 - pet.level * 0.5);
            BASE_STATS['mining_speed'] += BASE_STATS['defense'] / (100 - pet.level * 0.5);
            calculation['speed'].push(`Armadillo Pet: ${BASE_STATS['defense'] / (100 - pet.level * 0.5)} | ${BASE_STATS['defense']} / (100 - ${pet.level} * 0.5)`);
            calculation['mining_speed'].push(`Armadillo Pet: ${BASE_STATS['defense'] / (100 - pet.level * 0.5)} | ${BASE_STATS['defense']} / (100 - ${pet.level} * 0.5)`);
        }
    }

    // ? FEROCITY
    if (pet.type == 'TIGER') {
        if (pet.tier == 'COMMON') {
            ferocityMultiplier += 0.1 * pet.level;
            calculation['ferocityMultiplier'].push(`Tiger Pet: ${0.1 * pet.level} | 0.1 * ${pet.level}`);
        }
        if (pet.tier == 'UNCOMMON' || pet.tier == 'RARE') {
            ferocityMultiplier += 0.2 * pet.level;
            calculation['ferocityMultiplier'].push(`Tiger Pet: ${0.2 * pet.level} | 0.2 * ${pet.level}`);
        }
        if (pet.tier == 'EPIC' || pet.tier == 'LEGENDARY') {
            ferocityMultiplier += 0.3 * pet.level;
            calculation['ferocityMultiplier'].push(`Tiger Pet: ${0.3 * pet.level} | 0.3 * ${pet.level}`);
        }
    }

    // ? VITALITY
    if (pet.type == 'GHOUL') {
        if (pet.tier == 'EPIC' || pet.tier == 'LEGENDARY') {
            BASE_STATS['vitality'] += 0.25 * pet.level
            calculation['vitality'].push(`Ghoul Pet: ${0.25 * pet.level} | 0.25 * ${pet.level}`);
        }
    }

    // ? BONUS ATTACK SPEED
    if (pet.type == 'HOUND') {
        if (pet.tier == 'LEGENDARY') {
            bonusAttackSpeedMultiplier += 0.1 * pet.level;
            calculation['bonusAttackSpeedMultiplier'].push(`Hound Pet: ${0.1 * pet.level} | 0.1 * ${pet.level}`);
        }
    }
    // ? MINING FORTUNE
    if (pet.type == 'SCATHA') {
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['mining_fortune'] += 1.25 * pet.level;
            calculation['mining_fortune'].push(`Scatha Pet: ${1.25 * pet.level} | 1.25 * ${pet.level}`);
        }
    }

    // ? FISHING SPEED
    if (pet.type == 'FLYING_FIISH') {
        if (pet.tier == 'RARE') {
            BASE_STATS['fishing_speed'] += 0.60 * pet.level;
            calculation['fishing_speed'].push(`Flying Fish Pet: ${0.60 * pet.level} | 0.60 * ${pet.level}`);
        }
        if (pet.tier == 'EPIC' || pet.tier == 'LEGENDARY' || pet.tier == 'MYTHIC') {
            BASE_STATS['fishing_speed'] += 0.75 * pet.level;
            calculation['fishing_speed'].push(`Flying Fish Pet: ${0.75 * pet.level} | 0.75 * ${pet.level}`);
        }
    }

    // ? SEA CREATURE CHANCE
    if (pet.type == 'AMMONITE') {
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['sea_creature_chance'] += mining.hotM_tree.level ?? 0;
            calculation['sea_creature_chance'].push(`Ammonite Pet: ${mining.hotM_tree.level ?? 0} | ${mining.hotM_tree.level ?? 0}`);
        }
    }

    // ? FORAGING FORTUNE
    if (pet.type == 'MONKEY') {
        if (pet.tier == 'COMMON') {
            BASE_STATS['foraging_fortune'] += 0.4 * pet.level;
            calculation['foraging_fortune'].push(`Monkey Pet: ${0.4 * pet.level} | 0.4 * ${pet.level}`);
        }
        if (pet.tier == 'UNCOMMON' || pet.tier == 'RARE') {
            BASE_STATS['foraging_fortune'] += 0.5 * pet.level;
            calculation['foraging_fortune'].push(`Monkey Pet: ${0.5 * pet.level} | 0.5 * ${pet.level}`);
        }
        if (pet.tier == 'EPIC' || pet.tier == 'LEGENDARY') {
            BASE_STATS['foraging_fortune'] += 0.6 * pet.level;
            calculation['foraging_fortune'].push(`Monkey Pet: ${0.6 * pet.level} | 0.6 * ${pet.level}`);
        }
    }

    // ? FARMING FORTUNE
    if (pet.type == 'ELEPHANT') {
        if (pet.tier == 'LEGENDARY'){
            BASE_STATS['farming_fortune'] += 1.8 * 100;
            calculation['farming_fortune'].push(`Elephant Pet: ${1.8 * 100} | 1.8 * 100`);
        }
    }
        
    if (pet.type == 'MOOSHROOM_COW') {
        if (pet.tier == 'LEGENDARY') {
            BASE_STATS['farming_fortune'] += BASE_STATS['strength'] / (40 - pet.level * 0.2);
            calculation['farming_fortune'].push(`Mooshroom Cow Pet: ${BASE_STATS['strength'] / (40 - pet.level * 0.2)} | ${BASE_STATS['strength']} / (40 - ${pet.level} * 0.2)`);
        }
    }

    return { 
        BASE_STATS: BASE_STATS,
        calculation: calculation,
        statsMultiplier: statsMultiplier,
        healthMultiplier: healthMultiplier,
        defenseMultiplier: defenseMultiplier,
        strengthMultiplier: strengthMultiplier,
        bonusAttackSpeedMultiplier: bonusAttackSpeedMultiplier,
    }
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
        very: 5,
    };

    return power[rarity];
}

module.exports = { getStats }                                         