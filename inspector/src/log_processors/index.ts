import {
  InspectorState,
  InventoryTimelineRangeInfo,
  InventoryTimelineRepresentationInfo,
  STATE_PROPS,
} from "../constants";
import { UPDATE_TYPE } from "../observable_state";

/**
 * Each of the following objects is linked to a type of log.
 *
 * - The `filter` function should return true when we're handling the log concerned
 *   by this object.
 *
 *   It takes in argument the log line and should return `true` if the given log
 *   line concerns this `LogProcessor`.
 *   If `true` is returned, the `processor` function will then be called on that
 *   same line.
 *
 *   Note that multiple LogProcessors' filter functions can pass on the same log
 *   line.
 *
 * - The `processor` function will be the function called if the filter passes.
 *   It should return an array in which each element describes a state update
 *   that can be deduced from that log line (@see StateUpdate).
 *
 * - the `updatedProps` array should list all state properties the `processor`
 *   might alter.
 *   It is used when doing optimizations, such as parsing logs in bulk beginning
 *   by the newest, where we might stop calling the corresponding `LogProcessor`
 *   object once all of its `updatedProps` are already known.
 */
const LogProcessors : Array<LogProcessor<keyof InspectorState>> = [
  {
    filter: (log: string) : boolean =>
      log.indexOf("Updating duration ") > -1,
    processor: (log: string) : Array<StateUpdate<STATE_PROPS.CONTENT_DURATION>> =>
      processDurationLog(log),
    updatedProps: [ STATE_PROPS.CONTENT_DURATION ],
  },

  {
    filter: (log: string) : boolean =>
      log.indexOf("video inventory timeline:") > -1,
    processor: (log: string) : Array<StateUpdate<STATE_PROPS.VIDEO_INVENTORY>> =>
      processInventoryTimelineLog("video", log),
    updatedProps: [ STATE_PROPS.VIDEO_INVENTORY ],
  },

  {
    filter: (log: string) : boolean =>
      log.indexOf("audio inventory timeline:") > -1,
    processor: (log: string) : Array<StateUpdate<STATE_PROPS.AUDIO_INVENTORY>> =>
      processInventoryTimelineLog("audio", log),
    updatedProps: [ STATE_PROPS.AUDIO_INVENTORY ],
  },

  {
    filter: (log: string) : boolean =>
      log.indexOf("current playback timeline") > -1,
    processor: (log: string) : Array<StateUpdate<keyof InspectorState>> =>
      processPlaybackTimelineLog(log),
    updatedProps: [
      STATE_PROPS.POSITION,
      STATE_PROPS.BUFFER_GAPS,
      STATE_PROPS.BUFFERED_RANGES,
    ],
  },

  {
    filter: (log: string) : boolean =>
      log.indexOf("playerStateChange event") > -1,
    processor: (log: string) : Array<StateUpdate<keyof InspectorState>> =>
      processPlayerStateChangeLog(log),
    updatedProps: [
      STATE_PROPS.POSITION,
      STATE_PROPS.BUFFER_GAPS,
      STATE_PROPS.BUFFERED_RANGES,
      STATE_PROPS.PLAYER_STATE,
      STATE_PROPS.CONTENT_DURATION,
      STATE_PROPS.VIDEO_INVENTORY,
      STATE_PROPS.AUDIO_INVENTORY,
    ],
  },
];

export default LogProcessors;

/**
 * Object allowing to parse a given log line into state updates.
 *
 * `T` corresponds here to the names of the property states that can be updated
 * by this LogProcessor.
 */
export interface LogProcessor<T extends keyof InspectorState> {
  /**
   * Indicates if the current LogProcessor is able to parse state from the
   * given log line.
   * @param {string} log - The log line in question
   * @returns {boolean} - `true` if the current LogProcessor can parse this log
   * line. `false` otherwise.
   */
  filter(log: string): boolean;
  /**
   * State updates that can be deduced from the given log line.
   * Returns an empty array if no state can be deduced.
   * @param {string} log - The log line in question
   * @returns {Array.<Object>}
   */
  processor(log: string): Array<StateUpdate<T>>;
  /** All state properties that might be updated by the `processor` function. */
  updatedProps: T[];
}

/** Information on a state update that can be performed. */
export interface StateUpdate<P extends keyof InspectorState> {
  /** The property that can be updated. */
  property: P;
  /** The type of update that should be performed on the given property. */
  updateType: UPDATE_TYPE;
  /** The value accompanying this update type (@see UPDATE_TYPE). */
  updateValue: InspectorState[P];
}

