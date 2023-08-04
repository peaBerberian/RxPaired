import { InspectorState, STATE_PROPS } from "../constants";
import { createCompositeElement, createElement } from "../dom-utils";
import ObservableState from "../observable_state";

/**
 * @param {Object} args
 */
export default function PlayerGeneralInfoModule(
  { state } : { state : ObservableState<InspectorState> }
) {
  const stateData = createElement("span", {
    textContent: state.getCurrentState(STATE_PROPS.PLAYER_STATE) ?? "Unknown",
    className: "emphasized",
  });
  const positionData = createElement("span", {
    textContent: getCurrentPositionTextContent(state),
    className: "emphasized",
  });
  const bufferGapData = createElement("span", {
    textContent: getCurrentBufferGapTextContent(state),
    className: "emphasized",
  });
  const durationData = createElement("span", {
    textContent: getCurrentDurationTextContent(state),
    className: "emphasized",
  });
  const initialLoadingTimeDataElt = createElement("span", {
    textContent: getInitialLoadingTimeStr(
      state.getCurrentState(STATE_PROPS.STATE_CHANGE_HISTORY) ?? []
    ),
    className: "emphasized",
  });
  const generalInfoBodyElt = createCompositeElement("div", [
    createElement("span", { textContent: "Current state: " }),
    stateData,
    " - ",
    createElement("span", { textContent: "Current position: " }),
    positionData,
    " - ",
    createElement("span", { textContent: "Buffer Gap: " }),
    bufferGapData,
    " - ",
    createElement("span", { textContent: "Duration: " }),
    durationData,
    " - ",
    createElement("span", { textContent: "Initial loading time: " }),
    initialLoadingTimeDataElt,
  ], { className: "gen-info-body module-body" });

  const unsubscribeState = state.subscribe(STATE_PROPS.PLAYER_STATE, (
    _ut,
    newState: string | undefined
  ) => {
    stateData.textContent = newState ?? "Unknown";
  });
  const unsubscribePosition = state.subscribe(STATE_PROPS.POSITION, () => {
    positionData.textContent = getCurrentPositionTextContent(state);
  });
  const unsubscribeBufferGaps = state.subscribe(STATE_PROPS.BUFFER_GAPS, () => {
    bufferGapData.textContent = getCurrentBufferGapTextContent(state);
  });
  const unsubscribeDuration = state.subscribe(STATE_PROPS.CONTENT_DURATION, () => {
    durationData.textContent = getCurrentDurationTextContent(state);
  });
  const unsubscribeStateHistory = state.subscribe(
    STATE_PROPS.STATE_CHANGE_HISTORY,
    () => {
      initialLoadingTimeDataElt.textContent = getInitialLoadingTimeStr(
        state.getCurrentState(STATE_PROPS.STATE_CHANGE_HISTORY) ?? []
      );
    }
  );

  return {
    body: generalInfoBodyElt,
    destroy() {
      unsubscribeState();
      unsubscribePosition();
      unsubscribeBufferGaps();
      unsubscribeDuration();
      unsubscribeStateHistory();
    },
  };
}

function getInitialLoadingTimeStr(
  history: Array<{ state: string; timestamp: number }>
): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].state === "LOADED") {
      for (let j = i - 1; j >= 0; j--) {
        if (history[j].state === "LOADING") {
          const delta = history[i].timestamp - history[j].timestamp;
          return String(delta.toFixed(2));
        } else if (history[i].state === "STOPPED") {
          return "Unknown";
        }
      }
      return "Unknown";
    } else if (history[i].state === "STOPPED") {
      return "Unknown";
    }
  }
  return "Unknown";
}

/**
 * @param {Object} state
 * @returns {string}
 */
function getCurrentPositionTextContent(
  state : ObservableState<InspectorState>
) : string {
  const newPos = state.getCurrentState(STATE_PROPS.POSITION);
  if (newPos === undefined) {
    return "undefined";
  } else {
    return (+newPos).toFixed(2);
  }
}

/**
 * @param {Object} state
 * @returns {string}
 */
function getCurrentBufferGapTextContent(
  state : ObservableState<InspectorState>
) : string {
  const buffGaps = state.getCurrentState(STATE_PROPS.BUFFER_GAPS);
  if (buffGaps === undefined) {
    return "undefined";
  } else {
    const lastBuffGap = buffGaps[buffGaps.length - 1];
    if (lastBuffGap !== undefined && lastBuffGap.bufferGap !== undefined) {
      return lastBuffGap.bufferGap.toFixed(2);
    }
    return "undefined";
  }
}

/**
 * @param {Object} state
 * @returns {string}
 */
function getCurrentDurationTextContent(
  state : ObservableState<InspectorState>
) : string {
  const duration = state.getCurrentState(STATE_PROPS.CONTENT_DURATION);
  if (duration === undefined) {
    return "Unknown";
  } else {
    return (+duration).toFixed(2);
  }
}
