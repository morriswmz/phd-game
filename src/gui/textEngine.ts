import { LocalizationDictionary } from '../i18n/localization';
import { GameState } from '../gameState';
import { isVariableName } from '../utils/expression';

export interface GameTextEngine {
    /**
     * Renders the source text into HTML text.
     * Pipeline: original string -> variable interpolation + styling
     * Formats:
     * - {{varName:ndigits}} variable interpolation, number of digits is optional.
     * - __text__ underline
     * - **text** emphasize
     * - ##text## strong
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
}

export class SimpleGameTextEngine implements GameTextEngine {
    
    constructor(private _ldict: LocalizationDictionary, private _gs: GameState) {

    }

    render(src: string): string {
        // Step 1: interpolate
        src = src.replace(/\{\{([a-z0-9$_.]+)(:\d+)?\}\}/gi, (match, p1, p2) => {
            if (isVariableName(p1)) {
                let val = this._gs.getVar(p1, false);
                if (val == undefined) {
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
}

const TextStyleMarkupMap: { [key: string]: [string, string]; } = {
    '*': ['<em>', '</em>'],
    '#': ['<strong>', '</strong>'],
    '_': ['<span style="text-decoration: underline">', '</span>']
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
        // Must repeat once
        let curChar = s[idx];
        if (idx + 1 < s.length && s[idx + 1] === curChar) {
            if (idx > lastIdx) {
                result += s.substring(lastIdx, idx);
            }
            if (stack.length > 0 && curChar === stack[stack.length - 1]) {
                // Closing
                stack.pop();
                result += TextStyleMarkupMap[curChar][1];
            } else {
                // Opening
                stack.push(s[idx]);
                result += TextStyleMarkupMap[curChar][0];                
            }
            idx += 2;
            lastIdx = idx;
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
