import { MAX_DISPLAYED_LOG_ELEMENTS, STATE_PROPS } from "../constants";
import { createButton, createCompositeElement, createElement } from "../dom-utils";
import { UPDATE_TYPE } from "../observable_state";
import {
  ModuleObject,
  ModuleFunctionArguments,
} from "./index";

const LOADING_LOGS_MSG = "Loading logs...";
const NO_LOG_SELECTED_MSG = "No log selected (click to select)";
const LOG_SELECTED_MSG = "A log has been selected";

/**
 * @param {Object} args
 */
export default function LogModule({
  state,
  configState,
} : ModuleFunctionArguments) : ModuleObject {
  /**
   * A filter function allowing to filter only wanted logs.
   * `null` if no filter is active.
   */
  let currentFilter : ((input : string) => boolean) | null = null;

  /**
   * Log element's header which is going to show various information on what is
   * happening and if a log is selected.
   */
  const logHeaderElt = createElement("div", { className: "log-header" });
  logHeaderElt.style.borderBottom = "1px dashed #878787";
  displayNoLogHeader();

  /** Wrapper elements which will contain log messages. */
  const logBodyElt = createElement("div", { className: "log-body module-body" });

  /**
   * Parent element of the individual log messages.
   * It should be the unique child of `logBodyElt`, it is written that way so it
   * may easily be removed and appended at will from the DOM when it is in the
   * process of being heavily updated to improve performances.
   */
  const logContainerElt =
    createElement("div", { className: "log-container module-body" });

  // When pushing a LOT (thousands) of logs at once, the page can become
  // unresponsive multiple seconds.
  // To avoid a pause with no possibility of user interaction in the mean time,
  // logs are only processed by groups of 500, with a `setTimeout` between them.

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

  /** If `true`, inputted search string are case sensitive. */
  let areSearchCaseSensitive = false;

  /** If `true`, inputted search string are Regular Expression. */
  let areSearchRegex = false;

  /** Wrapper elements allowing to filter logs. */
  const filterFlexElt = createElement("div", {
    className: "log-wrapper",
  });
  filterFlexElt.style.display = "flex";
  filterFlexElt.style.height = "40px";
  filterFlexElt.style.margin = "5px 0px";
  const unsubFilterFlexStyle = configState.subscribe(STATE_PROPS.CSS_MODE, () => {
    filterFlexElt.style.backgroundColor =
      configState.getCurrentState(STATE_PROPS.CSS_MODE) === "dark" ?
        "#333" :
        "#f2f2f2";
  }, true);

  const [caseSensitiveBtn, unsubCaseBtn] = createFilterButtonElement(
    "Aa",
    "Enable case sensitivity",
    "Disable case sensitivity",
    () => {
      areSearchCaseSensitive = true;
      refreshFilters();
    },
    () => {
      areSearchCaseSensitive = false;
      refreshFilters();
    });

  const [regexFilterButton, unsubRegexBtn] = createFilterButtonElement(
    ".*",
    "Enable RegExp mode",
    "Disable RegExp mode",
    () => {
      areSearchRegex = true;
      refreshFilters();
    },
    () => {
      areSearchRegex = false;
      refreshFilters();
    });

  /** Text input element for filtering logs. */
  const logFilterInputElt = createElement("input", {
    className: "log-filter",
  });
  logFilterInputElt.placeholder = "Filter logs based on text";
  logFilterInputElt.type = "input";
  logFilterInputElt.style.margin = "5px";
  logFilterInputElt.style.width = "calc(100% - 9px)";
  logFilterInputElt.oninput = refreshFilters;

  filterFlexElt.appendChild(caseSensitiveBtn);
  filterFlexElt.appendChild(regexFilterButton);
  filterFlexElt.appendChild(logFilterInputElt);

  state.subscribe(STATE_PROPS.LOGS_HISTORY, onLogsHistoryChange, true);
  state.subscribe(STATE_PROPS.SELECTED_LOG_INDEX, onSelectedLogChanges, true);

  logBodyElt.appendChild(logContainerElt);
  return {
    body: createCompositeElement("div", [
      logHeaderElt,
      filterFlexElt,
      logBodyElt,
    ]),
    clear() {
      unsubCaseBtn();
      unsubRegexBtn();
      unsubFilterFlexStyle();
      clearLogs();
    },
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
      values.filter(currentFilter);
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
    if (logsPending.length > MAX_DISPLAYED_LOG_ELEMENTS) {
      logsPending = logsPending.slice(MAX_DISPLAYED_LOG_ELEMENTS);
    }

    const wasScrolledToBottom = isLogBodyScrolledToBottom();
    const shouldMaskContainerTemporarily = logsPending.length >= 10;
    if (shouldMaskContainerTemporarily) {
      logBodyElt.innerHTML = "";
    }
    const logsToDisplay = logsPending.slice(0, 500);
    logsPending = logsPending.slice(500);
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
      logContainerElt.appendChild(logElt);
      nextLogIdx++;
    }
    if (shouldMaskContainerTemporarily) {
      logBodyElt.appendChild(logContainerElt);
    }
    if (wasScrolledToBottom) {
      logBodyElt.scrollTop = logBodyElt.scrollHeight;
    }
  }

  function isLogBodyScrolledToBottom() : boolean {
    const hasVerticalScrollbar = logBodyElt.scrollHeight > logBodyElt.clientHeight;
    return !hasVerticalScrollbar ||
      logBodyElt.scrollHeight -
      logBodyElt.clientHeight <= logBodyElt.scrollTop + 5;
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
   * Reapply filters on what is currently in `logFilterInputElt.value`.
   */
  function refreshFilters() {
    const text = logFilterInputElt.value;
    if (text !== null && text.length > 0) {
      if (areSearchRegex) {
        const flags = areSearchCaseSensitive ? "i" : undefined;
        const reg = new RegExp(text, flags);
        currentFilter = (input : string) => reg.test(input);
      } else if (areSearchCaseSensitive) {
        currentFilter = (input : string) => input.toLowerCase().includes(text);
      } else {
        const toLower = text.toLowerCase();
        currentFilter = (input : string) => input.toLowerCase().includes(toLower);
      }
      logsPending = [];
      clearLogs();
      const allLogs = state.getCurrentState(STATE_PROPS.LOGS_HISTORY) ?? [];
      logsPending = allLogs.filter(currentFilter);
      displayNextPendingLogs();
    } else if (currentFilter !== null) {
      currentFilter = null;
      clearLogs();
      logsPending = state.getCurrentState(STATE_PROPS.LOGS_HISTORY) ?? [];
      displayNextPendingLogs();
    }
  }

  /**
   * Create a button element that will be displayed alongside the filter bar.
   * @param {string} innerText - The text to display inside the button
   * @param {string} titleDisabled - The title (e.g. in tooltip) that will be
   * shown when the button is not enabled.
   * @param {string} titleEnabled - The title (e.g. in tooltip) that will be
   * shown when the button is enabled.
   * @param {Function} onEnabled - The function that should be called when the
   * button is enabled.
   * @param {Function} onEnabled - The function that should be called when the
   * feature behind the button is enabled.
   * @param {Function} onDisabled - The function that should be called when the
   * feature behind the button is disabled.
   * @returns {Array} Returns a tuple of two values:
   *   - HTMLElement of the button
   *   - Code to be called when the button is removed from the DOM
   */
  function createFilterButtonElement(
    innerText: string,
    titleDisabled: string,
    titleEnabled: string,
    onEnabled: () => void,
    onDisabled: () => void
  ) : [HTMLElement, () => void] {
    let isDisabled = true;
    let isDarkMode = configState
      .getCurrentState(STATE_PROPS.CSS_MODE) === "dark";
    const unsub = configState.subscribe(STATE_PROPS.CSS_MODE, () => {
      isDarkMode = configState
        .getCurrentState(STATE_PROPS.CSS_MODE) === "dark";
      if (isDisabled) {
        setDisabledStyle();
      } else {
        setEnabledStyle();
      }
    });
    const buttonElt = createButton({
      textContent: innerText,
      className: "log-filter-button",
      onClick() {
        if (isDisabled) {
          isDisabled = false;
          setEnabledStyle();
          buttonElt.title = titleEnabled;
          onEnabled();
        } else {
          isDisabled = true;
          buttonElt.title = titleDisabled;
          setDisabledStyle();
          buttonElt.style.color = isDarkMode ?
            "#ffffff" :
            "#000000";
          onDisabled();
        }
      },
    });

    buttonElt.title = titleDisabled;
    buttonElt.style.cursor = "pointer";
    buttonElt.style.fontWeight = "bold";
    buttonElt.style.margin = "6px 5px";
    buttonElt.style.border = "none";
    buttonElt.style.fontSize = "11px";
    buttonElt.style.padding = "4px";
    buttonElt.style.backgroundColor = "transparent";
    setDisabledStyle();
    return [buttonElt, unsub];

    function setEnabledStyle() {
      buttonElt.style.color = isDarkMode ?
        "#d3ffcf" :
        "#990033";
    }

    function setDisabledStyle() {
      buttonElt.style.color = isDarkMode ?
        "#ffffff" :
        "#000000";

    }
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
    logBodyElt.innerHTML = "";
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
