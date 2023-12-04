import { downloadAndParse } from "../utils/network";
import { SimpleRegistry } from "../utils/simpleRegistry";
import { load as loadYaml } from 'js-yaml';

/**
 * Defines an attributes, which can be modified by effects.
 */
export class Attribute {

    constructor(private _id: string, private _baseValue: number,
        private _minValue: number = -Infinity,
        private _maxValue: number = Infinity) { }

    get id(): string {
        return this._id;
    }

    get baseValue(): number {
        return this._baseValue;
    }

    get minValue(): number {
        return this._minValue;
    }

    get maxValue(): number {
        return this._maxValue;
    }

}

export class AttributeRegistry extends SimpleRegistry<Attribute> {

    get name(): string {
        return 'attributes';
    }

    async loadAttributes(url: string): Promise<void> {
        let obj: any = await downloadAndParse(url, loadYaml);
        if (obj == undefined) return;
        if (!('attributes' in obj) || !Array.isArray(obj['attributes'])) {
            throw new Error('Expect an array of attribute definitions.');
        }
        const attributeDefs: any[] = obj['attributes'];
        for (let attributeDef of attributeDefs) {
            if (!('id' in attributeDef) ||
                typeof attributeDef['id'] !== 'string') {
                throw new Error('Missing valid attribute id definition.');
            }
            const attributeId: string = attributeDef['id'];
            if (!('baseValue' in attributeDef) ||
                typeof attributeDef['baseValue'] !== 'number') {
                throw new Error('Missing valid base value definition.');
            }
            const baseValue: number = attributeDef['baseValue'];
            let minValue = -Infinity;
            if ('minValue' in attributeDef) {
                if (typeof attributeDef['minValue'] !== 'number' ||
                    isNaN(attributeDef['minValue'])) {
                    throw new Error('minValue must be a valid number.');
                }
                minValue = attributeDef['minValue'];
            }
            let maxValue = Infinity;
            if ('maxValue' in attributeDef) {
                if (typeof attributeDef['maxValue'] !== 'number' ||
                    isNaN(attributeDef['maxValue'])) {
                    throw new Error('maxValue must be a valid number.');
                }
                maxValue = attributeDef['maxValue'];
            }
            this.add(new Attribute(attributeId, baseValue, minValue, maxValue));
        }
        console.log(`Successfully registered ${attributeDefs.length} attributes.`);
    }
}

export enum AttributeModifierType {
    /**
     * Modifies the attribute value by an absolute amount.
     */
    Absolute,
    /**
     * Modifies the attribute value relatively after other types of modifications.
     */
    Relative,
    /**
     * Modifies the attribute value relatively only based on its base value.
     */
    RelativeToBase,
}

export interface CombinedAttributeModifierAmounts {
    absolute: number;
    relative: number;
    relativeToBase: number;
}

/**
 * Describes a modification to an attribute. When multiple modifiers of
 * different types are affecting the same attribute, the final attribute value
 * is computed via the following formula:
 * 
 * (base_value * (1 + sum(relative_to_base_amount)) + sum(absolute_amount))
 *  * (1 + sum(relative_amount))
 */
export class AttributeModifier {

    constructor(private _target: string, private _type: AttributeModifierType,
        private _amount: number) { }

    /**
     * Retrieves the attribute id which this modifier targets.
     */
    get target(): string {
        return this._target;
    }

    get type(): AttributeModifierType {
        return this._type;
    }

    get amount(): number {
        return this._amount;
    }

    static fromObject(obj: any, registry: AttributeRegistry): AttributeModifier {
        if (!('target' in obj) || typeof obj['target'] !== 'string') {
            throw new Error('Expect `target` to be a valid string.');
        }
        const target: string = obj['target'];
        if (!registry.has(target)) {
            throw new Error(`Attribute "${target}" does not exist.`);
        }
        if (!('type' in obj) || typeof obj['type'] !== 'string') {
            throw new Error('Expect `type` to be a string.');
        }
        let type: AttributeModifierType = AttributeModifierType.Absolute;
        switch (obj['type']) {
            case AttributeModifierType[AttributeModifierType.Absolute]:
                type = AttributeModifierType.Absolute;
                break;
            case AttributeModifierType[AttributeModifierType.Relative]:
                type = AttributeModifierType.Relative;
                break;
            case AttributeModifierType[AttributeModifierType.RelativeToBase]:
                type = AttributeModifierType.RelativeToBase;
                break;
            default:
                throw new Error(`Unknown attribute modifier type: ${obj["type"]}.`);
        }
        if (!('amount' in obj) || typeof obj['amount'] !== 'number' ||
            isNaN(obj['amount'])) {
            throw new Error('Expect `amount` to be a valid number.');
        }
        return new AttributeModifier(target, type, obj['amount']);
    }

    static CalculateAttributeValue(attribute: Attribute, combinedAmounts: CombinedAttributeModifierAmounts) {
        let value: number = attribute.baseValue;
        value *= (1.0 + combinedAmounts.relativeToBase);
        value += combinedAmounts.absolute;
        value *= (1.0 + combinedAmounts.relative);
        return Math.max(Math.min(value, attribute.maxValue), attribute.minValue);
    }

}

export interface AttributeModifierSource {

    /**
     * Gets the combined attribute modifier amounts for the given `attribute`.
     */
    getCombinedAttributeModifierAmountsOf(attribute: Attribute): CombinedAttributeModifierAmounts;

}