/**
 * @param {string} logTxt
 * @returns {Array.<Object>}
 */
function processDurationLog(
  logTxt : string
) : Array<StateUpdate<STATE_PROPS.CONTENT_DURATION>> {
  const regexDur = /Updating duration ([0-9]+(?:\.[0-9]+)?)/;
  const match = logTxt.match(regexDur);
  let duration : number;
  if (match !== null) {
    duration = +match[1];
    return [{
      property: STATE_PROPS.CONTENT_DURATION,
      updateType: UPDATE_TYPE.REPLACE,
      updateValue: duration,
    }];
  } else {
    console.error("Has duration log format changed");
  }
  return [];
}

/**
 * @param {string} logTxt
 */
function processPlaybackTimelineLog(
  logTxt : string
) : Array<StateUpdate<STATE_PROPS.POSITION |
                      STATE_PROPS.BUFFER_GAPS |
                      STATE_PROPS.BUFFERED_RANGES>>
{
  const stateUpdates : Array<
    StateUpdate<STATE_PROPS.POSITION |
    STATE_PROPS.BUFFER_GAPS |
    STATE_PROPS.BUFFERED_RANGES>
  >= [];
  const splitted = logTxt.split("\n");
  const lastIdx = splitted.length - 1;
  const positionPart = splitted[lastIdx - 1];
  const regexPos = /\^([0-9]+(?:\.[0-9]+)?)/;
  const match = positionPart.match(regexPos);
  let position : number;
  if (match !== null) {
    position = +match[1];
    stateUpdates.push({
      property: STATE_PROPS.POSITION,
      updateType: UPDATE_TYPE.REPLACE,
      updateValue: position,
    });
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
      stateUpdates.push({
        property: STATE_PROPS.BUFFERED_RANGES,
        updateType: UPDATE_TYPE.REPLACE,
        updateValue: ranges,
      });

      const timestamp = parseFloat(logTxt);
      if (isNaN(timestamp)) {
        console.error("Has timestamp format changed?");
      }
      stateUpdates.push({
        property: STATE_PROPS.BUFFER_GAPS,
        updateType: UPDATE_TYPE.PUSH,
        updateValue: [{ bufferGap, timestamp }],
      });
    }
  } else {
    console.error("Has position log format changed?");
  }
  return stateUpdates;
}

/**
 * @param {string} logTxt
 */
function processPlayerStateChangeLog(
  logTxt : string
) : Array<StateUpdate<STATE_PROPS.POSITION |
                      STATE_PROPS.BUFFER_GAPS |
                      STATE_PROPS.BUFFERED_RANGES |
                      STATE_PROPS.CONTENT_DURATION |
                      STATE_PROPS.VIDEO_INVENTORY |
                      STATE_PROPS.AUDIO_INVENTORY |
                      STATE_PROPS.PLAYER_STATE>>
{
  const stateUpdates : Array<
    StateUpdate<STATE_PROPS.POSITION |
                STATE_PROPS.BUFFER_GAPS |
                STATE_PROPS.BUFFERED_RANGES |
                STATE_PROPS.CONTENT_DURATION |
                STATE_PROPS.VIDEO_INVENTORY |
                STATE_PROPS.AUDIO_INVENTORY |
                STATE_PROPS.PLAYER_STATE>
  > = [];
  const stateRegex = /(\w+)$/;
  const match = logTxt.match(stateRegex);
  if (match !== null) {
    const playerState = match[1];
    if (
      playerState === "STOPPED" ||
      playerState === "RELOADING" ||
      playerState === "LOADING"
    ) {
      stateUpdates.push({
        property: STATE_PROPS.POSITION,
        updateType: UPDATE_TYPE.REPLACE,
        updateValue: undefined,
      });
      stateUpdates.push({
        property: STATE_PROPS.BUFFER_GAPS,
        updateType: UPDATE_TYPE.REPLACE,
        updateValue: undefined,
      });
      stateUpdates.push({
        property: STATE_PROPS.BUFFERED_RANGES,
        updateType: UPDATE_TYPE.REPLACE,
        updateValue: undefined,
      });
      stateUpdates.push({
        property: STATE_PROPS.CONTENT_DURATION,
        updateType: UPDATE_TYPE.REPLACE,
        updateValue: undefined,
      });
      stateUpdates.push({
        property: STATE_PROPS.AUDIO_INVENTORY,
        updateType: UPDATE_TYPE.REPLACE,
        updateValue: undefined,
      });
      stateUpdates.push({
        property: STATE_PROPS.VIDEO_INVENTORY,
        updateType: UPDATE_TYPE.REPLACE,
        updateValue: undefined,
      });
    }
    stateUpdates.push({
      property: STATE_PROPS.PLAYER_STATE,
      updateType: UPDATE_TYPE.REPLACE,
      updateValue: playerState,
    });
  } else {
    console.error("Has state log format changed?");
  }
  return stateUpdates;
}

