import { Item } from "./item";
import { SimpleRegistry } from "../utils/simpleRegistry";

export interface Modifier {
    readonly relative: boolean;
    readonly amount: number;
}

export type EffectCollection = { [effectId: string]: Modifier; };

/**
 * Loads a effect collection.
 * @param obj Schema:
 *  ```
 *  {
 *      string: {
 *          "relative": boolean
 *          "amount": number
 *      }
 *  }
 *  ```
 */
export function loadEffectCollectionFromJSON(obj: any): EffectCollection {
    let result: EffectCollection = {};
    for (const key in obj) {
        if (obj[key]) {
            if (result[key]) {
                throw new Error(`Duplicate definition for "${key}".`);
            }
            if (typeof(obj[key]['relative']) !== 'boolean') {
                throw new Error('Missing relative/absolute definition.');
            }
            if (typeof(obj[key]['amount']) !== 'number') {
                throw new Error('Missing amount.');
            }
            result[key] = {
                relative: obj[key]['relative'],
                amount: obj[key]['amount']
            };
        }
    }
    return result;
}

/**
 * An effect provider can be an item, or a player status.
 */
export interface EffectProvider {
    /**
     * Unique identifier for this effect provider.
     */
    readonly id: string;
    /**
     * Retrieves the collection of effects.
     */
    getEffects(): EffectCollection;
}

/**
 * Registry for effect providers. Used to retrieve effect provider instances
 * by their id.
 */
export class EffectProviderRegistry<T extends EffectProvider> implements SimpleRegistry<T> {

    protected _registry: Map<string, T> = new Map();

    add(item: T): void {
        const existingItem = this._registry.get(item.id);
        if (existingItem != undefined && existingItem !== item) {
            throw new Error('Cannot register two different items under the same id.');
        }
        this._registry.set(item.id, item);
    }

    has(item: T | string): boolean {
        if (typeof item === 'string') {
            return this._registry.has(item);
        } else {
            return this._registry.get(item.id) === item;
        }
    }

    get(id: string): T {
        const existingItem = this._registry.get(id);
        if (existingItem == undefined) {
            throw new Error(`Id "${id}" does not exist.`);
        }
        return existingItem;
    }

    forEach(callback: (item: T) => void): void {
        for (let item of this._registry.values()) {
            callback(item);
        }
    }

}

export class EffectProviderCollectionChangedEvent<T extends EffectProvider> {
    // Indicates whether this is a clear event.
    clear: boolean;
    item: T | undefined;
    oldCount: number;
    newCount: number;

    constructor(clear: boolean, item: T | undefined, oldCount: number, newCount: number) {
        this.clear = clear;
        this.item = item;
        this.oldCount = oldCount;
        this.newCount = newCount;
    }
}

/**
 * An effect provider collection can be a player's inventory or status
 * collection. Each effect provider can have different amounts.
 */
export class EffectProviderCollection<T extends EffectProvider> {

    protected _items: { [id: string]: [T, number]; } = {};
    protected _registry: EffectProviderRegistry<T>;

    constructor(registry: EffectProviderRegistry<T>) {
        this._registry = registry;
    }

    onChanged?: (sender: EffectProviderCollection<T>, event: EffectProviderCollectionChangedEvent<T>) => void;

    /**
     * Determines the maximum number of the effect providers of the same type
     * (same id).
     */
    get maxStackSize(): number {
        return Infinity;
    }

    /**
     * Gets a readonly view of all the effect providers.
     */
    get items(): { readonly [id: string]: Readonly<[T, number]>; } {
        return this._items;
    }

    /**
     * Adds a new effect provider.
     * @param item
     * @param count
     */
    add(item: T | string, count: number = 1): void {
        if (typeof item === 'string') item = this._registry.get(item);
        if (count < 0 || Math.floor(count) !== count) throw new Error('Count must be a positive integer.');
        if (this._items[item.id] == undefined) {
            this._items[item.id] = [item, count];
            this.dispatchChangeEvent(new EffectProviderCollectionChangedEvent(false, item, 0, count));
        } else {
            let oldCount = this._items[item.id][1];
            this._items[item.id][1] += count;
            if (this._items[item.id][1] > this.maxStackSize) {
                this._items[item.id][1] = this.maxStackSize;                
            }
            this.dispatchChangeEvent(new EffectProviderCollectionChangedEvent(false, item, this._items[item.id][1], oldCount));
        }
    }

    /**
     * Removes an effect provider.
     * @param item 
     * @param count 
     */
    remove(item: T | string, count: number = 1): void {
        if (typeof item === 'string') item = this._registry.get(item);
        if (count < 0 || Math.floor(count) !== count) throw new Error('Count must be a positive integer.');
        if (this._items[item.id] == undefined) return;
        let oldCount = this._items[item.id][1];
        this._items[item.id][1] -= count;
        if (this._items[item.id][1] <= 0) {
            delete this._items[item.id];
            this.dispatchChangeEvent(new EffectProviderCollectionChangedEvent(false, item, 0, oldCount));
        } else {
            this.dispatchChangeEvent(new EffectProviderCollectionChangedEvent(false, item, this._items[item.id][1], oldCount));
        }
    }

    clear(): void {
        this.dispatchChangeEvent(new EffectProviderCollectionChangedEvent<T>(true, undefined, 0, 0));
        this._items = {};
    }

    count(item: T | string): number {
        if (typeof item === 'string') {
            item = this._registry.get(item);
        }
        return this._items[item.id] ? this.items[item.id][1] : 0;
    }

    /**
     * Calculates the combined effect value by considering all the effect
     * providers in this collection. For instance, if three effect providers in
     * this collection have effects
     * {'player.hopeBoost', false, 1.0},
     * {'player.hopeBoost', true, 0.2} 
     * {'player.hopeBoost', false, 1.5}, respectively,
     * then this function will return [2.5, 0.2] for the input
     * 'player.hopeBoost'.
     * Equation for calculating the values
     *  a = sum of absolute modifier values
     *  m = multiplication of (1.0 + amounts) for relative values
     * Returns [a, m]
     * @param effectId Id of the effect.
     */
    calcCombinedEffectValue(effectId: string): [number, number] {
        let a = 0;
        let m = 1;
        for (let id in this._items) {
            let curItem = this._items[id];
            let curEffects = curItem[0].getEffects();
            if (effectId in curEffects) {
                let modifier = curEffects[effectId];
                if (modifier.relative) {
                    m += Math.pow(modifier.amount + 1, curItem[1]);
                } else {
                    a += modifier.amount * curItem[1];
                }
            }
        }
        return [a, m];
    }

    protected dispatchChangeEvent(event: EffectProviderCollectionChangedEvent<T>): void {
        if (this.onChanged) {
            this.onChanged(this, event);
        }
    }

}
