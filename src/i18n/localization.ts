import { downloadAndParse } from "../utils/network";
import { load as loadYaml } from "js-yaml";

export class LocalizationDictionary {
    
    private _dict: Record<string, string> = {};
    private _requiredTranslationKeys: Record<string, boolean> = {};

    addTranslation(translationKey: string, translation: string): void {
        this._dict[translationKey] = translation;
    }

    addRequiredKey(translationKey: string): void {
        this._requiredTranslationKeys[translationKey] = true;
    }

    translate(translationKey: string): string {
        const translation = this._dict[translationKey]
        return translation == undefined ? translationKey : translation;
    }

    /**
     * Dumps keys of missing translations as a list, in lexicographical order.
     */
    dumpMissingTranslationKeys(): string[] {
        let missingKeys: string[] = [];
        for (const requiredKey in this._requiredTranslationKeys) {
            if (!(requiredKey in this._dict)) {
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
        let requiredKeys = Object.keys(this._requiredTranslationKeys);
        requiredKeys.sort();
        return requiredKeys;
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
