import { ConfigState, InspectorState } from "../constants";
import ObservableState from "../observable_state";
import generateAudioVideoBufferContentModule from "./buffer_audio_video_content_module";
import BufferContentModule from "./buffer_content_module";
import BufferSizeModule from "./buffer_size_module";
import HowToUseModule from "./how_to_use_module";
import LogModule from "./log_module";
import PlayerGeneralInfoModule from "./player_general_info_module";

/**
 * All modules that are exported, in order of display
 * @see ModuleInformation
 */
const ALL_MODULES : ModuleInformation[] = [
  {
    moduleTitle: "How to use this tool",
    moduleId: "howto",
    moduleFn: HowToUseModule,
    isClosable: true,
    isHalfWidthByDefault: false,
    contexts: ["live-debugging"],
  },

  {
    moduleTitle: "Player general information",
    moduleId: "gen-infos",
    moduleFn: PlayerGeneralInfoModule,
    isClosable: true,
    isHalfWidthByDefault: false,
    contexts: ["live-debugging", "post-analysis"],
  },

  {
    moduleTitle: "Logs",
    moduleId: "log",
    moduleFn: LogModule,
    isClosable: false,
    isHalfWidthByDefault: true,
    contexts: ["live-debugging", "post-analysis"],
  },

  {
    moduleTitle: "Buffer gap evolution chart",
    moduleId: "buffer-size",
    moduleFn: BufferSizeModule,
    isClosable: true,
    isHalfWidthByDefault: true,
    contexts: ["live-debugging", "post-analysis"],
  },

  {
    moduleTitle: "Video SourceBuffer",
    moduleId: "video-sb",
    moduleFn: generateAudioVideoBufferContentModule("video"),
    isClosable: true,
    isHalfWidthByDefault: true,
    contexts: ["live-debugging", "post-analysis"],
  },

  {
    moduleTitle: "Audio SourceBuffer",
    moduleId: "audio-sb",
    moduleFn: generateAudioVideoBufferContentModule("audio"),
    isClosable: true,
    isHalfWidthByDefault: true,
    contexts: ["live-debugging", "post-analysis"],
  },

  {
    moduleTitle: "Buffer content chart",
    moduleId: "buffer-content",
    moduleFn: BufferContentModule,
    isClosable: true,
    isHalfWidthByDefault: true,
    contexts: ["live-debugging", "post-analysis"],
  },
];

export default ALL_MODULES;

export interface ModuleInformation {
  /** Title appearing in the title bar of a module. */
  moduleTitle : string;

  /** Id used internally to identify the module. Should be unique and permanent. */
  moduleId : string;

  /**
   * Module function outputing its body and capabilities.
   * Will be call each time we want to create the module.
   */
  moduleFn : ModuleFunction;

  /** If set to `false` this module can never be closed. */
  isClosable : boolean;

  /** If set to true this Module has half the width by default. */
  isHalfWidthByDefault: boolean;

  /**
   * Pages in which the current module can appear:
   *   - "live-debugging": If present, this module will appear when doing
   *      live-debugging.
   *   - "post-analysis": If present, this module will also appear when doing
   *     post-analysis (non-live-debugging)
   */
  contexts: Array<"live-debugging" | "post-analysis">;
}

export type ModuleFunction = (args : ModuleFunctionArguments) =>
  ModuleObject | null;

export interface ModuleObject {
  /** The module's HTML body. */
  body : HTMLElement;

  /**
   * If defined, the module will be assumed to be clear-able. A button
   * allowing to call this function might appear and trigger that
   * function.
   */
  clear? : () => void;

  /**
   * If defined, this is the logic that will be called when the module is
   * closed.
   * This function should clear all resources used by the module.
   */
  destroy? : () => void;
}

export interface ModuleFunctionArguments {
  /** Object reporting the current application's state. */
  state : ObservableState<InspectorState>;
  /** Object reporting the current page config's state. */
  configState : ObservableState<ConfigState>;
  /** Token ID currently used to identify which device we are communicating with. */
  tokenId? : string | undefined;
}
