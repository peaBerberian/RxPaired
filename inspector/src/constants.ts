/* eslint-disable @typescript-eslint/naming-convention */
/** @see .npmrc file */
declare const _INSPECTOR_DEBUGGER_URL_ : string;
declare const __DEVICE_SCRIPT_URL__ : string;
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * URL of the server (relative to the client).
 * Localhost by default
 */
export const SERVER_URL = _INSPECTOR_DEBUGGER_URL_;

/** URL to the JavaScript script that should run on the device. */
export const CLIENT_SCRIPT_URL = __DEVICE_SCRIPT_URL__;

/** Maximum number of individual logs that will be in the DOM at any given time. */
export const MAX_DISPLAYED_LOG_ELEMENTS = 9001;

/** Key used in local storage to store module-related configuration. */
export const MODULE_CONFIG_LS_ITEM = "module-config";

/** Every state property's name. */
export enum STATE_PROPS {
  /**
   * The "mode" css the inspector is in:
   *   - "dark": Dark mode is enabled
   *   - "light": Light mode is enabled
   */
  CSS_MODE = "cssMode",
  /** Array of the inspector module's id which are currently closed. */
  CLOSED_MODULES = "closedModules",
  /**
   * Object where:
   *   - the keys are the inspector module's id
   *   - the value is their width ratio:
   *     - `2` if the module takes half the page's width
   *     - `1` if the module takes the full width.
   *
   * Empty object by default, only the modules whose default width
   * ratio has been updated should be added.
   */
  WIDTH_RATIOS = "widthRatios",
  /** Array of the inspector module's id which are currently minimized. */
  MINIMIZED_MODULES = "minimizedModules",
  /** Array of the inspector module's id in the order they are in. */
  MODULES_ORDER = "modulesOrder",
  /** Each log in chronological order, in an array. */
  LOGS_HISTORY = "logsHistory",
  /**
   * History of "buffer gap" measures.
   *
   * This is an array of objects with two properties:
   *   - `timestamp` (number): monotically raising time value representing the
   *     time at which the measure was taken, in milliseconds.
   *   - `bufferGap` (number|undefined): Known buffer gap at the time of the
   *     measure.
   */
  BUFFER_GAPS = "bufferGaps",
  /**
   * Current playback position, in seconds.
   */
  POSITION = "position",
  /** Current RxPlayer's state, as a string. */
  PLAYER_STATE = "state",
  /**
   * Represent the TimeRanges where data is buffered on the media element
   * associated to the RxPlayer, in chronological order.
   *
   * Values are in seconds and stored as tuples: `[start, end]`.
   */
  BUFFERED_RANGES = "bufferedRanges",
  /**
   * Estimated `duration` linked to the media element, in seconds.
   */
  CONTENT_DURATION = "duration",
  /**
   * Information on what is stored on the media element video's SourceBuffer.
   */
  VIDEO_INVENTORY = "videoInventory",
  /**
   * Information on what is stored on the media element audio's SourceBuffer.
   */
  AUDIO_INVENTORY = "audioInventory",
  /**
   * If set, a log has been selected and thus all charts should refer to the
   * playback conditions up to that point.
   *
   * Set to the index in the `LOGS_HISTORY` array.
   */
  SELECTED_LOG_INDEX = "selectedLogIndex",
}

/**
 * State properties listen by the inspector modules, which actually reflect the
 * RxPlayer state on the page.
 */
export interface InspectorState {
  [STATE_PROPS.LOGS_HISTORY]? : string[];
  [STATE_PROPS.BUFFER_GAPS]? : Array<{
    bufferGap : number | undefined;
    timestamp : number;
  }>;
  [STATE_PROPS.POSITION]? : number;
  [STATE_PROPS.PLAYER_STATE]? : string;
  [STATE_PROPS.BUFFERED_RANGES]? : Array<[number, number]>;
  [STATE_PROPS.CONTENT_DURATION]? : number;
  [STATE_PROPS.VIDEO_INVENTORY]? : InventoryTimelineInfo;
  [STATE_PROPS.AUDIO_INVENTORY]? : InventoryTimelineInfo;
  [STATE_PROPS.SELECTED_LOG_INDEX]? : number | undefined;
}

/** State linked to the Inspector page layout and configuration. */
export interface ConfigState {
  [STATE_PROPS.CSS_MODE]? : string;
  [STATE_PROPS.CLOSED_MODULES]? : string[];
  [STATE_PROPS.WIDTH_RATIOS]? : Partial<Record<string, number>>;
  [STATE_PROPS.MINIMIZED_MODULES]? : string[];
  [STATE_PROPS.MODULES_ORDER]? : string[];
}

/**
 * Information on all contents buffered by the RxPlayer on a specific buffer.
 */
export interface InventoryTimelineInfo {
  /**
   * Information on all `Representation`s referenced in `ranges`.
   *
   * On that object:
   *   - The keys are the corresponding `letter`, an identifier used by
   *     `ranges`.
   *   - The values are the corresponding `Representation`'s information.
   */
  representations: Record<string, InventoryTimelineRepresentationInfo>;
  /** Buffered data information, in chronological order. */
  ranges: InventoryTimelineRangeInfo[];
}

/** Information indentifying a single Representation (i.e. quality). */
export interface InventoryTimelineRepresentationInfo {
  /** Bitrate, in bits per seconds, linked to this Representation. */
  bitrate : number;
  /** `id` used in the RxPlayer to refer to that Representation's Period. */
  periodId : string;
  /** `id` used in the RxPlayer to refer to this Representation. */
  representationId : string;
}

/**
 * Information of data buffered by one of the RxPlayer's buffer relative to a
 * single Representation (i.e. quality)
 */
export interface InventoryTimelineRangeInfo {
  /** Start time this data begins at in the buffer, in seconds. */
  start: number;
  /** End time this data begins at in the buffer, in seconds. */
  end: number;
  /**
   * Identifier for the Representation.
   * The same value is used in the `InventoryTimelineInfo` object to index a
   * particular Representation.
   */
  letter: string;
}
