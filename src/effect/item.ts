import { Effect, EffectProvider, EffectProviderCollection, loadEffectsFromObjectArray } from './effect';
import { downloadAndParse } from '../utils/network';
import { load as loadYaml } from 'js-yaml';
import { JsonEncodable, JsonValue } from '../utils/json';
import { SimpleRegistry } from '../utils/simpleRegistry';
import { AttributeRegistry } from './attribute';

export class Item implements EffectProvider {

    constructor(private _id: string, private _rarity: number,
                private _icon: string = '',
                private _effects: Effect[] = []) {}

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

    get icon(): string {
        return this._icon;
    }

    getEffects(): ReadonlyArray<Effect> {
        return this._effects;
    }

}

export class ItemRegistry extends SimpleRegistry<Item> {

    constructor(private _attributeRegistry: AttributeRegistry) {
        super();
    }

    get name(): string {
        return 'items';
    }

    async loadItems(url: string): Promise<void> {
        let obj: any = await downloadAndParse(url, loadYaml);
        if (!obj) return;
        if (!Array.isArray(obj['items'])) {
            throw new Error('Expecting an array of item definitions.');
        }
        let itemDefs: any[] = obj['items'];
        for (let itemDef of itemDefs) {
            if (typeof itemDef['id'] !== 'string') {
                throw new Error('Missing item id.');
            }
            let effects: Effect[];
            if (Array.isArray(itemDef['effects'])) {
                effects = loadEffectsFromObjectArray(itemDef['effects'],
                                                     this._attributeRegistry);
            } else {
                effects = [];
            }
            let rarity = typeof itemDef['rarity'] === 'number' ? itemDef['rarity'] : 0;
            let icon = typeof itemDef['icon'] === 'string' ? itemDef['icon'] : '';
            this.add(new Item(itemDef['id'], rarity, icon, effects));
        }
        console.log(`Successfully registered ${itemDefs.length} items.`);
    }

}

export class Inventory extends EffectProviderCollection<Item> implements JsonEncodable {
    
    decodeFromJson(json: JsonValue): void {
        if (json === null || !Array.isArray(json)) {
            throw new Error('Array expected.');
        }
        this.clear();
        for (const itemData of json) {
            if (!Array.isArray(itemData) || itemData.length !== 2 ||
                typeof itemData[0] !== 'string' ||
                typeof itemData[1] !== 'number') {
                throw new Error('Each saved item data should be a two-element tuple of the item id string and the amount number.');
            }
            this.add(itemData[0], itemData[1]);
        }
    }

    /**
     * Encoding format for inventory items:
     * ```
     * [
     *     ["itemId1": $amount1],
     *     ["itemId1": $amount1],
     *     ...
     * ]
     * ```
     */
    encodeAsJson(): JsonValue {
        let json = new Array<[string, number]>();
        for (const itemId in this._items) {
            json.push([itemId, this._items[itemId][1]]);
        }
        return json;
    }

}
