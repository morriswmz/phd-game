import { SimpleRegistry } from "../utils/simpleRegistry";
import { Attribute, AttributeModifier, AttributeModifierSource, AttributeModifierType, AttributeRegistry, CombinedAttributeModifierAmounts } from "./attribute";

export interface Effect {
    attributeModifiers: ReadonlyArray<AttributeModifier>;
}

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
export function loadEffectsFromObjectArray(objArray: any[], registry: AttributeRegistry): Effect[] {
    let result: Effect[] = [];
    for (const obj of objArray) {
        if (!('attributeModifiers' in obj)) continue;
        if (!Array.isArray(obj['attributeModifiers'])) {
            throw new Error('Expect `attributeModifiers` to be an array.');
        }
        let attributeModifiers: AttributeModifier[] = [];
        for (const modifier of obj['attributeModifiers']) {
            attributeModifiers.push(
                AttributeModifier.fromObject(modifier, registry));
        }
        result.push({
            attributeModifiers: attributeModifiers
        });
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
    getEffects(): ReadonlyArray<Effect>;
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
export class EffectProviderCollection<T extends EffectProvider> implements AttributeModifierSource {

    protected _items: { [id: string]: [T, number]; } = {};
    protected _registry: SimpleRegistry<T>;

    constructor(registry: SimpleRegistry<T>) {
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

    getCombinedAttributeModifierAmountsOf(attribute: Attribute): CombinedAttributeModifierAmounts {
        let absoluteAmount = 0.0;
        let relativeAmount = 0.0;
        let relativeToBaseAmount = 0.0;
        for (const id in this._items) {
            const effects = this._items[id][0].getEffects();
            for (const effect of effects) {
                for (const attributeModifier of effect.attributeModifiers) {
                    if (attributeModifier.target !== attribute.id) {
                        continue;
                    }
                    switch (attributeModifier.type) {
                        case AttributeModifierType.Absolute:
                            absoluteAmount += attributeModifier.amount;
                            break;
                        case AttributeModifierType.Relative:
                            relativeAmount += attributeModifier.amount;
                            break;
                        case AttributeModifierType.RelativeToBase:
                            relativeToBaseAmount += attributeModifier.amount;
                            break;
                        default:
                    }
                }
            }
        }
        return {
            absolute: absoluteAmount,
            relative: relativeAmount,
            relativeToBase: relativeToBaseAmount
        };
    }

    protected dispatchChangeEvent(event: EffectProviderCollectionChangedEvent<T>): void {
        if (this.onChanged) {
            this.onChanged(this, event);
        }
    }

}
