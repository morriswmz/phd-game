import { ActionProxy } from './event/core';
import { GameStateBase } from './gameState';
import { GuiGame } from './gui/guiGame';

export class GameActionProxy implements ActionProxy {

    constructor(private _gameState: GameStateBase, private _guiGame: GuiGame) {
    }

    get gameState(): GameStateBase {
        return this._gameState;
    }

    displayMessage(message: string, confirm: string): Promise<void> {
        return this._guiGame.displayMessage(message, confirm);
    }

    displayChoices(message: string, choices: Array<[string, number]>): Promise<number> {
        return this._guiGame.displayChoices(message, choices);
    }

}
