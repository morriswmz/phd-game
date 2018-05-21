import { GuiBase } from './guiBase';
import { LocalizationDictionary } from '../i18n/localization';
import { renderText, HTMLTextRenderer } from './textRenderer';

export class GuiMessageWindow extends GuiBase<HTMLDivElement> {

    private _messageContainer: HTMLDivElement;
    private _choicesContainer: HTMLDivElement;

    /**
     * Creates a message window.
     * @param container Container element.
     * @param textRenderer HTML text renderer.
     */
    constructor(container: HTMLDivElement, textRenderer: HTMLTextRenderer) {
        super(container, textRenderer);
        this._messageContainer = this.createAndAddChild('div', '', 'message_container');
        this._choicesContainer = this.createAndAddChild('div', '', 'choices_container');
    }

    displayMessage(message: string, confirm: string, icon?: string): Promise<void> {
        return new Promise<void>(resolve => {
            this.updateMessage(message, icon);
            const btnConfirm = document.createElement('a');
            btnConfirm.className = 'btn';
            btnConfirm.href = 'javascript: void(0)';
            btnConfirm.innerHTML = this._textRenderer.render(confirm);
            this._choicesContainer.appendChild(btnConfirm);
            btnConfirm.onclick = () => {
                this._messageContainer.textContent = '';
                btnConfirm.onclick = null;
                btnConfirm.remove();
                resolve();        
            }
        });
    }

    displayChoices(message: string, choices: Array<[string, number]>, icon?: string): Promise<number> {
        return new Promise<number>(resolve => {
            this.updateMessage(message, icon);
            let choiceButtons : HTMLAnchorElement[] = [];
            for (let i = 0;i < choices.length;i++) {
                let btn = document.createElement('a');
                let [choiceMessage, choiceId] = choices[i];
                btn.className = 'btn';
                // Allow styled text in the buttons.
                btn.innerHTML = this._textRenderer.render(choiceMessage);
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

    updateMessage(message: string, icon?: string): void {
        let html = `<p>${this._textRenderer.render(message)}</p>`;
        if (icon) {
            html += `<p><img src="${icon}" /></p>`;
        }
        this._messageContainer.innerHTML = html;
    }

}