/**
 * @param {string} logTxt
 */
function processInventoryTimelineLog(
  mediaType : "audio",
  logTxt : string
) : Array<StateUpdate<STATE_PROPS.AUDIO_INVENTORY>>;
function processInventoryTimelineLog(
  mediaType : "video",
  logTxt : string
) : Array<StateUpdate<STATE_PROPS.VIDEO_INVENTORY>>;
function processInventoryTimelineLog(
  mediaType : "audio" | "video",
  logTxt : string
) : Array<StateUpdate<STATE_PROPS.VIDEO_INVENTORY | STATE_PROPS.AUDIO_INVENTORY>> {
  const splitted = logTxt.split("\n");

  // Example of format:
  //
  // 39200.00 [log] SI: current video inventory timeline:
  // 0.00|A|6.00 ~ 6.00|B|9.00 ~ 9.00|A|15.00 ~ 15.00|B|18.00
  // [A] P: gen-dash-period-0 || R: video/1(686685)
  // [B] P: gen-dash-period-0 || R: video/4(1929169)

  // Here, we begin at the end by parsing all the Representation informations
  // Then we will parse the timeline and associate both.

  let currentIndex = splitted.length - 1;
  const representationsInfo : Record<string,
                                     InventoryTimelineRepresentationInfo> = {};
  while (
    splitted[currentIndex] !== undefined &&
    splitted[currentIndex][0] === "["
  ) {
    const currentLine = splitted[currentIndex];
    const repLetter = currentLine[1];
    const substrStartingWithPeriodId = currentLine.substring("[X] P: ".length);
    const indexOfRep = substrStartingWithPeriodId.indexOf(" || R: ");
    if (indexOfRep < 0) {
      console.error("Has inventory timeline log format changed?");
      return [];
    }
    const periodId = substrStartingWithPeriodId.substring(0, indexOfRep);

    const representationInfoStr = substrStartingWithPeriodId
      .substring(indexOfRep + " || R: ".length);
    const bitrateRegex = /\((\d+)\)$/;
    const match = representationInfoStr.match(bitrateRegex);
    if (match === null) {
      console.error("Has inventory timeline log format changed?");
      return [];
    }
    const bitrate = +match[1];
    const representationId = representationInfoStr
      .substring(0, representationInfoStr.length - match[0].length);
    representationsInfo[repLetter] = {
      bitrate,
      periodId,
      representationId,
    };
    currentIndex--;
  }

  // We should now be at the timeline line, like:
  // 0.00|A|6.00 ~ 6.00|B|9.00 ~ 9.00|A|15.00 ~ 15.00|B|18.00

  const ranges : InventoryTimelineRangeInfo[] = [];
  let remainingTimeline = splitted[currentIndex];
  const rangeRegex = /^(\d+\.\d+)\|(.)\|(\d+\.\d+)/;
  while (
    remainingTimeline !== undefined &&
    remainingTimeline.length > 0
  ) {
    const match = remainingTimeline.match(rangeRegex);
    if (match === null) {
      console.error("Has inventory timeline log format changed?");
      return [];
    }
    const start = +match[1];
    const letter = match[2];
    const end = +match[3];
    ranges.push({ start, end, letter });
    remainingTimeline = remainingTimeline.substring(match[0].length + " ~ ".length);
  }

  const firstLine = splitted[0];
  if (firstLine === undefined) {
    console.error("Has inventory timeline log format changed?");
    return [];
  }

  if (mediaType === "video") {
    return [{
      property: STATE_PROPS.VIDEO_INVENTORY,
      updateType: UPDATE_TYPE.REPLACE,
      updateValue: { representations: representationsInfo, ranges },
    }];
  } else if (mediaType === "audio") {
    return [{
      property: STATE_PROPS.AUDIO_INVENTORY,
      updateType: UPDATE_TYPE.REPLACE,
      updateValue: { representations: representationsInfo, ranges },
    }];
  }
  return [];
}

// TODO:

// 3949.00 [info] Stream: Updating audio adaptation A: audio-en-audio/mp4 P: 0

// 15471.00 [info] Stream: New active period 0
