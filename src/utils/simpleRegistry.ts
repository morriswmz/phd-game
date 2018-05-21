/**
 * Represents an object tagged with an unique id.
 */
export interface IDOwner {

    /**
     * A unique identifier for this object.
     */
    readonly id: string;

}

/**
 * Represents a simple registry.
 */
export interface SimpleRegistry<T extends IDOwner> {

    /**
     * Adds an item to this registry.
     * Implementation notes:
     * 1. Should throw if a different item instance with the same id is being
     * added.
     * 2. Should do nothing if the given item is already added.
     * @param item Item to be added.
     */
    add(item: T): void;

    /**
     * Checks if the given item is in the registry.
     * @param item An instance of the item or its id.
     */
    has(item: T | string): boolean;

    /**
     * Retrieves an item by its id.
     * Implementation notes:
     * 1. Should throw if such an item does not exist.
     * @param id Id of the item to be retrieved.
     */
    get(id: string): T;

}
