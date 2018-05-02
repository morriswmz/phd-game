import { EffectProvider, EffectProviderCollection, Modifier, EffectProviderRegistry, EffectCollection } from './effect';
import { downloadAndParse } from '../utils/network';
import { safeLoad } from 'js-yaml';

export class Item implements EffectProvider {

    constructor(private _id: string, private _rarity: number, private _effects: EffectCollection = {}) {

    }

    get id(): string {
        return this._id;
    }

    get unlocalizedName(): string {
        return 'item.' + this.id;
    }

    get unlocalizedDescription(): string {
        return this.unlocalizedName + '.description';
    }

    get rarity(): number {
        return this._rarity;
    }

    getEffects(): EffectCollection {
        return this._effects;
    }

}

export class ItemRegistry extends EffectProviderRegistry<Item> {

    async loadItems(url: string): Promise<void> {
        let obj: any = await downloadAndParse(url, safeLoad);
        if (!obj) return;
        if (!Array.isArray(obj['items'])) {
            throw new Error('Expecting an array of item definitions.');
        }
        let itemDefs: any[] = obj['items'];
        for (let itemDef of itemDefs) {
            if (typeof itemDef['id'] !== 'string') {
                throw new Error('Missing item id.');
            }
            let effects: EffectCollection;
            if (itemDef['effects'] != undefined) {
                effects = this.loadEffects(itemDef['effects']);
            } else {
                effects = {};
            }
            let rarity = typeof itemDef['rarity'] === 'number' ? itemDef['rarity'] : 0;
            this.add(new Item(itemDef['id'], rarity, effects));
        }
    }

    loadEffects(obj: any): EffectCollection {
        throw new Error('Not implemented.');
    }

}

type InventoryChangeHandler = (inv: Inventory, item: Item, newAmount: number, oldAmount: number) => void;

export class Inventory extends EffectProviderCollection<Item> {
    
}
