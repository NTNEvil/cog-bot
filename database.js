const supabase = require('./conn');
const HealingHpSpell = require('./model/HealingHpSpell');

const races = ['Humano', 'Dragonborn', 'Tiefling', 'Fada', 'Anão', 'Elfo', 'Orc'];

async function getProfiles() {
    let { data: profiles } = await supabase
        .from('profiles')
        .select('*')
    return profiles;
}

async function getProfile(profileId) {
    let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId);
    return profile[0];
}

async function getProfileByDiscord(discordId) {
    let { data: discord } = await supabase
        .from('discord')
        .select('*')
        .eq('discord_id', discordId);
    const profile = await getProfile(discord[0].profile_id);
    return profile;
}

async function getStatus(userId) {
    let { data: status } = await supabase
        .from('status')
        .select('*')
        .eq('user_id', userId);
    return status[0];
}

async function updateStatus(status) {
    await supabase
        .from('status')
        .update(status)
        .eq('id', status.id);
    return true;
}

async function getStatusByDiscord(discordId) {
    let { data: discord } = await supabase
        .from('discord')
        .select('*')
        .eq('discord_id', discordId);
    if (discord[0] == undefined) throw new Error('Usuario não encontrado!');
    const status = await getStatus(discord[0].user_id);
    if (status == undefined) throw new Error('Usuario não encontrado!');
    return status;
}

async function resetHpAndMp() {
    let { data: status } = await supabase
        .from('status')
        .select('*');

    for (let i = 0; i < status.length; i++) {
        const item = status[i];
        const hp = (item.cons * 10) + 100;
        const mp = (item.int * 10) + 100;
        await supabase
            .from('status')
            .update({ hp: hp, mp: mp })
            .eq('id', item.id);
    }
}

function calculateAddXp(lvInit, xpInit, xpAdd, freePointInit) {
    let lv = lvInit;
    let xp = parseInt(xpInit) + parseInt(xpAdd);
    let maxXp = lv * 100;
    let freePoint = freePointInit;
    let leveledUp = 0;
    while (xp >= maxXp) {
        xp -= maxXp;
        lv++;
        leveledUp++;
        freePoint += 5;
        maxXp = lv * 100;
    }
    return { lv: lv, xp: xp, free_point: freePoint, leveledUp: leveledUp };
}

async function addXp(discordId, value) {
    let status = await getStatusByDiscord(discordId);
    const result = calculateAddXp(status.lv, status.xp, value, status.free_point);
    console.log(result);

    let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', status.user_id);
    const race = profile[0].race;

    for (let i = 0; i < result.leveledUp; i++) {
        status = lvUp(race, status);
    }

    status.xp = result.xp;
    status.lv = result.lv;
    status.free_point = result.free_point;

    await supabase
        .from('status')
        .update(status)
        .eq('id', status.id);
    return true;
}

function lvUp(race, status) {
    if (!races.includes(race)) throw new Error('A raça esta incorreta!');
    switch (race) {
        case 'Humano':
            status.str++;
            status.dex++;
            status.cons++;
            status.wis++;
            status.int++;
            break;
        case 'Dragonborn':
            status.str += 2;
            status.cons++;
            break;
        case 'Tiefling':
            status.dex += 2;
            status.wis++;
            status.int++;
            break;
        case 'Fada':
            status.str--;
            status.dex += 3;
            status.cons--;
            status.wis += 2;
            status.int += 2;
            break;
        case 'Anão':
            status.str += 2;
            status.cons += 2;
            break;
        case 'Elfo':
            status.dex += 2;
            status.wis += 2;
            status.int++;
            break;
        case 'Orc':
            status.str += 3;
            status.cons += 2;
            status.int--;
            break;
        default:
            break;
    }
    return status;
}

async function addMoney(discordId, value) {
    value = parseInt(value);
    const profile = await getProfileByDiscord(discordId);
    profile.money += value;

    await supabase
        .from('profiles')
        .update({ money: profile.money })
        .eq('user_id', profile.user_id);
    return true;
}

async function getStore() {
    let result = [];
    let { data: store } = await supabase
        .from('store')
        .select('*')

    for (let i = 0; i < store.length; i++) {
        let { data: item } = await supabase
            .from('items')
            .select('*')
            .eq('id', store[i].item_id)

        let model = {};
        model.id = store[i].id;
        model.name = item[0].name;
        model.price = store[i].price;
        model.description = item[0].description;
        model.img = item[0].img;
        result.push(model);
    }
    return result;
}

async function getItems() {
    let { data: items } = await supabase
        .from('items')
        .select('*')
    return items;
}

async function newItem(name, description, img) {
    await supabase
        .from('items')
        .insert([
            { name: name, description: description, img: img },
        ])
    return true;
}

