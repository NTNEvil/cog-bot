const Spell = require("./Spell");

class HealingHpSpell extends Spell {
    
    use(statusUser, statusTarget){
        // mana
        if ((statusUser.mp - this.value1) < 0) throw new Error('Mana insuficiente para ativar a magia de cura');
        statusUser.mp -= this.value1;

        // hp
        const maxHp = 100+(statusTarget.cons*10);
        if ((statusTarget.hp + this.value2) > maxHp) {
            statusTarget.hp = maxHp;
        } else {
            statusTarget.hp += this.value2;
        }

        // result
        return `Uma forte luz esverdeada surge curando o jogador`;
    }
}

module.exports = HealingHpSpell;