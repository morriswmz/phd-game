import { LocalizationDictionary } from '../i18n/localization';
import { GameState, VariableChangedEvent } from '../gameState';
import { Inventory, Item } from '../effect/item';
import { EffectProviderCollectionChangedEvent } from '../effect/effect';
import { StatusTable, Status } from '../effect/status';
import { GuiModalBox } from './guiModalBox';
import { GuiBase } from './guiBase';
import { GameEngine } from '../gameEngine';
import { GuiMessageWindow } from './guiMessageWindow';
import { GuiItemList, GuiStatusList } from './guiEffectProviderList';
import { GuiFX } from './guiFx';
import { GameTextEngine } from './textEngine';

export interface GuiGame {

    displayMessage(message: string, confirm: string, icon?: string, fx?: string): Promise<void>;

    displayChoices(message: string, choices: Array<[string, number]>, icon?: string): Promise<number>;

}

export class GuiGameWindow extends GuiBase<HTMLElement> implements GuiGame {

    private _messageWindow: GuiMessageWindow;
    private _modalBox: GuiModalBox;
    private _itemList: GuiItemList;
    private _fx: GuiFX;
    private _statusList: GuiStatusList;
    private _hopeMeter: HTMLElement;
    private _timeMeter: HTMLElement;
    private _btnHelp: HTMLAnchorElement;
    private _btnSeed: HTMLAnchorElement;
    private _btnPrivacyNotice: HTMLAnchorElement;

    private _gameEngine: GameEngine;

    constructor(container: HTMLElement, textEngine: GameTextEngine, gameEngine: GameEngine) {
        super(container, textEngine);
        this._gameEngine = gameEngine;
        // Initialize sub-components.
        this._messageWindow = new GuiMessageWindow(this.retrieveElement('message_window'), textEngine);
        this._modalBox = new GuiModalBox(this.retrieveElement('modal_container'), textEngine);
        this._itemList = new GuiItemList(
            this.retrieveElement('items_window'), textEngine,
            this._gameEngine.gameState.playerInventory,
            this._gameEngine.itemRegistry);
        this._statusList = new GuiStatusList(
            this.retrieveElement('status_window'), textEngine,
            this._gameEngine.gameState.playerStatus,
            this._gameEngine.statusRegistry);
        this._fx = new GuiFX(
            this.retrieveElement('fx_container'),
            textEngine);
        this._hopeMeter = this.retrieveElement('hope_meter');
        this._timeMeter = this.retrieveElement('time_meter');
        this._btnHelp = this.retrieveElement('btn_help');
        this._btnSeed = this.retrieveElement('btn_seed');
        this._btnPrivacyNotice = this.retrieveElement('btn_privacy_notice');
        // Handlers for game state updates.
        this._gameEngine.gameState.onVariableChanged = (gs, e) => {
            this.handleVariableUpdate(gs, e);
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
        // Other event handlers
        this._btnHelp.onclick = e => {
            this._modalBox.display(
                'ui.helpTitle',
                'ui.helpContent',
                'ui.ok'
            );
        };
        this._btnPrivacyNotice.onclick = e => {
            this._modalBox.display(
                'ui.privacyNoticeTitle',
                'ui.privacyNoticeContent',
                'ui.ok'
            );
        };
        this._btnSeed.onclick = e => {
            this._modalBox.display(
                'ui.seedTitle',
                'ui.seedContent',
                'ui.ok'
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

    updateUIText(): void {
        this._btnHelp.innerHTML =
            this._textEngine.localizeAndRender('ui.helpButton');
        this._btnPrivacyNotice.innerHTML =
            this._textEngine.localizeAndRender('ui.privacyNoticeButton');
        this._btnSeed.innerHTML =
            this._textEngine.localizeAndRender('ui.seedButton')
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
                this._hopeMeter.innerHTML = this._textEngine.localizeAndRender('ui.hopeMeter');
                break;
            case 'year':
            case 'month':
                this._timeMeter.innerHTML = this._textEngine.localizeAndRender('ui.timeMeter');
                break;
        }
    }

    displayMessage(message: string, confirm: string, icon?: string, fx?: string): Promise<void> {
        if (fx) this.playFx(fx);
        return this._messageWindow.displayMessage(message, confirm, icon);
    }

    displayChoices(message: string, choices: Array<[string, number]>, icon?: string): Promise<number> {
        return this._messageWindow.displayChoices(message, choices, icon);
    }

}
