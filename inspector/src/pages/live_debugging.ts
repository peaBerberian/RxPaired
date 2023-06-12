import { ConfigState, InspectorState, SERVER_URL, STATE_PROPS } from "../constants";
import createModules from "../create_modules";
import { createCompositeElement, createElement } from "../dom-utils";
import ObservableState, { UPDATE_TYPE } from "../observable_state";
import updateStateFromLog, {
  updateStatesFromLogGroup,
} from "../update_state_from_log";
import { displayError } from "../utils";
import { createClearStoredConfigButton, createDarkLightModeButton } from "./utils";

/**
 * Generate the HTML page linked to live debugging.
 * @param {string} password - The password currently used for server
 * interaction.
 * @param {string} tokenId - The current used token.
 * @param {Object} configState
 */
export default function generateLiveDebuggingPage(
  password : string,
  tokenId : string,
  configState : ObservableState<ConfigState>
) : void {
  (window as unknown as Record<string, unknown>).sendInstruction = sendInstruction;

  const inspectorState = new ObservableState<InspectorState>();
  /**
   * WebSocket instance used to exchange with the debug server.
   * @type {WebSocket.WebSocket}
   */
  const currentSocket : WebSocket = startWebsocketConnection(password, tokenId);
  const headerElt = createLiveDebuggerHeaderElement(tokenId,
                                                    currentSocket,
                                                    configState,
                                                    inspectorState);
  document.body.appendChild(headerElt);
  const modulesContainerElt = createElement("div");
  document.body.appendChild(modulesContainerElt);

  inspectorState.subscribe(STATE_PROPS.SELECTED_LOG_INDEX, () => {
    const allState = inspectorState.getCurrentState();
    const selectedLogIdx = allState[STATE_PROPS.SELECTED_LOG_INDEX];
    const history = allState[STATE_PROPS.LOGS_HISTORY] ?? [];
    /* eslint-disable-next-line */
    (Object.keys(allState) as unknown as Array<keyof InspectorState>)
      .forEach((stateProp: keyof InspectorState) => {
        if (
          stateProp !== STATE_PROPS.LOGS_HISTORY &&
          stateProp !== STATE_PROPS.SELECTED_LOG_INDEX
        ) {
          inspectorState.updateState(stateProp, UPDATE_TYPE.REPLACE, undefined);
        }
      });
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
    context: "live-debugging",
    tokenId,
    configState,
    inspectorState,
  });
  currentSocket.addEventListener("close", function () {
    displayError("WebSocket connection closed");
  });
  currentSocket.addEventListener("error", function () {
    displayError("WebSocket connection error");
  });
  if (currentSocket !== null) {
    currentSocket.addEventListener("message", function onMessage(event) {
      if (event == null || event.data == null) {
        displayError("No message received from WebSocket");
      }
      if (typeof event.data !== "string") {
        displayError("Invalid message format received");
        return;
      }
      const hasSelectedLog = inspectorState
        .getCurrentState(STATE_PROPS.SELECTED_LOG_INDEX) !== undefined;

      if (event.data === "ping") {
        currentSocket.send("pong");
        return;
      }
      if (event.data[0] === "{") {
        try {
          // TODO better type all this mess.
          /* eslint-disable @typescript-eslint/no-unsafe-assignment */
          /* eslint-disable @typescript-eslint/no-unsafe-member-access */
          /* eslint-disable @typescript-eslint/restrict-template-expressions */
          const signal = JSON.parse(event.data);
          if (signal.type === "Init") {
            const initTimestamp = signal.value?.timestamp;
            if (typeof initTimestamp === "number") {
              const initLog =
                `${initTimestamp.toFixed(2)} [Init] Local-Date:${signal.value.dateMs}`;
              let updates = [initLog];
              if (signal.value?.history?.length > 0) {
                updates = updates.concat(signal.value.history as string[]);
              }
              inspectorState.updateState(STATE_PROPS.LOGS_HISTORY,
                                         UPDATE_TYPE.PUSH,
                                         updates);
              if (!hasSelectedLog) {
                updateStatesFromLogGroup(inspectorState, updates);
              }
              inspectorState.commitUpdates();
            }
          } else if (signal.type === "eval-result") {
            const { id, data } = signal.value;
            console.log(`RESULT OF INSTRUCTION \u001b[32m${id}\u001b[0m: ${data}`);
          }
          /* eslint-enable @typescript-eslint/restrict-template-expressions */
          /* eslint-enable @typescript-eslint/no-unsafe-assignment */
          /* eslint-enable @typescript-eslint/no-unsafe-member-access */
        } catch (err) {
          console.error("Could not parse signalling message", err);
          displayError("Invalid signaling message format received");
          return;
        }
      } else {
        const newLog = event.data;
        inspectorState.updateState(STATE_PROPS.LOGS_HISTORY,
                                   UPDATE_TYPE.PUSH,
                                   [newLog]);
        if (!hasSelectedLog) {
          updateStateFromLog(inspectorState, event.data);
        }
        inspectorState.commitUpdates();
      }
    });
  }

  function sendInstruction(instruction : string) {
    const id = String(Math.random().toString(36)).substring(2);
    currentSocket.send(JSON.stringify({
      type: "eval",
      value: {
        id,
        instruction,
      },
    }));
    console.log(`INSTRUCTION \u001b[32m${id}\u001b[0m sent`);
  }
}

