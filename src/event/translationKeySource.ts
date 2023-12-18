import { SetBuilder } from "../utils/collection";
import { weightedSample } from "../utils/random";
import { EventConditionFactory } from "./conditions";
import { EventCondition, EventConditionEvaluationContext } from "./core";
import { CompiledEventExpression, EventExpressionCompiler } from "./expression";

/**
 * Source of a translation key used in GameEvents (for e.g., message, choices,
 * etc.).
 */
export interface TranslationKeySource {

    /**
     * Returns the translation key given the `context`.
     */
    getTranslationKey(context: EventConditionEvaluationContext): string;

    /**
     * Retrieves all possible translation keys that can be returned from this
     * source.
     */
    collectTranslationKeys(): Set<string>;

}

/**
 * Provides a constant translation key, regardless of the given context.
 * Defined as a simple string in GameEvent definitions (e.g., "message.ok").
 */
export class ConstantTranslationKeySource implements TranslationKeySource {

    constructor(private _key: string) { }

    getTranslationKey(context: EventConditionEvaluationContext): string {
        return this._key;
    }

    collectTranslationKeys(): Set<string> {
        return new Set([this._key])
    }

}

/**
 * Provides a translation key based on some randomness.
 * Defined through an array of translation key source definitions if weights are
 * equal. Otherwise an array of
 *  ```
 *  {
 *      "weight": number,
 *      "text": TranslationKeySourceDefinition
 *  }
 *  ```
 * Examples,
 *  ```
 *  [
 *      "message.base",
 *      [
 *          "message.alternative1",
 *          "message.alternative2"
 *      ],
 *  ]
 *  ```
 *  ```
 *  [
 *      { "weight": 3, "text": "message.variant1" },
 *      { "weight": 2, "text": "message.variant2" },
 *      {
 *          "weight": 1,
 *          "text": [
 *              "message.variant31",
 *              "message.variant32"
 *          ]
 *      }
 *  ]
 *  ```
 */
export class RandomTranslationKeySource implements TranslationKeySource {

    constructor(private _keySources: TranslationKeySource[],
                private _weights: CompiledEventExpression[]) {
        if (this._keySources.length !== this._weights.length) {
            throw new Error("The number of TranslationKeySources is not equal to the number of weight expressions.");
        }
        if (this._keySources.length === 0) {
            throw new Error('At least one TranslationKeySource is required.');
        }
    }

    /**
     * Randomly returns a translation key from the list of
     * TranslationKeySources.
     */
    getTranslationKey(context: EventConditionEvaluationContext): string {
        const weights: number[] =
            this._weights.map((w) => context.evaluator.eval(w));
        const index: number =
            weightedSample(weights, () => context.random.next());
        return this._keySources[index].getTranslationKey(context);
    }

    collectTranslationKeys(): Set<string> {
        const builder = new SetBuilder<string>();
        for (const keySource of this._keySources) {
            builder.addAll(keySource.collectTranslationKeys());
        }
        return builder.get();
    }

}

/**
 * Provides a translation key conditionally.
 * Defined through the following object:
 *  ```
 *  {
 *      "default": TranslationKeySourceDefinition
 *      "branches": [{
 *          "condition": EventConditionDefinition
 *          "text": TranslationKeySourceDefinition
 *      }]
 *  }
 *  ```
 * Example:
 *  ```
 *  {
 *      "default": "message.default",
 *      "branches": [
 *          {
 *              "condition": "year === 1",
 *              "text": [
 *                  "message.year1variant1",
 *                  "message.year1variant2"
 *              ]
 *          },
 *          {
 *              "condition": "year === 2",
 *              "text": "message.year2"
 *          }
 *      ]
 *  }
 *  ```
 */
export class ConditionalTranslationKeySource implements TranslationKeySource {

    constructor(private _defaultKey: TranslationKeySource,
                private _conditions: EventCondition[],
                private _keySources: TranslationKeySource[]) {
        if (this._keySources.length !== this._conditions.length) {
            throw new Error("The number of TranslationKeySources is not equal to the number of conditions.");
        }
    }

    /**
     * Returns the first translation key from the list of TranslationKeySources
     * whose corresponding condition evaluates to true. If none of the
     * conditions evaluates to true, returns the translation key from the
     * default TranslationKeySource.
     */
    getTranslationKey(context: EventConditionEvaluationContext): string {
        for (let i = 0; i < this._conditions.length; i++) {
            if (this._conditions[i].check(context)) {
                return this._keySources[i].getTranslationKey(context);
            }
        }
        return this._defaultKey.getTranslationKey(context);
    }

    collectTranslationKeys(): Set<string> {
        const builder = new SetBuilder<string>(
            this._defaultKey.collectTranslationKeys());
        for (const keySource of this._keySources) {
            builder.addAll(keySource.collectTranslationKeys());
        }
        return builder.get();
    }

}

export class TranslationKeySourceFactory {

    constructor(private _conditionFactory: EventConditionFactory,
                private _expressionCompiler: EventExpressionCompiler) { }

    fromObject(obj: any): TranslationKeySource {
        if (typeof obj === 'string') return new ConstantTranslationKeySource(obj);
        if (Array.isArray(obj)) {
            if (obj.length === 0) {
                throw new Error('The array of TranslationKeySource definitions cannot be empty.');
            }
            let keySources: TranslationKeySource[] = [];
            let weights: CompiledEventExpression[] = [];
            if (typeof obj[0] === 'object' && 'weight' in obj[0] &&
                'text' in obj[0]) {
                // weighted
                for (const def of obj) {
                    const weight = def['weight'];
                    if (weight == undefined) {
                        throw new Error('"weight" is not defined.');
                    }
                    if (typeof weight !== 'number' &&
                        typeof weight !== 'string') {
                        throw new Error('Weight must be a number or a string defining an expression.');
                    }
                    weights.push(this._expressionCompiler.compile(weight));
                    const text = def['text'];
                    if (text == undefined) {
                        throw new Error('"text" is not defined.');
                    }
                    keySources.push(this.fromObject(text));
                }
            } else {
                // unweighted
                for (const text of obj) {
                    keySources.push(this.fromObject(text));
                    weights.push(this._expressionCompiler.compile(1.0));
                }
            }
            return new RandomTranslationKeySource(keySources, weights);
        } else if (typeof obj === 'object' && 'default' in obj &&
                   'branches' in obj) {
            const defaultKeySource = this.fromObject(obj['default']);
            if (!Array.isArray(obj['branches'])) {
                throw new Error('"branches" should be an array.');
            }
            let conditions: EventCondition[] = [];
            let keySources: TranslationKeySource[] = [];
            for (const branch of obj['branches']) {
                conditions.push(
                    this._conditionFactory.fromJSON(branch['condition']));
                keySources.push(this.fromObject(branch['text']));
            }
            return new ConditionalTranslationKeySource(defaultKeySource,
                                                       conditions,
                                                       keySources);
        }
        throw new Error('Unrecognized TranslationKeySource definition.');
    }

}
