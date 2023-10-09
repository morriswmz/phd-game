/**
 * A simple set builder that helps easily combine sets.
 */
export class SetBuilder<T> {
  
  constructor(private _set: Set<T> = new Set(),
              private _built: boolean = false) {}

  /**
   * Adds one or more elements to the set. Can no longer be called after
   * calling `get()`.
   * @param inputs An element or an array of elements.
   */
  add(...inputs: (T | T[] | Set<T>)[]): void {
    if (this._built) {
      throw new Error('Cannot add element(s) after the set is built!');
    }
    for (let input of inputs) {
      if (Array.isArray(input) || input instanceof Set) {
        for (let element of input) {
          this._set.add(element);
        }
      } else {
        this._set.add(input);
      }
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
