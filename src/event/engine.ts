import { GameEvent, GuiActionProxy } from './core';
import { GameState, EndGameState } from '../gameState';
import { EventExpressionEvaluator, EventExpressionEngine } from './expression';

export class GameEventEngine {

    private _events: { [key: string]: GameEvent[]; } = {};
    // id => (GameEvent, disabled)
    private _eventIdMap: { [key: string]: [GameEvent, boolean]; } = {};
    private _gameState: GameState;
    private _actionProxy: GuiActionProxy;
    // Event actions and condition have access to the same expression evaluator.
    private _exprEngine: EventExpressionEvaluator;

    constructor(gs: GameState, ap: GuiActionProxy, exprEngine: EventExpressionEngine) {
        this._gameState = gs;
        this._actionProxy = ap;
        this._exprEngine = exprEngine;
    }

    public onActionExecuted: ((gs: GameState) => void ) | undefined = undefined;
    
    enableAll(): void {
        for (let id in this._eventIdMap) {
            this._eventIdMap[id][1] = false;
        }
    }

    registerEvents(events: GameEvent[]): void {
        for (let e of events) {
            this.registerEvent(e);
        }
    }

    registerEvent(e: GameEvent): void {
        if (this._eventIdMap[e.id]) {
            throw new Error(`Event "${e.id}" is already registered.`);
        }
        if (!this._events[e.trigger]) {
            this._events[e.trigger] = [];
        }
        this._events[e.trigger].push(e);
        this._eventIdMap[e.id] = [e, false];
    }

    unregisterEvent(e: GameEvent): void {
        if (!this._eventIdMap[e.id]) return;
        this._events[e.trigger].splice(this._events[e.trigger].indexOf(e), 1);
        delete this._eventIdMap[e.id];
    }

    /**
     * Triggers events.
     * @param t Trigger id.
     * @param callback Callback function that will be called after the execution
     * of every action.
     */
    async trigger(t: string): Promise<void> {
        const events = this._events[t];
        if (!events) return;
        let exclusions: { [key: string]: boolean; } = {};
        let gameEnded = false;
        for (let e of events) {
            if (gameEnded) break;
            // Skip disabled events.
            if (this._eventIdMap[e.id][1]) continue;
            // Skip mutually exclusive events.
            if (exclusions[e.id]) continue;
            // Check all the conditions.
            let skip = false;
            for (let c of e.conditions) {
                if (!c.check(this._gameState, this._exprEngine)) {
                    skip = true;
                    break;
                }
            }
            if (skip) continue;
            // Randomness
            if (Math.random() > e.probability) continue;
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
            for (let a of e.actions) {
                await a.execute(this._gameState, this._actionProxy, this._exprEngine);
                if (this.onActionExecuted) this.onActionExecuted(this._gameState);
                if (this._gameState.endGameState !== EndGameState.None) {
                    // Stop processing further actions or events
                    gameEnded = true;
                    break;
                }
            }
            // Once
            if (e.once) {
                this._eventIdMap[e.id][1] = true;
            }
        }
    }

}
