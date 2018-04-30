import { GameStateBase, EndGameState } from '../gameState';
import { GuiGame } from '../gui/guiGame';
import { EventAction, ActionProxy } from './core';
import { EventExpressionEvaluator, EventExpressionFunctionTable, CompiledEventExpression, EventFunctionTableProvider, EventExpressionCompiler } from './expression';
import { CompiledExpression, compileExpression } from '../utils/expression';
import { weightedSample } from '../utils/random';

// Note on the usage of typeof.
// For JSON-like objects, it is safe to check the types of numbers/strings using
// typeof. We forbid `Number(123)` or `String('abc')`.
// Object.prototype.toString.call() is a more foolproof approach.

export type EventActionDeserializer = (obj: any, factory: EventActionFactory, ec: EventExpressionCompiler) => EventAction;

/**
 * A factory class for creating event action instances from JSON-like objects.
 */
export class EventActionFactory {

    private _deserializers: { [key: string]: EventActionDeserializer } = {};
    private _exprCompiler: EventExpressionCompiler;

    constructor(exprCompiler: EventExpressionCompiler) {
        this._exprCompiler = exprCompiler;
    }

    registerDeserializer(typeName: string, f: EventActionDeserializer): void {
        this._deserializers[typeName] = f;
    }

    fromJSONObject(obj: any): EventAction {
        if (!obj['id']) {
            throw new Error('Action id is not specified.');
        }
        if (!this._deserializers[obj['id']]) {
            throw new Error(`Cannot construct the event action for "${obj['id']}".`);
        }
        return this._deserializers[obj['id']](obj, this, this._exprCompiler);
    }

    fromJSONArray(arr: any[]): EventAction[] {
        let actions = new Array<EventAction>(arr.length);
        for (let i = 0;i < arr.length;i++) {
            actions[i] = this.fromJSONObject(arr[i]);
        }
        return actions;
    }

}

/**
 * Logs information on the console.
 */
export class EALog extends EventAction {

    private _message: string;
    
    constructor(message: string)
    {
        super();
        this._message = message;
    }
    
    static Id = 'Log';
    
    static fromJSONObject(obj: any, af: EventActionFactory): EALog {
        if (obj['message'] == undefined) throw new Error('Message missing.');
        return new EALog(obj['message']);
    }

    async execute(ap: ActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        return new Promise<void>(resolve => {
            console.log(this._message);
            resolve();
        });
    }

}

/**
 * Displays a message.
 */
export class EADisplayMessage extends EventAction {

    constructor(private _message: string, private _confirm: string) {
        super();
    }

    static Id = 'DisplayMessage';

    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EADisplayMessage {
        if (obj['message'] == undefined) throw new Error('Message missing.');
        if (obj['confirm'] == undefined) throw new Error('Confirm message missing.');
        return new EADisplayMessage(obj['message'], obj['confirm']);
    }

    async execute(ap: ActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        await ap.displayMessage(this._message, this._confirm);
    }

}

/**
 * Display a message randomly selected from the predefined messages.
 */
export class EADisplayRandomMessage extends EventAction {

    constructor(private _messages: string[], private _confirm: string) {
        super();
    }

    static Id = 'DisplayRandomMessage';

    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EADisplayRandomMessage {
        if (!Array.isArray(obj['messages'])) throw new Error('Messages missing.');
        if (typeof obj['confirm'] !== 'string') throw new Error('Confirm message missing.');
        return new EADisplayRandomMessage(obj['messages'], obj['confirm']);
    }

    async execute(ap: ActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        const msgId = Math.floor(Math.random() * this._messages.length);
        await ap.displayMessage(this._messages[msgId], this._confirm);
    }

}

/**
 * Displays choices.
 */
export class EADisplayChoices extends EventAction {

    constructor(private _message: string, private _choiceMessages: string[],
                private _requirements: CompiledEventExpression[],
                private _actions: EventAction[][])
    {
        super();
        if (_choiceMessages.length !== _requirements.length || _choiceMessages.length !== _actions.length) {
            throw new Error('The number of choices must be equal to the number of requirements/actions.');
        }
    }

    static Id = 'DisplayChoices';
    
