/**
 * Represents an object tagged with an unique id.
 */
export interface IdOwner {

    /**
     * A unique identifier for this object.
     */
    readonly id: string;

}

/**
 * Implements a simple registry.
 */
export abstract class SimpleRegistry<T extends IdOwner> {

    private _items: Map<string, T> = new Map();

    /**
     * Retrieves the name of the registry.
     */
    abstract get name(): string;

    /**
     * Adds an item to this registry.
     * Implementation notes:
     * 1. Should throw if a different item instance with the same id is being
     * added.
     * 2. Should do nothing if the given item is already added.
     * @param item Item to be added.
     */
    add(item: T): void {
        const existingItem = this._items.get(item.id);
        if (existingItem != undefined && existingItem !== item) {
            throw new Error('Cannot register two different items under the same id.');
        }
        this._items.set(item.id, item);
    }

    /**
     * Checks if the given item is in the registry.
     * @param item An instance of the item or its id.
     */
    has(item: T | string): boolean {
        if (typeof item === 'string') {
            return this._items.has(item);
        } else {
            return this._items.get(item.id) === item;
        }
    }

    /**
     * Retrieves an item by its id.
     * Implementation notes:
     * 1. Should throw if such an item does not exist.
     * @param id Id of the item to be retrieved.
     */
    get(id: string): T {
        const existingItem = this._items.get(id);
        if (existingItem == undefined) {
            throw new Error(`"${id}" does not exist in "${this.name}".`);
        }
        return existingItem;
    }

    /**
     * Iterate through all items in the registry. The callback function will be
     * invoked once for each item in this registry.
     */
    forEach(callback: (item: T) => void): void {
        for (let item of this._items.values()) {
            callback(item);
        }
    }

}
