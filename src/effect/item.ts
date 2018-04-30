import { EffectProvider, EffectProviderCollection, Modifier, EffectProviderRegistry, EffectCollection } from './effect';
import { downloadAndParse } from '../utils/network';
import { safeLoad } from 'js-yaml';

export class Item implements EffectProvider {

    constructor(private _id: string, private _effects: EffectCollection = {}) {

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
            this.add(new Item(itemDef['id'], effects));
        }
    }

    loadEffects(obj: any): EffectCollection {
        throw new Error('Not implemented.');
    }

}

export class Inventory extends EffectProviderCollection<Item> {

    count(item: Item | string): number {
        if (typeof item === 'string') {
            item = this._registry.get(item);
        }
        return this._items[item.id] ? this.items[item.id][1] : 0;
    }

}
