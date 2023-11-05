import { GameEvent, EventActionExecutionContext, EventOccurrenceTracker, EventActionResult } from './core';
import { PriorityQueue } from '../utils/priorityQueue';

interface GameEventInfo {
    event: GameEvent;
    disabled: boolean;
    occurrenceCount: number;
}

interface PendingTrigger {
    id: string;
    priority: number;
    order: number;
    probability: number;
}

function comparePendingTrigger(a: PendingTrigger, b: PendingTrigger): boolean {
    if (a.priority !== b.priority) return a.priority < b.priority;
    if (a.order !== b.order) return a.order > b.order;
    return a.id < b.id;
}

export class GameEventEngine implements EventOccurrenceTracker {

    private _eventsByTrigger: Map<string, GameEvent[]> = new Map();
    // id => (GameEvent, disabled)
    private _eventInfoById: Map<string, GameEventInfo> = new Map();
    private _pendingTriggers: PriorityQueue<PendingTrigger> =
        new PriorityQueue(comparePendingTrigger);
    private _pendingTriggerOrder: number = 0;
    // Event actions and condition have access to the same expression evaluator.
    private _ongoingTrigger: string | null = null;

    constructor() {}

    /**
     * Enables the game event of the given `eventId`.
     * Throws an error if the given `eventId` does not exist.
     */
    enableEvent(eventId: string): void {
        let info = this._eventInfoById.get(eventId);
        if (info == undefined) {
            throw new Error(`Event "${eventId}" does not exist.`);
        }
        info.disabled = false;
    }

    /**
     * Disables the game event of the given `eventId`.
     * Throws an error if the given `eventId` does not exist.
     */
    disableEvent(eventId: string): void {
        let info = this._eventInfoById.get(eventId);
        if (info == undefined) {
            throw new Error(`Event "${eventId}" does not exist.`);
        }
        info.disabled = true;
    }

    registerEvents(events: GameEvent[]): void {
        for (let e of events) {
            this.registerEvent(e);
        }
    }

    registerEvent(e: GameEvent): void {
        if (this._eventInfoById.has(e.id)) {
            throw new Error(`Event "${e.id}" is already registered.`);
        }
        this._eventInfoById.set(e.id, {
            event: e,
            disabled: e.disabledByDefault,
            occurrenceCount: 0
        });
        let existingEvents = this._eventsByTrigger.get(e.trigger);
        if (existingEvents == undefined) {
            this._eventsByTrigger.set(e.trigger, [e]);
        } else {
            existingEvents.push(e);
        }
    }

    unregisterEvent(e: GameEvent): void {
        if (!this._eventInfoById.has(e.id)) return;
        this._eventInfoById.delete(e.id);
        let existingEvents = this._eventsByTrigger.get(e.trigger);
        if (existingEvents != undefined) {
            const index = existingEvents.indexOf(e);
            if (index >= 0) {
                existingEvents.splice(index, 1);
                if (existingEvents.length === 0) {
                    this._eventsByTrigger.delete(e.trigger);
                }
                return;
            }
        }
        throw new Error('Invariance broken: event has info entry but not registered under any trigger id.');
    }

    getEvents(): GameEvent[] {
        let events: GameEvent[] = [];
        for (let info of this._eventInfoById.values()) {
            events.push(info.event);
        }
        return events;
    }

    getEventOccurrenceCount(eventId: string): number {
        const info = this._eventInfoById.get(eventId);
        return info == undefined ? 0 : info.occurrenceCount;
    }

    /**
     * Triggers events with the given trigger id.
     * NOTE: This method simply pushes the given trigger into the queue, which
     * won't be processed until `processNextTrigger()` is called.
     * @param triggerId Trigger id.
     * @param probability Probability of triggering.
     * @param priority Priority.
     */
    trigger(triggerId: string, probability: number, priority: number): void {
        if (triggerId.length === 0) {
            throw new Error('Trigger id cannot be empty.');
        }
        this._pendingTriggers.push({
            'id': triggerId,
            'priority': priority,
            'order': this._pendingTriggerOrder++,
            'probability': probability
        });
    }

    /**
     * Processes the next trigger in the queue using the given `context`.
     * 
     * NOTE: Recursive `processNextTrigger()` calls are not supported.
     * 
     * Returns `true` if there are still pending triggers in the queue.
     * Otherwise returns `false`.
     */
    async processNextTrigger(context: EventActionExecutionContext): Promise<boolean> {
        // Check if we need to process the next trigger first
        if (this._pendingTriggers.empty()) return false;
        const pendingTrigger = this._pendingTriggers.pop();
        if (pendingTrigger.probability <= 0 || (
            pendingTrigger.probability < 1 &&
            context.random.next() > pendingTrigger.probability)) {
            return !this._pendingTriggers.empty();
        }
        // Actual processing
        if (this._ongoingTrigger != null) {
            throw new Error(`Cannot process the next trigger when the ongoing trigger "${this._ongoingTrigger}" is still being processed.`);
        }
        const triggerId = pendingTrigger.id;
        this._ongoingTrigger = triggerId;
        const events = this._eventsByTrigger.get(triggerId);
        if (events == undefined) return !this._pendingTriggers.empty();
        let exclusions: { [key: string]: boolean; } = {};
        for (let e of events) {
            const info = this._eventInfoById.get(e.id) as GameEventInfo;
            // Skip disabled events.
            if (info.disabled) continue;
            // Skip mutually exclusive events.
            if (exclusions[e.id]) continue;
            // Check all the conditions.
            let skip = false;
            for (let c of e.conditions) {
                if (!c.check(context)) {
                    skip = true;
                    break;
                }
            }
            if (skip) continue;
            // Randomness
            const p = typeof e.probability === 'number'
                ? e.probability
                : context.evaluator.eval(e.probability);
            if (p <= 0 || (p < 1 && context.random.next() > p)) {
                continue;
            }
            // Add exclusions
            for (let ex of e.exclusions) {
                exclusions[ex] = true;
            }
            // Mark as occurred
            ++info.occurrenceCount;
            // Execute actions
            const result = await e.actions.execute(context);
            // Once
            if (e.once) {
                info.disabled = true;
            }
            // Check end condition
            if (result === EventActionResult.StopExecutionGlobally) break;
        }
        this._ongoingTrigger = null;
        return !this._pendingTriggers.empty();
    }

    /**
     * Resets each game event's state (e.g., disabled/enabled) as well as
     * pending triggers.
     */
    reset(): void {
        if (this._ongoingTrigger != null) {
            throw new Error(`Cannot reset the engine when the ongoing trigger "${this._ongoingTrigger}" is still being processed.`);
        }
        for (let info of this._eventInfoById.values()) {
            info.disabled = info.event.disabledByDefault;
            info.occurrenceCount = 0;
        }
        this._pendingTriggers.clear();
        this._pendingTriggerOrder = 0;
    }

}
