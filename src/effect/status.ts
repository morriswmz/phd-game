import { EffectProvider, EffectCollection, EffectProviderCollection, EffectProviderRegistry, loadEffectCollectionFromJSON, EffectProviderCollectionChangedEvent } from './effect';
import { load as loadYaml } from 'js-yaml';
import { downloadAndParse } from '../utils/network';

export class Status implements EffectProvider {

    constructor (private _id: string, private _duration: number,
                 private _icon: string = '',
                 private _effects: EffectCollection = {})
    {

    }

    get id(): string {
        return this._id;
    }

    get unlocalizedName(): string {
        return 'status.' + this.id;
    }

    get unlocalizedDescription(): string {
        return this.unlocalizedName + '.description';
    }

    get icon(): string {
        return this._icon;
    }

    get duration(): number {
        return this._duration;
    }

    getEffects(): EffectCollection {
        return this._effects;
    }

}

export class StatusRegistry extends EffectProviderRegistry<Status> {
    
    async loadStatus(url: string): Promise<void> {
        let obj: any = await downloadAndParse(url, loadYaml);
        if (!obj) return;
        if (!Array.isArray(obj['status'])) {
            throw new Error('Expecting an array of status definitions.');
        }
        let statusDefs: any[] = obj['status'];
        for (let statusDef of statusDefs) {
            if (typeof statusDef['id'] !== 'string') {
                throw new Error('Missing item id.');
            }
            let effects: EffectCollection;
            if (statusDef['effects'] != undefined) {
                effects = loadEffectCollectionFromJSON(statusDef['effects']);
            } else {
                effects = {};
            }
            let duration = typeof statusDef['duration'] === 'number' ? statusDef['duration'] : Infinity;
            let icon = typeof statusDef['icon'] === 'string' ? statusDef['icon'] : '';
            this.add(new Status(statusDef['id'], duration, icon, effects));
        }
    }

}

export class StatusTable extends EffectProviderCollection<Status> {
    
    // Note: count is always one for the moment. If we want different levels of
    // status, we may utilize the count value in the future.

    private _remainingTicks: { [key: string]: number } = {};

    /**
     * Adds a new status.
     * @param item
     * @param count Ignored.
     */
    add(item: Status | string, count: number = 1): void {
        if (typeof item === 'string') item = this._registry.get(item);
        if (count !== 1) throw new Error('Count must be one.');
        if (this._items[item.id] == undefined) {
            this._items[item.id] = [item, 1];
            this._remainingTicks[item.id] = item.duration;
            this.dispatchChangeEvent(new EffectProviderCollectionChangedEvent(false, item, 0, 1));
        }
        // Reset duration
        this._remainingTicks[item.id] = item.duration;
    }

    /**
     * Removes an effect provider.
     * @param item 
     * @param count Ignored.
     */
    remove(item: Status | string, count: number = 1): void {
        if (typeof item === 'string') item = this._registry.get(item);
        if (count !== 1) throw new Error('Count must be one.');
        if (this._items[item.id] == undefined) return;
        delete this._items[item.id];
        delete this._remainingTicks[item.id];
        this.dispatchChangeEvent(new EffectProviderCollectionChangedEvent(false, item, 0, 1));
    }

    clear(): void {
        super.clear();
        this._remainingTicks = {};        
    }

    /**
     * Reduces the remaining ticks of all status by one.
     */
    tick(): void {
        let pending: string[] = [];
        for (let id in this._remainingTicks) {
            --this._remainingTicks[id];
            if (this._remainingTicks[id] === 0) {
                pending.push(id);
            }
        }
        for (let id of pending) {
            this.remove(id);
        }
    }

}
