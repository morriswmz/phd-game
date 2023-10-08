/**
 * A simple expression evaluation system for checking conditions, updating
 * weights, or changing variables using events.
 */

/**
 * Represents the type of a token.
 */
enum TokenType {
    Name,
    Number,
    Boolean,
    String,
    Operator,
    Delimiter,
    Whitespace // We do not store whitespace tokens.
}

/**
 * Represents a token object.
 */
interface Token {
    text: string;
    type: TokenType;
}

/**
 * Regular expressions for different tokens.
 */
const regexGroups = [
    {
        tokenType: TokenType.Whitespace,
        regex: /^\s+/g
    },
    {
        tokenType: TokenType.Boolean,
        regex: /^true|^false/
    },
    {
        tokenType: TokenType.Name,
        regex: /^[a-z_$][a-z0-9_$]*(\.[a-z_$][a-z0-9_$]*)*/i
    },
    {
        tokenType: TokenType.Number,
        regex: /^[+-]?Infinity|^NaN|^(\d+(\.\d+)?([Ee][+-]?\d+)?)/
    },
    {
        tokenType: TokenType.String,
        regex: /^'(\\['\\]|[^'])*'/
    },
    {
        tokenType: TokenType.Operator,
        regex: /^(\+|-|\*|\/|%|\(|\)|>=|>|<=|<|&&|&|\|\||\||!|:|\?|===|==|!==|!=)/
    },
    {
        tokenType: TokenType.Delimiter,
        regex: /^,/
    }
];

export function isVariableName(s: string): boolean {
    return /^[a-z_$][a-z0-9_$]*(\.[a-z_$][a-z0-9_$]*)*$/i.test(s);
}

/**
 * Tokenizes a simple expression.
 * @param expr String representation of the simple expression.
 */
function tokenize(expr: string): Token[] {
    let idx = 0;
    let tokens: Token[] = [];
    while (expr.length > 0) {
        let matched = false;
        for (let g of regexGroups) {
            let match = g.regex.exec(expr);
            if (match) {
                matched = true;
                if (g.tokenType !== TokenType.Whitespace) {
                    tokens.push({
                        type: g.tokenType,
                        text: match[0]
                    });
                }
                expr = expr.slice(match[0].length);
                break;
            }
        }
        if (!matched) {
            throw new Error(`Invalid syntax starting at: ${expr}`);
        }
    }
    return tokens;
}

/**
 * Consists of the available functions when evaluating the expressions.
 * These functions should NOT depend on this.
 */
export interface FunctionTable {
    /**
     * Retrieves the numerical value of a game variable.
     * This function must be implemented.
     * @param varName Name of the variable.
     */
    getVar(varName: string): number;

    /**
     * Other optional functions.
     */
    [fname: string]: Function;
}

export interface FunctionTableProvider<T extends FunctionTable> {
    /**
     * Returns a "dictionary" of functions where none of the functions should
     * depend of `this`. These functions will be made available when evaluating
     * simple expressions.
     */
    getClosure(): T;
    /**
     * Checks if the specified function name exists.
     */
    existsFunction(fname: string): boolean;
}

export interface CompiledExpression<T extends FunctionTable> {
    /**
     * Retrieves the source code for this expression.
     */
    readonly source: string;

    /**
     * Compiled function.
     * @param fTable Function table.
     */
    fn(fTable: T): number; 
}

export interface ExpressionEvaluator<T extends FunctionTable> {

    eval(expr: CompiledExpression<T>): number;

}

export interface ExpressionCompiler<T extends FunctionTable> {

    /**
     * Converts a string or a number of a compiled expression.
     * @param expr Expression.
     */
    compile(expr: string | number): CompiledExpression<T>;

}

/**
 * Compiles a simple expression into a JavaScript function.
 * A simple expression consists of:
 *  Names: year, player.hope, ...
 *         a-z, 0-9, $_., all segments cannot start with 0-9
 *  Numbers: 12, -1.3, 1e-8, Infinity, -Infinity, NaN, ...
 *  Strings: 'hello', 'a\nb', ...
 *  Operators: +, -, *, /, (, ), ...
 *  White spaces
 * This compiler will simply replace variable names with proper JavaScript
 * accessors (e.g., `player.hope` -> `__functions.getVar('player.hope')`),
 * and function names with proper function calls (e.g., `hasItem` ->
 * `__functions.hasItem`), and then let JavaScript compiles the functions.
 * For instance, the following expression
 *  hasItem('idea') ? player.hope + 1 : 0
 * will be converted to
 *  __functions.has('idea') ? __functions.getVar('player.hope') + 1 : 0;
 * @param expr String representation of the simple expression.
 */
export function compileExpression<T extends FunctionTable>(expr: string, fp: FunctionTableProvider<T>): CompiledExpression<T> {
    const tokens = tokenize(expr);
    let funcBody = '"use strict";\nreturn (';
    let idx = 0;
    while (idx < tokens.length) {
        const curToken = tokens[idx];
        switch (curToken.type) {
            case TokenType.Name:
                if (curToken.text.indexOf('.') > 0 || idx >= tokens.length - 2 || tokens[idx + 1].type !== TokenType.Operator || tokens[idx + 1].text !== '(') {
                    // Normal variable.
                    funcBody += `__functions.getVar('${curToken.text}')`;
                } else {
                    // Function call.
                    if (fp.existsFunction(curToken.text)) {
                        funcBody += `__functions.` + curToken.text;                        
                    } else {
                        throw new Error(`Unsupported function "${curToken.text}".`);
                    }
                }
                break;
            case TokenType.Number:
            case TokenType.Boolean:
            case TokenType.Operator:
            case TokenType.String:
            case TokenType.Delimiter:
                funcBody += curToken.text;
                break;
            default:
                throw new Error('Unexpected token type.');
        }
        ++idx;
    }
    funcBody += ');'
    let fn = new Function('__functions', funcBody);
    return {
        source: expr,
        fn: <(fc: T) => number>fn
    };
}

