import { GuiBase } from "./guiBase";
import { GuiModalBox } from "./guiModalBox";
import { GameTextEngine } from "./textEngine";

export interface GuiFooterLinkButtonDefinition {
  text: string;
  styleClasses?: string[];
  url: string;
}

export interface GuiFooterMessageButtonDefinition {
  text: string;
  styleClasses?: string[];
  messageTitle: string;
  message: string;
  confirmText: string;
  icon?: string;
}

export interface GuiFooterDefinition {
  // Localizable text before all buttons.
  preamble?: string;
  buttons: Array<GuiFooterLinkButtonDefinition | GuiFooterMessageButtonDefinition>;
}

// The footer GUI component, where help, privacy notice, copyright notice, etc.
// are displayed.
export class GuiFooter extends GuiBase<HTMLElement> {
  constructor(container: HTMLElement, textRenderer: GameTextEngine,
              modalBox: GuiModalBox, definition?: GuiFooterDefinition) {
    super(container, textRenderer);
    this.removeAllChildrenOf(container);
    if (!definition) return;
    if (definition.preamble) {
      let preamble = document.createElement('span');
      preamble.innerHTML = textRenderer.localizeAndRender(definition.preamble);
      this._container.appendChild(preamble);
    }
    for (let i = 0; i < definition.buttons.length; i++) {
      const buttonDef = definition.buttons[i];
      if (i > 0) {
        let separator = document.createElement('span');
        separator.textContent = ' | ';
        this._container.appendChild(separator);
      }
      let button = document.createElement('a');
      button.innerHTML = textRenderer.localizeAndRender(buttonDef.text);
      if ('styleClasses' in buttonDef) {
        if (!Array.isArray(buttonDef.styleClasses)) {
          throw new Error("Style classes should be an array.");
        }
        for (let style of buttonDef.styleClasses) {
          button.classList.add(style);
        }
      }
      if ('url' in buttonDef) {
        button.href = buttonDef.url;
      } else {
        button.onclick = (event) => {
          event.preventDefault();
          modalBox.display(
              buttonDef.messageTitle,
              buttonDef.message,
              buttonDef.confirmText,
              buttonDef.icon
          );
        };
      }
      this._container.appendChild(button);
    }
  }
}
