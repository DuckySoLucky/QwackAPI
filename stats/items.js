const { decodeData } = require('../other/helper');

module.exports = async (profile) => {
    const promises = [];
    if (profile.inv_armor?.data) {
        promises.push({
            name: "armor",
            items: decodeData(Buffer.from(profile.inv_armor?.data, 'base64')),
        });
    }

    if (profile.equippment_contents?.data) {
        promises.push({
            name: "equipment",
            items: decodeData(Buffer.from(profile.equippment_contents?.data, 'base64')),
        });
    }

    if (profile?.backpack_contents) {
        promises.push({
            name: "backpack",
            items: Object.keys(profile?.backpack_contents).map(async (key) => {
                return {
                    items: await decodeData(Buffer.from(profile?.backpack_contents[key].data, 'base64')),
                    slot: `backpack_${key}`,
                }
            }),
        });
    }

    if (profile.quiver?.data) {
        promises.push({
            name: "quiver",
            items: decodeData(Buffer.from(profile.quiver?.data, 'base64')),
        });
    }

    if (profile.talisman_bag?.data) {
        promises.push({
            name: "talisman_bag",
            items: decodeData(Buffer.from(profile.talisman_bag?.data, 'base64')),
        });
    }

    if (profile?.backpack_icons) {
        promises.push({
            name: "backpack_icons",
            items: Object.keys(profile?.backpack_icons).map(async (key) => {
                return {
                    items: await decodeData(Buffer.from(profile?.backpack_icons[key].data, 'base64')),
                    slot: `backpack_icons_${key}`,
                }
            }),
        })
    }

    if (profile.wardrobe_contents?.data) {
        promises.push({
            name: "wardrobe",
            items: decodeData(Buffer.from(profile.wardrobe_contents?.data, 'base64')),
        });
    }

    if (profile?.ender_chest_contents) {
        promises.push({
            name: "enderchest",
            items: decodeData(Buffer.from(profile?.ender_chest_contents?.data, 'base64')),
        });
    }

    if (profile?.personal_vault_contents) {
        promises.push({
            name: "personal_vault",
            items: decodeData(Buffer.from(profile?.personal_vault_contents?.data, 'base64')),
        });
    }

    if (profile.fishing_bag?.data) {
        promises.push({
            name: "fishing_bag",
            items: decodeData(Buffer.from(profile.fishing_bag?.data, 'base64')),
        });
    }

    if (profile.potion_bag?.data) {
        promises.push({
            name: "potion_bag",
            items: decodeData(Buffer.from(profile.potion_bag.data, 'base64')),
        });
    }

    if (profile?.inv_contents) {
        promises.push({
            name: "inventory",
            items: decodeData(Buffer.from(profile.inv_contents.data, 'base64')),
        });
    }

    if (profile?.candy_inventory_contents) {
        promises.push({
            name: 'candy_inventory_contents',
            items: decodeData(Buffer.from(profile.candy_inventory_contents.data, 'base64'))
        });
    }

    let items = {};
    for (const promise of promises) {
        items[promise.name] = promise.items.length > 0 ? (await Promise.all(promise.items)).i : (await promise.items).i;
    }


    return items;
};