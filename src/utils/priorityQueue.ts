// Returns true if a < b.
type LessComparator<T> = (a: T, b: T) => boolean;

/**
 * Simple max binary heap based priority queue using weak ordering.
 * 
 * Notes:
 * 
 * 1. Pop ordering of equal elements is unspecified.
 * 2. Mutations to elements in the queue will lead to unexpected behavior when
 *    such mutations affect ordering.
 */
export class PriorityQueue<T> {

  private _comparator: LessComparator<T>;
  private _data: T[] = [];

  /**
   * Constructs a new priority queue. Optionally with a custom comparator.
   * @param comparator If not specified will use JavaScript's "<".
   */
  constructor(comparator?: LessComparator<T>) {
    if (comparator) {
      this._comparator = comparator;
    } else {
      this._comparator = (a, b) => a < b;
    }
  }

  /**
   * Gets the number of elements in the queue.
   */
  get length(): number {
    return this._data.length;
  }

  /**
   * Checks if the queue is empty.
   */
  public empty(): boolean {
    return this._data.length === 0;
  }

  /**
   * Adds a new element to the queue.
   * @param element 
   */
  public push(element: T): void {
    this._data.push(element);
    this._heapUp(this._data.length - 1);
  }

  /**
   * Removes the top element from the queue, and returns it.
   */
  public pop(): T {
    if (this._data.length === 0) {
      throw new Error('Cannot pop from an empty queue.');
    }
    const top = this._data[0];
    if (this._data.length === 1) {
      this._data.pop();
      return top;
    }
    this._swap(0, this._data.length - 1);
    this._data.pop();
    this._heapDown(0);
    return top;
  }

  /**
   * Accesses the top element without removing it from the queue.
   */
  public top(): T {
    if (this._data.length === 0) {
      throw new Error('Cannot access the top element of an empty queue.');
    }
    return this._data[0];
  }

  /**
   * Remove all elements from the queue.
   */
  public clear(): void {
    this._data = [];
  }

  private _swap(i: number, j: number): void {
    const temp = this._data[i];
    this._data[i] = this._data[j];
    this._data[j] = temp;
  }

  private _heapUp(i: number): void {
    if (i === 0) return;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._comparator(this._data[parent], this._data[i])) {
        this._swap(parent, i);
      } else {
        break;
      }
      i = parent;
    }
  }

  private _heapDown(i: number): void {
    if (this._data.length <= 1) return;
    while (i < this._data.length) {
      const right = (i + 1) << 1;
      const left = right - 1;
      if (left >= this._data.length) break;
      if (right >= this._data.length) {
        if (this._comparator(this._data[i], this._data[left])) {
          this._swap(i, left);
          i = left;
        } else {
          break;
        }
      } else {
        const maxChild =
          this._comparator(this._data[left], this._data[right]) ? right : left;
        if (this._comparator(this._data[i], this._data[maxChild])) {
          this._swap(i, maxChild);
          i = maxChild;
        } else {
          break;
        }
      }
    }
  }

}