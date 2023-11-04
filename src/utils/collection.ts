/**
 * A simple set builder that helps easily combine sets.
 */
export class SetBuilder<T> {
  
  constructor(private _set: Set<T> = new Set(),
              private _built: boolean = false) {}

  /**
   * Adds one or more elements to the set. Can no longer be called after
   * calling `get()`.
   */
  add(...inputs: T[]): void {
    this.addAll(inputs);
  }

  /**
   * Adds all elements from an array or another set. Can no longer be called
   * after calling `get()`.
   * @param elements A array or a set.
   */
  addAll(elements: T[] | ReadonlySet<T>): void {
    if (this._built) {
      throw new Error('Cannot add element(s) after the set is built!');
    }
    for (let element of elements) {
      this._set.add(element);
    }
  }

  /**
   * Gets the built set.
   */
  get(): Set<T> {
    this._built = true;
    return this._set;
  }

}
