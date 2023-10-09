import { downloadAndParse } from "../utils/network";
import { load as loadYaml } from "js-yaml";

export class LocalizationDictionary {
    
    private _dict: Map<string, string> = new Map();
    private _requiredTranslationKeys: Set<string> = new Set();

    addTranslation(translationKey: string, translation: string): void {
        this._dict.set(translationKey, translation);
    }

    addRequiredKey(translationKey: string): void {
        this._requiredTranslationKeys.add(translationKey);
    }

    translate(translationKey: string): string {
        const translation = this._dict.get(translationKey)
        return translation == undefined ? translationKey : translation;
    }

    /**
     * Dumps keys of missing translations as a list, in lexicographical order.
     */
    dumpMissingTranslationKeys(): string[] {
        let missingKeys: string[] = [];
        for (const requiredKey of this._requiredTranslationKeys) {
            if (!this._dict.has(requiredKey)) {
                missingKeys.push(requiredKey);
            }
        }
        missingKeys.sort();
        return missingKeys;
    }

    /**
     * Dumps all keys of required translations as a list, in lexicographical
     * order.
     */
    dumpRequiredTranslationKeys(): string[] {
        let requiredKeys = [...this._requiredTranslationKeys];
        requiredKeys.sort();
        return requiredKeys;
    }

    /**
     * Dumps all keys with translations but are not required as a list, in
     * lexicographical order.
     */
    dumpUnnecessaryTranslationKeys(): string[] {
        let unnecessaryKeys: string[] = [];
        for (const key of this._dict.keys()) {
            if (!this._requiredTranslationKeys.has(key)) {
                unnecessaryKeys.push(key);
            }
        }
        unnecessaryKeys.sort();
        return unnecessaryKeys;
    }

    async loadFrom(url: string): Promise<void> {
        let obj: any = await downloadAndParse(url, loadYaml);
        if (obj == undefined) {
            throw new Error(`Failed to load translation file from: ${url}`);
        }
        let nTranslations = 0;
        for (let translationKey in obj) {
            const translation = obj[translationKey];
            if (typeof translation !== 'string') {
                throw new Error(
                    `Translation of "${translationKey}" should be a string.`);
            }
            this.addTranslation(translationKey, translation);
            ++nTranslations;
        }
        console.log(`Successfully loaded ${nTranslations} translations.`);
    }

}