// COMBAT
async function simpleAtk(atk, target, isArmed) {
    if (atk.isPlayer) {
        atk.status = await getStatusByDiscord(atk.id);
    }

    console.log(atk);

    if (target.isPlayer) {
        target.status = await getStatusByDiscord(target.id);
    }

    console.log(target);

    const vcdAtk = atk.status.dex + (Math.floor(Math.random() * 10) + 1);
    const vcdDef = target.status.dex + (Math.floor(Math.random() * 10) + 1);
    console.log(`VCDAtk: ${vcdAtk}`, `VCDDef: ${vcdDef}`);
    let critical = false;
    if (vcdAtk < vcdDef) {
        return {
            success: false,
            damage: 0,
            critical: critical,
            atk: atk,
            target: target
        }
    } else {
        // damage
        let damage;
        ({ damage, critical } = await setDamage(atk, critical, target, isArmed));

        return {
            success: true,
            damage: damage,
            critical: critical,
            atk: atk,
            target: target
        }
    }
}

async function getInvShow(discordId) {
    const profile = await getProfileByDiscord(discordId);

    const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', profile.user_id);

    for (let i = 0; i < inventory.length; i++) {
        const item = await getItem(inventory[i].item_id);
        inventory[i].data = item;
    }

    return inventory;
}

async function getInvItem(userId, invId) {
    // get inv item
    let { data: invItems } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', invId)
        .eq('user_id', userId)
    if (invItems[0] == undefined) throw new Error('Item not found');
    const invItem = invItems[0];

    const itemData = await getItem(invItem.item_id);
    return itemData;
}

async function giveItem(discordId, itemId) {
    const profile = await getProfileByDiscord(discordId);

    await getItem(itemId);

    await supabase
        .from('inventory')
        .insert([
            { item_id: itemId, user_id: profile.user_id },
        ]);

    return true;
}

async function removeItem(discordId, invId) {
    const profile = await getProfileByDiscord(discordId);

    // get inv item
    let { data: invItems } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', invId)
        .eq('user_id', profile.user_id)
    if (invItems[0] == undefined) throw new Error('Item not found');
    const invItem = invItems[0];

    const itemData = await getItem(invItem.item_id);

    if (invItem.equipped) {
        console.log('This item are equipped');
        const status = await getStatusByDiscord(discordId);
        // unequipped item
        status[itemData.type] = null;

        // update database
        await supabase
            .from('status')
            .update(status)
            .eq('id', status.id);
    }

    await supabase
        .from('inventory')
        .delete()
        .eq('id', invId)
        .eq('user_id', profile.user_id);

    return true;
}

async function getItem(itemId) {
    if (isNaN(itemId)) throw new Error('Value invalid');
    let { data: items } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
    if (items[0] == undefined) throw new Error('Item not found');
    return items[0]
}

async function setDamage(atk, critical, target, isArmed) {
    let damage = 10 + atk.status.str;
    if (atk.isPlayer) {
        // player atk
        if (atk.status.weapon != null && isArmed) {
            const item = await getInvItem(atk.status.user_id, atk.status.weapon);
            damage += item.value1;
        }
        console.log(`Damage: ${damage}`);

        // critical
        const randCritical = Math.random();
        console.log(`luck: ${0.2 + (atk.status.luck / 100)}`);
        if (randCritical <= 0.2 + (atk.status.luck / 100)) {
            damage *= 2;
            critical = true;
        }
    } else {
        // mob atk
        // critical
        const randCritical = Math.random();
        console.log(`luck: ${0.2 + (atk.status.luck / 100)}`);
        if (randCritical <= 0.2 + (atk.status.luck / 100)) {
            damage *= 2;
            critical = true;
        }
    }

    if (target.isPlayer) {
        // player defense
        // armor reduction
        if (target.status.armor != null) {
            console.log('Armour detect')
            const itemArmor = await getInvItem(target.status.user_id, target.status.armor);
            const reductionDamage = (itemArmor.value1 / 100) * damage;
            damage -= reductionDamage;
        }
        console.log(`Final damage: ${damage}`);

        // hp
        target.status.hp -= damage;

        // update database
        await supabase
            .from('status')
            .update(target.status)
            .eq('id', target.status.id);
    } else {
        // mob defense
        target.status.hp -= damage;
    }

    return { damage, critical };
}

async function errorAtk(atk, target, isArmed) {
    if (atk.isPlayer) {
        atk.status = await getStatusByDiscord(atk.id);
    }

    console.log(atk);

    if (target.isPlayer) {
        target.status = await getStatusByDiscord(target.id);
    }

    console.log(target);

    let critical = false;

    // damage
    let damage;
    ({ damage, critical } = await setDamage(atk, critical, target, isArmed));

    return {
        damage: damage,
        critical: critical,
        atk: atk,
        target: target
    }
}

