/**
 * Core definitions for the event system.
 */
import { Inventory } from '../effect/item';
import { StatusTable } from '../effect/status';
import { VariableStore } from '../variableStore';
import { SetBuilder } from '../utils/collection';
import { RandomSource } from '../utils/random';
import { GameEventEngine } from './engine';
import { EventExpressionEvaluator, CompiledEventExpression } from './expression';
import { EndGameState } from '../endGameState';

/**
 * Delegates the execution of actual GUI related actions.
 * An instance will be passed as an argument in the execute()
 * function so each EventAction instance does not need to hold references to 
 * action targets such as the GUI instances.
 * EventAction instances do not need to know the implementation details of
 * the action targets.
 */
export interface GuiActionProxy {
    /**
     * Provides the ability to display a message.
     * @param message Message (potentially unlocalized) to be displayed.
     * @param confirm Text (potentially unlocalized) of the confirm button.
     */
    displayMessage(message: string, confirm: string, icon?: string, fx?: string): Promise<void>;
    /**
     * Provides the ability to display a message with multiple choices.
     * @param message Message (potentially unlocalized) to be displayed.
     * @param choices Texts (potentially unlocalized) of choices.
     */
    displayChoices(message: string, choices: Array<[string, number]>, icon?: string): Promise<number>;
}

/**
 * Context needed to evaluate an `EventCondition`.
 */
export interface EventConditionEvaluationContext {
    readonly variableStore: VariableStore;
    readonly random: RandomSource;
    readonly evaluator: EventExpressionEvaluator;
}

/**
 * Represents a condition.
 * The implementation should be stateless and only storing necessary
 * definitions.
 */
export abstract class EventCondition {

    check(context: EventConditionEvaluationContext): boolean {
        throw new Error('Not implemented.');
    }

}

/**
 * Context needed to execute an `EventAction`.
 */
export interface EventActionExecutionContext extends EventConditionEvaluationContext {
    readonly inventory: Inventory;
    readonly statusTable: StatusTable;
    readonly eventEngine: GameEventEngine;
    readonly actionProxy: GuiActionProxy;
    setEndGameState(state: EndGameState): void;
}

export enum EventActionResult {
    /**
     * Indicates the execution of EventActions should continue normally.
     */
    Ok,
    /**
     * Execution of further EventActions in the current action list should be
     * aborted. The remaining EventActions in the current GameEvent but not in
     * the current action list may still run.
     */
    StopExecutionLocally,
    /**
     * Execution of all further EventActions in the current GameEvent should
     * be aborted.
     */
    StopExecutionGlobally,
}

const EMPTY_TRANSLATION_KEYS: ReadonlySet<string> = new Set();

/**
 * Represents an action.
 * The implementation should be stateless and only storing necessary
 * definitions.
 */
export abstract class EventAction {

    async execute(context: EventActionExecutionContext): Promise<EventActionResult> {
        throw new Error('Not implemented.');
    }

    // Collects all translation keys defined in this event action as a set.
    collectTranslationKeys(): ReadonlySet<string> {
        return EMPTY_TRANSLATION_KEYS;
    }

}

/**
 * Helper class to manage the execution of a fixed list of actions.
 */
export class EventActionList {

    constructor(private _actions: ReadonlyArray<EventAction>) {}

    get actions(): ReadonlyArray<EventAction> {
        return this._actions;
    }

    async execute(context: EventActionExecutionContext): Promise<EventActionResult> {
        for (let action of this._actions) {
            const result = await action.execute(context);
            if (result !== EventActionResult.Ok) {
                return result === EventActionResult.StopExecutionLocally
                    ? EventActionResult.Ok
                    : EventActionResult.StopExecutionGlobally;
            }
        }
        return EventActionResult.Ok;
    }

    // Collects all translation keys defined from the EventActions in this list.
    collectTranslationKeys(): ReadonlySet<string> {
        const builder = new SetBuilder<string>();
        for (let action of this._actions) {
            builder.addAll(action.collectTranslationKeys());
        }
        return builder.get();
    }

}

const EMPTY_EVENT_ACTION_LIST = new EventActionList([]);

/**
 * Represents a game event.
 * The implementation should be stateless and only contain necessary
 * definitions.
 */
export class GameEvent {
    
    constructor(private _id: string, private _trigger: string,
                private _conditions: EventCondition[] = [],
                private _actions: EventActionList = EMPTY_EVENT_ACTION_LIST,
                private _probability: number | CompiledEventExpression = 1.0,
                private _exclusions: string[] = [],
                private _once: boolean = false,
                private _disabledByDefault: boolean = false)
    {
    }
    /**
     * Unique identifier of this event.
     */
    get id(): string {
        return this._id;
    }
    /**
     * Trigger id.
     */
    get trigger(): string {
        return this._trigger;
    }
    /**
     * Conditions for this event.
     */
    get conditions(): EventCondition[] {
        return this._conditions;
    }
    /**
     * Actions for this event.
     */
    get actions(): EventActionList {
        return this._actions;
    }
    /**
     * Probability of executing the actions if all conditions are meet.
     */
    get probability(): number | CompiledEventExpression {
        return this._probability;
    }
    /**
     * Collection of event ids that are not allowed to be triggered under the
     * SAME trigger after successfully executing all actions of this event.
     */
    get exclusions(): string[] {
        return this._exclusions;
    }
    /**
     * Returns if this event only occurs once.
     */
    get once(): boolean {
        return this._once;
    }

    /**
     * Returns if this event is disable by default.
     */
    get disabledByDefault(): boolean {
        return this._disabledByDefault;
    }

    /**
     * Collects translation keys from all event actions
     */
    collectTranslationKeys(): ReadonlySet<string> {
        return this._actions.collectTranslationKeys();
    }
}

export interface EventOccurrenceTracker {
    /**
     * Returns the occurrence count of an event with the given `eventId`.
     */
    getEventOccurrenceCount(eventId: string): number;
}
