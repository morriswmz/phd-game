import { JSONSerializable } from './utils/jsonSerializable';
import { Inventory } from './effect/item';

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

    private _occurredEvents: { [key: string]: number; } = {};
    private _playerInventory: Inventory;
    private _variables: { [key: string]: number } = {};
    private _varLimits: { [key: string]: [number, number] } = {};

    // Public variables
    endGameState: EndGameState = EndGameState.None;
    // event handlers
    onVariableChanged: VariableChangeHandler | undefined;

    constructor(inventory: Inventory) {
        this._playerInventory = inventory;
    }

    get playerInventory(): Inventory {
        return this._playerInventory;
    }

    get occurredEvents(): { [key: string]: number; } {
        return this._occurredEvents;
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
            setImmediate(() => this.dispatchChangeEvent(new VariableChangedEvent(false, varName, oldValue, value)));
        }
    }

    /**
     * Sets the lower bound and upper bound of a variable.
     * @param varName Name of the variable.
     * @param lb Lower bound.
     * @param ub Upper bound.
     */
    setVarLimits(varName: string, lb: number, ub: number): void {
        this._varLimits[varName] = [lb, ub];
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

    reset(): void {
        this.playerInventory.clear();
        this._occurredEvents = {};
        this.endGameState = EndGameState.None;
        this.dispatchChangeEvent(new VariableChangedEvent(true, '', 0, 0));
        this._variables = {};
    }

    protected dispatchChangeEvent(event: VariableChangedEvent) {
        if (this.onVariableChanged) {
            this.onVariableChanged(this, event);
        }
    }

}
