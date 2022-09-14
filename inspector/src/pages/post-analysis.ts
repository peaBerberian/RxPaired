import { ConfigState, InspectorState, STATE_PROPS } from "../constants";
import createModules from "../create_modules";
import { createCompositeElement, createElement } from "../dom-utils";
import ObservableState, { UPDATE_TYPE } from "../observable_state";
import { updateStatesFromLogGroup } from "../update_state_from_log";
import { createClearStoredConfigButton, createDarkLightModeButton } from "./utils";

const START_LOG_LINE_REGEXP = /^[0-9]+\.[0-9]{2} \[/;

/**
 * @param {Object} configState
 */
export default function generatePostAnalysisPage(
  configState : ObservableState<ConfigState>
) : void {
  const inspectorState = new ObservableState<InspectorState>();
  const headerElt = createPostDebuggerHeaderElement(configState, inspectorState);
  document.body.appendChild(headerElt);
  const modulesContainerElt = createElement("div");
  document.body.appendChild(modulesContainerElt);

  inspectorState.subscribe(STATE_PROPS.SELECTED_LOG_INDEX, () => {
    const selectedLogIdx = inspectorState.getCurrentState(STATE_PROPS.SELECTED_LOG_INDEX);
    const history = inspectorState.getCurrentState(STATE_PROPS.LOGS_HISTORY) ?? [];
    if (selectedLogIdx === undefined) {
      updateStatesFromLogGroup(inspectorState, history);
      inspectorState.commitUpdates();
      return ;
    } else {
      const consideredLogs = history.slice(0, selectedLogIdx + 1);
      updateStatesFromLogGroup(inspectorState, consideredLogs);
      inspectorState.commitUpdates();
    }
  });

  createModules({
    containerElt: modulesContainerElt,
    context: "post-analysis",
    configState,
    inspectorState,
  });
}

/**
 * Returns an HTML element corresponding to the Post-Debugger's header.
 * @param {Object} configState
 * @returns {HTMLElement}
 */
function createPostDebuggerHeaderElement(
  configState : ObservableState<ConfigState>,
  inspectorState : ObservableState<InspectorState>
) : HTMLElement {
  return createCompositeElement("div", [

    createCompositeElement("div", [
      createElement("span", {
        className: "header-item page-title",
        textContent: "RxPaired Post-Debugger",
      }),
    ], { className: "token-title" }),

    createCompositeElement("div", [
      createImportFileButton(inspectorState),
      createClearStoredConfigButton(configState),
      createDarkLightModeButton(configState),
    ], { className: "header-item" }),

  ], { className: "header" });
}

function createImportFileButton(
  inspectorState : ObservableState<InspectorState>
) : HTMLInputElement {
  const fileInputEl = createElement("input");
  fileInputEl.name = "file";
  fileInputEl.type = "file";
  fileInputEl.addEventListener("change", onFileSelection, false);
  return fileInputEl;

  /**
   * @param {Event} evt
   */
  function onFileSelection(evt: Event) {
    const { target } = evt;
    if (target === null || !(target instanceof HTMLInputElement)) {
      return;
    }
    const files = target.files; // FileList object
    if (files === null || files.length === 0) {
      return;
    }

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (loadEvt : Event) => {
      const { target: loadTarget } = loadEvt;
      if (loadTarget === null || !(loadTarget instanceof FileReader)) {
        return;
      }
      if (typeof loadTarget.result !== "string") {
        return;
      }
      const dataStr = loadTarget.result;
      const logs : string[] = [];
      let remaininStrConsidered = dataStr;
      while (remaininStrConsidered.length > 0) {
        let indexOfEnd : number;
        let offset = 0;
        let indexOfBrk = remaininStrConsidered.indexOf("\n");
        while (indexOfBrk >= 0) {
          const strAfterBrk = remaininStrConsidered.substring(indexOfBrk + 1 + offset);
          const nextCharCode = strAfterBrk.charCodeAt(0);
          if (!isNaN(nextCharCode) && nextCharCode >= 48 && nextCharCode <= 57) {
            if (START_LOG_LINE_REGEXP.test(strAfterBrk)) {
              break;
            }
          }
          offset += indexOfBrk + 1;
          indexOfBrk = strAfterBrk.indexOf("\n");
        }
        if (indexOfBrk === -1) {
          indexOfEnd = remaininStrConsidered.length;
        } else {
          indexOfEnd = indexOfBrk + offset;
        }
        const logLine = remaininStrConsidered.substring(0, indexOfEnd);
        logs.push(logLine);
        remaininStrConsidered = remaininStrConsidered.substring(indexOfEnd + 1);
      }

      inspectorState.updateState(STATE_PROPS.LOGS_HISTORY, UPDATE_TYPE.REPLACE, logs);
      inspectorState.commitUpdates();
    };

    reader.readAsText(file);
    return;
  }
}
