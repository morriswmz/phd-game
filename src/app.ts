import { GuiGameWindow } from './gui/guiGame';
import { LocalizationDictionary } from './i18n/localization';
import { GameEngine, GameConfig, GameActionProxy } from './gameEngine';

interface AppConfig extends GameConfig {
    languageFileUrl: string;
}

class App {

    private _config: AppConfig;
    private _ldict = new LocalizationDictionary();
    private _gui: GuiGameWindow;
    private _gameEngine: GameEngine;

    constructor(container: HTMLDivElement, config: AppConfig) {
        this._config = Object.assign({}, config);
        this._ldict = new LocalizationDictionary();
        const ap = new GameActionProxy();
        this._gameEngine = new GameEngine(config, ap);             
        this._gui = new GuiGameWindow(container, this._ldict, this._gameEngine);
        ap.attachGui(this._gui);       
    }

    async start(): Promise<void> {
        await this._ldict.loadFrom(this._config.languageFileUrl);
        await this._gameEngine.start();
        const gameLoop = () => {
            setTimeout(() => this._gameEngine.step().then(gameLoop), 50);
        };
        gameLoop();
    }
}

let container = document.getElementById('game_window');
if (container) {
    const app = new App(<HTMLDivElement>container, {
        languageFileUrl: 'rulesets/default/lang.yaml',
        itemDefinitionUrl: 'rulesets/default/items.yaml',
        statusDefinitionUrl: 'rulesets/default/status.yaml',
        eventDefinitionUrl: 'rulesets/default/events.yaml'
    });
    app.start().then(() => {
        console.log('App started successfully.');
    });
}

