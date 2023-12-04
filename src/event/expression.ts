import { FunctionTable, ExpressionEvaluator, CompiledExpression, FunctionTableProvider, ExpressionCompiler, compileExpression } from '../utils/expression';
import { VariableStore } from '../variableStore';
import { EventOccurrenceTracker } from './core';
import { RandomSource } from '../utils/random';
import { Inventory } from '../effect/item';
import { StatusTable } from '../effect/status';
import { AttributeModifier, AttributeRegistry } from '../effect/attribute';

export interface EventExpressionFunctionTable extends FunctionTable {
    // Math functions. 
    random(): number;
    randi(x: number): number;
    max(...values: number[]): number;
    min(...values: number[]): number;
    floor(x: number): number;
    round(x: number): number;
    ceil(x: number): number;
    clip(x: number, min: number, max: number): number;
    /**
     * Sets variable limits.
     */
    setVarLimits(varName: string, lb: number, ub: number): void;
    /**
     * Retrieves the upper bound of a game variable.
     */
    upperBound(varName: string): number;
    /**
     * Retrieves the lower bound of a game variable.  
     */  
    lowerBound(varName: string): number;
    /**
     * Checks if the specified event has occurred.
     */
    eventOccurred(id: string): boolean;
    /**
     * Returns the number of specified items.
     */
    itemCount(id: string): number;
    /**
     * Returns the total months.
     */
    totalMonths(): number;
    /**
     * Checks if the player has the specified status.
     */
    hasStatus(id: string): boolean;
    /**
     * Calculates the give attribute's value.
     */
    getAttributeValue(id: string): number;
}

export type CompiledEventExpression = CompiledExpression<EventExpressionFunctionTable>;
export type EventExpressionCompiler = ExpressionCompiler<EventExpressionFunctionTable>;
export type EventExpressionEvaluator = ExpressionEvaluator<EventExpressionFunctionTable>;
export type EventFunctionTableProvider = FunctionTableProvider<EventExpressionFunctionTable>;

export class EventExpressionEngine implements EventFunctionTableProvider, EventExpressionCompiler, EventExpressionEvaluator {

    private _fTable: EventExpressionFunctionTable;
    private _variableStore: VariableStore;
    private _attributes: AttributeRegistry;
    private _inventory: Inventory;
    private _statusTable: StatusTable;
    private _random: RandomSource
    private _eventOccurrenceTracker: EventOccurrenceTracker;
    private _cache: { [key: string]: CompiledEventExpression } = {};

    constructor(variableStore: VariableStore, attributes: AttributeRegistry,
                inventory: Inventory, statusTable: StatusTable,
                random: RandomSource, tracker: EventOccurrenceTracker) {
        this._variableStore = variableStore;
        this._attributes = attributes;
        this._inventory = inventory;
        this._statusTable = statusTable;
        this._random = random;
        this._eventOccurrenceTracker = tracker;
        this._fTable = this._initFunctionTable();
    }

    private _initFunctionTable(): EventExpressionFunctionTable {
        return {
            getVar: varName => this._variableStore.getVar(varName, true),
            setVarLimits: (varName: string, lb: number, ub: number) => this._variableStore.setVarLimits(varName, lb, ub),
            eventOccurred: id => this._eventOccurrenceTracker.getEventOccurrenceCount(id) > 0,
            upperBound: varName => this._variableStore.getVarLimits(varName)[1],
            lowerBound: varName => this._variableStore.getVarLimits(varName)[0],
            itemCount: id => this._inventory.count(id),
            totalMonths: () => this._variableStore.getVar('year', true) * 12 + this._variableStore.getVar('month', true),
            getAttributeValue: (id) => {
                const attribute = this._attributes.get(id);
                const amountsItem = this._inventory.getCombinedAttributeModifierAmountsOf(attribute);
                const amountsStatus = this._statusTable.getCombinedAttributeModifierAmountsOf(attribute);
                const value = AttributeModifier.CalculateAttributeValue(attribute, {
                    absolute: amountsItem.absolute + amountsStatus.absolute,
                    relative: amountsItem.relative + amountsStatus.relative,
                    relativeToBase: amountsItem.relativeToBase + amountsStatus.relativeToBase
                });
                return value;
            },
            hasStatus: id => this._statusTable.count(id) > 0,
            random: () => this._random.next(),
            randi: x => Math.floor(this._random.next() * x),
            max: Math.max,
            min: Math.min,
            floor: Math.floor,
            round: Math.round,
            ceil: Math.ceil,
            clip: (x, min, max) => x < min ? x : (x > max ? max : x)
        };
    }

    getClosure(): EventExpressionFunctionTable {
        return this._fTable;
    }

    existsFunction(fname: string): boolean {
        return this._fTable[fname] != undefined;
    }

    compile(expr: string | number): CompiledEventExpression {
        if (typeof expr === "number") {
            return {
                source: expr.toString(),
                fn: () => expr
            };
        }
        if (!this._cache[expr]) {
            this._cache[expr] = compileExpression(expr, this);
        }
        return this._cache[expr];
    }

    eval(expr: CompiledExpression<EventExpressionFunctionTable>): number {
        let val = expr.fn(this.getClosure());
        if (isNaN(val)) throw new Error('Expression produced NaN.');
        return val;
    }

}