async function counterAtk(atk, target, isArmed) {
    if (atk.isPlayer) {
        atk.status = await getStatusByDiscord(atk.id);
    }

    console.log(atk);

    if (target.isPlayer) {
        target.status = await getStatusByDiscord(target.id);
    }

    console.log(target);

    const vcdAtk = atk.status.dex + (Math.floor(Math.random() * 10) + 1);
    let vcdDef = target.status.dex + (Math.floor(Math.random() * 10) + 1);
    console.log(`VCDAtk: ${vcdAtk}`, `VCDDef: ${vcdDef}`);
    vcdDef -= (vcdDef * 0.3);
    console.log(`VCDAtk: ${vcdAtk}`, `VCDDef: ${vcdDef}`);
    let critical = false;

    if (vcdAtk < vcdDef) {
        return {
            success: false,
            damage: 0,
            critical: critical,
            atk: atk,
            target: target
        }
    } else {
        // damage
        let damage;
        ({ damage, critical } = await setDamage(atk, critical, target, isArmed));

        return {
            success: true,
            damage: damage,
            critical: critical,
            atk: atk,
            target: target
        }
    }
}

async function revive(discordId) {
    const status = await getStatusByDiscord(discordId);
    status.hp = (status.cons * 10) + 100;
    status.mp = (status.int * 10) + 100;

    // update database
    await supabase
        .from('status')
        .update(status)
        .eq('id', status.id);
    return true;
}

async function kill(discordId) {
    const status = await getStatusByDiscord(discordId);
    status.hp = 0;

    // update database
    await supabase
        .from('status')
        .update(status)
        .eq('id', status.id);
    return true;
}

async function reset(discordId) {
    const status = await getStatusByDiscord(discordId);
    const oldLv = status.lv;
    const oldXp = status.xp;

    status.lv = 1;
    status.str = 0;
    status.dex = 0;
    status.cons = 0;
    status.wis = 0;
    status.int = 0;
    status.xp = 0;
    status.charm = 0;
    status.luck = 0;
    status.free_point = 0;

    await supabase
        .from('status')
        .update(status)
        .eq('id', status.id);

    const xpTotal = ((oldLv * (oldLv - 1)) / 2) * 100 + oldXp;
    console.log(xpTotal);

    addXp(discordId, xpTotal);
}

async function testAtt(discordId, att, difficult) {
    att = att.toLowerCase();
    const testAttList = ['str', 'dex', 'cons', 'wis', 'int', 'charm', 'luck'];
    if (!testAttList.includes(att)) throw new Error('Att invalid');
    difficult = parseInt(difficult);

    const status = await getStatusByDiscord(discordId);

    const randomBuff = (Math.floor(Math.random() * 10) + 1);
    const resultTest = status[att] + randomBuff;
    console.log(`Result: ${resultTest}`);
    if (resultTest > difficult) {
        return true;
    } else {
        return false;
    }
}

// monsters
async function createMonster(monster) {
    await supabase
        .from('monsters')
        .insert([monster])
    return true;
}

async function getMonsterByName(name) {
    let { data: monsters } = await supabase
        .from('monsters')
        .select('*')
        .like('name', name);
    if (monsters[0] == null) throw new Error('Monster not found');
    return monsters[0];
}

async function getSpells() {
    let { data: spells } = await supabase
        .from('spells')
        .select('*')
    return spells;
}

async function getSpellsByUser(userId) {
    let { data: spells } = await supabase
        .from('inventory_spell')
        .select('*')
        .eq('user_id');
    return spells;
}

async function getSpellByName(name) {
    let { data: spells } = await supabase
        .from('spells')
        .select('*')
        .like('name', name);
    const spell = spells[0];
    if (spell == null) throw new Error('Esta habilidade não existe');
    return spell;
}

async function getSpellByNameAndUser(name, userId) {
    const spell = await getSpellByName(name);

    let { data: spells } = await supabase
        .from('inventory_spell')
        .select('*')
        .eq('spell_id', spell.id)
        .eq('user_id', userId);
    const userSpell = spells[0];
    if (userSpell == null) throw new Error('O jogador não tem nenhuma habilidade com esse nome!');
    return spell;
}

async function spell(name, user, target) {
    const status = await getProfileByDiscord(user);

    const spell = await getSpellByNameAndUser(name, status.user_id);
    let objectSpell = {};

    const statusUser = await getStatusByDiscord(user);
    let statusTarget = await getStatusByDiscord(target);
    if (statusTarget.id == statusUser.id) {
        statusTarget = statusUser;
    }

    switch (spell.type) {
        case 'healingHp':
            objectSpell = new HealingHpSpell();
            objectSpell.copyFrom(spell);
            break;

        default:
            throw new Error(`Um erro desconhecido ocorreu!`);
            break;
    }

    const result = objectSpell.use(statusUser, statusTarget);
    await updateStatus(statusUser);
    await updateStatus(statusTarget);
    return result;
}

module.exports = {
    getProfiles,
    getProfileByDiscord,
    getStore,
    getItems,
    getInvShow,
    newItem,
    giveItem,
    removeItem,
    getStatusByDiscord,
    addXp,
    addMoney,
    resetHpAndMp,
    simpleAtk,
    revive,
    errorAtk,
    counterAtk,
    kill,
    reset,
    testAtt,
    createMonster,
    getMonsterByName,
    getSpells,
    spell
}