import { GameState, EndGameState } from '../gameState';
import { GuiGameWindow } from '../gui/guiGame';
import { EventAction, GuiActionProxy } from './core';
import { EventExpressionEvaluator, EventExpressionFunctionTable, CompiledEventExpression, EventFunctionTableProvider, EventExpressionCompiler } from './expression';
import { CompiledExpression, compileExpression, ExpressionEvaluator } from '../utils/expression';
import { weightedSample } from '../utils/random';

// Note on the usage of typeof.
// For JSON-like objects, it is safe to check the types of numbers/strings using
// typeof. We forbid `Number(123)` or `String('abc')`.
// Object.prototype.toString.call() is a more foolproof approach.

export type EventActionDeserializer = (obj: any, factory: EventActionFactory, ec: EventExpressionCompiler) => EventAction;

export interface EventActionDeserializerDefinition {
    ID: string;
    fromJSONObject: EventActionDeserializer;
}

/**
 * A factory class for creating event action instances from JSON-like objects.
 */
export class EventActionFactory {

    private _deserializers: { [key: string]: EventActionDeserializer } = {};
    private _exprCompiler: EventExpressionCompiler;

    constructor(exprCompiler: EventExpressionCompiler) {
        this._exprCompiler = exprCompiler;
    }

    registerDeserializer(def: EventActionDeserializerDefinition): void {
        this._deserializers[def.ID] = def.fromJSONObject;
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
    
    static ID = 'Log';
    
    /**
     * Creates an `EALog` instance from it JSON definition stored in the given
     * JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "Log",
     *         "message": string
     *     }
     *     ```
     * @param af Not used.
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EALog {
        if (obj['message'] == undefined) throw new Error('Message missing.');
        return new EALog(obj['message']);
    }

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        return new Promise<void>(resolve => {
            console.log(this._message);
            resolve();
        });
    }

}

/**
 * Displays one message.
 */
export class EADisplayMessage extends EventAction {

    constructor(private _message: string, private _confirm: string, private _icon: string) {
        super();
    }

    static ID = 'DisplayMessage';

    /**
     * Creates an `EADisplayMessage` instance from it JSON definition stored in
     * the given JSON object.
     * @param obj Schema:
     *  ```
     *  {
     *      "id": "DisplayMessage",
     *      "message": string,
     *      "confirm": string
     *  }
     *  ```
     * @param af Not used.
     * @param ec Not used.
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EADisplayMessage {
        if (obj['message'] == undefined) throw new Error('Message missing.');
        if (obj['confirm'] == undefined) throw new Error('Confirm message missing.');
        return new EADisplayMessage(obj['message'], obj['confirm'], obj['icon'] || '');
    }

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        await ap.displayMessage(this._message, this._confirm, this._icon);
    }

}

/**
 * Display a message randomly selected from a list of predefined messages.
 */
export class EADisplayRandomMessage extends EventAction {

    constructor(private _messages: string[], private _confirm: string, private _icon: string) {
        super();
    }

    static ID = 'DisplayRandomMessage';

    /**
     * Creates an `EADisplayRandomMessage` instance from it JSON definition
     * stored in the given JSON object.
     * @param obj Schema:
     *  ```
     *  {
     *      "id": "DisplayRandomMessage",
     *      "messages": string[]
     *      "confirm": string
     *      "icon": string | undefined
     *  }
     *  ```
     * @param af Not used.
     * @param ec Not used.
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EADisplayRandomMessage {
        if (!Array.isArray(obj['messages'])) throw new Error('Messages missing.');
        if (typeof obj['confirm'] !== 'string') throw new Error('Confirm message missing.');
        return new EADisplayRandomMessage(obj['messages'], obj['confirm'], obj['icon'] || '');
    }

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        const msgId = Math.floor(gs.nextRandomNumber() * this._messages.length);
        await ap.displayMessage(this._messages[msgId], this._confirm, this._icon);
    }

}

/**
 * Displays a message along with multiple choices from which players can select.
 * Each choice can also optionally execute a list of actions after being
 * selected.
 */
export class EADisplayChoices extends EventAction {

    constructor(private _message: string, private _choiceMessages: string[],
                private _requirements: CompiledEventExpression[],
                private _actions: EventAction[][], private _icon: string)
    {
        super();
        if (_choiceMessages.length !== _requirements.length || _choiceMessages.length !== _actions.length) {
            throw new Error('The number of choices must be equal to the number of requirements/actions.');
        }
    }

    static ID = 'DisplayChoices';
    
    /**
     * Creates an `EADisplayChoices` instance from it JSON definition stored in
     * the given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "DisplayChoices",
     *         "message": string,
     *         "choices": [
     *             {
     *                 "message": string,
     *                 "requirement": number | string | undefined,
     *                 "actions": EventAction[] | undefined
     *             }
     *         ]
     *     }
     *     ```
     *     The `requirement` is optional and can be an expression.
     * @param af The event action factory for creating nested actions.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `requirement` field.
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
        return new EADisplayChoices(obj['message'], choiceMessages, requirements, actions, obj['icon'] || '');
    }

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        // Build choice array according to requirements.
        let choices: Array<[string, number]> = [];
        for (let i = 0;i < this._choiceMessages.length;i++) {
            if (ee.eval(this._requirements[i])) {
                choices.push([this._choiceMessages[i], i]);
            }
        }
        let choiceId = await ap.displayChoices(this._message, choices, this._icon);
        let actions = this._actions[choiceId];
        for (let a of actions) {
            await a.execute(gs, ap, ee);
        }
    }

}

/**
 * Randomly executes one list of actions of a group of action lists according to
 * the given weights.
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

    static ID = 'Random';
    
    /**
     * Creates an `EARandom` instance from it JSON definition stored in the
     * given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "Random",
     *         "groups": [
     *             {
     *                 "weight": number | string,
     *                 "actions": EventAction[]
     *             }
     *         ]
     *     }
     *     ```
     *     The `weight` field can be an expression.
     * @param af The event action factory for creating nested actions.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `weight` field.
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

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        let idx = weightedSample(this._weightExprs.map(item => ee.eval(item)),
                                 () => gs.nextRandomNumber());
        for (let a of this._actions[idx]) {
            await a.execute(gs, ap, ee);
        }
    }

}

/**
 * Randomly chooses one of the two action lists to execute via a coin flip.
 * This action is a simplified version of `EARandom` when you only need randomly
 * pick from two actions.
 */
export class EACoinFlip extends EventAction {

    constructor(private _p: CompiledEventExpression,
                private _successActions: EventAction[],
                private _failActions: EventAction[])
    {
        super();
    }

    static ID = 'CoinFlip';

    /**
     * Creates an `EACoinFlip` instance from it JSON definition stored in the
     * given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "CoinFlip",
     *         "probability": number | string,
     *         "success": EventAction[] | undefined,
     *         "fail": EventAction[] | undefined
     *     }
     *     ```
     * @param af The event action factory for creating nested actions.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `probability` field.
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

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        let p = ee.eval(this._p);
        if (p < 0) p = 0;
        let coinFlip = gs.nextRandomNumber();
        if (coinFlip < p) {
            for (let a of this._successActions) {
                await a.execute(gs, ap, ee);
            }
        } else {
            for (let a of this._failActions) {
                await a.execute(gs, ap, ee);
            }
        }
    }

}

/**
 * Given a list of conditions and their associated action lists, evaluates the
 * conditions in the order they are defined and executes the action list
 * associated with the first condition that evaluates to true.
 * This action is similar to a non-fall-through switch statement in JavaScript.
 */
export class EASwitch extends EventAction {

    constructor(private _conditions: CompiledEventExpression[], private _actions: EventAction[][]) {
        super();
    }

    static ID = 'Switch';

    /**
     * Creates an `EASwitch` instance from it JSON definition stored in the
     * given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "Switch",
     *         "branches": [
     *             {
     *                 "condition": string | number,
     *                 "actions": EventAction[]
     *             }
     *         ]
     *     }
     *     ```
     *     Each `condition` can also be an expression.
     * @param af The event action factory for creating nested actions.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `condition` field.
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EASwitch {
        const branches = obj['branches'];
        if (!Array.isArray(branches)) throw new Error('Expecting an array of branches.');
        let conditions: CompiledEventExpression[] = [];
        let actions: EventAction[][] = [];
        for (let branch of branches) {
            if (!branch['condition']) throw new Error('Condition is required.');
            let cond = branch['condition'];
            if (typeof cond !== 'string' && typeof cond !== 'number') {
                throw new Error('Condition must be either an expression or a number.');
            }
            conditions.push(ec.compile(cond));
            if (!Array.isArray(branch['actions'])) throw new Error('Missing actions.');
            actions.push(af.fromJSONArray(branch['actions']));
        }
        return new EASwitch(conditions, actions);
    }

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        // Check operation
        for (let i = 0;i < this._conditions.length;i++) {
            if (ee.eval(this._conditions[i])) {
                for (let action of this._actions[i]) {
                    await action.execute(gs, ap, ee);
                }
                break;
            }
        }
    }

}

/**
 * Updates one game state variables.
 */
export class EAUpdateVariable extends EventAction {

    constructor(private _varName: string, private _updateExpr: CompiledEventExpression) {
        super();
    }

    static ID = 'UpdateVariable';
    
    /**
     * Creates an `EAUpdateVariable` instance from it JSON definition stored in
     * the given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "UpdateVariable",
     *         "variable": string,
     *         "value": number | string
     *     }
     *     ```
     *     The `value` field can also be an expression.
     * @param af Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `value` field.
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EAUpdateVariable {
        if (!obj['variable']) throw new Error('Missing variable name.');
        if (obj['value'] == undefined) throw new Error('Missing value.');
        let expr = obj['value'];
        if (typeof expr !== 'number' && typeof expr !== 'string') {
            throw new Error('Value must be either a number of a string.');
        }
        return new EAUpdateVariable(obj['variable'], ec.compile(expr));
    }

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        gs.setVar(this._varName, ee.eval(this._updateExpr), false);
    }

}

/**
 * Updates one or more game state variables.
 */
export class EAUpdateVariables extends EventAction {

    constructor(private _varNames: string[], private _updateExprs: CompiledEventExpression[]) {
        super();
        if (_varNames.length !== _updateExprs.length) {
            throw new Error('The number of variables must be equal to the number of expressions.');
        }
    }

    static ID = 'UpdateVariables';

    /**
     * Creates an `EAUpdateVariables` instance from it JSON definition stored in
     * the given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "UpdateVariables",
     *         "updates": { [varName: string]: string | number }
     *     }
     *     ```
     * @param af Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `updates` map.
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EAUpdateVariables {
        if (!obj['updates']) throw new Error('Missing update definitions.');
        let varNames: string[] = [];
        let exprs: CompiledEventExpression[] = [];
        for (let varName in obj['updates']) {
            varNames.push(varName);
            exprs.push(ec.compile(obj['updates'][varName]));
        }
        return new EAUpdateVariables(varNames, exprs);
    }

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        for (let i = 0;i < this._varNames.length;i++) {
            gs.setVar(this._varNames[i], ee.eval(this._updateExprs[i]));
        }
    }

}

/**
 * Gives the player a certain amount of a certain item.
 */
export class EAGiveItem extends EventAction {

    constructor(private _itemId: string, private _amountExpr: CompiledEventExpression) {
        super();
    }

    static ID = 'GiveItem';

    /**
     * Creates an `EAGiveItem` instance from it JSON definition stored in the
     * given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "GiveItem",
     *         "itemId": string,
     *         "amount": number | string
     *     }
     *     ```
     *     The `amount` field can also be an expression.
     * @param af Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `amount` field.
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EAGiveItem {
        if (obj['itemId'] == undefined) throw new Error('Missing item id.');
        // We allow amount to be an expression.
        if (typeof obj['amount'] !== 'string' && typeof obj['amount'] !== 'number') {
            throw new Error('Amount must be a number or an expression.');
        }
        return new EAGiveItem(obj['itemId'], ec.compile(obj['amount']));
    }

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        let amount = ee.eval(this._amountExpr);
        if (amount > 0) {
            gs.playerInventory.add(this._itemId, amount);
        } else if (amount < 0) {
            gs.playerInventory.remove(this._itemId, -amount);
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

    static ID = 'UpdateItemAmounts';

    /**
     * Creates an `EAUpdateItemAmounts` instance from it JSON definition stored
     * in the given JSON object.
     * @param obj Schema:
     *     ``
     *     {
     *         "id": "UpdateItemAmounts",
     *         "updates": { [itemId: string]: number | string; }
     *     }
     *     ```
     * @param af Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `updates` map.
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

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        for (let i = 0;i < this._itemIds.length;i++) {
            let amount = ee.eval(this._updateExprs[i]);
            if (amount > 0) {
                gs.playerInventory.add(this._itemIds[i], amount);
            } else if (amount < 0) {
                gs.playerInventory.remove(this._itemIds[i], -amount);
            }
        }
    }

}

/**
 * Ends the game.
 */
export class EAEndGame extends EventAction {

    constructor(private _message: string, private _confirm: string,
                private _winning: boolean, private _fx?: string) {
        super();
    }

    static ID = 'EndGame';

    /**
     * Creates an `EAEndGame` instance from it JSON definition stored in the
     * given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "EndGame",
     *         "message": string,
     *         "confirm": string,
     *         "winning": boolean,
     *         "fx": string | undefined
     *     }
     *     ```
     * @param af Not used.
     * @param ec Not used.
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EAEndGame {
        if (typeof(obj['message']) !== 'string') throw new Error('Missing message.');
        if (typeof(obj['confirm']) !== 'string') throw new Error('Missing confirm message.');
        if (typeof(obj['winning']) !== 'boolean') throw new Error('Missing winning status.');
        if (obj['fx'] && typeof(obj['fx']) !== 'string') throw new Error('FX must be a string.');
        return new EAEndGame(obj['message'], obj['confirm'], obj['winning'], obj['fx']);
    }

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        await ap.displayMessage(this._message, this._confirm, '', this._fx);
        gs.endGameState = this._winning ? EndGameState.Winning : EndGameState.Losing;
    }

}

/**
 * Sets a status effect on or off.
 */
export class EASetStatus extends EventAction {

    constructor(private _statusId: string, private _on: boolean) {
        super();
    }

    static ID = 'SetStatus';
    
    /**
     * Creates an `EASetStatus` instance from it JSON definition stored in the
     * given JSON object.
     * @param obj Schema
     *     ```
     *     {
     *         "id": "SetStatus",
     *         "statusId": string,
     *         "on": boolean
     *     }
     *     ```
     * @param af Not used.
     * @param ec Not used.
     */
    static fromJSONObject(obj: any, af: EventActionFactory, ec: EventExpressionCompiler): EASetStatus {
        if (typeof(obj['statusId']) !== 'string') throw new Error('Missing status id.');
        if (typeof(obj['on']) !== 'boolean') throw new Error('Missing on/off indicator.');
        return new EASetStatus(obj['statusId'], obj['on']);
    }

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        if (this._on) {
            gs.playerStatus.add(this._statusId);
        } else {
            gs.playerStatus.remove(this._statusId);
        }
    }

}
