class Spell {

    constructor() {
        this.id = null;
        this.name = null;
        this.description = null;
        this.type = null;
        this.value1 = null;
        this.value2 = null;
        this.img = null;
    }

    copyFrom(spell){
        this.id = spell.id;
        this.name = spell.name;
        this.description = spell.description;
        this.type = spell.type;
        this.value1 = spell.value1;
        this.value2 = spell.value2;
        this.img = spell.img;
    }

    toString(){
        let result = `**Nome:** ${this.name} ||**ID:** ${this.id}|| \n**Descrição:** ${this.description}`;
        switch (this.type) {
            case 'healingHp':
                result += `\n**Custo:** ${this.value1} MP \n**Cura:** ${this.value2} HP`;
                break;        
            default:
                break;
        }
        return result;
    }
}

module.exports = Spell;