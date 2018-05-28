import { GuiBase } from './guiBase';
import { LocalizationDictionary } from '../i18n/localization';
import { GameTextEngine } from './textEngine';

export class GuiMessageWindow extends GuiBase<HTMLDivElement> {

    private _messageContainer: HTMLDivElement;
    private _choicesContainer: HTMLDivElement;
    private _animate: boolean = true;

    /**
     * Creates a message window.
     * @param container Container element.
     * @param textEngine HTML text renderer.
     */
    constructor(container: HTMLDivElement, textEngine: GameTextEngine) {
        super(container, textEngine);
        this._messageContainer = this.createAndAddChild('div', '', 'message_container');
        this._choicesContainer = this.createAndAddChild('div', '', 'choices_container');
    }

    async displayMessage(message: string, confirm: string, icon?: string): Promise<void> {
        if (this._animate) {
            await this.typewriteMessage(message, icon);
        } else {
            this.updateMessage(message, icon);
        }
        return new Promise<void>(resolve => {
            const btnConfirm = document.createElement('a');
            btnConfirm.className = 'btn';
            btnConfirm.href = 'javascript: void(0)';
            btnConfirm.innerHTML = this._textEngine.localizeAndRender(confirm);
            this._choicesContainer.appendChild(btnConfirm);
            btnConfirm.onclick = () => {
                this._messageContainer.textContent = '';
                btnConfirm.onclick = null;
                btnConfirm.remove();
                resolve();        
            }
        });
    }

    async displayChoices(message: string, choices: Array<[string, number]>, icon?: string): Promise<number> {
        if (this._animate) {
            await this.typewriteMessage(message, icon);
        } else {
            this.updateMessage(message, icon);
        }
        return new Promise<number>(resolve => {
            let choiceButtons : HTMLAnchorElement[] = [];
            for (let i = 0;i < choices.length;i++) {
                let btn = document.createElement('a');
                let [choiceMessage, choiceId] = choices[i];
                btn.className = 'btn';
                // Allow styled text in the buttons.
                btn.innerHTML = this._textEngine.localizeAndRender(choiceMessage);
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
        let html = `<p>${this._textEngine.localizeAndRender(message)}</p>`;
        if (icon) {
            html += `<p><img src="${icon}" /></p>`;
        }
        this._messageContainer.innerHTML = html;
    }

    typewriteMessage(message: string, icon?: string): Promise<void> {
        return new Promise<void>(resolve => {
            this.removeAllChildrenOf(this._messageContainer);
            let pText = document.createElement('p');
            this._messageContainer.appendChild(pText);
            let segments = this._textEngine.localize(message).split(' ');
            let curText = '';
            let idx = 0;
            let t = 0;
            let callback = () => {
                ++t;
                if (t < 2) {
                    requestAnimationFrame(callback);
                    return;
                }
                t = 0;
                if (idx == segments.length) {
                    // Finished!
                    if (icon) {
                        let pIcon = document.createElement('p');
                        let img = document.createElement('img');
                        img.src = icon;
                        pIcon.appendChild(img);
                        this._messageContainer.appendChild(pIcon);
                    }
                    resolve();
                } else {
                    // Add next segment.
                    if (curText.length > 0) curText += ' ';
                    curText += segments[idx];
                    pText.innerHTML = this._textEngine.localizeAndRender(curText);
                    ++idx;
                    requestAnimationFrame(callback);
                }
            };
            requestAnimationFrame(callback);
        });
    }
}