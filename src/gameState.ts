import * as seedrandom from 'seedrandom';

import { Inventory, ItemRegistry } from './effect/item';
import { StatusTable, StatusRegistry } from './effect/status';

export enum EndGameState {
    None,
    Winning,
    Losing
};

export class VariableChangedEvent {

    // Indicates whether all variables are cleared.
    clear: boolean;
    varName: string;
    oldValue: number | undefined;
    newValue: number;

    constructor(clear: boolean, varName: string, oldValue: number | undefined, newValue: number) {
        this.clear = clear;
        this.varName = varName;
        this.oldValue = oldValue;
        this.newValue = newValue;
    }

}

type VariableChangeHandler = (sender: GameState, event: VariableChangedEvent) => void;

export class GameState {

    private _playerInventory: Inventory;
    private _playerStatus: StatusTable;
    private _variables: Record<string, number> = {};
    private _varLimits: Record<string, [number, number]> = {};
    private _randomSeed: string;
    private _random: seedrandom.StatefulPRNG<seedrandom.State.Alea>;

    // Public variables
    endGameState: EndGameState = EndGameState.None;
    // event handlers
    onVariableChanged: VariableChangeHandler | undefined;

    constructor(itemRegistry: ItemRegistry, statusRegistry: StatusRegistry,
                randomSeed?: string) {
        this._playerInventory = new Inventory(itemRegistry);
        this._playerStatus = new StatusTable(statusRegistry);
        if (randomSeed) {
            this._randomSeed = randomSeed;
        } else {
            this._randomSeed = Math.random().toString().substring(2);
        }
        this._random = seedrandom.alea(this._randomSeed, {
            state: true
        });
    }

    get playerInventory(): Inventory {
        return this._playerInventory;
    }

    get playerStatus(): StatusTable {
        return this._playerStatus;
    }

    get randomSeed(): string {
        return this._randomSeed;
    }

    nextRandomNumber(): number {
        return this._random();
    }

    /**
     * Sets a numeric variable.
     * @param varName Name of the variable.
     * @param value Value.
     * @param checkExistence Whether the existence of this variable should be
     * checked first.
     */
    setVar(varName: string, value: number, checkExistence: boolean = false): void {
        if (checkExistence && !(varName in this._variables)) {
            throw new Error(`Variable "${varName}" does not exist.`);
        }
        if (this._varLimits[varName]) {
            if (value > this._varLimits[varName][1]) {
                value = this._varLimits[varName][1];
            }
            if (value < this._varLimits[varName][0]) {
                value = this._varLimits[varName][0];
            }
        }
        let oldValue = this._variables[varName];
        this._variables[varName] = value;
        if (oldValue !== value) {
            const e = new VariableChangedEvent(false, varName, oldValue, value);
            setTimeout(() => this.dispatchChangeEvent(e), 0);
        }
    }

    /**
     * Sets the lower bound and upper bound of a variable.
     * @param varName Name of the variable.
     * @param lb Lower bound.
     * @param ub Upper bound.
     */
    setVarLimits(varName: string, lb: number, ub: number): void {
        if (isNaN(lb)) throw new Error("Lower bound cannot be NaN");
        if (isNaN(ub)) throw new Error("Upper bound cannot be NaN");
        if (lb > ub) {
            throw new Error('Lower bound cannot be greater than upper bound.');
        }
        this._varLimits[varName] = [lb, ub];
        // Clamp the existing value if exists.
        if (!(varName in this._variables)) return;
        const oldValue = this._variables[varName];
        if (oldValue < lb) {
            this._variables[varName] = lb;
            const e = new VariableChangedEvent(false, varName, oldValue, lb);
            setTimeout(() => this.dispatchChangeEvent(e), 0);
        } else if (oldValue > ub) {
            this._variables[varName] = ub;
            const e = new VariableChangedEvent(false, varName, oldValue, ub);
            setTimeout(() => this.dispatchChangeEvent(e), 0);
        }
    }

    /**
     * Gets the lower bound and upper bound of a variable.
     * If such bounds are not defined, [-Infinity, Infinity] will be returned.
     * @param varName Name of the variable.
     */
    getVarLimits(varName: string): [number, number] {
        let limits = this._varLimits[varName];
        if (limits) {
            return [limits[0], limits[1]];
        } else {
            return [-Infinity, Infinity];
        }
    }

    getVar(varName: string, checkExistence: true): number;
    getVar(varName: string, checkExistence: false): number | undefined;
    getVar(varName: string, checkExistence: boolean = true): number | undefined {
        let value = this._variables[varName];
        if (value == undefined && checkExistence) {
            throw new Error(`Variable "${varName}" does not exist.`);
        }
        return value;
    }

    /**
     * Resets all internal states for a new game.
     * @param newRandomSeed If true will generate a new random seed and use the
     * new seed to reset the random number generator. Otherwise the existing
     * random seed will be used to reset the random number generator.
     */
    reset(newRandomSeed: boolean): void {
        this.playerInventory.clear();
        this.playerStatus.clear();
        this.endGameState = EndGameState.None;
        this.dispatchChangeEvent(new VariableChangedEvent(true, '', 0, 0));
        this._variables = {};
        if (newRandomSeed) {
            this._randomSeed = Math.random().toString().substring(2);
        }
        this._random = seedrandom.alea(this._randomSeed, {
            state: true
        });
    }

    dumpToConsole(): void {
        let lines: string[] = [];
        lines.push('[Variables (Limits)]');
        for (let varName in this._variables) {
            const limits = this._varLimits[varName];
            const limitsStr = limits ? ` ([${limits[0]}, ${limits[1]}])` : '';
            lines.push(`${varName}: ${this._variables[varName]}${limitsStr}`);
        }
        lines.push('[Items]');
        for (const itemId in this._playerInventory.items) {
            lines.push(`${itemId} x${this._playerInventory.items[itemId][1]}`);
        }
        lines.push('[Status]');
        for (const statusId in this._playerStatus.items) {
            lines.push(statusId);
        }
        lines.push('[Seed]');
        lines.push(this._randomSeed);
        console.log(lines.join('\n'));
    }

    protected dispatchChangeEvent(event: VariableChangedEvent) {
        if (this.onVariableChanged) {
            this.onVariableChanged(this, event);
        }
    }

}
