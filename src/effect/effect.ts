import { Item } from "./item";

export enum ModifierType {
    Absolute,
    Relative,
    Assignment
}

export interface Modifier {
    readonly type: ModifierType;
    readonly amount: number;
}

export type EffectCollection = { [effectId: string]: Modifier; };

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
export class EffectProviderRegistry<T extends EffectProvider> {

    protected _registry: { [id: string]: T; } = {};

    add(item: T): void {
        if (this._registry[item.id] && this._registry[item.id] !== item) {
            throw new Error('Cannot register two different items under the same id.');
        }
        this._registry[item.id] = item;
    }

    has(item: T | string): boolean {
        if (typeof item === 'string') {
            return this._registry[item] != undefined;
        } else {
            return this._registry[item.id] === item;
        }
    }

    get(id: string): T {
        if (!this.has(id)) throw new Error(`Id "${id}" does not exist.`);
        return this._registry[id];
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

    onChanged: ((sender: EffectProviderCollection<T>, event: EffectProviderCollectionChangedEvent<T>) => void) | undefined;

    /**
     * Determines the maximum number of the effect providers of the same type
     * (same id).
     */
    get maxStackSize(): number {
        return Infinity;
    }

    /**
     * Gets an readonly view of all the effect providers.
     */
    get items(): { readonly [id: string]: Readonly<[T, number]>; } {
        return this._items;
    }

    /**
     * Adds an new effect provider.
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
     * providers in this collection. For instance, if two effect providers in
     * this collection have effects
     * {'player.hopeBoost', Modifiers.Absolute, 1.0} and 
     * {'player.hopeBoost', Modifiers.Absolute, 1.5}, respectively,
     * then this function will return 2.5 for the input 'player.hopeBoost'.
     * Equation for calculating the final value
     *  a = sum of modifier amounts with type `Absolute`
     *  m = multiplication of modifier (1.0 + amounts) with type `Relative`
     *  final value = a * b
     *  * If any modifier has the type `Assignment`, this modifier's amount will
     *    be returned immediately.
     * @param effectId Id of the effect.
     */
    calcCombinedEffectValue(effectId: string): number {
        let a = 0;
        let m = 1;
        for (let id in this._items) {
            let curItem = this._items[id];
            let curEffects = curItem[0].getEffects();
            if (effectId in curEffects) {
                let modifier = curEffects[effectId];
                switch (modifier.type) {
                    case ModifierType.Absolute:
                        a += modifier.amount * curItem[1];
                        break;
                    case ModifierType.Relative:
                        m += Math.pow(modifier.amount + 1, curItem[1]);
                        break;
                    case ModifierType.Assignment:
                        return modifier.amount;
                    default:
                        throw new Error(`Unknown modifier type: ${modifier.type}.`);
                } 
            }
        }
        return a * m;
    }

    protected dispatchChangeEvent(event: EffectProviderCollectionChangedEvent<T>): void {
        if (this.onChanged) {
            this.onChanged(this, event);
        }
    }

}
