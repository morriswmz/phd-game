import { GameEvent, GuiActionProxy, EventAction } from './core';
import { GameState, EndGameState } from '../gameState';
import { EventExpressionEngine } from './expression';

export class GameEventEngine {

    private _events: { [key: string]: GameEvent[]; } = {};
    // id => (GameEvent, disabled)
    private _eventIdMap: { [key: string]: [GameEvent, boolean]; } = {};
    private _gameState: GameState;
    private _actionProxy: GuiActionProxy;
    // Event actions and condition have access to the same expression evaluator.
    private _exprEngine: EventExpressionEngine;

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
     */
    async trigger(t: string): Promise<void> {
        if (t.length === 0) throw new Error('Trigger id cannot be empty.');
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
                this._eventIdMap[e.id][1] = true;
            }
        }
    }

    async executeActions(actions: EventAction[]): Promise<boolean> {
        for (let a of actions) {
            await a.execute(this._gameState, this._actionProxy, this._exprEngine);
            if (this.onActionExecuted) this.onActionExecuted(this._gameState);
            if (this._gameState.endGameState !== EndGameState.None) {
                // Stop processing further actions or events
                return true;
            }
        }
        return false;
    }

}
