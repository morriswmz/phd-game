import { FunctionTable, ExpressionEvaluator, CompiledExpression, FunctionTableProvider, ExpressionCompiler, compileExpression } from '../utils/expression';
import { GameStateBase } from '../gameState';

export interface EventExpressionFunctionTable extends FunctionTable {
    // Math functions. 
    random(): number;
    max(...values: number[]): number;
    min(...values: number[]): number;
    floor(x: number): number;
    round(x: number): number;
    ceil(x: number): number;
    clip(x: number, min: number, max: number): number;
    // Game state related function.
    eventOccurred(id: string): boolean;
    itemCount(id: string): number;
    totalMonths(): number;
    calcEffectValue(id: string): number;
}

export type CompiledEventExpression = CompiledExpression<EventExpressionFunctionTable>;
export type EventExpressionCompiler = ExpressionCompiler<EventExpressionFunctionTable>;
export type EventExpressionEvaluator = ExpressionEvaluator<EventExpressionFunctionTable>;
export type EventFunctionTableProvider = FunctionTableProvider<EventExpressionFunctionTable>;

export class EventExpressionEngine implements EventFunctionTableProvider, EventExpressionCompiler, EventExpressionEvaluator {

    private _fTable: EventExpressionFunctionTable;
    private _gameState: GameStateBase;
    private _cache: { [key: string]: CompiledEventExpression } = {};

    constructor(gs: GameStateBase) {
        this._gameState = gs;
        this._fTable = this._initFunctionTable();
    }

    private _initFunctionTable(): EventExpressionFunctionTable {
        return {
            getVar: varName => this._gameState.getVar(varName),
            eventOccurred: id => this._gameState.occurredEvents[id] != undefined,
            itemCount: id => this._gameState.playerInventory.count(id),
            totalMonths: () => this._gameState.getVar('year') * 12 + this._gameState.getVar('month'),
            calcEffectValue: s => 0,
            random: Math.random,
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
        return expr.fn(this.getClosure());
    }

}
