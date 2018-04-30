import { GameEventEngine } from './event/engine';
import { GameEvent, ActionProxy } from './event/core';
import { EALog, EventActionFactory, EADisplayMessage, EADisplayChoices, EARandom, EAUpdateVariable, EAGiveItem, EADisplayRandomMessage, EAUpdateItemAmounts, EACoinFlip, EAEndGame } from './event/actions';
import { GameStateBase, EndGameState } from './gameState';
import { GuiGame } from './gui/guiGame';
import { EventConditionFactory, ECExpression } from './event/conditions';
import { LocalizationDictionary } from './i18n/localization';
import { GameActionProxy } from './gameEngine';
import { FunctionTable, compileExpression } from './utils/expression';
import { GameEventLoader } from './event/loader';
import { EffectProviderRegistry } from './effect/effect';
import { Item, Inventory, ItemRegistry } from './effect/item';
import { EventExpressionEngine } from './event/expression';

class App {

    private _itemRegistry = new ItemRegistry();
    private _events: GameEvent[] = [];
    private _dataLoaded: boolean = false;
    private _gameState: GameStateBase;
    private _ldict = new LocalizationDictionary();
    private _gui: GuiGame;
    private _actionProxy: ActionProxy;
    private _expressionEngine: EventExpressionEngine;
    private _eventEngine: GameEventEngine;
    private _conditionFactory: EventConditionFactory;
    private _actionFactory: EventActionFactory;
    private _eventLoader: GameEventLoader;

    constructor(container: HTMLDivElement) {
        this._ldict = new LocalizationDictionary();
        this._gui = new GuiGame(container, this._ldict);
        this._gameState = new GameStateBase(new Inventory(this._itemRegistry));        
        this._actionProxy = new GameActionProxy(this._gameState, this._gui);
        this._expressionEngine = new EventExpressionEngine(this._gameState);
        this._conditionFactory = new EventConditionFactory(this._expressionEngine);
        this._actionFactory = new EventActionFactory(this._expressionEngine);
        this._eventLoader = new GameEventLoader(this._conditionFactory, this._actionFactory);
        this._eventEngine = new GameEventEngine(this._gameState, this._actionProxy, this._expressionEngine);
    }

    async loadData(): Promise<void> {
        await this._itemRegistry.loadItems('rulesets/default/items.yaml');
        await this._ldict.loadFrom('rulesets/default/lang.yaml');

        this._actionFactory.registerDeserializer(EALog.Id, EALog.fromJSONObject);
        this._actionFactory.registerDeserializer(EADisplayMessage.Id, EADisplayMessage.fromJSONObject);
        this._actionFactory.registerDeserializer(EADisplayRandomMessage.Id, EADisplayRandomMessage.fromJSONObject);
        this._actionFactory.registerDeserializer(EADisplayChoices.Id, EADisplayChoices.fromJSONObject);
        this._actionFactory.registerDeserializer(EARandom.Id, EARandom.fromJSONObject);
        this._actionFactory.registerDeserializer(EACoinFlip.Id, EACoinFlip.fromJSONObject);
        this._actionFactory.registerDeserializer(EAUpdateVariable.Id, EAUpdateVariable.fromJSONObject);
        this._actionFactory.registerDeserializer(EAGiveItem.Id, EAGiveItem.fromJSONObject);
        this._actionFactory.registerDeserializer(EAUpdateItemAmounts.Id, EAUpdateItemAmounts.fromJSONObject);
        this._actionFactory.registerDeserializer(EAEndGame.Id, EAEndGame.fromJSONObject);

        this._conditionFactory.registerDeserializer(ECExpression.Id, ECExpression.fromJSONObject);

        this._events = await this._eventLoader.load('rulesets/default/events.yaml');
        this._eventEngine.registerEvents(this._events);

        this._dataLoaded = true;
    }


    async start(): Promise<void> {
        if (!this._dataLoaded) {
            await this.loadData();
        }
        this._gameState.reset();
        this._eventEngine.enableAll();
        
        this._gui.update(this._gameState);

        this._eventEngine.onActionExecuted = gs => this._gui.update(gs);
    }

    async step(): Promise<void> {
        if (this._gameState.endGameState !== EndGameState.None) {
            // Restart the game
            await this.start();
            return;
        }
        await this._eventEngine.trigger('MonthBegin')
        this._gameState.variables.month++;
        await this._eventEngine.trigger('MonthEnd');

        if (this._gameState.variables.month == 12) {
            await this._eventEngine.trigger('YearEnd');
            this._gameState.variables.month = 0;
            this._gameState.variables.year++;
            await this._eventEngine.trigger('YearBegin');
        }
        this._gui.update(this._gameState);
    }
}
let container = document.getElementById('game_window');
if (container) {
    const app = new App(<HTMLDivElement>container);
    app.start().then(() => {
        console.log('App started successfully.');
        const gameLoop = () => {
            setTimeout(() => app.step().then(gameLoop), 50);
        }
        gameLoop();
    });
}

