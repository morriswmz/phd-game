import { EventActionExecutionContext, GuiActionProxy } from './event/core';
import { VariableStore } from './variableStore';
import { GuiGame } from './gui/guiGame';
import { Inventory, ItemRegistry } from './effect/item';
import { GameEventEngine } from './event/engine';
import { EventExpressionEngine } from './event/expression';
import { EventActionFactory, EALog, EADisplayMessage, EADisplayRandomMessage, EADisplayChoices, EARandom, EACoinFlip, EAUpdateVariable, EAUpdateVariables, EAGiveItem, EAUpdateItemAmounts, EAEndGame, EASetStatus, EASwitch, EAUpdateVariableLimits, EATriggerEvents, EALoop, EAEnableEvents, EADisableEvents } from './event/actions';
import { EventConditionFactory, ECExpression, ECAll, ECAny, ECSome, ECNot } from './event/conditions';
import { GameEventLoader } from './event/loader';
import { StatusRegistry, StatusTable } from './effect/status';
import { AleaRandomSource, RandomSource } from './utils/random';
import { EndGameState } from './endGameState';
import { AttributeRegistry } from './effect/attribute';

export interface GameConfig {
    initialRandomSeed?: string;
    attributeDefinitionUrl?: string;
    itemDefinitionUrl?: string;
    statusDefinitionUrl?: string;
    eventDefinitionUrl?: string;
}

function newSeedFromNativeRandom(): string {
    return Math.random().toString().substring(2);
}

export class GameEndEvent {
    constructor(public readonly state: EndGameState,
                public readonly endingType: string) { }
}

type GameEndedEventHandler = (sender: GameEngine, event: GameEndEvent) => void;

/**
 * Central class for the game.
 */
export class GameEngine {

    private _config: GameConfig;
    private _actionProxy: GuiActionProxy;
    private _attributeRegistry: AttributeRegistry;
    private _itemRegistry: ItemRegistry;
    private _statusRegistry: StatusRegistry;
    private _inventory: Inventory;
    private _statusTable: StatusTable;
    private _variableStore: VariableStore;
    private _endGameState: EndGameState;
    private _endingType: string;
    private _random: AleaRandomSource;
    private _expressionEngine: EventExpressionEngine;
    private _eventEngine: GameEventEngine;
    private _actionFactory: EventActionFactory;
    private _conditionFactory: EventConditionFactory;
    private _executionContext: EventActionExecutionContext;

    private _dataLoaded: boolean = false;

    /**
     * Gets/sets the callback when the game ends.
     */
    onGameEnd?: GameEndedEventHandler;

    constructor(config: GameConfig, ap: GuiActionProxy) {
        // Copy the configuration.
        this._config = Object.assign({}, config);
        this._actionProxy = ap;
        this._attributeRegistry = new AttributeRegistry();
        this._itemRegistry = new ItemRegistry(this._attributeRegistry);
        this._statusRegistry = new StatusRegistry(this._attributeRegistry);
        this._inventory = new Inventory(this._itemRegistry);
        this._statusTable = new StatusTable(this._statusRegistry);
        this._variableStore = new VariableStore();
        this._endGameState = EndGameState.None;
        this._endingType = '';
        this._random = new AleaRandomSource(
            this._config.initialRandomSeed == undefined
                ? newSeedFromNativeRandom()
                : this._config.initialRandomSeed
        );
        this._eventEngine = new GameEventEngine();
        this._expressionEngine = new EventExpressionEngine(
            this._variableStore, this._attributeRegistry, this._inventory,
            this._statusTable, this._random, this._eventEngine);
        this._conditionFactory = 
            new EventConditionFactory(this._expressionEngine);
        this._actionFactory = new EventActionFactory(this._conditionFactory,
                                                     this._expressionEngine);
        this._executionContext = {
            variableStore: this._variableStore,
            inventory: this._inventory,
            statusTable: this._statusTable,
            random: this._random,
            evaluator: this._expressionEngine,
            eventEngine: this._eventEngine,
            actionProxy: ap,
            setEndGameState: (state, endingType) => {
                this._endGameState = state
                if (endingType) {
                    this._endingType = endingType;
                }
            },
        };
    }

    /**
     * Retrieves the variable store.
     */
    get variableStore(): VariableStore {
        return this._variableStore;
    }

    /**
     * Retrieves the random source.
     */
    get random(): RandomSource {
        return this._random;
    }
    
    /**
     * Retrieves the attribute registry.
     */
    get attributeRegistry(): AttributeRegistry {
        return this._attributeRegistry;
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
     * Retrieves the inventory of the current game.
     */
    get inventory(): Inventory {
        return this._inventory;
    }

    /**
     * Retrieves the status table of the current game.
     */
    get statusTable(): StatusTable {
        return this._statusTable;
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
        if (this._config.attributeDefinitionUrl) {
            await this._attributeRegistry.loadAttributes(
                this._config.attributeDefinitionUrl);
        } else {
            console.warn('Missing attribute definitions. No attributes loaded.');
        }
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
        this._actionFactory.registerDeserializer(EAEnableEvents);
        this._actionFactory.registerDeserializer(EADisableEvents);
        // Condition factory
        this._conditionFactory.registerDeserializer(ECExpression);
        this._conditionFactory.registerDeserializer(ECNot);
        this._conditionFactory.registerDeserializer(ECAll);
        this._conditionFactory.registerDeserializer(ECAny);
        this._conditionFactory.registerDeserializer(ECSome);
    }

    /**
     * Starts (or restarts) the game.
     * 
     * @param newRandomSeed If true will generate a new random seed and use the
     * new seed to reset the random number generator. Otherwise the existing
     * random seed will be used to reset the random number generator.
     */
    async start(newRandomSeed: boolean): Promise<void> {
        if (!this._dataLoaded) {
            await this.loadGameData();
        }
        this._variableStore.reset();
        this._inventory.clear();
        this._statusTable.clear();
        this._endGameState = EndGameState.None;
        if (newRandomSeed) {
            this._random.reset(newSeedFromNativeRandom());
        } else {
            this._random.reset();
        }
        this._eventEngine.reset();
        this._eventEngine.trigger('Initialization', 1.0, 0);
    }

    /**
     * Advances one game tick.
     */
    async tick(): Promise<void> {
        this._eventEngine.trigger('Tick', 1.0, 0);
        while (true) {
            const pending = await this._eventEngine.processNextTrigger(
                this._executionContext);
            if (this._endGameState !== EndGameState.None) {
                // Restart the game
                if (this.onGameEnd) {
                    this.onGameEnd(
                        this,
                        new GameEndEvent(this._endGameState, this._endingType)
                    );
                }
                await this.start(this._endGameState === EndGameState.Win);
                return;
            } else if (!pending) {
                break;
            }
        }
        this._statusTable.tick();
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
