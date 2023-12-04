import { GuiBase } from './guiBase';
import { SimpleRegistry } from '../utils/simpleRegistry';
import { EffectProviderCollection, EffectProvider, EffectProviderCollectionChangedEvent } from '../effect/effect';
import { Item } from '../effect/item';
import { GameTextEngine } from './textEngine';
import { Status } from '../effect/status';

interface GuiEffectProviderListDefinition {
    title: string;
}

/**
 * Abstract base class for item list and status list.
 */
export abstract class GuiEffectProviderList<T extends EffectProvider> extends GuiBase<HTMLElement> {
    
    protected _titleContainer: HTMLHeadingElement;
    protected _listContainer: HTMLUListElement;
    protected _collection: EffectProviderCollection<T>;
    protected _registry: SimpleRegistry<T>;

    constructor(container: HTMLElement, textEngine: GameTextEngine,
                collection: EffectProviderCollection<T>,
                registry: SimpleRegistry<T>,
                definition?: GuiEffectProviderListDefinition) {
        super(container, textEngine);
        this._collection = collection;
        this._registry = registry;
        this._titleContainer = this.createAndAddChild('h3');
        if (definition) {
            if (typeof definition['title'] !== 'string') {
                throw new Error("Title must be a string.");
            }
            this._titleContainer.innerHTML =
                textEngine.localizeAndRender(definition.title);
            textEngine.getLocalizationDictionary()
                .addRequiredKey(definition.title);
        }
        this._listContainer = this.createAndAddChild('ul');
        this._collection.onChanged = (collection, e) => {
            this.renderList(collection, e);
        };
        // Handles item clicks.
        this._listContainer.onclick = e => {
            let target = e.target;
            if (target instanceof HTMLLIElement && this.onItemClicked) {
                this.onItemClicked(
                    this.retrieveEffectProviderFromElement(target));
            } 
        };
    }

    /**
     * Specifies the callback function to handle item clicks.
     */
    onItemClicked?: (item: T) => void;

    /**
     * Renders the list.
     * @param collection Effect provider collection.
     * @param e Collection changed event.
     */
    abstract renderList(collection: EffectProviderCollection<T>,
                        e: EffectProviderCollectionChangedEvent<T>): void;

    /**
     * Retrieves the effect provider instance based on the given HTML li element.
     * @param el HTML li element.
     */
    abstract retrieveEffectProviderFromElement(el: HTMLElement): T;

}

interface RaritySpecificStyle {
    // Minimum rarity required to apply the style (inclusive).
    // Defaults to -Infinity if not set.
    minRarity?: number;
    // Maximum rarity allowed to apply the style (inclusive).
    // Defaults to Infinity if not set.
    maxRarity?: number;
    styleClasses: string[];
}

export interface GuiItemListDefinition extends GuiEffectProviderListDefinition {
    // Style classes to apply based on rarity. Evaluated in order.
    raritySpecificStyles?: RaritySpecificStyle[];
}

export class GuiItemList extends GuiEffectProviderList<Item> {

    private _raritySpecificStyles: Required<RaritySpecificStyle>[] = [];

    constructor(container: HTMLElement, textEngine: GameTextEngine,
                collection: EffectProviderCollection<Item>,
                registry: SimpleRegistry<Item>,
                definition?: GuiItemListDefinition) {
        super(container, textEngine, collection, registry, definition);
        if (definition == undefined ||
            definition['raritySpecificStyles'] == undefined) {
            return;
        }
        if (!Array.isArray(definition['raritySpecificStyles'])) {
            throw new Error('raritySpecificStyles must be an array.');
        }
        for (let style of definition['raritySpecificStyles']) {
            const minRarity = style['minRarity'] == undefined
                ? -Infinity
                : style['minRarity'];
            const maxRarity = style['maxRarity'] == undefined
                ? Infinity
                : style['maxRarity'];
            if (!Array.isArray(style['styleClasses'])) {
                throw new Error('styleClasses must be an array.');
            }
            for (const styleClass of style['styleClasses']) {
                if (typeof styleClass !== 'string') {
                    throw new Error(
                        'styleClasses must be an array of strings.');
                }
            }
            this._raritySpecificStyles.push({
                minRarity: minRarity,
                maxRarity: maxRarity,
                styleClasses: [...style['styleClasses']]
            });
        }
    }

    renderList(collection: EffectProviderCollection<Item>,
               e: EffectProviderCollectionChangedEvent<Item>): void {
        this.removeAllChildrenOf(this._listContainer);
        if (e.clear) return;
        for (const itemId in collection.items) {
            let node = document.createElement('li');
            let [item, count] = collection.items[itemId];
            node.setAttribute('data-item-id', item.id);
            for (const style of this._raritySpecificStyles) {
                if (item.rarity >= style.minRarity &&
                    item.rarity <= style.maxRarity) {
                    node.classList.add(...style.styleClasses);
                }
            }
            const localizedItemName =
                this._textEngine.localizeAndRender(item.unlocalizedName);
            node.innerHTML = `${localizedItemName} x${count}`;
            this._listContainer.appendChild(node);
        }
    }

    retrieveEffectProviderFromElement(el: HTMLElement): Item {
        return this._registry.get(el.getAttribute('data-item-id') || '');
    }

}

export interface GuiStatusListDefinition extends GuiEffectProviderListDefinition {}

export class GuiStatusList extends GuiEffectProviderList<Status> {

    constructor(container: HTMLElement, textEngine: GameTextEngine,
                collection: EffectProviderCollection<Status>,
                registry: SimpleRegistry<Status>,
                definition?: GuiStatusListDefinition) {
        super(container, textEngine, collection, registry, definition);
    }

    renderList(collection: EffectProviderCollection<Status>,
               e: EffectProviderCollectionChangedEvent<Status>): void {
        this.removeAllChildrenOf(this._listContainer);
        if (e.clear) return;
        for (const itemId in collection.items) {
            let node = document.createElement('li');
            let status = collection.items[itemId];
            node.innerHTML =
                this._textEngine.localizeAndRender(status[0].unlocalizedName);
            node.setAttribute('data-status-id', itemId);
            this._listContainer.appendChild(node);
        }
    }

    retrieveEffectProviderFromElement(el: HTMLElement): Status {
        return this._registry.get(el.getAttribute('data-status-id') || '');
    }

}
