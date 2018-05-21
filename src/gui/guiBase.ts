import { HTMLTextRenderer } from "./textRenderer";

export class GuiBase<T extends HTMLElement> {

    protected _container: T;
    protected _textRenderer: HTMLTextRenderer;

    constructor(container: T, textRenderer: HTMLTextRenderer) {
        this._container = container;
        this._textRenderer = textRenderer
    }

    setHidden(hidden: boolean): void {
        this._container.style.display = hidden ? 'none' : 'block';
    }

    removeAllChildrenOf(el: HTMLElement): void {
        while (el.firstChild) el.removeChild(el.firstChild);
    }

    createAndAddChild<T extends HTMLElement>(type: string, id?: string, className?: string): T {
        const el = document.createElement(type);
        if (id) el.id = id;
        if (className) el.className = className;
        this._container.appendChild(el);
        // Unsafe hack.
        return <T>el;
    }

}