    /**
     * Creates an action that prompts multiple choices.
     * @param obj Schema:
     *  ```
     *  {
     *      "id": "DisplayChoices",
     *      "message": string,
     *      "choices": [
     *          {
     *              "message": string,
     *              "requirement": string | undefined,
     *              "actions": EventAction[]
     *          }
     *      ]
     *  }
     *  ```
     * @param af Event action factory for creating nested actions.
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EADisplayChoices {
        if (obj['message'] == undefined) throw new Error('Message missing.');
        if (!Array.isArray(obj['choices'])) throw new Error('Choices are missing.');
        let choiceMessages: string[] = [];
        let requirements: CompiledEventExpression[] = [];
        let actions: EventAction[][] = [];
        for (let c of obj['choices']) {
            if (c['message'] == undefined) throw new Error('Missing message for the current choice.');
            choiceMessages.push(c['message']);
            let curActions = Array.isArray(c['actions'])
                ? af.fromJSONArray(c['actions'])
                : [];
            actions.push(curActions);
            // requirement
            if (c['requirement'] != undefined) {
                requirements.push(ec.compile(c['requirement']));
            } else {
                requirements.push(ec.compile('true'));
            }
        }
        return new EADisplayChoices(obj['message'], choiceMessages, requirements, actions);
    }

    async execute(ap: ActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        // Build choice array according to requirements.
        let choices: Array<[string, number]> = [];
        for (let i = 0;i < this._choiceMessages.length;i++) {
            if (ee.eval(this._requirements[i])) {
                choices.push([this._choiceMessages[i], i]);
            }
        }
        let choiceId = await ap.displayChoices(this._message, choices);
        let actions = this._actions[choiceId];
        for (let a of actions) {
            await a.execute(ap, ee);
        }
    }

}

/**
 * Randomly execute a group of actions according to the weights.
 */
export class EARandom extends EventAction {

    private _actions: EventAction[][];
    private _weightExprs: CompiledEventExpression[];

    constructor(actions: EventAction[][], weightExprs: CompiledEventExpression[]) {
        super();
        if (actions.length !== weightExprs.length) {
            throw new Error('The number of weights must match the number of actions.');
        }
        this._actions = actions;
        this._weightExprs = weightExprs
    }

    static Id = 'Random';
    
    /**
     * Creates a action that randomly executes one of the action groups.
     * @param obj Schema:
     *  ```
     *  {
     *      "id": "Random",
     *      "groups": [
     *          {
     *              "weight": number | string,
     *              "actions": EventAction[]
     *          }
     *      ]
     *  }
     *  ```
     * @param af Event action factory for creating nested actions.
     * @param ec
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EARandom {
        if (!Array.isArray(obj['groups'])) throw new Error('Missing group definitions.');
        let weightExprs: CompiledEventExpression[] = [];
        let actions: EventAction[][] = [];
        for (let o of obj['groups']) {
            let weight = o['weight'];
            if (weight == undefined) throw new Error('Missing weight definition.');
            if (typeof weight !== 'string' && typeof weight !== 'number') {
                throw new Error('Weight must be a number or an expression.');
            }
            if (!Array.isArray(o['actions'])) throw new Error('Missing actions.');
            weightExprs.push(ec.compile(weight));
            actions.push(af.fromJSONArray(o['actions']));
        }
        return new EARandom(actions, weightExprs);
    }

    async execute(ap: ActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        let idx = weightedSample(this._weightExprs.map(item => ee.eval(item)));
        for (let a of this._actions[idx]) {
            await a.execute(ap, ee);
        }
    }

}

/**
 * Randomly chooses one of the two actions via a coin flip.
 */
export class EACoinFlip extends EventAction {

    constructor(private _p: CompiledEventExpression,
                private _successActions: EventAction[],
                private _failActions: EventAction[])
    {
        super();
    }

    static Id = 'CoinFlip';

    /**
     * Creates an action that executes one of the two action groups via a coin
     * flip.
     * @param obj Schema:
     *  ```
     *  {
     *      "id": "CoinFlip",
     *      "probability": number | string,
     *      "success": EventAction[] | undefined,
     *      "fail": EventAction[] | undefined
     *  }
     *  ```
     * @param af 
     * @param ec 
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EACoinFlip {
        const p = obj['probability'];
        if (typeof p !== 'string' && typeof p !== 'number') {
            throw new Error('Probability must be a number of an expression.');
        }
        let successActions = Array.isArray(obj['success']) ? af.fromJSONArray(obj['success']) : [];
        let failActions = Array.isArray(obj['fail']) ? af.fromJSONArray(obj['fail']) : [];
        return new EACoinFlip(ec.compile(p), successActions, failActions);
    }

    async execute(ap: ActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        let p = ee.eval(this._p);
        if (p < 0) p = 0;
        let coinFlip = Math.random();
        if (coinFlip < p) {
            for (let a of this._successActions) {
                await a.execute(ap, ee);
            }
        } else {
            for (let a of this._failActions) {
                await a.execute(ap, ee);
            }
        }
    }

}

/**
 * Updates a variable.
 */
export class EAUpdateVariable extends EventAction {

