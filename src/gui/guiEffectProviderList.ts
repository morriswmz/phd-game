import { GuiBase } from './guiBase';
import { SimpleRegistry, IDOwner } from '../utils/simpleRegistry';
import { EffectProviderCollection, EffectProvider, EffectProviderCollectionChangedEvent } from '../effect/effect';
import { Item } from '../effect/item';
import { GameTextEngine } from './textEngine';
import { Status } from '../effect/status';

/**
 * Abstract base class for item list and status list.
 */
export abstract class GuiEffectProviderList<T extends EffectProvider> extends GuiBase<HTMLElement> {
    
    protected _titleContainer: HTMLHeadingElement;
    protected _listContainer: HTMLUListElement;
    protected _collection: EffectProviderCollection<T>;
    protected _registry: SimpleRegistry<T>;

    constructor(container: HTMLElement,
                textEngine: GameTextEngine,
                collection: EffectProviderCollection<T>,
                registry: SimpleRegistry<T>)
    {   
        super(container, textEngine);
        this._collection = collection;
        this._registry = registry;
        this._titleContainer = this.createAndAddChild('h3');
        this._listContainer = this.createAndAddChild('ul');
        this._collection.onChanged = (collection, e) => {
            this.renderList(collection, e);
        };
        // Handles item clicks.
        this._listContainer.onclick = e => {
            let target = e.target;
            if (target instanceof HTMLLIElement && this.onItemClicked) {
                this.onItemClicked(this.retrieveEffectProviderFromElement(target));
            } 
        };
    }

    onItemClicked?: (item: T) => void;

    setTitle(title: string): void {
        this._titleContainer.innerHTML = this._textEngine.localizeAndRender(title);
    }
    
    /**
     * Renders the list.
     * @param collection Effect provider collection.
     * @param e Collection changed event.
     */
    abstract renderList(collection: EffectProviderCollection<T>, e: EffectProviderCollectionChangedEvent<T>): void;

    /**
     * Retrieves the effect provider instance based on the given HTML li element.
     * @param el HTML li element.
     */
    abstract retrieveEffectProviderFromElement(el: HTMLElement): T;

}

export class GuiItemList extends GuiEffectProviderList<Item> {

    renderList(collection: EffectProviderCollection<Item>, e: EffectProviderCollectionChangedEvent<Item>): void {
        this.removeAllChildrenOf(this._listContainer);
        if (e.clear) return;
        for (const itemId in collection.items) {
            let node = document.createElement('li');
            let item = collection.items[itemId];
            node.setAttribute('data-item-id', item[0].id);
            // Set styles based on the item rarity.
            if (item[0].rarity >= 10) {
                node.className = 'r_legendary';
            } else if (item[0].rarity >= 6) {
                node.className = 'r_rare';
            } else if (item[0].rarity >= 3) {
                node.className = 'r_uncommon';
            }
            node.innerHTML = this._textEngine.localizeAndRender(item[0].unlocalizedName) + ' x' + item[1].toString();
            this._listContainer.appendChild(node);
        }
    }

    retrieveEffectProviderFromElement(el: HTMLElement): Item {
        return this._registry.get(el.getAttribute('data-item-id') || '');
    }

}

export class GuiStatusList extends GuiEffectProviderList<Status> {

    renderList(collection: EffectProviderCollection<Status>, e: EffectProviderCollectionChangedEvent<Status>): void {
        this.removeAllChildrenOf(this._listContainer);
        if (e.clear) return;
        for (const itemId in collection.items) {
            let node = document.createElement('li');
            let status = collection.items[itemId];
            node.innerHTML = this._textEngine.localizeAndRender(status[0].unlocalizedName);
            node.setAttribute('data-status-id', itemId);
            this._listContainer.appendChild(node);
        }
    }

    retrieveEffectProviderFromElement(el: HTMLElement): Status {
        return this._registry.get(el.getAttribute('data-status-id') || '');
    }

}
