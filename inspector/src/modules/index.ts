import { ConfigState, InspectorState } from "../constants";
import ObservableState from "../observable_state";
import BufferContentModule from "./buffer_content_module";
import BufferSizeModule from "./buffer_size_module";
import HowToUseModule from "./how_to_use_module";
import LogModule from "./log_module";
import PlayerGeneralInfoModule from "./player_general_info_module";

export interface ModuleInformation {
  /** Title appearing in the title bar of a module. */
  moduleTitle : string;

  /** Id used internally to identify the module. Should be unique and permanent. */
  moduleId : string;

  /**
   * Module function outputing its body and capabilities.
   * Will be call each time we want to create the module.
   */
  moduleFn : (args : ModuleFunctionArguments) => {
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
  };

  /** If set to `false` this module can never be closed. */
  isClosable : boolean;
}

export interface ModuleFunctionArguments {
  /** Object reporting the current application's state. */
  state : ObservableState<InspectorState>;
  /** Object reporting the current page config's state. */
  configState : ObservableState<ConfigState>;
  /** Token ID currently used to identify which device we are communicating with. */
  tokenId : string;
}

const ALL_MODULES : ModuleInformation[] = [
  {
    moduleTitle: "How to use this tool",
    moduleId: "howto",
    moduleFn: HowToUseModule,
    isClosable: true,
  },

  {
    moduleTitle: "Player general information",
    moduleId: "gen-infos",
    moduleFn: PlayerGeneralInfoModule,
    isClosable: true,
  },

  {
    moduleTitle: "Buffer gap evolution chart",
    moduleId: "buffer-size",
    moduleFn: BufferSizeModule,
    isClosable: true,
  },

  {
    moduleTitle: "Buffer content chart",
    moduleId: "buffer-content",
    moduleFn: BufferContentModule,
    isClosable: true,
  },

  {
    moduleTitle: "Logs",
    moduleId: "log",
    moduleFn: LogModule,
    isClosable: false,
  },
];

export default ALL_MODULES;
