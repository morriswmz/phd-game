import { GameState } from '../gameState';
import { EventCondition } from './core';
import { EventExpressionEvaluator, EventExpressionFunctionTable, CompiledEventExpression, EventExpressionCompiler } from './expression';
import { CompiledExpression, compileExpression } from '../utils/expression';

type EventConditionDeserializer = (obj: any, factory: EventConditionFactory, ec: EventExpressionCompiler) => EventCondition;

export interface EventConditionDeserializerDefinition {
    ID: string;
    fromJSONObject: EventConditionDeserializer;
}

export class EventConditionFactory {

    private _converters: { [key: string]: EventConditionDeserializer; } = {};
    private _exprCompiler: EventExpressionCompiler;

    constructor(exprCompiler: EventExpressionCompiler) {
        this._exprCompiler = exprCompiler;
    }

    registerDeserializer(def: EventConditionDeserializerDefinition) : void {
        this._converters[def.ID] = def.fromJSONObject;
    }

    fromJSONObject(obj: any): EventCondition {
        if (!obj['id']) {
            throw new Error('Condition id is not specified.');
        }
        if (!this._converters[obj['id']]) {
            throw new Error(`Cannot construct the event condition for "${obj['id']}".`);
        }
        return this._converters[obj['id']](obj, this, this._exprCompiler);
    }

}

/**
 * Represents a condition constructed from a simple expression.
 */
export class ECExpression extends EventCondition {

    constructor(private _expression: CompiledEventExpression) {
        super();
    }

    static ID = 'Expression';
    
    static fromJSONObject(obj: any, cf: EventConditionFactory, ec: EventExpressionCompiler): EventCondition {
        if (obj['expression'] == undefined || typeof obj['expression'] !== 'string') {
            throw new Error('Missing expression.');
        }
        return new ECExpression(ec.compile(obj['expression']));
    }

    check(gs: GameState, ee: EventExpressionEvaluator): boolean {
        return !!ee.eval(this._expression);
    }

}

export class ECAll extends EventCondition {
    
    private _conditions: EventCondition[] = [];

    check(gs: GameState, ee: EventExpressionEvaluator): boolean {
        for (let cond of this._conditions) {
            if (!cond.check(gs, ee)) return false; 
        }
        return true;
    }

}

export class EAAny extends EventCondition {
    
    private _conditions: EventCondition[] = [];

    check(gs: GameState, ee: EventExpressionEvaluator): boolean {
        for (let cond of this._conditions) {
            if (cond.check(gs, ee)) return true;
        }
        return false;
    }

}
