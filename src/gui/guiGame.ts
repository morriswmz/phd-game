import { LocalizationDictionary } from '../i18n/localization';
import { GameState, VariableChangedEvent } from '../gameState';
import { Inventory, Item } from '../effect/item';
import { EffectProviderCollectionChangedEvent } from '../effect/effect';
import { renderText, HTMLTextRenderer } from './textRenderer';
import { StatusTable, Status } from '../effect/status';
import { GuiModalBox } from './guiModalBox';
import { GuiBase } from './guiBase';
import { GameEngine } from '../gameEngine';
import { GuiMessageWindow } from './guiMessageWindow';
import { GuiItemList, GuiStatusList } from './guiEffectProviderList';

export interface GuiGame {

    displayMessage(message: string, confirm: string, icon?: string): Promise<void>;

    displayChoices(message: string, choices: Array<[string, number]>, icon?: string): Promise<number>;

}

export class GuiGameWindow extends GuiBase<HTMLDivElement> implements GuiGame {

    private _messageWindow: GuiMessageWindow;
    private _modalBox: GuiModalBox;
    private _itemList: GuiItemList;
    private _statusList: GuiStatusList;
    private _hopeMeter: HTMLElement;
    private _timeMeter: HTMLElement;

    private _gameEngine: GameEngine;

    constructor(container: HTMLDivElement, textRenderer: HTMLTextRenderer, gameEngine: GameEngine) {
        super(container, textRenderer);
        this._gameEngine = gameEngine;
        // Initialize sub-components.
        this._messageWindow = new GuiMessageWindow(this.retrieveElement('message_window'), textRenderer);
        this._modalBox = new GuiModalBox(this.retrieveElement('modal_container'), textRenderer);
        this._itemList = new GuiItemList(
            this.retrieveElement('items_window'), textRenderer,
            this._gameEngine.gameState.playerInventory,
            this._gameEngine.itemRegistry);
        this._statusList = new GuiStatusList(
            this.retrieveElement('status_window'), textRenderer,
            this._gameEngine.gameState.playerStatus,
            this._gameEngine.statusRegistry);
        this._hopeMeter = this.retrieveElement('hope_meter');
        this._timeMeter = this.retrieveElement('time_meter');
        // Handlers for game state updates.
        this._gameEngine.gameState.onVariableChanged = (gs, e) => {
            this.handleVariableUpdate(gs, e);
        };
        // Event handlers for items/status list.
        this._itemList.onItemClicked = item => {
            this._modalBox.display(
                this._textRenderer.render(item.unlocalizedName),
                this._textRenderer.render(item.unlocalizedDescription),
                this._textRenderer.render('ui.ok'),
                item.icon
            );
        };
        this._statusList.onItemClicked = status => {
            this._modalBox.display(
                this._textRenderer.render(status.unlocalizedName),
                this._textRenderer.render(status.unlocalizedDescription),
                this._textRenderer.render('ui.ok'),
                status.icon
            );
        };
    }

    updateUIText(): void {
        this._itemList.setTitle('ui.items');
        this._statusList.setTitle('ui.status');        
    }

    retrieveElement<T extends HTMLElement>(id: string): T {
        // Lazy implementation here.
        let el = document.getElementById(id);
        if (!el) throw new Error(`Unable to find #${id}.`);
        return <T>el;
    }

    handleVariableUpdate(gs: GameState, e: VariableChangedEvent): void {
        if (e.clear) return;
        switch (e.varName) {
            case 'player.hope':
                if (e.newValue < 40 && e.newValue > 20) {
                    this._hopeMeter.className = 'warning';
                } else if (e.newValue <= 20) {
                    this._hopeMeter.className = 'critical';
                } else {
                    this._hopeMeter.className = 'normal';
                }
                this._hopeMeter.textContent = `Hope ${e.newValue}/${gs.getVarLimits(e.varName)[1]}`;
                break;
            case 'year':
            case 'month':
                this._timeMeter.textContent = `Year ${gs.getVar('year', true)} Month ${gs.getVar('month', true)}`;
                break;
        }
    }

    displayMessage(message: string, confirm: string, icon?: string): Promise<void> {
        return this._messageWindow.displayMessage(message, confirm, icon);
    }

    displayChoices(message: string, choices: Array<[string, number]>, icon?: string): Promise<number> {
        return this._messageWindow.displayChoices(message, choices, icon);
    }

}
