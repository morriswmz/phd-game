import { EventCondition, EventConditionEvaluationContext } from './core';
import { CompiledEventExpression, EventExpressionCompiler } from './expression';

interface EventConditionDeserializationContext {
    conditionFactory: EventConditionFactory;
    expressionCompiler: EventExpressionCompiler;
}

type EventConditionDeserializer =
    (obj: object, context: EventConditionDeserializationContext) => EventCondition;

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

    fromJSONObject(obj: object): EventCondition {
        if (!('id' in obj) || typeof obj.id !== 'string') {
            throw new Error('Condition id must be a string.');
        }
        const conditionId = obj.id;
        const deserializer = this._deserializers.get(conditionId);
        if (deserializer == undefined) {
            throw new Error(`No deserializer defined for "${conditionId}".`);
        }
        return deserializer(obj, this._deserializationContext);
    }

    /**
     * A more relaxed version of `fromJSONObject()` that allows expression
     * inputs (string or number) in addition to objects.
     */
    fromJSON(obj: any): EventCondition {
        if (obj == undefined) throw new Error('JSON input cannot be null.');
        if (typeof obj === 'number' || typeof obj === 'string') {
            return new ECExpression(
                this._deserializationContext.expressionCompiler.compile(obj));
        } else if (typeof obj === 'object') {
            return this.fromJSONObject(obj);
        } else {
            throw new Error('Unsupported JSON input.');
        }
    }

    fromJSONArray(objectArray: any[]): EventCondition[] {
        return objectArray.map((obj) => this.fromJSON(obj));
    }

}

/**
 * Represents a condition constructed from a simple expression. The condition
 * evaluates to true when the expression evaluates to a valid non-zero number
 * (no NaN).
 */
export class ECExpression extends EventCondition {

    constructor(private _expression: CompiledEventExpression) {
        super();
    }

    static ID = 'Expression';
    
    /**
     * Creates a new `ECExpression` instance from its JSON definition stored in
     * the given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "Expression",
     *         "expression": number | string
     *     }
     *     ```
     * @param context The required context to construct the event condition.
     */
    static fromJSONObject(obj: object, context: EventConditionDeserializationContext): ECExpression {
        if (!('expression' in obj) || obj.expression == undefined) {
            throw new Error('Missing expression.');
        }
        const expression = obj.expression;
        if (typeof expression !== 'number' && typeof expression !== 'string') {
            throw new Error('Expression must be a number or string.');
        }
        return new ECExpression(context.expressionCompiler.compile(expression));
    }

    check(context: EventConditionEvaluationContext): boolean {
        return !!context.evaluator.eval(this._expression);
    }

}

/**
 * Negates the given condition.
 */
export class ECNot extends EventCondition {

    constructor(private _condition: EventCondition) {
        super();
    }

    static ID = 'Not';
    
    /**
     * Creates a new `ECNot` instance from its JSON definition stored in the
     * given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "Not",
     *         "condition": number | string | EventCondition
     *     }
     *     ```
     * @param context The required context to construct the event condition.
     */
    static fromJSONObject(obj: object, context: EventConditionDeserializationContext): ECNot {
        if (!('condition' in obj) || obj.condition == undefined) {
            throw new Error('Missing condition definition.');
        }
        return new ECNot(context.conditionFactory.fromJSON(obj.condition));
    }

    check(context: EventConditionEvaluationContext): boolean {
        return !this._condition.check(context);
    }

}

/**
 * Evaluates to true if an only if all sub-conditions evaluate true.
 */
export class ECAll extends EventCondition {
    
    constructor(private _conditions: EventCondition[]) {
        super();
    }

    static ID = 'All'

    /**
     * Creates a new `ECAll` instance from its JSON definition stored in the
     * given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "All",
     *         "conditions": Array<number | string | EventCondition>
     *     }
     *     ```
     *     Each sub-condition in `conditions` can either be a simple expression
     *     or another event condition.
     * @param context The required context to construct the event condition.
     */
    static fromJSONObject(obj: object, context: EventConditionDeserializationContext): ECAll {
        if (!('conditions' in obj) || !Array.isArray(obj.conditions)) {
            throw new Error('Missing condition definitions.');
        }
        return new ECAll(
            context.conditionFactory.fromJSONArray(obj.conditions));
    }

