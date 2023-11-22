import strHtml from "str-html";
import { MAX_DISPLAYED_LOG_ELEMENTS, STATE_PROPS } from "../constants";
import { UPDATE_TYPE } from "../observable_state";
import { ModuleObject, ModuleFunctionArguments } from "./index";

const LOADING_LOGS_MSG = "Loading logs...";
const NO_LOG_SELECTED_MSG =
  "No log selected (click on a log to time-travel to it).";
const LOG_SELECTED_MSG = "A log has been time-travelled to.";

/**
 * @param {Object} args
 */
export default function LogModule({
  state,
  configState,
}: ModuleFunctionArguments): ModuleObject {
  /**
   * A filter function allowing to filter only wanted logs.
   * `null` if no filter is active.
   */
  const filterObject: {
    minTimeStamp: number;
    maxTimeStamp: number;
    textFilter: null | {
      text: string;
      caseSensitive: boolean;
      regex: boolean;
    };
  } = {
    minTimeStamp: 0,
    maxTimeStamp: Infinity,
    textFilter: null,
  };

  /**
   * Log element's header which is going to show various information on what is
   * happening and if a log is selected.
   */
  const logHeaderElt = strHtml`<div class="log-header"/>`;
  logHeaderElt.style.borderBottom = "1px dashed #878787";
  displayNoLogHeader();

  /** Wrapper elements which will contain log messages. */
  const logBodyElt = strHtml`<div class="log-body module-body"/>`;

  /**
   * Parent element of the individual log messages.
   * It should be the unique child of `logBodyElt`, it is written that way so it
   * may easily be removed and appended at will from the DOM when it is in the
   * process of being heavily updated to improve performances.
   */
  const logContainerElt = strHtml`<div class="log-container module-body"/>`;

  // When pushing a LOT (thousands) of logs at once, the page can become
  // unresponsive multiple seconds.
  // To avoid a pause with no possibility of user interaction in the mean time,
  // logs are only processed by groups of 500, with a `setTimeout` between them.

  /**
   * Logs that are not yet displayed as a tuple of:
   *   1. The log message
   *   2. The log idx in the message in the LOGS_HISTORY array.
   */
  let logsPending: Array<[string, number]> = [];

  /**
   * If set, a `setTimeout` has been called to process the next group of logs
   * in `logsPending`. Log processing is only done by groups to avoid the page
   * being unresponsive for too long.
   *
   * Should be set to `undefined` if no timeout is pending.
   */
  let timeoutInterval: number | undefined;

  /**
   * HTML element currently selected.
   * `null` if none is currently selected.
   */
  let selectedElt: HTMLElement | null = null;

  /**
   * The log "index" (linked to its index in `LOGS_HISTORY`) of the log
   * currently selected by this LogModule.
   */
  let nextLogIdx = 0;

  /** If `true`, inputted search string are case sensitive. */
  let areSearchCaseSensitive = false;

  /** If `true`, inputted search string are Regular Expression. */
  let areSearchRegex = false;

  const minimumTimeInputElt = strHtml`<input
    type="input"
    placeholder="0"
    value="0"
    class="log-time-range"
    style="margin: 0px 5px"
  />` as HTMLInputElement;
  const maximumTimeInputElt = strHtml`<input
    type="input"
    class="log-time-range"
    style="margin: 0px 5px"
  />` as HTMLInputElement;
  minimumTimeInputElt.oninput = refreshFilters;
  minimumTimeInputElt.onchange = refreshFilters;
  maximumTimeInputElt.oninput = refreshFilters;
  maximumTimeInputElt.onchange = refreshFilters;

  /** Text input element for only showing a sub-time-range of the logs. */
  const timeRangeInputElt = strHtml`<div class="log-wrapper">
    <span>
      Min. timestamp: ${minimumTimeInputElt}
    </span>
    <span>
      Max. timestamp (empty for no limit): ${maximumTimeInputElt}
    </span>
  </div>` as HTMLInputElement;
  timeRangeInputElt.style.fontSize = "0.9em";
  timeRangeInputElt.style.display = "flex";
  timeRangeInputElt.style.margin = "10px 0px 0px 0px";
  timeRangeInputElt.style.overflow = "hidden";
  timeRangeInputElt.style.justifyContent = "space-between";

  /** Wrapper elements allowing to filter logs. */
  const filterFlexElt = strHtml`<div class="log-wrapper"/>`;
  filterFlexElt.style.display = "flex";
  filterFlexElt.style.height = "40px";
  filterFlexElt.style.margin = "5px 0px";

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
    }
  );

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
    }
  );

  /** Text input element for filtering logs. */
  const logFilterInputElt = strHtml`<input
    type="input"
    placeholder="Filter logs based on text"
    class="log-filter"
  />` as HTMLInputElement;
  logFilterInputElt.style.margin = "5px";
  logFilterInputElt.style.width = "calc(100% - 9px)";
  logFilterInputElt.oninput = refreshFilters;
  logFilterInputElt.onchange = refreshFilters;

  filterFlexElt.appendChild(caseSensitiveBtn);
  filterFlexElt.appendChild(regexFilterButton);
  filterFlexElt.appendChild(logFilterInputElt);

  const allFiltersElt = strHtml`<div>
    <div style="border-bottom: 1px dotted;">Filters</div>
  </div>`;
  allFiltersElt.style.padding = "5px";
  allFiltersElt.style.marginTop = "5px";
  const unsubFiltersStyle = configState.subscribe(
    STATE_PROPS.CSS_MODE,
    () => {
      allFiltersElt.style.backgroundColor =
        configState.getCurrentState(STATE_PROPS.CSS_MODE) === "dark"
          ? "#333"
          : "#f2f2f2";
    },
    true
  );
  allFiltersElt.appendChild(timeRangeInputElt);
  allFiltersElt.appendChild(filterFlexElt);

  state.subscribe(STATE_PROPS.LOGS_HISTORY, onLogsHistoryChange, true);
  state.subscribe(STATE_PROPS.SELECTED_LOG_INDEX, onSelectedLogChange, true);

  logBodyElt.appendChild(logContainerElt);

  return {
    body: strHtml`<div>${[logHeaderElt, allFiltersElt, logBodyElt]}</div>`,
    clear() {
      unsubCaseBtn();
      unsubRegexBtn();
      unsubFiltersStyle();
      clearLogs();
    },
    destroy() {
      logsPending = [];
      timeoutInterval = undefined;
      clearTimeout(timeoutInterval);
      state.unsubscribe(STATE_PROPS.LOGS_HISTORY, onLogsHistoryChange);
      state.unsubscribe(STATE_PROPS.SELECTED_LOG_INDEX, onSelectedLogChange);

      if (state.getCurrentState(STATE_PROPS.SELECTED_LOG_INDEX) !== undefined) {
        state.updateState(
          STATE_PROPS.SELECTED_LOG_INDEX,
          UPDATE_TYPE.REPLACE,
          undefined
        );
        state.commitUpdates();
      }
    },
  };

  /** Display header for when no logs are yet received. */
  function displayNoLogHeader() {
    logHeaderElt.textContent = "No log.";
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
    const clickSpan = strHtml`<span class="emphasized">${
      "Click on the log again or here to unselect"
    }</span>`;
    clickSpan.onclick = function () {
      state.updateState(
        STATE_PROPS.SELECTED_LOG_INDEX,
        UPDATE_TYPE.REPLACE,
        undefined
      );
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
  function getHeaderType(): "loading" | "no-log" | "no-selected" | "selected" {
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
      logsPending = [];
      clearLogs();
      return;
    }
    if (updateType === UPDATE_TYPE.REPLACE || updateType === "initial") {
      nextLogIdx = 0;
      logsPending = [];
      clearLogs();
    }

    const numberedValues = values.map((str): [string, number] => [
      str,
      nextLogIdx++,
    ]);
    let filtered;
    if (
      filterObject.minTimeStamp === 0 &&
      filterObject.maxTimeStamp === Infinity &&
      filterObject.textFilter === null
    ) {
      filtered = numberedValues;
    } else {
      const filter = createFilterFunction();
      filtered = numberedValues.filter(([str]) => filter(str));
    }
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
  function onSelectedLogChange() {
    const hasLogIdxSelected =
      state.getCurrentState(STATE_PROPS.SELECTED_LOG_INDEX) !== undefined;
    const headerType = getHeaderType();
    if (!hasLogIdxSelected && logContainerElt.childNodes.length === 0) {
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
  function displayNextPendingLogs(): void {
    timeoutInterval = undefined;
    if (logsPending.length > MAX_DISPLAYED_LOG_ELEMENTS) {
      logsPending = logsPending.slice(MAX_DISPLAYED_LOG_ELEMENTS);
    }

    const wasScrolledToBottom = isLogBodyScrolledToBottom();
    const logsToDisplay = logsPending.slice(0, 500);
    if (logsToDisplay.length >= 10) {
      logBodyElt.innerHTML = "";
    }
    logsPending = logsPending.slice(500);
    displayLoadingHeader();
    const selectedLogIdx = state.getCurrentState(
      STATE_PROPS.SELECTED_LOG_INDEX
    );
    for (const log of logsToDisplay) {
      const logElt = createLogElement(log[0]);
      if (log[1] === selectedLogIdx) {
        if (selectedElt !== null) {
          selectedElt.classList.remove("focused-bg");
        }
        logElt.classList.add("focused-bg");
        selectedElt = logElt;
      }
      logElt.dataset.logId = String(log[1]);
      logElt.onclick = toggleCurrentElementSelection;
      while (logContainerElt.children.length > MAX_DISPLAYED_LOG_ELEMENTS - 1) {
        logContainerElt.removeChild(logContainerElt.children[0]);
      }
      logContainerElt.appendChild(logElt);
    }

    if (logsPending.length > 0) {
      timeoutInterval = setTimeout(displayNextPendingLogs, 50);
    } else {
      const headerType = getHeaderType();
      if (selectedElt === null && logContainerElt.childNodes.length === 0) {
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

    if (logContainerElt.parentElement !== logBodyElt) {
      logBodyElt.appendChild(logContainerElt);
    }
    if (wasScrolledToBottom) {
      logBodyElt.scrollTop = logBodyElt.scrollHeight;
    }
  }

  function isLogBodyScrolledToBottom(): boolean {
    const hasVerticalScrollbar =
      logBodyElt.scrollHeight > logBodyElt.clientHeight;
    return (
      !hasVerticalScrollbar ||
      logBodyElt.scrollHeight - logBodyElt.clientHeight <=
        logBodyElt.scrollTop + 5
    );
  }

  /**
   * Select/unselect the currently clicked log element.
   */
  function toggleCurrentElementSelection(evt: MouseEvent): void {
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
    const selectedLogIdx = state.getCurrentState(
      STATE_PROPS.SELECTED_LOG_INDEX
    );
    if (selectedLogIdx === currentLogIdx) {
      state.updateState(
        STATE_PROPS.SELECTED_LOG_INDEX,
        UPDATE_TYPE.REPLACE,
        undefined
      );
      state.commitUpdates();
      return;
    }

    state.updateState(
      STATE_PROPS.SELECTED_LOG_INDEX,
      UPDATE_TYPE.REPLACE,
      currentLogIdx
    );
    selectedElt = logElt;

    logElt.classList.add("focused-bg");
    state.commitUpdates();
  }

  /**
   * Reapply filters on what is currently in `logFilterInputElt.value`.
   */
  function refreshFilters() {
    let minRange: number = +minimumTimeInputElt.value;
    if (isNaN(minRange) || minRange <= 0) {
      minRange = 0;
    }
    let maxRange: number =
      maximumTimeInputElt.value === "" ? Infinity : +maximumTimeInputElt.value;
    if (isNaN(maxRange)) {
      maxRange = Infinity;
    }
    const text = logFilterInputElt.value ?? "";
    if (
      filterObject.minTimeStamp === minRange &&
      filterObject.maxTimeStamp === maxRange &&
      (text.length === 0
        ? filterObject.textFilter === null
        : filterObject.textFilter?.text === text &&
          filterObject.textFilter.caseSensitive === areSearchCaseSensitive &&
          filterObject.textFilter.regex === areSearchRegex)
    ) {
      return; // Nothing changed
    }
    filterObject.minTimeStamp = minRange;
    filterObject.maxTimeStamp = maxRange;
    if (text === "") {
      filterObject.textFilter = null;
    } else {
      filterObject.textFilter = {
        text,
        caseSensitive: areSearchCaseSensitive,
        regex: areSearchRegex,
      };
    }
    onLogsHistoryChange(
      "initial",
      state.getCurrentState(STATE_PROPS.LOGS_HISTORY) ?? []
    );
  }

  function createFilterFunction(): (input: string) => boolean {
    let checkLogDate: (input: string) => boolean;
    if (filterObject.minTimeStamp === 0) {
      if (filterObject.maxTimeStamp === Infinity) {
        checkLogDate = () => true;
      } else {
        checkLogDate = (input: string) =>
          filterObject.maxTimeStamp >= parseFloat(input);
      }
    } else if (filterObject.maxTimeStamp === Infinity) {
      checkLogDate = (input: string) =>
        filterObject.minTimeStamp <= parseFloat(input);
    } else {
      checkLogDate = (input: string) => {
        const timestamp = parseFloat(input);
        return (
          filterObject.minTimeStamp <= timestamp &&
          filterObject.maxTimeStamp >= timestamp
        );
      };
    }
    if (filterObject.textFilter !== null) {
      const text = filterObject.textFilter.text;
      if (filterObject.textFilter.regex) {
        const flags = filterObject.textFilter.caseSensitive ? "i" : undefined;
        const reg = new RegExp(text, flags);
        return (input: string) => checkLogDate(input) && reg.test(input);
      } else if (filterObject.textFilter.caseSensitive) {
        return (input: string) => checkLogDate(input) && input.includes(text);
      } else {
        const toLower = text.toLowerCase();
        return (input: string) =>
          checkLogDate(input) && input.toLowerCase().includes(toLower);
      }
    } else {
      return checkLogDate;
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
  ): [HTMLElement, () => void] {
    let isDisabled = true;
    let isDarkMode =
      configState.getCurrentState(STATE_PROPS.CSS_MODE) === "dark";
    const unsub = configState.subscribe(STATE_PROPS.CSS_MODE, () => {
      isDarkMode = configState.getCurrentState(STATE_PROPS.CSS_MODE) === "dark";
      if (isDisabled) {
        setDisabledStyle();
      } else {
        setEnabledStyle();
      }
    });
    const buttonElt = strHtml`<button class="log-filter-button">${innerText}</button>`;
    buttonElt.onclick = () => {
      if (isDisabled) {
        isDisabled = false;
        setEnabledStyle();
        buttonElt.title = titleEnabled;
        onEnabled();
      } else {
        isDisabled = true;
        buttonElt.title = titleDisabled;
        setDisabledStyle();
        buttonElt.style.color = isDarkMode ? "#ffffff" : "#000000";
        onDisabled();
      }
    };

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
      buttonElt.style.color = isDarkMode ? "#d3ffcf" : "#990033";
    }

    function setDisabledStyle() {
      buttonElt.style.color = isDarkMode ? "#ffffff" : "#000000";
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
export function createLogElement(logTxt: string): HTMLElement {
  let namespace;
  let formattedMsg = logTxt;
  const indexOfNamespaceStart = logTxt.indexOf("[");
  if (indexOfNamespaceStart >= 0) {
    const indexOfNamespaceEnd = logTxt.indexOf("]");
    if (indexOfNamespaceEnd > 0) {
      namespace = logTxt.substring(
        indexOfNamespaceStart + 1,
        indexOfNamespaceEnd
      );
      formattedMsg = logTxt.replace(
        /\n/g,
        "\n" + " ".repeat(indexOfNamespaceEnd + 2)
      );
    }
  }
  const className =
    namespace !== undefined
      ? "log-line log-" + namespace.toLowerCase()
      : "log-line log-unknown";
  return strHtml`<pre class=${className}>${formattedMsg}</pre>`;
}
