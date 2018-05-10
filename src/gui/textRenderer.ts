import { LocalizationDictionary } from '../i18n/localization';
import { GameState } from '../gameState';
import { isVariableName } from '../utils/expression';

const TextStyles = {
    Underline: 1,
    Emphasize: 2,
    Strong: 4
};

const TextStyleMarkupMap: { [key: string]: [number, string, string]; } = {
    '*': [TextStyles.Emphasize, '<em>', '</em>'],
    '#': [TextStyles.Strong, '<strong>', '</strong>'],
    '_': [TextStyles.Underline, '<span style="text-decoration: underline">', '</span>']
};

/**
 * Renders rich text as an HTML string.
 * Pipeline: original string -> localization -> variable interpolation + styling
 * Formats:
 * - {{varName:ndigits}} variable interpolation, number of digits is optional.
 * - __text__ underline
 * - **text** emphasize
 * - ##text## strong
 * For example, if player.hope is 50, then "Hope: <**{{player.hope}}**>" will be
 * converted to "Hope: &lt;<em>50</em>&gt;".
 * @param s Original string to be rendered.
 * @param ldict Localization dictionary.
 * @param gs Game state.
 */
export function renderText(s: string, ldict: LocalizationDictionary, gs: GameState): string {
    s = ldict.translate(s);
    // Step 1: interpolate
    s = s.replace(/\{\{([a-z0-9$_.]+)(:\d+)?\}\}/gi, (match, p1, p2) => {
        if (isVariableName(p1)) {
            let val = gs.getVar(p1, false);
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
    s = escapeHTML(s);
    // Step 3: Add style
    return renderWithStyle(s);
}

export function escapeHTML(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderWithStyle(s: string): string {
    // Split into segments and render.
    let stack: number[] = [];
    let result = '';
    let idx = 0;
    let lastIdx = 0;
    while (idx < s.length) {
        if (!(s[idx] in TextStyleMarkupMap)) {
            ++idx;   
            continue;
        }
        if (idx + 1 < s.length && s[idx + 1] === s[idx]) {
            let newStyle = TextStyleMarkupMap[s[idx]][0];
            if (idx > lastIdx) {
                result += s.substring(lastIdx, idx);
            }
            if (newStyle === stack[stack.length - 1]) {
                // Closing
                stack.pop();
                result += TextStyleMarkupMap[s[idx]][2];
            } else {
                // Opening
                stack.push(newStyle);
                result += TextStyleMarkupMap[s[idx]][1];                
            }
            idx += 2;
            lastIdx = idx;
        }
    }
    if (stack.length > 0) {
        throw new Error('Unbalanced style markups.');
    }
    // Last one
    if (idx > lastIdx) {
        result += s.substring(lastIdx, idx);
    }
    return result;
}
