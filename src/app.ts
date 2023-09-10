import { GuiGameWindow } from './gui/guiGame';
import { LocalizationDictionary } from './i18n/localization';
import { GameEngine, GameConfig, GameActionProxy } from './gameEngine';
import { SimpleGameTextEngine } from './gui/textEngine';
import queryString from 'query-string';

interface AppConfig extends GameConfig {
    languageFileUrl: string;
}

class App {

    private _config: AppConfig;
    private _ldict = new LocalizationDictionary();
    private _gui: GuiGameWindow;
    private _gameEngine: GameEngine;

    constructor(container: HTMLElement, config: AppConfig) {
        this._config = Object.assign({}, config);
        this._ldict = new LocalizationDictionary();
        const ap = new GameActionProxy();
        this._gameEngine = new GameEngine(config, ap);
        const textEngine = new SimpleGameTextEngine(this._ldict, this._gameEngine.gameState);
        this._gui = new GuiGameWindow(container, textEngine, this._gameEngine);
        ap.attachGui(this._gui);       
    }

    async start(): Promise<void> {
        await this._ldict.loadFrom(this._config.languageFileUrl);
        this._gui.updateUIText();
        await this._gameEngine.start(false);
        const gameLoop = () => {
            setTimeout(() => this._gameEngine.step().then(gameLoop), 50);
        };
        gameLoop();
    }
}

let parsedHash = queryString.parse(window.location.hash || '');
let seed = parsedHash['init_seed'];

const app = new App(document.body, {
    initialRandomSeed: typeof seed === 'string' ? seed : undefined,
    languageFileUrl: 'rulesets/default/lang.yaml',
    itemDefinitionUrl: 'rulesets/default/items.yaml',
    statusDefinitionUrl: 'rulesets/default/status.yaml',
    eventDefinitionUrl: 'rulesets/default/events.yaml'
});
app.start().then(() => {
    console.log('App started successfully.');
});
