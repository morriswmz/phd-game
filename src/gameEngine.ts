import { GuiActionProxy } from './event/core';
import { GameState, EndGameState } from './gameState';
import { GuiGameWindow, GuiGame } from './gui/guiGame';
import { ItemRegistry, Inventory } from './effect/item';
import { GameEventEngine } from './event/engine';
import { EventExpressionEngine } from './event/expression';
import { EventActionFactory, EALog, EADisplayMessage, EADisplayRandomMessage, EADisplayChoices, EARandom, EACoinFlip, EAUpdateVariable, EAUpdateVariables, EAGiveItem, EAUpdateItemAmounts, EAEndGame, EASetStatus } from './event/actions';
import { EventConditionFactory, ECExpression } from './event/conditions';
import { GameEventLoader } from './event/loader';
import { StatusTable, StatusRegistry } from './effect/status';

export interface GameConfig {
    itemDefinitionUrl: string;
    statusDefinitionUrl: string;
    eventDefinitionUrl: string;
}

/**
 * Central class for the game.
 */
export class GameEngine {

    private _config: GameConfig;
    private _itemRegistry: ItemRegistry;
    private _statusRegistry: StatusRegistry;
    private _actionProxy: GuiActionProxy;
    private _gameState: GameState;
    private _expressionEngine: EventExpressionEngine;
    private _eventEngine: GameEventEngine;
    private _actionFactory: EventActionFactory;
    private _conditionFactory: EventConditionFactory;

    private _dataLoaded: boolean = false;

    constructor(config: GameConfig, ap: GuiActionProxy) {
        // Copy the configuration.
        this._config = Object.assign({}, config);
        this._actionProxy = ap;
        this._itemRegistry = new ItemRegistry();
        this._statusRegistry = new StatusRegistry();
        this._gameState = new GameState(this._itemRegistry, this._statusRegistry);
        this._expressionEngine = new EventExpressionEngine(this._gameState);
        this._eventEngine = new GameEventEngine(this._gameState, this._actionProxy, this._expressionEngine);
        this._actionFactory = new EventActionFactory(this._expressionEngine);
        this._conditionFactory = new EventConditionFactory(this._expressionEngine);
    }

    /**
     * Retrieves the game state.
     */
    get gameState(): GameState {
        return this._gameState;
    }

    /**
     * Retrieves the item registry.
     */
    get itemRegistry(): ItemRegistry {
        return this._itemRegistry;
    }

    /**
     * Retrieves the status registry.
     */
    get statusRegistry(): StatusRegistry {
        return this._statusRegistry;
    }

    /**
     * Retrieves the action proxy.
     */
    get actionProxy(): GuiActionProxy {
        return this._actionProxy;
    }

    /**
     * Loads game data.
     */
    async loadGameData(): Promise<void> {
        if (this._dataLoaded) return;
        this._initFactories();
        await this._itemRegistry.loadItems(this._config.itemDefinitionUrl);
        await this._statusRegistry.loadStatus(this._config.statusDefinitionUrl);
        const eventLoader = new GameEventLoader(this._expressionEngine, this._conditionFactory, this._actionFactory);
        const events = await eventLoader.load(this._config.eventDefinitionUrl);
        this._eventEngine.registerEvents(events);
        this._dataLoaded = true;
    }

    private _initFactories(): void {
        // Event factory
        this._actionFactory.registerDeserializer(EALog);
        this._actionFactory.registerDeserializer(EADisplayMessage);
        this._actionFactory.registerDeserializer(EADisplayRandomMessage);
        this._actionFactory.registerDeserializer(EADisplayChoices);
        this._actionFactory.registerDeserializer(EARandom);
        this._actionFactory.registerDeserializer(EACoinFlip);
        this._actionFactory.registerDeserializer(EAUpdateVariable);
        this._actionFactory.registerDeserializer(EAUpdateVariables);
        this._actionFactory.registerDeserializer(EAGiveItem);
        this._actionFactory.registerDeserializer(EAUpdateItemAmounts);
        this._actionFactory.registerDeserializer(EAEndGame);
        this._actionFactory.registerDeserializer(EASetStatus);
        // Condition factory
        this._conditionFactory.registerDeserializer(ECExpression);
    }

    /**
     * Starts (or restarts) the game.
     */
    async start(): Promise<void> {
        if (!this._dataLoaded) {
            await this.loadGameData();
        }
        this._gameState.reset();
        this._gameState.setVar('month', 1);
        this._gameState.setVar('year', 1);
        this._gameState.setVar('player.hope', 50);
        this._gameState.setVarLimits('player.hope', 0, 100);
        this._eventEngine.enableAll();
        await this._eventEngine.trigger('Initialization');
    }

    /**
     * Advance one step.
     */
    async step(): Promise<void> {
        if (this._gameState.endGameState !== EndGameState.None) {
            // Restart the game
            await this.start();
            return;
        }
        await this._eventEngine.trigger('MonthBegin');
        let month = this._gameState.getVar('month', true) + 1;
        let year = this._gameState.getVar('year', true);
        if (month === 13) {
            month = 1;
            ++year;
            this._gameState.setVar('year', year);
            await this._eventEngine.trigger('YearBegin');
        }
        this._gameState.setVar('month', month);
        this._gameState.playerStatus.tick();
    }
    
}

export class GameActionProxy implements GuiActionProxy {

    private _guiGame: GuiGame | undefined;

    attachGui(gui: GuiGame): void {
        this._guiGame = gui;
    }

    displayMessage(message: string, confirm: string, icon?: string, fx?: string): Promise<void> {
        if (!this._guiGame) throw new Error('No attached GUI.');
        return this._guiGame.displayMessage(message, confirm, icon, fx);
    }

    displayChoices(message: string, choices: Array<[string, number]>, icon?: string): Promise<number> {
        if (!this._guiGame) throw new Error('No attached GUI.');
        return this._guiGame.displayChoices(message, choices, icon);
    }

}
