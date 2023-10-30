import * as seedrandom from 'seedrandom';

/**
 * Samples a integer from [0, w.length) according to the weights defined by w.
 * @param w Array of weights.
 */
export function weightedSample(w: ArrayLike<number>,
                               random: () => number): number {
    if (w.length === 0) throw new Error('Must have at least one weight value.');
    let cw: number[] = new Array(w.length + 1);
    let sum = 0;
    for (let i = 0;i < w.length;i++)
    {
        cw[i] = sum;
        if (w[i] < 0) throw new Error('Weights cannot be negative.');
        sum += w[i];
    }
    cw[cw.length - 1] = sum;
    if (sum === 0) throw new Error('Sum of weights must be positive.');
    let p = random() * sum;
    // Should use binary search here!
    let idx = 0;
    for (;idx < w.length;idx++) {
        if (p >= cw[idx] && p < cw[idx + 1]) {
            break;
        }
    }
    return idx;
}

export interface RandomSource {
    /**
     * Gets the current random seed.
     */
    seed: string;
    /**
     * Returns the next random number in [0, 1).
     */
    next(): number;
}

export class AleaRandomSource implements RandomSource {

    private _seed: string;
    private _random: seedrandom.StatefulPRNG<seedrandom.State.Alea>;

    constructor(seed: string) {
        this._seed = seed;
        this._random = seedrandom.alea(seed, {
            state: true
        });
    }

    get seed(): string {
        return this._seed;
    }

    next(): number {
        return this._random.double();
    }

    /**
     * Resets the random source.
     * 
     * @param seed If set, will reset the random source using the specified
     * seed. Otherwise, the existing seed will be used.
     */
    reset(seed?: string): void {
        if (seed == undefined) {
            seed = this._seed;
        } else {
            this._seed = seed;
        }
        this._random = seedrandom.alea(seed, {
            state: true
        });
    }

}