/**
 * Returns an HTML element corresponding to the Live Debugger's header.
 * @param {string} tokenId
 * @param {WebSocket.WebSocket} currentSocket
 * @param {Object} inspectorState
 * @returns {HTMLElement}
 */
function createLiveDebuggerHeaderElement(
  tokenId : string,
  currentSocket : WebSocket,
  configState : ObservableState<ConfigState>,
  inspectorState : ObservableState<InspectorState>
) : HTMLElement {
  return createCompositeElement("div", [

    createCompositeElement("div", [

      createElement("span", {
        className: "header-item page-title",
        textContent: "RxPaired Live Debugger",
      }),

      createCompositeElement("span", [
        createElement("span", { className: "token-title-desc", textContent: "Token: " }),
        createElement("span", { className: "token-title-val", textContent: tokenId }),
      ], { className: "header-item token-header-value" }),

    ], { className: "token-title" }),

    createCompositeElement("div", [
      createExportLogsButton(inspectorState),
      createCloseConnectionButton(currentSocket),
      createClearAllButton(inspectorState),
      createClearStoredConfigButton(configState),
      createDarkLightModeButton(configState),
    ], { className: "header-item" }),

  ], { className: "header" });
}

/**
 * Returns an HTML element corresponding to the closure of the current socket's
 * connection.
 * @param {WebSocket.WebSocket} currentSocket
 * @returns {HTMLElement}
 */
function createCloseConnectionButton(currentSocket : WebSocket) : HTMLElement {
  const buttonElt = document.createElement("button");
  buttonElt.textContent = "✋ Stop listening";
  buttonElt.onclick = function() {
    if (currentSocket !== null) {
      currentSocket.close();
    }
    buttonElt.disabled = true;
  };
  return buttonElt;
}

/**
 * @param {Object} inspectorState
 * @returns {HTMLButtonElement}
 */
function createExportLogsButton(
  inspectorState : ObservableState<InspectorState>
) : HTMLButtonElement {
  const buttonElt = document.createElement("button");
  buttonElt.textContent = "💾 Export";
  buttonElt.onclick = function() {
    exportLogs(inspectorState);
  };
  return buttonElt;
}

/**
 * @param {Object} inspectorState
 * @returns {HTMLButtonElement}
 */
function createClearAllButton(
  inspectorState : ObservableState<InspectorState>
) : HTMLButtonElement {
  const buttonElt = document.createElement("button");
  buttonElt.textContent = "🧹 Clear all logs";
  buttonElt.onclick = function() {
    const allProps = Object.keys(
      inspectorState.getCurrentState()
    ) as Array<keyof InspectorState>;
    allProps.forEach(prop => {
      inspectorState.updateState(prop, UPDATE_TYPE.REPLACE, undefined);
    });
    inspectorState.commitUpdates();
  };
  return buttonElt;
}

/**
 * Download all logs in a txt file.
 * @param {Object} inspectorState
 */
function exportLogs(inspectorState : ObservableState<InspectorState>) : void {
  const aElt = document.createElement("a");
  aElt.style.display = "none";
  document.body.appendChild(aElt);
  const logsHistory = inspectorState.getCurrentState(STATE_PROPS.LOGS_HISTORY) ?? [];
  const logExport = logsHistory.join("\n");
  const blob = new Blob([logExport], { type: "octet/stream" });
  const url = window.URL.createObjectURL(blob);
  aElt.href = url;
  aElt.download = "log-export-" + new Date().toISOString() + ".txt";
  aElt.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(aElt);
}

/**
 * Starts a websocket connection with the given token.
 * @param {string} password - The password currently used for server
 * interaction.
 * @param {string} tokenId - The current used token.
 * @returns {WebSocket.WebSocket}
 */
function startWebsocketConnection(
  password : string,
  tokenId : string
) : WebSocket {
  const wsUrl = `${SERVER_URL}/${password}/${tokenId}`;
  const socket = new WebSocket(wsUrl);
  return socket;
}
