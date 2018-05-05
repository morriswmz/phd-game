import { EventConditionFactory } from './conditions';
import { EventActionFactory } from './actions';
import { GameEvent } from './core';
import { downloadAndParse } from '../utils/network';
import { safeLoad } from 'js-yaml';
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
        return this.parseEvents(safeLoad(s) || {});
    }

    parseEvents(obj: any): GameEvent[] {
        if (!Array.isArray(obj)) throw new Error('Expecting an array of event definitions.');
        // Preserve this!
        return obj.map(item => this.parseEvent(item));
    }

    parseEvent(obj: any): GameEvent {
        if (obj['id'] == undefined) throw new Error('Missing event id.');
        const id = obj['id'];
        if (obj['trigger'] == undefined) throw new Error('Missing event trigger.');
        const trigger = obj['trigger'];
        const conditions = Array.isArray(obj['conditions'])
            ? obj['conditions'].map((item: any) => this._conditionFactory.fromJSONObject(item))
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
        const actions = obj['actions'].map((item: any) => this._actionFactory.fromJSONObject(item));
        const once = !!obj['once'];
        const disabled = !!obj['disabled'];
        return new GameEvent(id, trigger, conditions, actions, probability, exclusions, once);
    }

}
