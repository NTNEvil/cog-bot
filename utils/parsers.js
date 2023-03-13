function parseStatus(status){
    const result = {};
    result.maxHp = (status.cons*10)+100;
    result.maxMp = (status.int*10)+100;
    result.hp = status.hp;
    result.mp = status.mp;
    return result;
}

function parseStatusToString(status){
    return `**HP:** ${status.hp} | **MP:** ${status.mp} \n**Sorte:** ${status.luck} \n**Carisma:** ${status.charm} `;
}

module.exports = {
    parseStatus,
    parseStatusToString
}