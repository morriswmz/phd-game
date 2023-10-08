import { GameState } from '../gameState';
import { EventCondition, EventConditionEvaluationContext } from './core';
import { EventExpressionEvaluator, EventExpressionFunctionTable, CompiledEventExpression, EventExpressionCompiler } from './expression';
import { CompiledExpression, compileExpression } from '../utils/expression';

interface EventConditionDeserializationContext {
    conditionFactory: EventConditionFactory;
    expressionCompiler: EventExpressionCompiler;
}

type EventConditionDeserializer =
    (obj: any, context: EventConditionDeserializationContext) => EventCondition;

export interface EventConditionDeserializerDefinition {
    ID: string;
    fromJSONObject: EventConditionDeserializer;
}

export class EventConditionFactory {

    private _deserializers: Map<string, EventConditionDeserializer> = new Map();
    private _deserializationContext: EventConditionDeserializationContext;

    constructor(expressionCompiler: EventExpressionCompiler) {
        this._deserializationContext = {
            conditionFactory: this,
            expressionCompiler: expressionCompiler
        };
    }

    registerDeserializer(def: EventConditionDeserializerDefinition) : void {
        this._deserializers.set(def.ID, def.fromJSONObject);
    }

    fromJSONObject(obj: any): EventCondition {
        const conditionId = obj['id'];
        if (conditionId == undefined || typeof conditionId !== 'string') {
            throw new Error('Condition id must be a string.');
        }
        const deserializer = this._deserializers.get(conditionId);
        if (deserializer == undefined) {
            throw new Error(`No deserializer defined for "${conditionId}".`);
        }
        return deserializer(obj, this._deserializationContext);
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
    
    static fromJSONObject(obj: any, context: EventConditionDeserializationContext): ECExpression {
        const expression = obj['expression'];
        if (obj['expression'] == undefined) {
            throw new Error('Missing expression.');
        }
        if (typeof obj['expression'] !== 'number' &&
            typeof obj['expression'] !== 'string') {
            throw new Error('Expression must be a number or string.');
        }
        return new ECExpression(
            context.expressionCompiler.compile(obj['expression']));
    }

    check(context: EventConditionEvaluationContext): boolean {
        return !!context.evaluator.eval(this._expression);
    }

}

export class ECAll extends EventCondition {
    
    private _conditions: EventCondition[] = [];

    check(context: EventConditionEvaluationContext): boolean {
        for (let cond of this._conditions) {
            if (!cond.check(context)) return false; 
        }
        return true;
    }

}

export class EAAny extends EventCondition {
    
    private _conditions: EventCondition[] = [];

    check(context: EventConditionEvaluationContext): boolean {
        for (let cond of this._conditions) {
            if (cond.check(context)) return true;
        }
        return false;
    }

}
