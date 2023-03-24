require('dotenv').config();
const Discord = require('discord.js');
const db = require('./database');
const parse = require('./utils/parsers');
const cron = require('node-cron');
const Spell = require('./model/Spell');

const client = new Discord.Client();

const token = process.env.DISCORD_TOKEN;
const prefix = "!";

const job = cron.schedule('0 0 * * *', function () {
    db.resetHpAndMp();
    const chatId = '1077769275072331846';
    client.channels.cache.get(chatId).send('O hp e mp de todos os jogadores foi resetado!');
});
job.start();

// COMBAT
let inCombate = false;
let player1 = null;
let player2 = null;
let inAtk = null;

let cPhase = 1;
let timerIdReaction = null;

let monstersInBattle = {
    countMob: [],
    mobs: []
};

client.on('message', message => {
    try {
        if (message.author.bot) return;
        if (!message.content.startsWith(prefix) && !message.content.endsWith('!fc')) return;

        // COMMANDS

        // view profiles
        if (message.content === '!allprofiles') {
            db.getProfiles().then((response) => {
                response.forEach((item) => {
                    const parse = parseProfile(item);
                    message.channel.send(parse.img);
                    message.channel.send(parse.text);
                })
            }).catch((error) => {
                message.channel.send(error.message);
            });
        }

        // view profile
        if (message.content.startsWith('!profile')) {
            const discordId = message.mentions.users.first().id;
            db.getProfileByDiscord(discordId).then((response) => {
                const parse = parseProfile(response);
                message.channel.send(parse.img);
                message.channel.send(parse.text);
            }).catch((error) => {
                message.channel.send("Não foi possivel achar este perfil, porfavor fale com um adm.");
            });
        }

        // status
        if (message.content.startsWith('!status')) {
            messageList = message.content.split(' ');
            const nameId = messageList[1];
            console.log(`NameId: ${nameId}`);
            console.log(`isPlayer: ${isPlayer(nameId)}`);
            if (isPlayer(nameId)) {
                // show player
                const discordId = message.mentions.users.first().id;
                db.getStatusByDiscord(discordId).then((response) => {
                    console.log(response);
                    message.channel.send(parse.parseStatusToString(response));
                }).catch((error) => {
                    message.channel.send("Não foi possivel achar este usuario, porfavor fale com um adm.");
                })
            } else {
                // show monster
                if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                    db.getMonsterByName(nameId).then((response) => {
                        message.channel.send(parseMonsterFull(response));
                    }).catch((error) => {
                        message.channel.send(error.message);
                    });
                }
                else {
                    message.reply("Você não tem permissão para executar este comando!");
                }
            }
        }

        // view store
        if (message.content === '!loja') {
            db.getStore().then((response) => {
                response.forEach((item) => {
                    const text = `╔──────¤◎¤──────╗\n    **ID:** ${item.id} \n    **Nome:** ${item.name} \n    **Preço:** ${item.price} \n    **Descrição:** *${item.description.replace(/\n/g, '\n    ')}*\n╚──────¤◎¤──────╝`;
                    message.channel.send(item.img);
                    message.channel.send(text);
                })
            }).catch((error) => {
                message.channel.send(error.message);
            });
        }

        /**
         *  ADM COMMANDS ADM COMMANDS ADM COMMANDS
         * */

        // CLEAR
        if (message.content === '!clear') {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                message.channel.messages.fetch().then(messages => {
                    message.channel.bulkDelete(messages);
                });
            }
            else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        // view items
        if (message.content === '!items') {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                db.getItems().then((response) => {
                    response.forEach((item) => {
                        const text = `╔──────¤◎¤──────╗\n    **ID:** ${item.id}\n    **Nome:** ${item.name}\n    **Descrição:** *${item.description.replace(/\n/g, '\n    ')}*\n╚──────¤◎¤──────╝`;
                        message.channel.send(item.img)
                        message.channel.send(text);
                    })
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            }
            else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        // inv
        if (message.content.startsWith('!inv')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const discordId = message.mentions.users.first().id;
                db.getInvShow(discordId).then((response) => {
                    response.forEach((item) => {
                        message.channel.send(`Nome: ${item.data.name} \nEquipado: ${item.equipped} | ID: ||${item.id}||`);
                    });
                }).catch((error) => {
                    message.channel.send("Não foi possivel achar este perfil, porfavor fale com um adm.");
                });
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        // new item
        if (message.content.startsWith("!newitem")) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const messageList = message.content.split('#');
                const name = messageList[1];
                const description = messageList[2];
                const imgUrl = messageList[3];

                if (name == undefined || description == undefined || imgUrl == undefined) {
                    message.channel.send('O formato para cadastrar um novo item está incorreto ou faltam informações! Porfavor siga o formato abaixo:');
                    message.channel.send('!newitem#nomedoitem#descrição#linkdaimg')
                    return;
                }

                db.newItem(name, description, imgUrl).then((response) => {
                    const text = `╔──────¤◎¤──────╗\n    **Nome:** ${name}\n    **Descrição:** *${description.replace(/\n/g, '\n    ')}*\n╚──────¤◎¤──────╝`;
                    message.channel.send('🛠️ Um novo item foi criado! 🛠️');
                    message.channel.send(imgUrl);
                    message.channel.send(text);
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            }
            else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        // add xp
        if (message.content.startsWith('!addxp')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const discordId = message.mentions.users.first().id;
                console.log(discordId);
                const xp = message.content.split(' ')[1];
                console.log(xp);
                if (isNaN(xp)) {
                    message.channel.send('Valor incorreto');
                    return;
                }
                db.addXp(discordId, xp).then((response) => {
                    console.log(response);
                    message.channel.send('Xp adicionado');
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            }
            else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        // add money
        if (message.content.startsWith('!addmoney')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const discordId = message.mentions.users.first().id;
                console.log(discordId);
                const money = message.content.split(' ')[1];
                console.log(money);
                if (isNaN(money)) {
                    message.channel.send('Valor incorreto');
                    return;
                }
                db.addMoney(discordId, money).then((response) => {
                    console.log(response);
                    message.channel.send('Dinheiro foi adicionado');
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            }
            else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        if (message.content.startsWith('!revive')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const discordId = message.mentions.users.first().id;
                db.revive(discordId).then((response) => {
                    message.channel.send("O jogador voltou a vida!");
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            }
            else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        // give item
        if (message.content.startsWith('!additem')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const discordId = message.mentions.users.first().id;
                const messageList = message.content.split(' ');
                const itemId = messageList[1];
                if (isNaN(itemId)) {
                    message.channel.send('Id do item invalido!');
                    return;
                }
                db.giveItem(discordId, itemId).then((response) => {
                    message.channel.send(`O item foi adicionado ao inventario de <@${discordId}>`);
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        // remove item
        if (message.content.startsWith('!removeitem')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const discordId = message.mentions.users.first().id;
                const messageList = message.content.split(' ');
                const invId = messageList[1];
                if (isNaN(invId)) {
                    message.channel.send('Id do item invalido!');
                    return;
                }
                db.removeItem(discordId, invId).then((response) => {
                    message.channel.send(`O item foi destruido do inventario de <@${discordId}>`);
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        // COMBATE
        if (message.content.startsWith('!vs')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                if (inAtk) {
                    message.channel.send('Ja existe um combate em andamento espere ate ele acabar!');
                    return;
                }
                const mentionedUsers = message.mentions.users;

                if (mentionedUsers.size === 2) {
                    const user1 = mentionedUsers.firstKey();
                    const user2 = mentionedUsers.lastKey();
                    console.log(user1, user2);
                    player1 = user1;
                    player2 = user2;
                    inCombate = true;
                }
                message.channel.send('Uma batalha começou!');
                if (Math.random() < 0.5) {
                    inAtk = player1;
                } else {
                    inAtk = player2;
                }
                message.channel.send(`O jogador <@${inAtk}> começara atacando.`);
            }
        }

        if (message.content.startsWith('!atk')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const messageList = message.content.split(' ');
                if (messageList.length != 4) {
                    message.channel.send('Comando incorreto \nUse o comando da forma a baixo: \n```!atk (n ou s) @Useratk @Useralvo```');
                    return;
                }

                const playerAtk = messageList[2];
                const playerTarget = messageList[3];

                console.log(messageList);

                let isArmed = false;
                switch (messageList[1]) {
                    case 's':
                        isArmed = true;
                        break;
                    case 'n':
                        isArmed = false;
                        break;
                    default:
                        message.channel.send('Passe s ou n como argumento apos !atk informando se o ataque foi com uma arma ou não.');
                        return;
                }
                console.log(isArmed);

                let atk = {};
                let target = {};

                if (isPlayer(playerAtk)) {
                    atk.isPlayer = true;
                    atk.id = playerAtk.replace('<@', '').replace('>', '');
                } else {
                    atk.isPlayer = false;
                    atk.status = getMob(playerAtk);
                    if (atk.status == null) {
                        message.channel.send('Não existe nenhum mob com esse nome!');
                        return;
                    }
                }

                if (isPlayer(playerTarget)) {
                    target.isPlayer = true;
                    target.id = playerTarget.replace('<@', '').replace('>', '');
                } else {
                    target.isPlayer = false;
                    target.status = getMob(playerTarget);
                    if (target.status == null) {
                        message.channel.send('Não existe nenhum mob com esse nome!');
                        return;
                    }
                }

                //console.log(atk);
                //console.log(target);

                db.simpleAtk(atk, target, isArmed).then((response) => {
                    if (response.success) {
                        if (response.critical) {
                            message.channel.send(`${getShowName(response.atk)} acertou um golpe critico em ${getShowName(response.target)} causando ${response.damage} de dano!`);
                            message.channel.send(parse.parseStatusToString(response.target.status));
                        } else {
                            message.channel.send(`${getShowName(response.atk)} acertou um golpe em ${getShowName(response.target)} causando ${response.damage} de dano!`);
                            message.channel.send(parse.parseStatusToString(response.target.status));
                        }
                    } else {
                        message.channel.send(`${getShowName(response.target)} desviou do golpe`);
                    }
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            }
        }

        if (message.content.startsWith('!erroratk')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const messageList = message.content.split(' ');
                if (messageList.length != 4) {
                    message.channel.send('Comando incorreto \nUse o comando da forma a baixo: \n```!erroratk (n ou s) @Useratk @Useralvo```');
                    return;
                }

                const playerAtk = messageList[2];
                const playerTarget = messageList[3];

                console.log(messageList);

                let isArmed = false;
                switch (messageList[1]) {
                    case 's':
                        isArmed = true;
                        break;
                    case 'n':
                        isArmed = false;
                        break;
                    default:
                        message.channel.send('Passe s ou n como argumento apos !atk informando se o ataque foi com uma arma ou não.');
                        return;
                }
                console.log(`isArmed: ${isArmed}`);

                let atk = {};
                let target = {};

                if (isPlayer(playerAtk)) {
                    atk.isPlayer = true;
                    atk.id = playerAtk.replace('<@', '').replace('>', '');
                } else {
                    atk.isPlayer = false;
                    atk.status = getMob(playerAtk);
                    if (atk.status == null) {
                        message.channel.send('Não existe nenhum mob com esse nome!');
                        return;
                    }
                }

                if (isPlayer(playerTarget)) {
                    target.isPlayer = true;
                    target.id = playerTarget.replace('<@', '').replace('>', '');
                } else {
                    target.isPlayer = false;
                    target.status = getMob(playerTarget);
                    if (target.status == null) {
                        message.channel.send('Não existe nenhum mob com esse nome!');
                        return;
                    }
                }

                //console.log(atk);
                //console.log(target);

                db.errorAtk(atk, target, isArmed).then((response) => {
                    if (response.critical) {
                        message.channel.send(`${getShowName(response.atk)} acertou um golpe critico em ${getShowName(response.target)} causando ${response.damage} de dano!`);
                        message.channel.send(parse.parseStatusToString(response.target.status));
                    } else {
                        message.channel.send(`${getShowName(response.atk)} acertou um golpe em ${getShowName(response.target)} causando ${response.damage} de dano!`);
                        message.channel.send(parse.parseStatusToString(response.target.status));
                    }
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            }
        }

        if (message.content.startsWith('!counteratk')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const messageList = message.content.split(' ');
                if (messageList.length != 4) {
                    message.channel.send('Comando incorreto \nUse o comando da forma a baixo: \n```!counteratk (n ou s) @Useratk @Usercontrataque```');
                    return;
                }

                const playerAtk = messageList[2];
                const playerTarget = messageList[3];

                console.log(messageList);

                let isArmed = false;
                switch (messageList[1]) {
                    case 's':
                        isArmed = true;
                        break;
                    case 'n':
                        isArmed = false;
                        break;
                    default:
                        message.channel.send('Passe s ou n como argumento apos !atk informando se o ataque foi com uma arma ou não.');
                        return;
                }
                console.log(isArmed);

                let atk = {};
                let target = {};

                if (isPlayer(playerAtk)) {
                    atk.isPlayer = true;
                    atk.id = playerAtk.replace('<@', '').replace('>', '');
                } else {
                    atk.isPlayer = false;
                    atk.status = getMob(playerAtk);
                    if (atk.status == null) {
                        message.channel.send('Não existe nenhum mob com esse nome!');
                        return;
                    }
                }

                if (isPlayer(playerTarget)) {
                    target.isPlayer = true;
                    target.id = playerTarget.replace('<@', '').replace('>', '');
                } else {
                    target.isPlayer = false;
                    target.status = getMob(playerTarget);
                    if (target.status == null) {
                        message.channel.send('Não existe nenhum mob com esse nome!');
                        return;
                    }
                }

                db.counterAtk(atk, target, isArmed).then((response) => {
                    if (response.success) {
                        if (response.critical) {
                            message.channel.send(`${getShowName(response.atk)} acertou um golpe critico em ${getShowName(response.target)} causando ${response.damage} de dano!`);
                            message.channel.send(parse.parseStatusToString(response.target.status));
                        } else {
                            message.channel.send(`${getShowName(response.atk)} acertou um golpe em ${getShowName(response.target)} causando ${response.damage} de dano!`);
                            message.channel.send(parse.parseStatusToString(response.target.status));
                        }
                    } else {
                        message.channel.send(`${getShowName(response.target)} contra atacou o golpe, ${getShowName(response.atk)} tem 10 segundos para se defender!`);
                        changeShift(message);
                    }
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            }
        }

        if (message.content == '!fimc') {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                inCombate = false;
                player1 = null;
                player2 = null;
                inAtk = null;
                message.channel.send("A luta foi finalizada por um ADM");
            }
            else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        if (message.content.endsWith('!fc')) {
            changeShift(message);
        }

        // test att
        if (message.content.startsWith('!test')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const discordId = message.mentions.users.first().id;
                const messageList = message.content.split(' ');
                const att = messageList[1];
                console.log(`ATT: ${att}`);
                const difficult = messageList[2];
                console.log(`Difficult: ${difficult}`);
                if (isNaN(difficult)) {
                    message.channel.send('Passe um valor validor para a dificuldade do teste!');
                    return;
                }
                db.testAtt(discordId, att, difficult).then((response) => {
                    if (response) {
                        message.channel.send(`<@${discordId}> passou no teste!`);
                    } else {
                        message.channel.send(`<@${discordId}> não passou no teste!`);
                    }
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        if (message.content.startsWith('!kill')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const discordId = message.mentions.users.first().id;
                db.kill(discordId).then((response) => {
                    message.channel.send(`<@${discordId}> morreu`);
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        if (message.content.startsWith('!reset')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const discordId = message.mentions.users.first().id;
                db.reset(discordId).then((response) => {
                    message.channel.send(`<@${discordId}> teve os atributos resetados!`);
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        // monsters
        if (message.content.startsWith('!newmonster1')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const messageList = message.content.split(' ');
                const monster = {};
                monster.name = messageList[1];
                monster.str = messageList[2];
                monster.dex = messageList[3];
                monster.cons = messageList[4];
                monster.wis = messageList[5];
                monster.int = messageList[6];
                monster.hp = messageList[7];
                monster.mp = messageList[8];
                monster.charm = messageList[9];
                monster.luck = messageList[10];
                db.createMonster(monster).then((response) => {
                    message.channel.send(`O monstro ${monster.name} foi criado!`)
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        if (message.content.startsWith('!newmonster2')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const messageList = message.content.split(' ');
                const monster = {};
                monster.name = messageList[1]
                monster.str = messageList[2];
                monster.dex = messageList[2];
                monster.cons = messageList[2];
                monster.wis = messageList[2];
                monster.int = messageList[2];
                monster.hp = messageList[2];
                monster.mp = messageList[2];
                monster.charm = messageList[2];
                monster.luck = messageList[2];
                console.log(monster);
                db.createMonster(monster).then((response) => {
                    message.channel.send(`O monstro ${monster.name} foi criado!`)
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        if (message.content.startsWith('!mib')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                for (let i = 0; i < monstersInBattle.mobs.length; i++) {
                    monster = monstersInBattle.mobs[i];
                    message.channel.send(`╔═════════════════════╗ \n║  **${monster.name + monster.count}** \n║  **HP:** ${monster.hp} **MP:** ${monster.mp}\n╚═════════════════════╝`);
                }
                console.log(monstersInBattle);
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        if (message.content == '!removemib') {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                monstersInBattle = {
                    countMob: [],
                    mobs: []
                };
                message.channel.send("Todos os monstros em batalha se retiraram!");
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        // spawn new monster in battle
        if (message.content.startsWith('!spawn')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                messageList = message.content.split(' ');
                const name = messageList[1];
                spawnMob(name, message);
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        // spells
        if (message.content == '!infospells') {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                db.getSpells().then((response) => {
                    response.forEach((spell) => {
                        const new_spell = new Spell();
                        new_spell.copyFrom(spell);
                        console.log(spell);
                        message.channel.send(new_spell.img);
                        message.channel.send(new_spell.toString());
                    });
                }).catch((error) => {
                    message.channel.send(error.message);
                });
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

        if (message.content.startsWith('!spell')) {
            if (message.member.roles.cache.some(role => role.name === 'ADM')) {
                const messageList = message.content.split(' ');
                console.log(messageList);
                if (messageList.length != 4) {
                    message.channel.send('Comando incorreto \nUse o comando da forma a baixo: \n```!spell nome_spell @User @Useralvo```');
                    return;
                }

                const spellName = messageList[1];
                let playerAtk = messageList[2];
                let playerTarget = messageList[3];
                console.log(`SpellName: ${spellName}`);
                console.log(`PlayerAtk: ${playerAtk}`);
                console.log(`PlayerTarget: ${playerTarget}`);

                playerAtk = playerAtk.replace('<@', '').replace('>', '');
                playerTarget = playerTarget.replace('<@', '').replace('>', '');

                db.spell(spellName, playerAtk, playerTarget).then((reponse) => {
                    message.channel.send(reponse);
                    db.getStatusByDiscord(playerTarget).then((response) => {
                        console.log(response);
                        message.channel.send(parse.parseStatusToString(response));
                    }).catch((error) => {
                        message.channel.send("Não foi possivel achar este usuario, porfavor fale com um adm.");
                    })
                }).catch((error) => {
                    console.log(error);
                    message.channel.send(error.message);
                });
            } else {
                message.reply("Você não tem permissão para executar este comando!");
            }
        }

    } catch (error) {
        console.log(error);
    }

});

function changeShift(message) {
    if (cPhase === 1) {
        console.log('Primeiro movimento!');
        // iniciando fazer de reacao
        cPhase = 2;
        timerIdReaction = setTimeout(function () {
            message.channel.send('Acabou o tempo para reagir!');
            cPhase = 1;
        }, 10000)
    } else {
        console.log('Segundo movimento!');
        cPhase = 1;
        // fim da reacao e voltando a faze 1
        clearTimeout(timerIdReaction);
    }
}

function parseProfile(profile) {
    const biographyTruncated = truncateString(profile.biography, 150);
    return {
        text: `╔═════════════════════╗\n║  **Nome:** ${profile.name}\n║  **Idade:** ${profile.age}\n║  **Raça:** ${profile.race}\n║  **Biografia:** *${biographyTruncated}*\n║  ||**ID de Usuario:** ${profile.user_id}||\n╚═════════════════════╝`,
        img: profile.img
    }
}

function parseMonsterFull(monster) {
    return `╔═════════════════════╗ \n║  ${monster.name} ||**ID:** ${monster.id}|| \n║  **STR:** ${monster.str} **DEX:** ${monster.dex} **CONS:** ${monster.cons} \n║  **WIS:** ${monster.wis} **INT:** ${monster.int} \n║  **CHARM:** ${monster.charm} **LUCK:** ${monster.luck} \n║  **HP:** ${monster.hp} **MP:** ${monster.mp} \n╚═════════════════════╝`;
}

function isPlayer(name) {
    if (name.startsWith('<@') && name.endsWith('>')) {
        return true;
    } else {
        return false;
    }
}

const truncateString = (str, maxLength) => {
    if (str.length > maxLength) {
        return str.slice(0, maxLength - 3) + '...';
    } else {
        return str;
    }
};

function spawnMob(name, message) {
    db.getMonsterByName(name).then((monster) => {
        if (!(name in monstersInBattle.countMob)) {
            monstersInBattle.countMob[name] = 1;
        } else {
            monstersInBattle.countMob[name] += 1;
        }
        monster.count = monstersInBattle.countMob[name];
        monstersInBattle.mobs.push(monster);
        message.channel.send(`Um ${monster.name} apareceu!`);
    }).catch((error) => {
        message.channel.send(error.message);
    });
}

function getMob(name) {
    for (let i = 0; i < monstersInBattle.mobs.length; i++) {
        const mob = monstersInBattle.mobs[i];
        if ((mob.name + mob.count) == name) {
            return mob;
        }
    }
    return null;
}

function getShowName(fighter) {
    if (fighter.isPlayer) {
        return `<@${fighter.id}>`
    } else {
        return fighter.status.name + fighter.status.count;
    }
}

client.once('ready', () => {
    console.log('Bot está pronto!');
});

client.login(token);