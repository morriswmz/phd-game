import { VariableStore, VariableChangedEvent } from '../variableStore';
import { GuiModalBox } from './guiModalBox';
import { GuiBase } from './guiBase';
import { GameEngine } from '../gameEngine';
import { GuiMessageWindow, GuiMessageWindowDefinition } from './guiMessageWindow';
import { GuiItemList, GuiItemListDefinition, GuiStatusList, GuiStatusListDefinition } from './guiEffectProviderList';
import { GuiFX } from './guiFx';
import { GameTextEngine } from './textEngine';
import { GuiFooter, GuiFooterDefinition } from './guiFooter';
import { GuiStatsBar, GuiStatsBarDefinition } from './guiStatsBar';

export interface GuiGameWindowDefinition {
    statsBar?: GuiStatsBarDefinition;
    messageWindow?: GuiMessageWindowDefinition;
    itemList?: GuiItemListDefinition;
    statusList?: GuiStatusListDefinition;
    footer?: GuiFooterDefinition;
}

export interface GuiGame {

    displayMessage(message: string, confirm: string, icon?: string, fx?: string): Promise<void>;

    displayChoices(message: string, choices: Array<[string, number]>, icon?: string): Promise<number>;

}

export class GuiGameWindow extends GuiBase<HTMLElement> implements GuiGame {

    private _statsBar: GuiStatsBar;
    private _messageWindow: GuiMessageWindow;
    private _modalBox: GuiModalBox;
    private _itemList: GuiItemList;
    private _statusList: GuiStatusList;
    private _footer: GuiFooter;
    private _fx: GuiFX;

    private _gameEngine: GameEngine;

    constructor(container: HTMLElement, textEngine: GameTextEngine,
                gameEngine: GameEngine, definition: GuiGameWindowDefinition) {
        super(container, textEngine);
        this._gameEngine = gameEngine;
        // Initialize sub-components.
        this._statsBar = new GuiStatsBar(
            this.retrieveElement('stats_bar'), textEngine,
            gameEngine.expressionEngine, definition.statsBar);
        this._messageWindow = new GuiMessageWindow(
            this.retrieveElement('message_window'), textEngine,
            definition.messageWindow);
        this._modalBox = new GuiModalBox(
            this.retrieveElement('modal_container'), textEngine);
        this._itemList = new GuiItemList(
            this.retrieveElement('items_window'), textEngine,
            this._gameEngine.inventory,
            this._gameEngine.itemRegistry, definition.itemList);
        this._statusList = new GuiStatusList(
            this.retrieveElement('status_window'), textEngine,
            this._gameEngine.statusTable,
            this._gameEngine.statusRegistry, definition.statusList);
        this._footer = new GuiFooter(
            this.retrieveElement('footer'), textEngine, this._modalBox,
            definition.footer);
        this._fx = new GuiFX(
            this.retrieveElement('fx_container'),
            textEngine);
        // Handlers for variable updates.
        this._gameEngine.variableStore.onVariableChanged = (sender, e) => {
            this.handleVariableUpdate(sender, e);
        };
        // Event handlers for items/status list.
        this._itemList.onItemClicked = item => {
            this._modalBox.display(
                item.unlocalizedName,
                item.unlocalizedDescription,
                'ui.ok',
                item.icon
            );
        };
        this._statusList.onItemClicked = status => {
            this._modalBox.display(
                status.unlocalizedName,
                status.unlocalizedDescription,
                'ui.ok',
                status.icon
            );
        };
    }

    playFx(fx: string): void {
        switch (fx) {
            case 'confetti':
                this._fx.confetti();
                break;
            default:
                throw new Error(`Unknown fx "${fx}".`);
        }
    }

    retrieveElement<T extends HTMLElement>(id: string): T {
        // Lazy implementation here.
        let el = document.getElementById(id);
        if (!el) throw new Error(`Unable to find #${id}.`);
        return <T>el;
    }

    handleVariableUpdate(sender: VariableStore, e: VariableChangedEvent): void {
        this._statsBar.handleVariableUpdate(sender, e);
    }

    displayMessage(message: string, confirm: string, icon?: string, fx?: string): Promise<void> {
        if (fx) this.playFx(fx);
        return this._messageWindow.displayMessage(message, confirm, icon);
    }

    displayChoices(message: string, choices: Array<[string, number]>, icon?: string): Promise<number> {
        return this._messageWindow.displayChoices(message, choices, icon);
    }

}
