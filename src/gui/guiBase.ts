export class GuiBase<T extends HTMLElement> {

    protected _container: T;

    constructor(container: T) {
        this._container = container;
    }

    setHidden(hidden: boolean): void {
        this._container.style.display = hidden ? 'none' : 'block';
    }

}
