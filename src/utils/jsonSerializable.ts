/**
 * Describes an object whose state can be saved/loaded from a JSON object.
 */
export interface JSONSerializable {

    /**
     * Restores the object state from the given JSON object.
     * @param obj A JSON object.
     */
    loadFromJSONObject(obj: any): void;
    
    /**
     * Saves the current object state to a JSON object.
     */
    saveToJSONObject(): any;

}
