import { InspectorState, MAX_DISPLAYED_LOG_ELEMENTS, STATE_PROPS } from "../constants";
import { createCompositeElement, createElement } from "../dom-utils";
import ObservableState, { UPDATE_TYPE } from "../observable_state";

const LOADING_LOGS_MSG = "Loading logs...";
const NO_LOG_SELECTED_MSG = "No log selected (click to select)";
const LOG_SELECTED_MSG = "A log has been selected";

/**
 * @param {Object} args
 */
export default function LogModule(
  { state } : { state : ObservableState<InspectorState> }
) {
  /**
   * The current filtered string.
   * `null` if no filter is active.
   */
  let currentFilter : string | null = null;

  /**
   * Log element's header which is going to show various information on what is
   * happening and if a log is selected.
   */
  const logHeaderElt = createElement("div", { className: "log-header" });
  logHeaderElt.style.borderBottom = "1px dashed #878787";
  displayNoLogHeader();

  /** Element which will contain all logs. */
  const logContainerElt = createElement("div", { className: "log-body module-body" });

  // When pushing a LOT (thousands) of logs at once, the page can become
  // unresponsive multiple seconds.
  // To avoid a pause with no possibility of user interaction in the mean time,
  // logs are only processed by groups of 200, with a `setTimeout` between them.

  /**
   * Logs that are not yet displayed.
   */
  let logsPending : string[] = [];

  /**
   * If set, a `setTimeout` has been called to process the next group of logs
   * in `logsPending`. Log processing is only done by groups to avoid the page
   * being unresponsive for too long.
   *
   * Should be set to `undefined` if no timeout is pending.
   */
  let timeoutInterval : number | undefined;

  /**
   * HTML element currently selected.
   * `null` if none is currently selected.
   */
  let selectedElt : HTMLElement | null = null;

  /**
   * The log "index" (linked to its index in `LOGS_HISTORY`) of the log
   * currently selected by this LogModule.
   */
  let nextLogIdx = 0;

  /** Text input element for filtering logs. */
  const logFilterInputElt = createElement("input", {
    className: "log-filter",
  });
  logFilterInputElt.placeholder = "Filter logs based on text (case sensitive)";
  logFilterInputElt.type = "input";
  logFilterInputElt.style.margin = "5px 0px";
  logFilterInputElt.style.width = "calc(100% - 9px)";
  logFilterInputElt.oninput = function() {
    const text = logFilterInputElt.value;
    if (text !== null && text.length > 0) {
      currentFilter = text;
      logsPending = [];
      clearLogs();
      const allLogs = state.getCurrentState(STATE_PROPS.LOGS_HISTORY) ?? [];
      logsPending = allLogs.filter((l) => l.includes(text));
      displayNextPendingLogs();
    } else if (currentFilter !== null) {
      currentFilter = null;
      clearLogs();
      logsPending = state.getCurrentState(STATE_PROPS.LOGS_HISTORY) ?? [];
      displayNextPendingLogs();
    }
  };

  state.subscribe(STATE_PROPS.LOGS_HISTORY, onLogsHistoryChange, true);
  state.subscribe(STATE_PROPS.SELECTED_LOG_INDEX, onSelectedLogChanges, true);

  return {
    body: createCompositeElement("div", [
      logHeaderElt,
      logFilterInputElt,
      logContainerElt,
    ]),
    clear: clearLogs,
    destroy() {
      logsPending = [];
      timeoutInterval = undefined;
      clearTimeout(timeoutInterval);
      state.unsubscribe(STATE_PROPS.LOGS_HISTORY, onLogsHistoryChange);
      state.unsubscribe(STATE_PROPS.SELECTED_LOG_INDEX, onSelectedLogChanges);

      if (state.getCurrentState(STATE_PROPS.SELECTED_LOG_INDEX) !== undefined) {
        state.updateState(STATE_PROPS.SELECTED_LOG_INDEX, UPDATE_TYPE.REPLACE, undefined);
        state.commitUpdates();
      }
    },
  };

  /** Display header for when no logs are yet received. */
  function displayNoLogHeader() {
    if (currentFilter === null) {
      logHeaderElt.textContent = "No log received yet.";
    } else {
      logHeaderElt.textContent = "No log corresponding to that filter.";
    }
    logHeaderElt.classList.remove("important-bg");
  }

  /** Display header for when logs are being loaded. */
  function displayLoadingHeader() {
    logHeaderElt.textContent = LOADING_LOGS_MSG;
    logHeaderElt.classList.add("important-bg");
  }

  /** Display header for when not loading and no log is currently selected. */
  function displayNoLogSelectedHeader() {
    logHeaderElt.textContent = NO_LOG_SELECTED_MSG;
    logHeaderElt.classList.remove("important-bg");
  }

  /** Display header for when a log is currently selected. */
  function displayLogSelectedHeader() {
    logHeaderElt.textContent = LOG_SELECTED_MSG;
    const clickSpan = createElement("span", {
      textContent: "Click on the log again or here to unselect",
      className: "emphasized",
    });
    clickSpan.onclick = function() {
      state.updateState(STATE_PROPS.SELECTED_LOG_INDEX, UPDATE_TYPE.REPLACE, undefined);
      state.commitUpdates();
      if (selectedElt !== null) {
        selectedElt.classList.remove("focused-bg");
        selectedElt = null;
      }
    };
    clickSpan.style.cursor = "pointer";
    clickSpan.style.marginLeft = "5px";
    logHeaderElt.appendChild(clickSpan);
    logHeaderElt.classList.add("important-bg");
  }

  /**
   * Returns a string describing the current header shown.
   * @returns {string}
   */
  function getHeaderType() : "loading" | "no-log" | "no-selected" | "selected" {
    const textContent = logHeaderElt.textContent;
    if (textContent === null) {
      return "no-log";
    }
    if (textContent.startsWith(LOADING_LOGS_MSG)) {
      return "loading";
    } else if (textContent.startsWith(NO_LOG_SELECTED_MSG)) {
      return "no-selected";
    } else if (textContent.startsWith(LOG_SELECTED_MSG)) {
      return "selected";
    }
    return "no-log";
  }

  /**
   * Callback triggered when the global history of logs changes.
   * @param {string} updateType
   * @param {Array.<string>|undefined} values
   */
  function onLogsHistoryChange(
    updateType: UPDATE_TYPE | "initial",
    values: string[] | undefined
  ) {
    if (values === undefined) {
      nextLogIdx = 0;
      clearLogs();
      return;
    }
    if (updateType === UPDATE_TYPE.REPLACE || updateType === "initial") {
      nextLogIdx = 0;
      clearLogs();
    }

    const filtered = currentFilter === null ?
      values :
      values.filter(v => v.includes(currentFilter as string));
    logsPending = logsPending.concat(filtered);
    if (timeoutInterval !== undefined) {
      return;
    } else {
      displayNextPendingLogs();
    }
  }

  /**
   * Callback called when the index of the selected log changes.
   * This Callback is also mainly here to better handle conflicts between multiple
   * concurrent LogModules.
   */
  function onSelectedLogChanges() {
    const hasLogIdxSelected = state
      .getCurrentState(STATE_PROPS.SELECTED_LOG_INDEX) !== undefined;
    const headerType = getHeaderType();
    if (
      !hasLogIdxSelected &&
      logContainerElt.childNodes.length === 0
    ) {
      if (headerType !== "no-log") {
        displayNoLogHeader();
      }
      return;
    }

    if (hasLogIdxSelected) {
      if (headerType !== "selected") {
        displayLogSelectedHeader();
      }
    } else if (timeoutInterval !== undefined) {
      if (headerType !== "loading") {
        displayLoadingHeader();
      }
    } else if (headerType !== "no-selected") {
      displayNoLogSelectedHeader();
    }
  }

  /**
   * Display next group of logs in the `logsPending` array.
   */
  function displayNextPendingLogs() : void {
    timeoutInterval = undefined;
    const logsToDisplay = logsPending.slice(0, 200);
    logsPending = logsPending.slice(200);
    if (logsPending.length > 0) {
      displayLoadingHeader();
      timeoutInterval = setTimeout(displayNextPendingLogs, 50);
    } else {
      const headerType = getHeaderType();
      if (logsToDisplay.length === 0) {
        if (headerType !== "no-log") {
          displayNoLogHeader();
        }
      } else if (selectedElt === null) {
        if (headerType !== "no-selected") {
          displayNoLogSelectedHeader();
        }
      } else if (headerType !== "selected") {
        displayLogSelectedHeader();
      }
    }

    for (const log of logsToDisplay) {
      const logElt = createLogElement(log);
      logElt.dataset.logId = String(nextLogIdx);
      logElt.onclick = toggleCurrentElementSelection;
      while (logContainerElt.children.length > MAX_DISPLAYED_LOG_ELEMENTS - 1) {
        logContainerElt.removeChild(logContainerElt.children[0]);
      }
      const hasVerticalScrollbar =
        logContainerElt.scrollHeight > logContainerElt.clientHeight;
      const wasScrolledToBottom = !hasVerticalScrollbar ||
        logContainerElt.scrollHeight -
          logContainerElt.clientHeight <= logContainerElt.scrollTop + 5;
      logContainerElt.appendChild(logElt);
      if (wasScrolledToBottom) {
        logContainerElt.scrollTop = logContainerElt.scrollHeight;
      }

      nextLogIdx++;
    }
  }

  /**
   * Select/unselect the currently clicked log element.
   */
  function toggleCurrentElementSelection(evt : MouseEvent) : void {
    const logElt = evt.target;
    if (logElt === null || !(logElt instanceof HTMLElement)) {
      console.error("No element selected");
      return;
    }
    const currentLogIdx = +String(logElt.dataset?.logId);
    if (isNaN(currentLogIdx)) {
      console.error("The element selected had a bad log id");
      return;
    }
    if (selectedElt !== null) {
      selectedElt.classList.remove("focused-bg");
      selectedElt = null;
    }
    const selectedLogIdx = state.getCurrentState(STATE_PROPS.SELECTED_LOG_INDEX);
    if (selectedLogIdx === currentLogIdx) {
      state.updateState(STATE_PROPS.SELECTED_LOG_INDEX,
                        UPDATE_TYPE.REPLACE,
                        undefined);
      state.commitUpdates();
      return;
    }

    state.updateState(STATE_PROPS.SELECTED_LOG_INDEX,
                      UPDATE_TYPE.REPLACE,
                      currentLogIdx);
    selectedElt = logElt;

    logElt.classList.add("focused-bg");
    state.commitUpdates();
  }

  /**
   * Clear all logs currently displayed or pending to be displayed, without
   * modifying the complete log history.
   */
  function clearLogs() {
    logsPending = [];
    clearTimeout(timeoutInterval);
    timeoutInterval = undefined;
    logContainerElt.innerHTML = "";
    if (getHeaderType() !== "no-log") {
      displayNoLogHeader();
    }
  }
}

/**
 * @param {string} logTxt
 * @returns {HTMLElement}
 */
export function createLogElement(logTxt : string) : HTMLElement {
  let namespace;
  let formattedMsg = logTxt;
  const indexOfNamespaceStart = logTxt.indexOf("[");
  if (indexOfNamespaceStart >= 0) {
    const indexOfNamespaceEnd = logTxt.indexOf("]");
    if (indexOfNamespaceEnd > 0) {
      namespace = logTxt.substring(indexOfNamespaceStart + 1, indexOfNamespaceEnd);
      formattedMsg = logTxt.replace(/\n/g, "\n" + " ".repeat(indexOfNamespaceEnd + 2));
    }
  }
  return createElement("pre", {
    textContent: formattedMsg,
    className: namespace !== undefined ?
      "log-line log-" + namespace.toLowerCase() :
      "log-line log-unknown",
  });
}

