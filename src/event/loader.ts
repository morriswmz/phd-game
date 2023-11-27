import { EventConditionFactory } from './conditions';
import { EventActionFactory } from './actions';
import { EventActionList, GameEvent } from './core';
import { downloadAndParse } from '../utils/network';
import { load as loadYaml } from 'js-yaml';
import { CompiledEventExpression, EventExpressionCompiler } from './expression';

export class GameEventLoader {

    private _exprCompiler: EventExpressionCompiler;
    private _conditionFactory: EventConditionFactory;
    private _actionFactory: EventActionFactory;

    constructor(ec: EventExpressionCompiler, cf: EventConditionFactory, af: EventActionFactory) {
        this._exprCompiler = ec;
        this._conditionFactory = cf;
        this._actionFactory = af;
    }

    async load(url: string): Promise<GameEvent[]> {
        return downloadAndParse(url, s => this.loadFromString(s));
    }

    loadFromString(s: string): GameEvent[] {
        return this.parseEvents(loadYaml(s) || {});
    }

    parseEvents(obj: any): GameEvent[] {
        if (!Array.isArray(obj)) throw new Error('Expecting an array of event definitions.');
        // Preserve this!
        return obj.map(item => this.parseEvent(item));
    }

    /**
     * Creates a game event from its description.
     * Schema:
     *  ```
     *  {
     *      id: string,
     *      trigger: string | undefined, // undefined means never triggered.
     *      conditions: Array<EventCondition | string | number> | undefined,
     *      probability: number | string | undefined,
     *      once: boolean | undefined,
     *      disabled: boolean | undefined,
     *      exclusions: string[] | undefined,
     *      actions: EventAction[]
     *  }
     *  ```
     * @param obj JSON-like object.
     */
    parseEvent(obj: any): GameEvent {
        if (obj['id'] == undefined) throw new Error('Missing event id.');
        const id = obj['id'];
        if (obj['trigger'] != undefined && typeof(obj['trigger']) !== 'string') {
            throw new Error('Event trigger must be a string.');
        }
        const trigger = obj['trigger'] || '';
        const conditions = Array.isArray(obj['conditions'])
            ? obj['conditions'].map((item: any) => this._conditionFactory.fromJSON(item))
            : [];
        let probability: number | CompiledEventExpression;
        if (obj['probability'] == undefined) {
            probability = 1.0;
        } else {
            if (typeof obj['probability'] === 'number') {
                probability = obj['probability'];
            } else if (typeof obj['probability'] === 'string') {
                probability = this._exprCompiler.compile(obj['probability']);
            } else {
                throw new Error('Probability must either a number or a string expression.');
            }
        }
        const exclusions = Array.isArray(obj['exclusions']) ? obj['exclusions'] : [];
        if (!Array.isArray(obj['actions'])) throw new Error('Missing actions.');
        const actions = new EventActionList(obj['actions'].map((item: any) => {
            return this._actionFactory.fromJSONObject(item);
        }));
        const once = !!obj['once'];
        const disabledByDefault = !!obj['disabled'];
        return new GameEvent(id, trigger, conditions, actions, probability,
                             exclusions, once, disabledByDefault);
    }

}