    constructor(private _varName: string, private _updateExpr: CompiledEventExpression) {
        super();
    }

    static Id = 'UpdateVariable';
    
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EAUpdateVariable {
        if (!obj['variable']) throw new Error('Missing variable name.');
        if (!obj['value']) throw new Error('Missing value.');
        let expr = obj['value'];
        if (typeof expr !== 'number' && typeof expr !== 'string') {
            throw new Error('Value must be either a number of a string.');
        }
        return new EAUpdateVariable(obj['variable'], ec.compile(expr));
    }

    async execute(ap: ActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        // Check operation
        ap.gameState.setVar(this._varName, ee.eval(this._updateExpr), false);
    }

}

export class EAGiveItem extends EventAction {

    constructor(private _itemId: string, private _amountExpr: CompiledEventExpression) {
        super();
    }

    static Id = 'GiveItem';

    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EAGiveItem {
        if (obj['itemId'] == undefined) throw new Error('Missing item id.');
        // We allow amount to be an expression.
        if (typeof obj['amount'] !== 'string' && typeof obj['amount'] !== 'number') {
            throw new Error('Amount must be a number or an expression.');
        }
        return new EAGiveItem(obj['itemId'], ec.compile(obj['amount']));
    }

    async execute(ap: ActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        let amount = ee.eval(this._amountExpr);
        if (amount > 0) {
            ap.gameState.playerInventory.add(this._itemId, amount);
        } else if (amount < 0) {
            ap.gameState.playerInventory.remove(this._itemId, -amount);
        }
    }

}

/**
 * Updates the amounts of items relatively.
 */
export class EAUpdateItemAmounts extends EventAction {

    constructor(private _itemIds: string[], private _updateExprs: CompiledEventExpression[]) {
        super();
        if (_itemIds.length !== _updateExprs.length) {
            throw new Error('The number of items must match the number of expressions.');
        }
    }

    static Id = 'UpdateItemAmounts';

    /**
     * Creates an action that updates the amounts of multiple items relatively.
     * @param obj Schema:
     *  ``
     *  {
     *      "id": "UpdateItemAmounts",
     *      "updates": { [itemId: string]: number | string; }
     *  }
     *  ```
     * @param af 
     * @param ec 
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EAUpdateItemAmounts {
        if (obj['updates'] == undefined) throw new Error('Missing update definitions.');
        let itemIds: string[] = [];
        let updateExprs: CompiledEventExpression[] = [];
        for (const itemId in obj['updates']) {
            itemIds.push(itemId);
            updateExprs.push(ec.compile(obj['updates'][itemId]));
        }
        return new EAUpdateItemAmounts(itemIds, updateExprs);
    }

    async execute(ap: ActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        for (let i = 0;i < this._itemIds.length;i++) {
            let amount = ee.eval(this._updateExprs[i]);
            if (amount > 0) {
                ap.gameState.playerInventory.add(this._itemIds[i], amount);
            } else if (amount < 0) {
                ap.gameState.playerInventory.remove(this._itemIds[i], -amount);
            }
        }
    }

}

export class EAEndGame extends EventAction {

    constructor(private _message: string, private _confirm: string, private _winning: boolean) {
        super();
    }

    static Id = 'EndGame';

    /**
     * Creates an action that ends the game.
     * @param obj Schema:
     *  ```
     *  {
     *      "id": "EndGame",
     *      "message": string,
     *      "confirm": string,
     *      "winning": boolean
     *  }
     *  ```
     * @param af 
     * @param ec 
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EAEndGame {
        if (typeof(obj['message']) !== 'string') throw new Error('Missing message.');
        if (typeof(obj['confirm']) !== 'string') throw new Error('Missing confirm message.');
        if (typeof(obj['winning']) !== 'boolean') throw new Error('Missing winning status.');
        return new EAEndGame(obj['message'], obj['confirm'], obj['winning']);
    }

    async execute(ap: ActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        await ap.displayMessage(this._message, this._confirm);
        ap.gameState.endGameState = this._winning ? EndGameState.Winning : EndGameState.Losing;
    }

}
