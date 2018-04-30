import { JSONSerializable } from './utils/jsonSerializable';
import { Inventory } from './effect/item';

export interface GameVariables {
    year: number;
    month: number;
    "player.hope": number;
    // User defined.
    [key: string]: number;
}

export enum EndGameState {
    None,
    Winning,
    Losing
};

export class GameStateBase implements JSONSerializable {

    
    endGameState: EndGameState = EndGameState.None;
    playerInventory: Inventory;
    playerStatus: { [key: string]: number; } = {};
    occurredEvents: { [key: string]: number; } = {};

    private _variables: GameVariables = {
        year: 1,
        month: 0,
        "player.hope": 50
    };

    constructor(inventory: Inventory) {
        this.playerInventory = inventory;
        this._variables['player.hope'] = 50;
    }

    get variables(): GameVariables {
        return this._variables;
    }

    setVar(varName: string, value: number, checkExistence: boolean = false): void {
        if (checkExistence && !(varName in this._variables)) {
            throw new Error(`Variable "${varName}" does not exist.`);
        }
        this._variables[varName] = value;
    }

    getVar(varName: string, checkExistence: boolean = true): number {
        let value = this._variables[varName];
        if (value == undefined && checkExistence) {
            throw new Error(`Variable "${varName}" does not exist.`);
        }
        return value;
    }

    reset(): void {
        this.playerInventory.clear();
        this.occurredEvents = {};
        this.endGameState = EndGameState.None;
        this._variables = {
            year: 1,
            month: 0,
            "player.hope": 50
        };
    }

    loadFromJSONObject(obj: any): void {
        if (!obj) return;
        if (obj['occurredEvents'] != undefined) this.occurredEvents = obj['occurredEvents'];
        if (obj['variables'] != undefined) this._variables = obj['variables'];
    }

    saveToJSONObject(): any {
        return {
            occurredEvents: this.occurredEvents,
            variables: this._variables
        };
    }
}
