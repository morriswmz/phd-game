import { GuiBase } from './guiBase';
import { GameTextEngine } from './textEngine';

// https://en.wikipedia.org/wiki/Unicode_block
const CJK_SCRIPTS = [
    "\\p{Script=Han}",
    "\\p{Script=Bopomofo}",
    "\\p{Script=Katakana}",
    "\\p{Script=Hiragana}",
    "\\p{Script=Hangul}",
];
const CJK_REGEXP = new RegExp(`^[${CJK_SCRIPTS.join('')}]\$`, 'u');

function segmentMessage(message: string): string[] {
    const segments: string[] = [];
    let idx = 0;
    let lastIdx = 0;
    while (idx < message.length) {
        const currentChar = message[idx];
        if (currentChar === ' ') {
            // Consume all white spaces
            ++idx;
            while (idx < message.length && message[idx] === ' ');
            segments.push(message.substring(lastIdx, idx));
            lastIdx = idx;
        } else if (CJK_REGEXP.test(currentChar)) {
            // Currently only support CJK characters
            ++idx;
            segments.push(message.substring(lastIdx, idx));
            lastIdx = idx;
        } else {
            ++idx;
        }
    }
    if (lastIdx < idx) {
        segments.push(message.substring(lastIdx, idx));
    }
    return segments;
}

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
            let segments = segmentMessage(this._textEngine.localize(message));
            let curText = '';
            let lastStep = 0;
            let startingTimestamp : number | null = null;
            let callback: FrameRequestCallback = (timestamp) => {
                if (!startingTimestamp) {
                    startingTimestamp = timestamp;
                }
                const elapsedTime = timestamp - startingTimestamp;
                // 30 FPS
                const steps = Math.min(elapsedTime / 33.3333, segments.length);
                while (lastStep < steps) {
                    curText += segments[lastStep];
                    ++lastStep;
                }
                pText.innerHTML = this._textEngine.render(curText);
                if (lastStep === segments.length) {
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
                    requestAnimationFrame(callback);
                }
            };
            requestAnimationFrame(callback);
        });
    }
}