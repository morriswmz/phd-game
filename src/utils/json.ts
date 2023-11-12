// See https://www.json.org/json-en.html.
// Caveat: vanilla JS numbers can also be NaN or Infinity, which is not covered
// in JSON.
export type JsonValue = JsonObject | JsonArray | string | number | boolean | null;
export type JsonArray = Array<JsonValue>;
export type JsonObject = { [key: string]: JsonValue; };

/**
 * Describes an object whose state can be saved/loaded from a JSON object.
 */
export interface JsonEncodable {

    /**
     * Restores the object state from the given JSON value.
     */
    decodeFromJson(json: JsonValue): void;
    
    /**
     * Saves the current object state to a JSON value.
     */
    encodeAsJson(): JsonValue;

}
