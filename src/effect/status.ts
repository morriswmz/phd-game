import { Effect, EffectProvider, EffectProviderCollection, loadEffectsFromObjectArray, EffectProviderCollectionChangedEvent } from './effect';
import { load as loadYaml } from 'js-yaml';
import { downloadAndParse } from '../utils/network';
import { JsonEncodable, JsonValue } from '../utils/json';
import { SimpleRegistry } from '../utils/simpleRegistry';
import { AttributeRegistry } from './attribute';

export class Status implements EffectProvider {

    constructor (private _id: string, private _duration: number,
                 private _icon: string = '',
                 private _effects: Effect[] = []) {}

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

    getEffects(): ReadonlyArray<Effect> {
        return this._effects;
    }

}

export class StatusRegistry extends SimpleRegistry<Status> {

    constructor(private _attributeRegistry: AttributeRegistry) {
        super();
    }

    get name(): string {
        return 'status';
    }

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
            let effects: Effect[];
            if (Array.isArray(statusDef['effects'])) {
                effects = loadEffectsFromObjectArray(statusDef['effects'],
                                                     this._attributeRegistry);
            } else {
                effects = [];
            }
            let duration = typeof statusDef['duration'] === 'number' ? statusDef['duration'] : Infinity;
            let icon = typeof statusDef['icon'] === 'string' ? statusDef['icon'] : '';
            this.add(new Status(statusDef['id'], duration, icon, effects));
        }
        console.log(`Successfully registered ${statusDefs.length} status.`);
    }

}

export class StatusTable extends EffectProviderCollection<Status> implements JsonEncodable {
    
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

    decodeFromJson(json: JsonValue): void {
        if (json === null || !Array.isArray(json)) {
            throw new Error('Array expected.');
        }
        this.clear();
        for (const statusData of json) {
            if (!Array.isArray(statusData) || statusData.length !== 2 ||
                typeof statusData[0] !== 'string' ||
                typeof statusData[1] !== 'number') {
                throw new Error('Each saved status data should be a two-element tuple of the status id string and the duration remaining.');
            }
            const [statusId, durationLeft] = statusData;
            this.add(statusId);
            this._remainingTicks[statusId] =
                durationLeft < 0 ? Infinity : durationLeft;
        }
    }

    /**
     * Encoding format for status:
     * ```
     * [
     *     ["statusId1": $durationLeft1],
     *     ["statusId2": $durationLeft2],
     * ]
     * We use -1 to indicate infinite duration.
     * ```
     */
    encodeAsJson(): JsonValue {
        let json = new Array<[string, number]>();
        for (const statusId in this._items) {
            const duration = this._remainingTicks[statusId];
            json.push([statusId, isFinite(duration) ? duration : -1])
        }
        return json;
    }

}
