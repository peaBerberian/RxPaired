import { ConfigState, InspectorState, SERVER_URL, STATE_PROPS } from "../constants";
import createModules from "../create_modules";
import { createButton, createElement } from "../dom-utils";
import ObservableState, { UPDATE_TYPE } from "../observable_state";
import updateStateFromLog from "../update_state_from_log";
import { displayError, getDefaultModuleOrder } from "../utils";

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
  const inspectorState = new ObservableState<InspectorState>();
  /**
   * WebSocket instance used to exchange with the debug server.
   * @type {WebSocket.WebSocket}
   */
  const currentSocket : WebSocket = startWebsocketConnection(password, tokenId);
  window.sendEvalToDevice = sendEvalToDevice;
  const headerElt = createLiveDebuggerHeaderElement(tokenId,
                                                    currentSocket,
                                                    configState,
                                                    inspectorState);
  document.body.appendChild(headerElt);
  const modulesContainerElt = createElement("div");
  document.body.appendChild(modulesContainerElt);
  createModules(modulesContainerElt, tokenId, configState, inspectorState);
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
      if (event.data[0] === "{") {
        try {
          // TODO better type all this mess.
          /* eslint-disable @typescript-eslint/no-unsafe-assignment */
          /* eslint-disable @typescript-eslint/no-unsafe-member-access */
          const signal = JSON.parse(event.data);
          if (signal.type === "Init") {
            if (signal.value.history.length > 0) {
              for (const log of signal.value.history) {
                if (typeof log === "string") {
                  updateStateFromLog(inspectorState, log);
                }
              }
              inspectorState.commitUpdates();
            }
          }
          /* eslint-enable @typescript-eslint/no-unsafe-assignment */
          /* eslint-enable @typescript-eslint/no-unsafe-member-access */
        } catch (err) {
          console.error("Could not parse signalling message", err);
          displayError("Invalid signaling message format received");
          return;
        }
      } else {
        updateStateFromLog(inspectorState, event.data);
        inspectorState.commitUpdates();
      }
    });
  }

  function sendEvalToDevice(instruction : string) {
    currentSocket.send(JSON.stringify({
      type: "eval",
      value: {
        id: String(Math.random().toString(36)),
        instruction,
      },
    }));
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
  const header = document.createElement("div");
  header.className = "header";
  const tokenTitleElt = document.createElement("div");
  tokenTitleElt.className = "token-title";
  tokenTitleElt.innerHTML =
    '<span class="header-item page-title">Live Debugger</span>' +
    '<span class="header-item"><span class="token-title-desc">Token:</span>' +
    ` <span class="token-title-val">${tokenId}</span>  </span>`;
  header.appendChild(tokenTitleElt);
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "header-item";
  buttonsContainer.appendChild(createExportLogsButton(inspectorState));
  buttonsContainer.appendChild(createCloseConnectionButton(currentSocket));
  buttonsContainer.appendChild(createClearAllButton(inspectorState));
  buttonsContainer.appendChild(createClearStoredConfigButton(configState));
  buttonsContainer.appendChild(createDarkLightModeButton(configState));
  header.appendChild(buttonsContainer);
  return header;
}

/**
 * @param {Object} configState
 * @returns {HTMLElement}
 */
function createClearStoredConfigButton(
  configState : ObservableState<ConfigState>
) : HTMLElement {
  const buttonElt = document.createElement("button");
  buttonElt.textContent = "🧹 Clear page config";
  buttonElt.onclick = function() {
    // TODO "clear" `updateType` and clearing all but module-related config?
    configState.updateState(STATE_PROPS.CLOSED_MODULES, UPDATE_TYPE.REPLACE, []);
    configState.updateState(STATE_PROPS.MINIMIZED_MODULES, UPDATE_TYPE.REPLACE, []);
    configState.updateState(STATE_PROPS.WIDTH_RATIOS, UPDATE_TYPE.REPLACE, {});
    configState.updateState(STATE_PROPS.MODULES_ORDER,
                            UPDATE_TYPE.REPLACE,
                            getDefaultModuleOrder());
    configState.commitUpdates();
  };
  configState.subscribe(STATE_PROPS.CLOSED_MODULES, check);
  configState.subscribe(STATE_PROPS.MODULES_ORDER, check);
  configState.subscribe(STATE_PROPS.MINIMIZED_MODULES, check);
  configState.subscribe(STATE_PROPS.WIDTH_RATIOS, check);
  check();

  function check() {
    const closedModules = configState.getCurrentState(STATE_PROPS.CLOSED_MODULES) ?? [];
    const minimizedModules = configState
      .getCurrentState(STATE_PROPS.MINIMIZED_MODULES) ?? [];
    const widthRatios = configState.getCurrentState(STATE_PROPS.WIDTH_RATIOS) ?? {};
    const modulesOrder = configState.getCurrentState(STATE_PROPS.MODULES_ORDER) ?? [];
    const defaultModuleOrder = getDefaultModuleOrder();
    const hasDefaultModuleOrder =
      modulesOrder.length === defaultModuleOrder.length &&
      modulesOrder.every((moduleId : string, index : number) =>
        moduleId === defaultModuleOrder[index]);
    buttonElt.disabled = closedModules.length === 0 &&
                         minimizedModules.length === 0 &&
                         Object.keys(widthRatios).length === 0 &&
                         hasDefaultModuleOrder;
  }
  return buttonElt;
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
 * Returns an HTML element corresponding to the light/dark mode button.
 * @param {Object} configState
 * @returns {HTMLButtonElement}
 */
function createDarkLightModeButton(
  configState : ObservableState<ConfigState>
) : HTMLButtonElement {
  const buttonElt = createButton({ className: "btn-dark-light-mode" });
  let isDark : boolean;
  configState.subscribe(STATE_PROPS.CSS_MODE, () => {
    isDark = configState.getCurrentState(STATE_PROPS.CSS_MODE) === "dark";
    if (isDark) {
      document.body.classList.replace("light", "dark");
      buttonElt.textContent = "☼ Light mode";
    } else {
      document.body.classList.replace("dark", "light");
      buttonElt.textContent = "🌘 Dark mode";
    }
  }, true);
  buttonElt.onclick = function() {
    configState.updateState(STATE_PROPS.CSS_MODE,
                            UPDATE_TYPE.REPLACE,
                            isDark ? "light" : "dark");
    configState.commitUpdates();
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
