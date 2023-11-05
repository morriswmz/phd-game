import { LocalizationDictionary } from '../i18n/localization';
import { VariableStore } from '../variableStore';
import { isVariableName } from '../utils/expression';
import { RandomSource } from '../utils/random';

export interface GameTextEngine {
    /**
     * Renders the source text into HTML text.
     * Pipeline: original string -> variable interpolation + styling
     * Formats:
     * * {{varName:ndigits}} Variable interpolation, number of digits is
     *                       optional.
     * * {{@specialVarName}} Special variable interpolation. See
     *                       `_evalSpecialVariable()` for more details.
     * * __text__ underline
     * * **text** emphasize
     * * ##text## strong
     * * ``text`` vertabim, no additional style modifier allowed inside.
     *            Variable interpolation still applies inside.
     * For example, if player.hope is 50, then "Hope: <**{{player.hope}}**>" will be
     * converted to "Hope: &lt;<em>50</em>&gt;".
     * @param src Source text.
     */
    render(src: string): string;

    /**
     * Localizes and then renders the source text into HTML text.
     * @param src Source text.
     */
    localizeAndRender(src: string): string;

    /**
     * Only localizes the source text.
     * @param src Source text.
     */
    localize(src: string): string;

    /**
     * Gets the underlying localization dictionary.
     */
    getLocalizationDictionary(): LocalizationDictionary;
}

export class SimpleGameTextEngine implements GameTextEngine {
    
    constructor(private _ldict: LocalizationDictionary,
                private _variableStore: VariableStore,
                private _random: RandomSource) {

    }

    render(src: string): string {
        // Step 1: interpolate
        src = src.replace(/\{\{(@?[a-z0-9$_.]+)(:\d+)?\}\}/gi, (match, p1, p2) => {
            if (p1[0] === '@') {
                // Special variables
                let specialVarName = p1.substring(1);
                return this._evalSpecialVariable(specialVarName) || match;
            } else if (isVariableName(p1)) {
                // Variables in VariableStore
                let val = this._variableStore.getVar(p1, false);
                if (val == undefined) {
                    console.log('Undefined variable ' + p1);
                    return match;
                }
                if (p2 == undefined) {
                    return val.toString();
                } else {
                    return val.toFixed(parseInt(p2.slice(1)));
                }
            } else {
                return match;
            }
        });
        // Step 2: Escape
        src = escapeHTML(src);
        // Step 3: Add style
        return renderWithStyle(src);
    }
    
    localizeAndRender(src: string): string {
        return this.render(this.localize(src));
    }
    
    localize(src: string): string {
        return this._ldict.translate(src);
    }

    getLocalizationDictionary(): LocalizationDictionary {
        return this._ldict;
    }

    private _evalSpecialVariable(varName: string): string | undefined {
        if (!isVariableName(varName)) {
            return undefined;
        }
        switch (varName) {
            case 'seed':
                return this._random.seed;
            case 'seedUrl':
                let path = window.location.protocol + '//' + 
                           window.location.host + window.location.pathname;
                let encodedSeed = encodeURIComponent(this._random.seed)
                return `${path}#init_seed=${encodedSeed}`;
            default:
                return undefined;
        }
    }
}

const TextStyleMarkupMap: { [key: string]: [string, string]; } = {
    '*': ['<em>', '</em>'],
    '#': ['<strong>', '</strong>'],
    '_': ['<span style="text-decoration: underline">', '</span>'],
    '`': ['<code>', '</code>']
};

function escapeHTML(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderWithStyle(s: string): string {
    // Split into segments and render.
    let stack: string[] = [];
    let result = '';
    let idx = 0;
    let lastIdx = 0;
    while (idx < s.length) {
        if (!(s[idx] in TextStyleMarkupMap)) {
            ++idx;   
            continue;
        }
        // Must repeat once and not inside a code block
        let curChar = s[idx];
        if (idx + 1 < s.length && s[idx + 1] === curChar) {
            if (idx > lastIdx) {
                result += s.substring(lastIdx, idx);
            }
            let markupConsumed = false;
            if (stack.length > 0 && curChar === stack[stack.length - 1]) {
                // Closing
                stack.pop();
                result += TextStyleMarkupMap[curChar][1];
                markupConsumed = true;
            } else if (stack.length === 0 || stack[stack.length - 1] !== '`') {
                // Opening
                stack.push(s[idx]);
                result += TextStyleMarkupMap[curChar][0];
                markupConsumed = true;
            }
            idx += 2;
            if (markupConsumed) {
                lastIdx = idx;
            }
        } else {
            ++idx;
        }
    }
    // Last segment.
    if (idx > lastIdx) {
        result += s.substring(lastIdx, idx);
    }
    // Auto closing
    while (stack.length > 0) {
        result += TextStyleMarkupMap[<string>stack.pop()][1];
    }
    return result;
}
