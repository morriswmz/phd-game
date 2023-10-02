import { GameState, EndGameState } from '../gameState';
import { EventAction, EventCondition, GuiActionProxy } from './core';
import { EventExpressionEvaluator, CompiledEventExpression, EventExpressionCompiler } from './expression';
import { weightedSample } from '../utils/random';
import { ECExpression, EventConditionFactory } from './conditions';

// Note on the usage of typeof.
// For JSON-like objects, it is safe to check the types of numbers/strings using
// typeof. We forbid `Number(123)` or `String('abc')`.
// Object.prototype.toString.call() is a more foolproof approach.

export type EventActionDeserializer =
    (obj: any, af: EventActionFactory, cf: EventConditionFactory,
     ec: EventExpressionCompiler) => EventAction;

export interface EventActionDeserializerDefinition {
    ID: string;
    fromJSONObject: EventActionDeserializer;
}

/**
 * A factory class for creating event action instances from JSON-like objects.
 */
export class EventActionFactory {

    private _deserializers: { [key: string]: EventActionDeserializer } = {};
    private _conditionFactory: EventConditionFactory;
    private _exprCompiler: EventExpressionCompiler;

    constructor(conditionFactory: EventConditionFactory,
                exprCompiler: EventExpressionCompiler) {
        this._conditionFactory = conditionFactory;
        this._exprCompiler = exprCompiler;
    }

    registerDeserializer(def: EventActionDeserializerDefinition): void {
        this._deserializers[def.ID] = def.fromJSONObject;
    }

