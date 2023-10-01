import { load as loadYaml } from 'js-yaml';
import queryString from 'query-string';

import { GuiGameWindow, GuiGameWindowDefinition } from './gui/guiGame';
import { LocalizationDictionary } from './i18n/localization';
import { GameEngine, GameConfig, GameActionProxy } from './gameEngine';
import { SimpleGameTextEngine } from './gui/textEngine';
import { downloadAndParse } from './utils/network';

interface AppConfig extends GameConfig {
    guiDefinitionUrl?: string;
    languageFileUrl?: string;
}

class App {

    private _config: AppConfig;
    private _container: HTMLElement;
    private _gameEngine: GameEngine;
    private _actionProxy: GameActionProxy;
    private _gui?: GuiGameWindow;
    private _started: boolean = false;

    constructor(container: HTMLElement, config: AppConfig) {
        this._config = Object.assign({}, config);
        this._container = container;
        this._actionProxy = new GameActionProxy();
        this._gameEngine = new GameEngine(config, this._actionProxy);
    }

    async start(): Promise<void> {
        if (this._started) {
            throw new Error('App already started!');
        }
        // The language file needs to be loaded first before rendering the game
        // GUI.
        let ldict = new LocalizationDictionary();
        if (this._config.languageFileUrl) {
            await ldict.loadFrom(this._config.languageFileUrl);
        } else {
            console.warn('Missing language file!');
        }
        const textEngine = new SimpleGameTextEngine(ldict,
                                                    this._gameEngine.gameState);
        if (!this._config.guiDefinitionUrl) {
            throw new Error('Missing GUI config file!');
        }
        let guiDef = await <GuiGameWindowDefinition>downloadAndParse(
            this._config.guiDefinitionUrl, loadYaml);
        let gui = new GuiGameWindow(this._container, textEngine,
                                    this._gameEngine, guiDef);
        this._actionProxy.attachGui(gui);       
        gui.updateUIText();
        await this._gameEngine.start(false);
        const gameLoop = () => {
            setTimeout(() => this._gameEngine.tick().then(gameLoop), 50);
        };
        gameLoop();
        this._started = true;
    }
}

let appConfig: AppConfig = {};
let appConfigJson = document.getElementById('app_config')?.textContent;
if (appConfigJson) {
    appConfig = {...JSON.parse(appConfigJson)};
}
let parsedHash = queryString.parse(window.location.hash || '');
let seed = parsedHash['init_seed'];
if (typeof seed === 'string') {
    appConfig['initialRandomSeed'] = seed;
}

const app = new App(document.body, appConfig);
app.start().then(() => {
    console.log('App started successfully.');
});
