import strHtml from "str-html";
import { InspectorState, STATE_PROPS } from "../constants";
import ObservableState from "../observable_state";

/**
 * @param {Object} args
 */
export default function PlayerGeneralInfoModule({
  state,
}: {
  state: ObservableState<InspectorState>;
}) {
  const stateData = strHtml`<span class="emphasized">${
    state.getCurrentState(STATE_PROPS.PLAYER_STATE) ?? "Unknown"
  }</span>`;
  const positionData = strHtml`<span class="emphasized">${getCurrentPositionTextContent(
    state,
  )}</span>`;
  const bufferGapData = strHtml`<span class="emphasized">${getCurrentBufferGapTextContent(
    state,
  )}</span>`;
  const durationData = strHtml`<span class="emphasized">${getCurrentDurationTextContent(
    state,
  )}</span>`;
  const initialLoadingTimeDataElt = strHtml`<span class="emphasized">${getInitialLoadingTimeStr(
    state.getCurrentState(STATE_PROPS.STATE_CHANGE_HISTORY) ?? [],
  )}</span>`;

  const generalInfoBodyElt = strHtml`<div class="gen-info-body module-body">${[
    strHtml`<span>Current state: </span>`,
    stateData,
    " - ",
    strHtml`<span>Current position: </span>`,
    positionData,
    " - ",
    strHtml`<span>Buffer Gap: </span>`,
    bufferGapData,
    " - ",
    strHtml`<span>Duration: </span>`,
    durationData,
    " - ",
    strHtml`<span>Initial loading time: </span>`,
    initialLoadingTimeDataElt,
  ]}</div>`;

  const unsubscribeFns = [
    state.subscribe(
      STATE_PROPS.PLAYER_STATE,
      (_updateType, newState: string | undefined) => {
        stateData.textContent = newState ?? "Unknown";
      },
    ),

    state.subscribe(STATE_PROPS.POSITION, () => {
      positionData.textContent = getCurrentPositionTextContent(state);
    }),

    state.subscribe(STATE_PROPS.BUFFER_GAPS, () => {
      bufferGapData.textContent = getCurrentBufferGapTextContent(state);
    }),

    state.subscribe(STATE_PROPS.CONTENT_DURATION, () => {
      durationData.textContent = getCurrentDurationTextContent(state);
    }),

    state.subscribe(STATE_PROPS.STATE_CHANGE_HISTORY, () => {
      initialLoadingTimeDataElt.textContent = getInitialLoadingTimeStr(
        state.getCurrentState(STATE_PROPS.STATE_CHANGE_HISTORY) ?? [],
      );
    }),
  ];

  return {
    body: generalInfoBodyElt,
    destroy() {
      unsubscribeFns.forEach((fn) => fn());
    },
  };
}

function getInitialLoadingTimeStr(
  history: Array<{ state: string; timestamp: number }>,
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
  state: ObservableState<InspectorState>,
): string {
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
  state: ObservableState<InspectorState>,
): string {
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
  state: ObservableState<InspectorState>,
): string {
  const duration = state.getCurrentState(STATE_PROPS.CONTENT_DURATION);
  if (duration === undefined) {
    return "Unknown";
  } else {
    return (+duration).toFixed(2);
  }
}