    fromJSONObject(obj: any): EventAction {
        if (!obj['id']) {
            throw new Error('Action id is not specified.');
        }
        const id = obj['id'];
        if (typeof id !== 'string') {
            throw new Error('Action id must be a string.');
        }
        const deserializer = this._deserializers[id];
        if (!deserializer) {
            throw new Error(`Cannot construct the event action for "${id}".`);
        }
        return deserializer(obj, this, this._conditionFactory,
                            this._exprCompiler);
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
     * @param cf Not used.
     * @param ec Not used.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EALog {
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

    constructor(private _message: string, private _confirm: string,
                private _icon: string) {
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
     * @param cf Not used.
     * @param ec Not used.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EADisplayMessage {
        if (obj['message'] == undefined) throw new Error('Message missing.');
        if (obj['confirm'] == undefined) {
            throw new Error('Confirm message missing.');
        }
        return new EADisplayMessage(obj['message'], obj['confirm'],
                                    obj['icon'] || '');
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
     * @param cf Not used.
     * @param ec Not used.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EADisplayRandomMessage {
        if (!Array.isArray(obj['messages'])) {
            throw new Error('Messages missing.');
        }
        if (typeof obj['confirm'] !== 'string') {
            throw new Error('Confirm message missing.');
        }
        return new EADisplayRandomMessage(obj['messages'], obj['confirm'],
                                          obj['icon'] || '');
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
     * @param cf Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `requirement` field.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EADisplayChoices {
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
     * @param cf Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `weight` field.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EARandom {
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
     * @param cf Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `probability` field.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EACoinFlip {
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

    constructor(private _conditions: EventCondition[],
                private _actions: EventAction[][]) {
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
     *                 "condition": string | number | EventCondition,
     *                 "actions": EventAction[]
     *             }
     *         ]
     *     }
     *     ```
     *     Each `condition` can also be an expression.
     * @param af The event action factory for creating nested actions.
     * @param cf Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `condition` field.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EASwitch {
        const branches = obj['branches'];
        if (!Array.isArray(branches)) throw new Error('Expecting an array of branches.');
        let conditions: EventCondition[] = [];
        let actions: EventAction[][] = [];
        for (let branch of branches) {
            if (branch['condition'] == undefined) {
                throw new Error('Condition is required.');
            }
            let cond = branch['condition'];
            if (typeof cond === 'string' || typeof cond === 'number') {
                conditions.push(new ECExpression(ec.compile(cond)));
            } else {
                conditions.push(cf.fromJSONObject(cond));
            }
            if (!Array.isArray(branch['actions'])) {
                throw new Error('Missing actions.');
            }
            actions.push(af.fromJSONArray(branch['actions']));
        }
        return new EASwitch(conditions, actions);
    }

    async execute(gs: GameState, ap: GuiActionProxy, ee: EventExpressionEvaluator): Promise<void> {
        // Check operation
        for (let i = 0;i < this._conditions.length;i++) {
            if (this._conditions[i].check(gs, ee)) {
                for (let action of this._actions[i]) {
                    await action.execute(gs, ap, ee);
                }
                break;
            }
        }
    }

}

/**
 * Keeps executing a list of actions until the stop condition is met. Like a
 * loop in JavaScript.
 */
export class EALoop extends EventAction {

    constructor(private _stopCondition: EventCondition | null,
                private _maxIterations: number,
                private _checkStopConditionAtEnd: boolean,
                private _actions: EventAction[]) {
        super();
    }

    static ID = 'Loop';
    
    /**
     * Creates an `EALoop` instance from it JSON definition stored in the given
     * JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "Loop",
     *         "stopCondition": number | string | EventCondition | undefined,
     *         "maxIterations": number | undefined,
     *         "checkStopConditionAtEnd": boolean | undefined,
     *         "actions": EventAction[]
     *     }
     *     ```
     *     If `stopCondition` is not set, there will no stop condition and the
     *     loop will keep going until `maxIterations` is reached.
     *     `maxIterations` limits the maximum number of times the loop can run,
     *     regardless of the `stopCondition`. If `maxIterations` is not set, or
     *     not set to a positive value, there will be no limit.
     *     If `checkStopConditionAtEnd` is true, `actions` will be executed
     *     first before evaluating the stop condition (like a do ... while
     *     loop). If the stop condition is met, next iteration will not occur.
     *     Otherwise, the stop condition will be evaluated before executing
     *     `actions` (like a while loop). Default value is false.
     *     
     * @param af Not used.
     * @param cf Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `value` field.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EALoop {
        let stopCondition: EventCondition | null = null;
        const stopConditionDef = obj['stopCondition'];
        if (stopConditionDef != undefined) {
            if (typeof stopConditionDef === 'string' ||
                typeof stopConditionDef === 'number') {
                stopCondition = new ECExpression(ec.compile(stopConditionDef));
            } else {
                stopCondition = cf.fromJSONObject(stopConditionDef);
            }
        }
        let maxIterations = obj['maxIterations'];
        if (maxIterations == undefined) {
            maxIterations = 0;
        } else if (typeof maxIterations === 'number') {
            maxIterations = maxIterations > 0 ? maxIterations : 0;
        } else {
            throw new Error('maxIterations needs to be a number.');
        }
        let checkStopConditionAtEnd = obj['checkStopConditionAtEnd'];
        if (checkStopConditionAtEnd == undefined) {
            checkStopConditionAtEnd = false;
        } else if (typeof checkStopConditionAtEnd !== 'boolean') {
            throw new Error('checkStopConditionAtEnd need to be a boolean.');
        }
        if (!Array.isArray(obj['actions'])) {
            throw new Error('Missing actions.');
        }
        return new EALoop(stopCondition, maxIterations, checkStopConditionAtEnd,
                          af.fromJSONArray(obj['actions']));
    }
    
    async execute(gs: GameState, ap: GuiActionProxy,
                  ee: EventExpressionEvaluator): Promise<void> {
        let i = 0;
        if (this._checkStopConditionAtEnd) {
            do {
                for (let action of this._actions) {
                    await action.execute(gs, ap, ee);
                }
                if (this._maxIterations > 0) {
                    i++;
                    if (i >= this._maxIterations) break;
                }
            } while (this._stopCondition === null ||
                     this._stopCondition.check(gs, ee));
        } else {
            while (this._stopCondition === null ||
                   this._stopCondition.check(gs, ee)) {
                for (let action of this._actions) {
                    await action.execute(gs, ap, ee);
                }
                if (this._maxIterations > 0) {
                    i++;
                    if (i >= this._maxIterations) break;
                }
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
     * @param cf Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `value` field.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EAUpdateVariable {
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
     * @param cf Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `updates` map.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EAUpdateVariables {
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
 * Updates one or more variables' limits.
 */
export class EAUpdateVariableLimits extends EventAction {

    constructor(private _limitsByVarName: Record<string, [number, number]>) {
        super();
    }

    static ID = 'UpdateVariableLimits';

    /**
     * Creates an `EAUpdateVariableLimits` instance from it JSON definition
     * stored in the given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "UpdateVariableLimits",
     *         "updates": { [varName: string]: [number, number] }
     *     }
     *     ```
     *     Limits are defined via a pair of constant numbers, where the first
     *     number specifies the lower bound (inclusive) and the second number
     *     specifies the upper bound (inclusive). The can be Infinity or
     *     -Infinity, but cannot be NaN expressions.
     * @param af Not used.
     * @param cf Not used.
     * @param ec Not used.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EAUpdateVariableLimits {
        if (!obj['updates']) throw new Error('Missing update definitions.');
        let limitsByVarName: Record<string, [number, number]> = {};
        for (const varName in obj['updates']) {
            let limits = obj['updates'][varName];
            if (!Array.isArray(limits) || limits.length !== 2 ||
                typeof limits[0] !== 'number' ||
                typeof limits[1] !== 'number') {
                throw new Error('Limits need to be two-element tuples.');
            }
            limitsByVarName[varName] = <[number, number]>limits;
        }
        return new EAUpdateVariableLimits(limitsByVarName);
    }

    async execute(gs: GameState, ap: GuiActionProxy,
                  ee: EventExpressionEvaluator): Promise<void> {
        for (const varName in this._limitsByVarName) {
            const limits = this._limitsByVarName[varName];
            gs.setVarLimits(varName, limits[0], limits[1]);
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
     * @param cf Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `amount` field.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EAGiveItem {
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
     * @param cf Not used.
     * @param ec The event expression compiler for compiling expressions from 
     *     the `updates` map.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EAUpdateItemAmounts {
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
     * @param cf Not used.
     * @param ec Not used.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EAEndGame {
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
     * @param cf Not used.
     * @param ec Not used.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EASetStatus {
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

/**
 * Triggers one or more events via one or more trigger ids.
 * 
 * IMPORTANT: Game events will be triggered asynchronously instead of
 * synchronously:
 * 
 * 1. Each trigger id listed in this action will be pushed to a queue and
 *    processed after all game events from the ongoing trigger are handled.
 * 2. The processing order is determined by priority (trigger ids with higher
 *    priorities will be processed earlier than those with lower priorities).
 * 3. When multiple priorities are defined for the same trigger id, the highest
 *    one will be picked.
 * 
 * Example:
 * 
 * Suppose you define a game event named "OnTick" triggered by "Tick", which
 * contains an event action that triggers (1) "AfterTickA" with priority 100,
 * and (2) "AfterTickB" with priority 200.
 * 
 * Suppose you also define another game event named "OnAfterTickA" triggered by
 * "AfterTickA", which contains an event action that triggers "AfterTickC" with
 * priority 50.
 * 
 * Then after "Tick" is triggered, the following will happen in order:
 * 
 * 1. All event actions under "OnTick" will be executed;
 * 2. All event actions under "AfterTickB" will be executed;
 * 3. All event actions under "AfterTickA" will be executed;
 * 4. All event actions under "AfterTickC" will be executed.
 */
export class EATriggerEvents extends EventAction {

    constructor(private _priorityByTriggerId: Record<string, number>) {
        super();
    }

    static ID = 'TriggerEvents'

    /**
     * Creates an `EATriggerEvents` instance from it JSON definition stored in
     * the given JSON object.
     * @param obj Schema
     *     ```
     *     {
     *         "id": "TriggerEvents",
     *         "triggers": [
     *             {
     *                 "id": string,
     *                 "priority": number | undefined
     *             }
     *         ]
     *     }
     *     ```
     *     The default priority is 0. Triggers with higher priorities with be
     *     processed earlier than those with lower priorities.
     * @param af Not used.
     * @param cf Not used.
     * @param ec Not used.
     */
    static fromJSONObject(obj: any, af: EventActionFactory,
                          cf: EventConditionFactory,
                          ec: EventExpressionCompiler): EATriggerEvents {
        let priorityByTriggerId: Record<string, number> = {};
        if (!obj['triggers'] || !Array.isArray(obj['triggers'])) {
            throw new Error('Missing trigger definitions.');
        }
        for (const trigger of obj['triggers']) {
            let triggerId = trigger['id'];
            if (typeof triggerId !== 'string') {
                throw new Error('Missing valid trigger id.');
            }
            let priority = trigger['priority'] || 0;
            if (typeof priority !== 'number' || isNaN(priority)) {
                throw new Error('Priority must be a valid number.');
            }
            if (triggerId in priorityByTriggerId) {
                priorityByTriggerId[triggerId] = Math.max(
                    priorityByTriggerId[triggerId], priority);
            } else {
                priorityByTriggerId[triggerId] = priority;
            }
        }
        return new EATriggerEvents(priorityByTriggerId);
    }

    async execute(gs: GameState, ap: GuiActionProxy,
                  ee: EventExpressionEvaluator): Promise<void> {
        for (const triggerId in this._priorityByTriggerId) {
            gs.addPendingTrigger(triggerId,
                                 this._priorityByTriggerId[triggerId]);
        }
    }

}