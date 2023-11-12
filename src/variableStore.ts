import { JsonObject, JsonEncodable, JsonValue } from "./utils/json";

type EncodedNumber = number | 'NaN' | 'Infinity' | '-Infinity';

function isEncodedNumber(x: any): x is EncodedNumber {
    if (typeof x === 'number') return true;
    if (typeof x === 'string') {
        return x === 'NaN' || x === 'Infinity' || x === '-Infinity';
    }
    return false;
}

function encodeNumber(x: number): EncodedNumber {
    if (isNaN(x)) return 'NaN';
    if (!isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
    return x;
}

function decodeNumber(x: EncodedNumber) : number {
    if (typeof x === 'string') {
        if (x === 'NaN') return NaN;
        if (x === 'Infinity') return Infinity;
        if (x === '-Infinity') return -Infinity;
        throw new Error('Unable to decode ' + x);
    }
    return x;
}

export class VariableChangedEvent {

    // Indicates whether all variables are cleared.
    clear: boolean;
    varName: string;
    oldValue: number | undefined;
    newValue: number;

    constructor(clear: boolean, varName: string, oldValue: number | undefined, newValue: number) {
        this.clear = clear;
        this.varName = varName;
        this.oldValue = oldValue;
        this.newValue = newValue;
    }

}

type VariableChangeHandler = (sender: VariableStore, event: VariableChangedEvent) => void;

export class VariableStore implements JsonEncodable {

    private _variables: Record<string, number> = {};
    private _varLimits: Record<string, [number, number]> = {};

    /**
     * Variable changed event handler.
     */
    onVariableChanged: VariableChangeHandler | undefined;

    constructor() {}

    /**
     * Sets a numeric variable.
     * @param varName Name of the variable.
     * @param value Value.
     * @param checkExistence Whether the existence of this variable should be
     * checked first.
     */
    setVar(varName: string, value: number, checkExistence: boolean = false): void {
        if (checkExistence && !(varName in this._variables)) {
            throw new Error(`Variable "${varName}" does not exist.`);
        }
        if (this._varLimits[varName]) {
            if (value > this._varLimits[varName][1]) {
                value = this._varLimits[varName][1];
            }
            if (value < this._varLimits[varName][0]) {
                value = this._varLimits[varName][0];
            }
        }
        let oldValue = this._variables[varName];
        this._variables[varName] = value;
        if (oldValue !== value) {
            const e = new VariableChangedEvent(false, varName, oldValue, value);
            setTimeout(() => this.dispatchChangeEvent(e), 0);
        }
    }

    /**
     * Sets the lower bound and upper bound of a variable.
     * @param varName Name of the variable.
     * @param lb Lower bound.
     * @param ub Upper bound.
     */
    setVarLimits(varName: string, lb: number, ub: number): void {
        if (isNaN(lb)) throw new Error("Lower bound cannot be NaN");
        if (isNaN(ub)) throw new Error("Upper bound cannot be NaN");
        if (lb > ub) {
            throw new Error('Lower bound cannot be greater than upper bound.');
        }
        this._varLimits[varName] = [lb, ub];
        // Clamp the existing value if exists.
        if (!(varName in this._variables)) return;
        const oldValue = this._variables[varName];
        if (oldValue < lb) {
            this._variables[varName] = lb;
            const e = new VariableChangedEvent(false, varName, oldValue, lb);
            setTimeout(() => this.dispatchChangeEvent(e), 0);
        } else if (oldValue > ub) {
            this._variables[varName] = ub;
            const e = new VariableChangedEvent(false, varName, oldValue, ub);
            setTimeout(() => this.dispatchChangeEvent(e), 0);
        }
    }

    /**
     * Gets the lower bound and upper bound of a variable.
     * If such bounds are not defined, [-Infinity, Infinity] will be returned.
     * @param varName Name of the variable.
     */
    getVarLimits(varName: string): [number, number] {
        let limits = this._varLimits[varName];
        if (limits) {
            return [limits[0], limits[1]];
        } else {
            return [-Infinity, Infinity];
        }
    }

    getVar(varName: string, checkExistence: true): number;
    getVar(varName: string, checkExistence: false): number | undefined;
    getVar(varName: string, checkExistence: boolean = true): number | undefined {
        let value = this._variables[varName];
        if (value == undefined && checkExistence) {
            throw new Error(`Variable "${varName}" does not exist.`);
        }
        return value;
    }

    /**
     * Resets all variables.
     */
    reset(): void {
        this.dispatchChangeEvent(new VariableChangedEvent(true, '', 0, 0));
        this._variables = {};
    }

    dumpToConsole(): void {
        let lines: string[] = [];
        lines.push('[Variables (Limits)]');
        for (let varName in this._variables) {
            const limits = this._varLimits[varName];
            const limitsStr = limits ? ` ([${limits[0]}, ${limits[1]}])` : '';
            lines.push(`${varName}: ${this._variables[varName]}${limitsStr}`);
        }
        console.log(lines.join('\n'));
    }

    decodeFromJson(json: JsonValue): void {
        if (json === null || typeof json !== 'object' || Array.isArray(json)) {
            throw new Error('Non-null JSON object expected.');
        }
        this.reset();
        for (const varName in json) {
            const varValue = json[varName];
            if (isEncodedNumber(varValue)) {
                this.setVar(varName, decodeNumber(varValue));
            } else if (Array.isArray(varValue)) {
                if (varValue.length !== 3) {
                    throw new Error('Expect 3 elements: value, lower bound, upper bound.');
                }
                const [value, lb, ub] = varValue;
                if (!isEncodedNumber(value)) {
                    throw new Error('Invalid variable value.');
                }
                if (!isEncodedNumber(lb)) {
                    throw new Error('Invalid variable lower bound.');
                }
                if (!isEncodedNumber(ub)) {
                    throw new Error('Invalid variable upper bound.');
                }
                this.setVar(varName, decodeNumber(value));
                this.setVarLimits(varName, decodeNumber(lb), decodeNumber(ub));
            }
        }
    }

    /**
     * Encoding format:
     * ```
     * {
     *     // With limits
     *     "varName1": [$value1, $loweBound1, $upperBound1],
     *     // Without limits
     *     "varName2": $value2,
     *     ...
     * }
     * ```
     * Infinity, -Infinity, and NaN values are encoded as strings.
     */
    encodeAsJson(): JsonValue {
        let json: JsonObject = {};
        for (const varName in this._variables) {
            const varValue: number = this._variables[varName];
            if (varName in this._varLimits) {
                const [lb, ub] = this._varLimits[varName];
                json[varName] = [
                    encodeNumber(varValue), encodeNumber(lb), encodeNumber(ub)
                ];
            } else {
                json[varName] = encodeNumber(varValue);
            }
        }
        return json;
    }

    protected dispatchChangeEvent(event: VariableChangedEvent) {
        if (this.onVariableChanged) {
            this.onVariableChanged(this, event);
        }
    }

}
