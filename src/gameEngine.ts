import { GuiActionProxy } from './event/core';
import { GameState, EndGameState } from './gameState';
import { GuiGameWindow, GuiGame } from './gui/guiGame';
import { ItemRegistry, Inventory } from './effect/item';
import { GameEventEngine } from './event/engine';
import { EventExpressionEngine } from './event/expression';
import { EventActionFactory, EALog, EADisplayMessage, EADisplayRandomMessage, EADisplayChoices, EARandom, EACoinFlip, EAUpdateVariable, EAUpdateVariables, EAGiveItem, EAUpdateItemAmounts, EAEndGame, EASetStatus, EASwitch, EAUpdateVariableLimits, EATriggerEvents, EALoop } from './event/actions';
import { EventConditionFactory, ECExpression, ECAll, ECAny, ECSome, ECNot } from './event/conditions';
import { GameEventLoader } from './event/loader';
import { StatusTable, StatusRegistry } from './effect/status';

export interface GameConfig {
    initialRandomSeed?: string;
    itemDefinitionUrl?: string;
    statusDefinitionUrl?: string;
    eventDefinitionUrl?: string;
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
        this._gameState = new GameState(this._itemRegistry,
                                        this._statusRegistry,
                                        this._config.initialRandomSeed);
        this._expressionEngine = new EventExpressionEngine(this._gameState);
        this._eventEngine = new GameEventEngine(this._gameState,
                                                this._actionProxy,
                                                this._expressionEngine);
        this._conditionFactory = 
            new EventConditionFactory(this._expressionEngine);
        this._actionFactory = new EventActionFactory(this._conditionFactory,
                                                     this._expressionEngine);
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
     * Retrieves the expression engine.
     */
    get expressionEngine(): EventExpressionEngine {
        return this._expressionEngine;
    }

    /**
     * Retrieves the event engine.
     */
    get eventEngine(): GameEventEngine {
        return this._eventEngine;
    }

    /**
     * Loads game data.
     */
    async loadGameData(): Promise<void> {
        if (this._dataLoaded) return;
        this._initFactories();
        if (this._config.itemDefinitionUrl) {
            await this._itemRegistry.loadItems(this._config.itemDefinitionUrl);
        } else {
            console.warn('Missing item definitions. No items loaded.');
        }
        if (this._config.statusDefinitionUrl) {
            await this._statusRegistry.loadStatus(
                this._config.statusDefinitionUrl);
        } else {
            console.warn('Missing status definitions. No status loaded.');
        }
        const eventLoader = new GameEventLoader(this._expressionEngine,
                                                this._conditionFactory,
                                                this._actionFactory);
        if (this._config.eventDefinitionUrl) {
            const events = await eventLoader.load(
                this._config.eventDefinitionUrl);
            this._eventEngine.registerEvents(events);
            console.log(
                `Successfully registered ${events.length} game events.`);
        } else {
            console.warn('Missing event definitions. No events loaded.');
        }
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
        this._actionFactory.registerDeserializer(EAUpdateVariableLimits);
        this._actionFactory.registerDeserializer(EAGiveItem);
        this._actionFactory.registerDeserializer(EAUpdateItemAmounts);
        this._actionFactory.registerDeserializer(EAEndGame);
        this._actionFactory.registerDeserializer(EASetStatus);
        this._actionFactory.registerDeserializer(EASwitch);
        this._actionFactory.registerDeserializer(EALoop);
        this._actionFactory.registerDeserializer(EATriggerEvents);
        // Condition factory
        this._conditionFactory.registerDeserializer(ECExpression);
        this._conditionFactory.registerDeserializer(ECNot);
        this._conditionFactory.registerDeserializer(ECAll);
        this._conditionFactory.registerDeserializer(ECAny);
        this._conditionFactory.registerDeserializer(ECSome);
    }

    /**
     * Starts (or restarts) the game.
     */
    async start(newRandomSeed: boolean): Promise<void> {
        if (!this._dataLoaded) {
            await this.loadGameData();
        }
        this._gameState.reset(newRandomSeed);
        this._eventEngine.enableAll();
        await this._eventEngine.trigger('Initialization');
    }

    /**
     * Advances one game tick.
     */
    async tick(): Promise<void> {
        let endGameState = this._gameState.endGameState;
        if (endGameState !== EndGameState.None) {
            // Restart the game
            await this.start(endGameState === EndGameState.Winning);
            return;
        }
        this._gameState.playerStatus.tick();
        await this._eventEngine.trigger('Tick');
        while (this._gameState.hasPendingTrigger()) {
            const [id, probability] = this._gameState.popPendingTrigger();
            if (probability <= 0) continue;
            if (probability < 1 &&
                this._gameState.nextRandomNumber() > probability) {
                continue;
            }
            await this._eventEngine.trigger(id);
        }
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
