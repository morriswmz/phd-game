import { load as loadYaml } from 'js-yaml';
import queryString from 'query-string';

import { GuiGameWindow, GuiGameWindowDefinition } from './gui/guiGame';
import { LocalizationDictionary } from './i18n/localization';
import { GameEngine, GameConfig, GameActionProxy } from './gameEngine';
import { SimpleGameTextEngine } from './gui/textEngine';
import { downloadAndParse } from './utils/network';
import { SetBuilder } from './utils/collection';

interface DebugConfig {
    dumpTranslationKeys?: boolean;
}

interface AppConfig extends GameConfig {
    guiDefinitionUrl?: string;
    languageFileUrl?: string;
    debugConfig?: DebugConfig;
}

class App {

    private _config: AppConfig;
    private _container: HTMLElement;
    private _localizer: LocalizationDictionary;
    private _gameEngine: GameEngine;
    private _actionProxy: GameActionProxy;
    private _gui?: GuiGameWindow;
    private _started: boolean = false;

    constructor(container: HTMLElement, config: AppConfig) {
        this._config = config;
        this._container = container;
        this._actionProxy = new GameActionProxy();
        this._gameEngine = new GameEngine(config, this._actionProxy);
        this._localizer = new LocalizationDictionary();
    }

    async start(): Promise<void> {
        if (this._started) {
            throw new Error('App already started!');
        }
        // The language file needs to be loaded first before rendering the game
        // GUI.
        if (this._config.languageFileUrl) {
            await this._localizer.loadFrom(this._config.languageFileUrl);
        } else {
            console.warn('Missing language file!');
        }
        const textEngine = new SimpleGameTextEngine(this._localizer,
                                                    this._gameEngine.variableStore,
                                                    this._gameEngine.random);
        if (!this._config.guiDefinitionUrl) {
            throw new Error('Missing GUI config file!');
        }
        let guiDef = await <GuiGameWindowDefinition>downloadAndParse(
            this._config.guiDefinitionUrl, loadYaml);
        let gui = new GuiGameWindow(this._container, textEngine,
                                    this._gameEngine, guiDef);
        this._actionProxy.attachGui(gui);
        this._gameEngine.onGameEnd = (sender, event) => {
            window.dispatchEvent(new CustomEvent('gameEnd', {
                detail: {
                    state: event.state,
                    endingType: event.endingType
                }
            }));
        };
        await this._gameEngine.start(false);
        // Debugging info for translation keys
        if (this._config.debugConfig) {
           this._dumpDebugInfo(this._config.debugConfig);
        }
        // Start game loop
        const gameLoop = () => {
            setTimeout(() => this._gameEngine.tick().then(gameLoop), 50);
        };
        gameLoop();
        this._started = true;
    }

    private _dumpDebugInfo(debugConfig: DebugConfig): void {
        if (debugConfig.dumpTranslationKeys) {
            const allEvents = this._gameEngine.eventEngine.getEvents();
            const builder = new SetBuilder<string>();
            for (let event of allEvents) {
                builder.addAll(event.collectTranslationKeys());
            }
            this._gameEngine.itemRegistry.forEach((item) => {
                this._localizer.addRequiredKey(item.unlocalizedName);
                this._localizer.addRequiredKey(item.unlocalizedDescription);
            });
            this._gameEngine.statusRegistry.forEach((status) => {
                this._localizer.addRequiredKey(status.unlocalizedName);
                this._localizer.addRequiredKey(status.unlocalizedDescription);
            })
            builder.get().forEach((key) => this._localizer.addRequiredKey(key));
            const requiredKeys = this._localizer.dumpRequiredTranslationKeys();
            console.log(`# Required translation keys (${requiredKeys.length}):\n${requiredKeys.join('\n')}`);
            const missingKeys = this._localizer.dumpMissingTranslationKeys();
            console.log(`# Missing translation keys (${missingKeys.length}):\n${missingKeys.join('\n')}`);
            const unnecessaryKeys = this._localizer.dumpUnnecessaryTranslationKeys();
            console.log(`# Unnecessary translation keys (${unnecessaryKeys.length}):\n${unnecessaryKeys.join('\n')}`);
        }
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
