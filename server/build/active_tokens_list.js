import { performance } from "perf_hooks";
export default new (class ActiveTokensList {
    constructor() {
        this._tokensList = [];
    }
    /**
     * Create a new token with a given ID and log history size.
     * @param {string} tokenId
     * @param {number} historySize
     * @returns {Object}
     */
    create(tokenId, historySize) {
        const tokenMetadata = new TokenMetadata(tokenId, historySize);
        this._tokensList.push(tokenMetadata);
        return tokenMetadata;
    }
    /**
     * Retrieve an active token from its index number (which can be from `0` to
     * one minus the list's size that can be known by calling the `size` method).
     *
     * Returns `undefined` if there's no token at that index.
     * @param {number} idx
     * @returns {Object|undefined}
     */
    getFromIndex(idx) {
        return this._tokensList[idx];
    }
    /**
     * Removes an active token from its index number (which can be from `0` to
     * one minus the list's size that can be known by calling the `size` method).
     *
     * Returns `undefined` if there was no token at that index or the
     * corresponding `TokenMetadata` if there was.
     * @param {number} idx
     * @returns {Object|undefined}
     */
    removeIndex(idx) {
        return this._tokensList.splice(idx, 1)[0];
    }
    /**
     * Returns the number of currently active tokens in this `ActiveTokensList`.
     *
     * This value can then be used to infer all "indexes" that can be given to
     * methods such as `getFromIndex` or `removeIndex`.
     * @returns {number}
     */
    size() {
        return this._tokensList.length;
    }
    /**
     * Get the index number of the first token stored which has the given
     * `tokenId`.
     * Returns `-1` if no token uses that id.
     * @param {string} tokenId
     * @returns {number}
     */
    findIndex(tokenId) {
        return this._tokensList.findIndex((t) => t.tokenId === tokenId);
    }
    /**
     * Get the `TokenMetadata` object of the first token stored which has the
     * given `tokenId`.
     * Returns `undefined` if no token uses that id.
     * @param {string} tokenId
     * @returns {Object|undefined}
     */
    find(tokenId) {
        return this._tokensList.find((t) => t.tokenId === tokenId);
    }
})();
/**
 * For a given token ID, list store all clients and the potential device linked
 * to it.
 * @class TokenMetadata
 */
export class TokenMetadata {
    /**
     * @param {string} tokenId - ID identifying the token
     * @param {number} historySize - Maximum number of logs kept in the log
     * history associated with this token.
     */
    constructor(tokenId, historySize) {
        this.tokenId = tokenId;
        this.timestamp = performance.now();
        this.clients = [];
        this.device = null;
        this._initData = null;
        this._history = {
            history: [],
            maxHistorySize: historySize,
        };
    }
    /**
     * Update of reset the `DeviceInitData` associated with this `TokenMetadata`.
     * @param {Object|null} initData
     */
    setDeviceInitData(initData) {
        this._initData = initData;
        this._history.history = [];
    }
    /**
     * Get the `DeviceInitData` associated with this `TokenMetadata`.
     * Returns `null` if no `DeviceInitData` is associated.
     * @param {Object|null}
     */
    getDeviceInitData() {
        return this._initData;
    }
    /**
     * Add a new log to this token's log history.
     * Removes the most ancient log if the maximum history size is already
     * reached.
     * @param {string} log - The Log line to add to history
     */
    addLogToHistory(log) {
        if (this._history.maxHistorySize === 0) {
            return;
        }
        if (this._history.history.length >= this._history.maxHistorySize) {
            this._history.history.shift();
        }
        this._history.history.push(log);
    }
    /**
     * Returns the current log history associated with this token.
     * @returns {Object}
     */
    getCurrentHistory() {
        return this._history;
    }
}
