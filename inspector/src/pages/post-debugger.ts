import strHtml from "str-html";
import { ConfigState, InspectorState, STATE_PROPS } from "../constants";
import createModules from "../create_modules";
import ObservableState, { UPDATE_TYPE } from "../observable_state";
import { updateStatesFromLogGroup } from "../update_state_from_log";
import { reGeneratePageUrl } from "../utils";
import {
  createClearStoredConfigButton,
  createDarkLightModeButton,
} from "./utils";

const START_LOG_LINE_REGEXP = /^[0-9]+\.[0-9]{2} \[/;

/**
 * @param {Object} configState
 * @returns {Function} - Call this function to clean up all resources created
 * by this page. Should be called when the page is disposed.
 */
export default function generatePostDebuggerPage(
  password: string | null,
  configState: ObservableState<ConfigState>,
): () => void {
  const inspectorState = new ObservableState<InspectorState>();
  const modulesContainerElt = strHtml`<div/>`;
  const bodyElement = strHtml`<div>
    ${createPostDebuggerHeaderElement(password, configState)}
    <div class="page-input-block">
      <span>Log file to import: </span>
      ${createImportFileButton(inspectorState)}
    </div>
    ${modulesContainerElt}
  </div>`;
  document.body.appendChild(bodyElement);

  inspectorState.subscribe(STATE_PROPS.SELECTED_LOG_INDEX, () => {
    const allState = inspectorState.getCurrentState();
    const selectedLogIdx = allState[STATE_PROPS.SELECTED_LOG_INDEX];
    const history = allState[STATE_PROPS.LOGS_HISTORY] ?? [];
    /* eslint-disable-next-line */
    (Object.keys(allState) as unknown as Array<keyof InspectorState>).forEach(
      (stateProp: keyof InspectorState) => {
        if (
          stateProp !== STATE_PROPS.LOGS_HISTORY &&
          stateProp !== STATE_PROPS.SELECTED_LOG_INDEX
        ) {
          inspectorState.updateState(stateProp, UPDATE_TYPE.REPLACE, undefined);
        }
      },
    );
    if (selectedLogIdx === undefined) {
      updateStatesFromLogGroup(inspectorState, history);
      inspectorState.commitUpdates();
      return;
    } else {
      const consideredLogs = history.slice(0, selectedLogIdx + 1);
      updateStatesFromLogGroup(inspectorState, consideredLogs);
      inspectorState.commitUpdates();
    }
  });

  const disposeModules = createModules({
    containerElt: modulesContainerElt,
    context: "post-debugger",
    configState,
    inspectorState,
  });

  return () => {
    disposeModules();
    inspectorState.dispose();
    document.body.removeChild(bodyElement);
  };
}

function createImportFileButton(
  inspectorState: ObservableState<InspectorState>,
): HTMLInputElement {
  const fileInputEl =
    strHtml`<input name="file" type="file">` as HTMLInputElement;
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

    reader.onload = (loadEvt: Event) => {
      const { target: loadTarget } = loadEvt;
      if (loadTarget === null || !(loadTarget instanceof FileReader)) {
        return;
      }
      if (typeof loadTarget.result !== "string") {
        return;
      }
      const dataStr = loadTarget.result;
      const logs: string[] = [];
      let remaininStrConsidered = dataStr;
      while (remaininStrConsidered.length > 0) {
        let indexOfEnd: number;
        let offset = 0;
        let indexOfBrk = remaininStrConsidered.indexOf("\n");
        while (indexOfBrk >= 0) {
          const strAfterBrk = remaininStrConsidered.substring(
            indexOfBrk + 1 + offset,
          );
          const nextCharCode = strAfterBrk.charCodeAt(0);
          if (
            !isNaN(nextCharCode) &&
            nextCharCode >= 48 &&
            nextCharCode <= 57
          ) {
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

      inspectorState.updateState(
        STATE_PROPS.LOGS_HISTORY,
        UPDATE_TYPE.REPLACE,
        logs,
      );
      updateStatesFromLogGroup(inspectorState, logs);
      inspectorState.commitUpdates();
    };

    reader.readAsText(file);
    return;
  }
}

/**
 * Returns an HTML element corresponding to the Live Debugger's header.
 * @param {string|null} password
 * @param {Object} configState
 * @returns {HTMLElement}
 */
function createPostDebuggerHeaderElement(
  password: string | null,
  configState: ObservableState<ConfigState>,
): HTMLElement {
  return strHtml`<div class="header">
    <div class="token-title">
      <span class="header-item page-title">
        <a href=${reGeneratePageUrl(undefined, undefined)}>Home</a>
        ${">"}
        <a href=${reGeneratePageUrl(password, undefined)}>Token</a>
        ${"> Post-Debugger"}
      </span>
    </div>
    <div class="header-item">${[
      createClearStoredConfigButton(configState),
      createDarkLightModeButton(configState),
    ]}</div>
  </div>`;
}
