import { LocalizationDictionary } from '../i18n/localization';
import { GameStateBase } from '../gameState';

export class GuiGame {

    private _messageContainer: HTMLParagraphElement;
    private _choicesContainer: HTMLElement;
    private _itemsContainer: HTMLElement;
    private _statusContainer: HTMLElement;
    private _hopeMeter: HTMLElement;
    private _timeMeter: HTMLElement;

    constructor(private _container: HTMLDivElement, private _ldict: LocalizationDictionary) {
        this._messageContainer = this.retrieveElement('message_container');
        this._hopeMeter = this.retrieveElement('hope_meter');
        this._timeMeter = this.retrieveElement('time_meter');
        this._choicesContainer = this.retrieveElement('choices_container');
        this._itemsContainer = this.retrieveElement('item_list');
        this._statusContainer = this.retrieveElement('status_list');
    }

    retrieveElement<T extends HTMLElement>(id: string): T {
        let el = document.getElementById(id);
        if (!el) throw new Error(`Unable to find #${id}.`);
        return <T>el;
    }

    update(gs: GameStateBase): void {
        this._hopeMeter.textContent = `Hope: ${gs.getVar('player.hope')}/100`;
        this._timeMeter.textContent = `Year: ${gs.variables.year}, Month: ${gs.variables.month + 1}`;
        this.updateItemList(gs);
    }

    updateItemList(gs: GameStateBase): void {
        while (this._itemsContainer.lastChild) {
            this._itemsContainer.removeChild(this._itemsContainer.lastChild);
        }
        for (const itemId in gs.playerInventory.items) {
            let node = document.createElement('li');
            let item = gs.playerInventory.items[itemId];
            node.textContent = this._ldict.translate(item[0].unlocalizedName) + ': ' + item[1].toString();
            node.title = this._ldict.translate(item[0].unlocalizedDescription);
            this._itemsContainer.appendChild(node);
        }
    }
    
    displayMessage(message: string, confirm: string): Promise<void> {
        return new Promise<void>(resolve => {
            this._messageContainer.textContent = this._ldict.translate(message);
            const btnConfirm = document.createElement('a');
            btnConfirm.href = 'javascript: void(0)';
            btnConfirm.textContent = this._ldict.translate(confirm);
            this._choicesContainer.appendChild(btnConfirm);
            btnConfirm.onclick = () => {
                this._messageContainer.textContent = '';
                btnConfirm.onclick = null;
                btnConfirm.remove();
                resolve();        
            }
        });
    }

    displayChoices(message: string, choices: Array<[string, number]>): Promise<number> {
        return new Promise<number>(resolve => {
            this._messageContainer.textContent = this._ldict.translate(message);
            let choiceButtons : HTMLAnchorElement[] = [];
            for (let i = 0;i < choices.length;i++) {
                let btn = document.createElement('a');
                let [choiceMessage, choiceId] = choices[i];
                btn.textContent = this._ldict.translate(choiceMessage);
                btn.href = 'javascript: void(0);';
                btn.setAttribute('data-choice-number', choiceId.toString());
                btn.onclick = () => {
                    this._messageContainer.textContent = '';
                    for (btn of choiceButtons) btn.remove();
                    resolve(choiceId);
                };
                choiceButtons.push(btn);
                this._choicesContainer.appendChild(btn);
            }
        });
    }

}
