import { InspectorState, STATE_PROPS } from "./constants";
import ObservableState, { UPDATE_TYPE } from "./observable_state";

/**
 * Function called when a new log is received, so it can update the
 * `ObservableState` accordingly, which will have the effect of updating the
 * modules relying on those updated states.
 * @param {Object} state
 * @param {string} newLog
 */
export default function updateStateFromLog(
  state : ObservableState<InspectorState>,
  newLog : string
) : void {
  state.updateState(STATE_PROPS.LOGS_HISTORY, UPDATE_TYPE.PUSH, [newLog]);
  if (newLog.indexOf("current playback timeline") > -1) {
    processPlaybackTimelineLog(state, newLog);
  } else if (newLog.indexOf("playerStateChange event") > -1) {
    processPlayerStateChangeLog(state, newLog);
  } else if (newLog.indexOf("Updating duration ") > -1) {
    const regexDur = /Updating duration ([0-9]+(?:\.[0-9]+)?)/;
    const match = newLog.match(regexDur);
    let duration : number;
    if (match !== null) {
      duration = +match[1];
      state.updateState(STATE_PROPS.CONTENT_DURATION, UPDATE_TYPE.REPLACE, duration);
    } else {
      console.error("Has duration log format changed");
    }
  }
}

/**
 * @param {Object} state
 * @param {string} logTxt
 */
function processPlaybackTimelineLog(
  state : ObservableState<InspectorState>,
  logTxt : string
) : void {
  const splitted = logTxt.split("\n");
  const lastIdx = splitted.length - 1;
  const positionPart = splitted[lastIdx - 1];
  const regexPos = /\^([0-9]+(?:\.[0-9]+)?)/;
  const match = positionPart.match(regexPos);
  let position : number;
  if (match !== null) {
    position = +match[1];
    state.updateState(STATE_PROPS.POSITION, UPDATE_TYPE.REPLACE, position);
    let bufferLine = splitted[lastIdx - 2];
    if (bufferLine === undefined) {
      console.error("Has buffer log format changed?");
    } else {
      bufferLine = bufferLine.trim();
      let bufferGap;
      const ranges : Array<[number, number]> = [];
      while (true) {
        let indexOfPipe = bufferLine.indexOf("|");
        if (indexOfPipe === -1) {
          break;
        }
        const rangeStart = parseFloat(bufferLine.substring(0, indexOfPipe));
        if (isNaN(rangeStart)) {
          console.error("Has buffer range log format changed?");
          break;
        }
        bufferLine = bufferLine.substring(indexOfPipe + 1);
        indexOfPipe = bufferLine.indexOf("|");
        if (indexOfPipe === -1) {
          console.error("Has buffer range end log format changed?");
          break;
        }
        let indexOfTilde = bufferLine.indexOf("~");
        let rangeEnd;
        if (indexOfTilde === -1) {
          rangeEnd = parseFloat(bufferLine.substring(indexOfPipe + 1).trim());
        } else {
          rangeEnd = parseFloat(
            bufferLine.substring(indexOfPipe + 1, indexOfTilde).trim()
          );
        }
        if (isNaN(rangeEnd)) {
          console.error("Has buffer range end log format changed?");
          break;
        }
        ranges.push([ rangeStart, rangeEnd ]);
        if (position >= rangeStart && position <= rangeEnd) {
          bufferGap = rangeEnd - position;
        }
        if (indexOfTilde === -1) {
          break;
        }
        bufferLine = bufferLine.substring(indexOfTilde + 1);
        indexOfTilde = bufferLine.indexOf("~");
        if (indexOfTilde === -1) {
          console.error("Has consecutive buffer log format changed?");
          break;
        }
        bufferLine = bufferLine.substring(indexOfTilde + 1);
      }
      state.updateState(STATE_PROPS.BUFFERED_RANGES, UPDATE_TYPE.REPLACE, ranges);

      const timestamp = parseFloat(logTxt);
      if (isNaN(timestamp)) {
        console.error("Has timestamp format changed?");
      }
      state.updateState(STATE_PROPS.BUFFER_GAPS,
                        UPDATE_TYPE.PUSH,
                        [{ bufferGap, timestamp }]);
    }
  } else {
    console.error("Has position log format changed?");
  }
}

/**
 * @param {Object} state
 * @param {string} logTxt
 */
function processPlayerStateChangeLog(
  state : ObservableState<InspectorState>,
  logTxt : string
) : void {
  const stateRegex = /(\w+)$/;
  const match = logTxt.match(stateRegex);
  if (match !== null) {
    const playerState = match[1];
    if (playerState === "STOPPED") {
      state.updateState(STATE_PROPS.POSITION, UPDATE_TYPE.REPLACE, undefined);
      state.updateState(STATE_PROPS.BUFFER_GAPS, UPDATE_TYPE.REPLACE, undefined);
      state.updateState(STATE_PROPS.BUFFERED_RANGES, UPDATE_TYPE.REPLACE, undefined);
    }
    state.updateState(STATE_PROPS.PLAYER_STATE, UPDATE_TYPE.REPLACE, playerState);
  } else {
    console.error("Has state log format changed?");
  }
}

// 39200.00 [log] SI: current video inventory timeline:
// 0.00|A|6.00 ~ 6.00|B|9.00 ~ 9.00|A|15.00 ~ 15.00|B|18.00
// [A] P: gen-dash-period-0 || R: video/1(686685)
// [B] P: gen-dash-period-0 || R: video/4(1929169)

// 3949.00 [info] Stream: Updating audio adaptation A: audio-en-audio/mp4 P: 0

// 15471.00 [info] Stream: New active period 0

