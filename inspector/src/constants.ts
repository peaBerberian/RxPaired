/* eslint-disable @typescript-eslint/naming-convention */
declare const _INSPECTOR_DEBUGGER_URL_ : string;
declare const __DEVICE_SCRIPT_URL__ : string;
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * SERVER_URL of the server (relative to the client).
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
  CSS_MODE = "cssMode",
  CLOSED_MODULES = "closedModules",
  WIDTH_RATIOS = "widthRatios",
  MINIMIZED_MODULES = "minimizedModules",
  MODULES_ORDER = "modulesOrder",
  LOGS_HISTORY = "logsHistory",
  BUFFER_GAPS = "bufferGaps",
  POSITION = "position",
  PLAYER_STATE = "state",
  BUFFERED_RANGES = "bufferedRanges",
  CONTENT_DURATION = "duration",
  VIDEO_INVENTORY = "videoInventory",
  AUDIO_INVENTORY = "audioInventory",
  SELECTED_LOG_INDEX = "selectedLogIndex",
}

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

export interface ConfigState {
  [STATE_PROPS.CSS_MODE]? : string;
  [STATE_PROPS.CLOSED_MODULES]? : string[];
  [STATE_PROPS.WIDTH_RATIOS]? : Partial<Record<string, number>>;
  [STATE_PROPS.MINIMIZED_MODULES]? : string[];
  [STATE_PROPS.MODULES_ORDER]? : string[];
}

export interface InventoryTimelineInfo {
  representations: Record<string, InventoryTimelineRepresentationInfo>;
  ranges: InventoryTimelineRangeInfo[];
}

export interface InventoryTimelineRepresentationInfo {
  bitrate : number;
  periodId : string;
  representationId : string;
}

export interface InventoryTimelineRangeInfo {
  start: number;
  end: number;
  letter: string;
}
