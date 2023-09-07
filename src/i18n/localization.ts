import { downloadAndParse } from "../utils/network";
import { load as loadYaml } from "js-yaml";

export class LocalizationDictionary {
    
    private _dict: { [key: string]: string; } = {};

    addEntry(src: string, target: string): void {
        this._dict[src] = target;
    }

    translate(message: string): string {
        return this._dict[message] || message;
    }

    async loadFrom(url: string): Promise<void> {
        let obj = await downloadAndParse(url, loadYaml);
        if (obj) {
            Object.assign(this._dict, obj);
        }
    }

}