    check(context: EventConditionEvaluationContext): boolean {
        for (let cond of this._conditions) {
            if (!cond.check(context)) return false; 
        }
        return true;
    }

}

/**
 * Evaluates to true if any sub-condition evaluates true.
 */
export class ECAny extends EventCondition {
    
    constructor(private _conditions: EventCondition[]) {
        super();
    }

    static ID = 'Any';

    /**
     * Creates a new `ECAny` instance from its JSON definition stored in the
     * given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "Any",
     *         "conditions": Array<number | string | EventCondition>
     *     }
     *     ```
     *     Each sub-condition in `conditions` can either be a simple expression
     *     or another event condition.
     * @param context The required context to construct the event condition.
     */
    static fromJSONObject(obj: object, context: EventConditionDeserializationContext): ECAny {
        if (!('conditions' in obj) || !Array.isArray(obj.conditions)) {
            throw new Error('Missing condition definitions.');
        }
        return new ECAny(
            context.conditionFactory.fromJSONArray(obj.conditions));
    }

    check(context: EventConditionEvaluationContext): boolean {
        for (let cond of this._conditions) {
            if (cond.check(context)) return true;
        }
        return false;
    }

}

/**
 * Evaluates to true if some sub-conditions evaluate true.
 */
export class ECSome extends EventCondition {
    
    constructor(private _conditions: EventCondition[],
                private _min: CompiledEventExpression,
                private _max: CompiledEventExpression) {
        super();
    }

    static ID = 'Some';

    /**
     * Creates a new `ECSome` instance from its JSON definition stored in the
     * given JSON object.
     * @param obj Schema:
     *     ```
     *     {
     *         "id": "Some",
     *         "min": number | string | undefined,
     *         "max": number | string | undefined,
     *         "conditions": Array<number | string | EventCondition>
     *     }
     *     ```
     *     Each sub-condition in `conditions` can either be a simple expression
     *     or another event condition.
     * 
     *     `min` (inclusive) and `max` (inclusive) specifies the allowed number
     *     of sub-conditions that can be true. They can be a constant number or
     *     an expression. If not set, `min` defaults to `-Infinity` and `max`
     *     defaults to `Infinity`.
     * 
     *     If you require exactly N sub-conditions to be true, set `min` and
     *     `max` to the same value N.
     * @param context The required context to construct the event condition.
     */
    static fromJSONObject(obj: object, context: EventConditionDeserializationContext): ECSome {
        if (!('conditions' in obj) || !Array.isArray(obj['conditions'])) {
            throw new Error('Missing condition definitions.');
        }
        const conditions =
            context.conditionFactory.fromJSONArray(obj['conditions']);
        let min: CompiledEventExpression;
        if (!('min' in obj)) {
            min = context.expressionCompiler.compile(-Infinity);
        } else if (typeof obj['min'] === 'number' ||
                   typeof obj['min'] === 'string') {
            min = context.expressionCompiler.compile(obj['min']);
        } else {
            throw new Error('min must be a valid number or expression string.');
        }
        let max: CompiledEventExpression;
        if (!('max' in obj)) {
            max = context.expressionCompiler.compile(Infinity);
        } else if (typeof obj['max'] === 'number' ||
                   typeof obj['max'] === 'string') {
            max = context.expressionCompiler.compile(obj['max']);
        } else {
            throw new Error('max must be a valid number or expression string.');
        }
        return new ECSome(conditions, min, max);
    }

    check(context: EventConditionEvaluationContext): boolean {
        const min = context.evaluator.eval(this._min);
        const max = context.evaluator.eval(this._max);
        let n = 0;
        for (let c of this._conditions) {
            if (c.check(context)) n++;
        }
        return n >= min && n <= max;
    }

}
