import { GameEvent, GuiActionProxy, EventAction, EventActionExecutionContext } from './core';
import { GameState, EndGameState } from '../gameState';
import { EventExpressionEngine } from './expression';

interface GameEventInfo {
    event: GameEvent;
    disabled: boolean;
}

export class GameEventEngine {

    private _eventsByTrigger: Map<string, GameEvent[]> = new Map();
    // id => (GameEvent, disabled)
    private _eventInfoById: Map<string, GameEventInfo> = new Map();
    private _gameState: GameState;
    private _actionProxy: GuiActionProxy;
    // Event actions and condition have access to the same expression evaluator.
    private _exprEngine: EventExpressionEngine;
    private _executionContext: EventActionExecutionContext;

    constructor(gameState: GameState, actionProxy: GuiActionProxy,
                expressionEngine: EventExpressionEngine) {
        this._gameState = gameState;
        this._actionProxy = actionProxy;
        this._exprEngine = expressionEngine;
        this._executionContext = {
            gameState: gameState,
            actionProxy: actionProxy,
            evaluator: expressionEngine
        };
    }

    public onActionExecuted: ((gs: GameState) => void ) | undefined = undefined;
    
    enableAll(): void {
        for (let info of this._eventInfoById.values()) {
            info.disabled = false;
        }
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
            disabled: false
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

    /**
     * Triggers events.
     * @param t Trigger id.
     */
    async trigger(t: string): Promise<void> {
        if (t.length === 0) throw new Error('Trigger id cannot be empty.');
        const events = this._eventsByTrigger.get(t);
        if (events == undefined) return;
        let exclusions: { [key: string]: boolean; } = {};
        let gameEnded = false;
        for (let e of events) {
            if (gameEnded) break;
            let info = this._eventInfoById.get(e.id) as GameEventInfo;
            // Skip disabled events.
            if (info.disabled) continue;
            // Skip mutually exclusive events.
            if (exclusions[e.id]) continue;
            // Check all the conditions.
            let skip = false;
            for (let c of e.conditions) {
                if (!c.check(this._executionContext)) {
                    skip = true;
                    break;
                }
            }
            if (skip) continue;
            // Randomness
            const p = typeof e.probability === 'number'
                ? e.probability
                : this._exprEngine.eval(e.probability);
            if (p <= 0 || (p < 1 && this._gameState.nextRandomNumber() > p)) {
                continue;
            }
            // Add exclusions
            for (let ex of e.exclusions) {
                exclusions[ex] = true;
            }
            // Mark as occurred
            if (this._gameState.occurredEvents[e.id] == undefined)
            {
                this._gameState.occurredEvents[e.id] = 0;
            }
            ++this._gameState.occurredEvents[e.id];
            // Execute actions
            gameEnded = await this.executeActions(e.actions);
            // Once
            if (e.once) {
                info.disabled = true;
            }
        }
    }

    async executeActions(actions: EventAction[]): Promise<boolean> {
        for (let a of actions) {
            await a.execute(this._executionContext);
            if (this.onActionExecuted) this.onActionExecuted(this._gameState);
            if (this._gameState.endGameState !== EndGameState.None) {
                // Stop processing further actions or events
                return true;
            }
        }
        return false;
    }

}
