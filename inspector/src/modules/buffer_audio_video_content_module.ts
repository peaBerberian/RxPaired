import strHtml from "str-html";
import {
  ConfigState,
  InventoryTimelineInfo,
  InventoryTimelineRepresentationInfo,
  STATE_PROPS,
} from "../constants";
import ObservableState from "../observable_state";
import { ModuleFunction, ModuleFunctionArguments, ModuleObject } from ".";

const CANVAS_WIDTH = 20000;
const CANVAS_HEIGHT = 100;

const COLORS = [
  "#2ab7ca",
  "#fed766",
  "#4dd248",
  "#a22c28",
  "#556b2f", // darkolivegreen
  "#add8e6", // lightblue
  "#90ee90", // lightgreen
  "#444444",
  "#40bfc1",
  "#57557e",
  "#fbe555",
];

export default function generateAudioVideoBufferContentModule(
  mediaType: "audio" | "video"
) : ModuleFunction {
  /**
   * Display a graph representing what has been buffered in the SourceBuffer
   * of the given `mediaType`.
   * @param {Object}
   * @returns {Object}
   */
  return function BufferAudioVideoModule(
    { state, configState } : ModuleFunctionArguments
  ) : ModuleObject {
    const listenedStateProp = mediaType === "video" ?
      STATE_PROPS.VIDEO_INVENTORY :
      STATE_PROPS.AUDIO_INVENTORY;
    const canvasElt = strHtml`<canvas class="canvas-buffer-size" />` as HTMLCanvasElement;
    const canvasCtx = canvasElt.getContext("2d");
    let currentRangesScaled : ScaledRangeInfo[] = [];

    const canvasParent = strHtml`<div>${canvasElt}</div>`;
    canvasParent.style.textAlign = "center";
    canvasParent.style.border = "1px solid black";
    canvasParent.style.height = "20px";
    canvasElt.style.height = "20px";
    canvasElt.onmousemove = onMouseMove;
    canvasElt.onmouseout = onMouseOut;

    const currentRangeTitle = strHtml`<span>Played range:</span>`;
    const currentRangeData = strHtml`<span class="emphasized">None</span>`;
    const currentRangeRepInfoTitle = strHtml`<span>Played Representation:</span>`;
    const currentRangeRepInfoData = strHtml`<span class="emphasized">None</span>`;
    const currentRangeElt = strHtml`<div>${[
      currentRangeTitle,
      currentRangeData,
    ]}</div>`;
    currentRangeData.style.marginLeft = "5px";

    const currentRangeRepInfoElt = strHtml`<div>${[
      currentRangeRepInfoTitle,
      currentRangeRepInfoData,
    ]}</div>`;
    currentRangeRepInfoData.style.marginLeft = "5px";
    currentRangeRepInfoElt.style.marginTop = "5px";

    const hoveredRangeTitle = strHtml`<span>Hovered range:</span>`;
    const hoveredRangeData =
      strHtml`<span class="emphasized">Hover range to show</span>`;
    hoveredRangeData.style.marginLeft = "5px";
    const hoveredRangeElt = strHtml`<div>${[
      hoveredRangeTitle,
      hoveredRangeData,
    ]}</div>`;
    hoveredRangeElt.style.marginTop = "5px";

    const hoveredRangeRepInfoTitle = strHtml`<span>Hovered Representation:</span>`;
    const hoveredRangeRepInfoData =
      strHtml`<span class="emphasized">Hover range to show</span>`;
    hoveredRangeRepInfoData.style.marginLeft = "5px";
    const hoveredRangeRepInfoElt = strHtml`<div>${[
      hoveredRangeRepInfoTitle,
      hoveredRangeRepInfoData,
    ]}</div>`;
    hoveredRangeRepInfoElt.style.marginTop = "5px";
    const descriptionElt = strHtml`<div>${[
      currentRangeElt,
      currentRangeRepInfoElt,
      hoveredRangeElt,
      hoveredRangeRepInfoElt,
    ]}</div>`;
    descriptionElt.style.marginTop = "7px";

    const bufferChartBodyElt = strHtml`<div class="buffer-chart-body module-body">${[
      canvasParent,
      descriptionElt,
    ]}</div>`;
    bufferChartBodyElt.style.overflow = "auto";
    bufferChartBodyElt.style.fontSize = "0.95em";

    state.subscribe(listenedStateProp, reRender, true);
    state.subscribe(STATE_PROPS.CONTENT_DURATION, reRender);
    state.subscribe(STATE_PROPS.POSITION, reRender);
    configState.subscribe(STATE_PROPS.CSS_MODE, reRender);

    return {
      body: bufferChartBodyElt,
      destroy() {
        state.unsubscribe(listenedStateProp, reRender);
        state.unsubscribe(STATE_PROPS.POSITION, reRender);
        state.unsubscribe(STATE_PROPS.CONTENT_DURATION, reRender);
        configState.unsubscribe(STATE_PROPS.CSS_MODE, reRender);
      },
    };

    function reRender() {
      const inventory = state.getCurrentState(
        listenedStateProp
      );
      if (canvasCtx === null || inventory === undefined) {
        setEmptyState();
        return;
      }

      canvasElt.width = CANVAS_WIDTH;
      canvasElt.height = CANVAS_HEIGHT;
      clearCanvas(canvasCtx);
      const currentTime = state.getCurrentState(STATE_PROPS.POSITION);
      const duration = state.getCurrentState(STATE_PROPS.CONTENT_DURATION);
      const minimumBuffered = inventory.ranges[0]?.start ?? 0;
      const maximumBuffered = duration ??
                              inventory.ranges[inventory.ranges.length - 1]?.end ?? 1000;
      let minimumPosition;
      let maximumPosition;
      if (maximumBuffered > 20000 && maximumBuffered - minimumBuffered > 11000) {
        if (currentTime === undefined) {
          minimumPosition = minimumBuffered;
          maximumPosition = maximumBuffered;
        } else {
          minimumPosition = currentTime - 5500;
          maximumPosition = currentTime + 5500;
        }
      } else if (maximumBuffered < 11000) {
        minimumPosition = 0;
        maximumPosition = maximumBuffered;
      } else {
        minimumPosition = minimumBuffered;
        maximumPosition = maximumBuffered;
      }
      if (minimumPosition >= maximumPosition) {
        setEmptyState();
        return;
      }

      currentRangesScaled = scaleSegments(inventory, minimumPosition, maximumPosition);

      for (let i = 0; i < currentRangesScaled.length; i++) {
        paintRange(currentRangesScaled[i]);
      }

      if (currentTime !== undefined) {
        paintCurrentPosition(currentTime,
                             minimumPosition,
                             maximumPosition,
                             canvasCtx,
                             configState);
        for (let i = 0; i < currentRangesScaled.length; i++) {
          const rangeInfo = currentRangesScaled[i];
          const { start, end, representationInfo } = rangeInfo;
          if (currentTime >= start && currentTime < end) {
            currentRangeData.textContent =
              `${start.toFixed(2)} - ${end.toFixed(2)} ` +
              `(${i + 1} / ${currentRangesScaled.length})`;
            if (representationInfo === undefined) {
              currentRangeRepInfoData.textContent = "None";
            } else {
              const { periodId, bitrate, representationId } = representationInfo;
              currentRangeRepInfoData.textContent =
                `Period: "${periodId}" - Representation: "${representationId}" ` +
                `- Bitrate: ${bitrate}`;
            }
            return;
          }
        }
      }
      currentRangeData.textContent = "None";
      currentRangeRepInfoData.textContent = "None";
    }

    function getMousePositionInPercentage(event : MouseEvent) : number | undefined {
      if (canvasElt === null) {
        return;
      }
      const rect = canvasElt.getBoundingClientRect();
      const point0 = rect.left;
      const clickPosPx = Math.max(event.clientX - point0, 0);
      const endPointPx = Math.max(rect.right - point0, 0);
      if (!endPointPx) {
        return 0;
      }
      return clickPosPx / endPointPx;
    }

    function onMouseMove(event : MouseEvent) {
      const mousePercent = getMousePositionInPercentage(event);
      if (mousePercent === undefined) {
        return;
      }
      for (let i = 0; i < currentRangesScaled.length; i++) {
        const rangeScaled = currentRangesScaled[i];
        if (mousePercent >= rangeScaled.scaledStart &&
            mousePercent < rangeScaled.scaledEnd)
        {
          const { start, end, representationInfo } = rangeScaled;

          hoveredRangeData.textContent =
            `${start.toFixed(2)} - ${end.toFixed(2)} ` +
            `(${i + 1} / ${currentRangesScaled.length})`;
          if (representationInfo === undefined) {
            hoveredRangeRepInfoData.textContent = "Hover range to show";
          } else {
            const { periodId, bitrate, representationId } = representationInfo;
            hoveredRangeRepInfoData.textContent =
              `Period: "${periodId}" - Representation: "${representationId}" ` +
              `- Bitrate: ${bitrate}`;
          }
          return ;
        }
      }
      hoveredRangeData.textContent = "Hover range to show";
      hoveredRangeRepInfoData.textContent = "Hover range to show";
    }

    function onMouseOut() {
      hoveredRangeData.textContent = "Hover range to show";
      hoveredRangeRepInfoData.textContent = "Hover range to show";
    }

    /**
     * Paint a given range in the canvas
     * @param {Object} rangeScaled - Buffered segment information with added
     * "scaling" information to know where it fits in the canvas.
     */
    function paintRange(
      rangeScaled : ScaledRangeInfo
    ) : void {
      if (canvasCtx === null) {
        return;
      }
      const startX = rangeScaled.scaledStart * CANVAS_WIDTH;
      const endX = rangeScaled.scaledEnd * CANVAS_WIDTH;

      // TODO dark mode
      // const isDark = configState.getCurrentState(STATE_PROPS.CSS_MODE) === "dark";
      canvasCtx.fillStyle = getColorFromLetter(rangeScaled.letter);
      canvasCtx.fillRect(Math.ceil(startX),
                         0,
                         Math.ceil(endX - startX),
                         CANVAS_HEIGHT);
    }

    function setEmptyState() {
      if (canvasCtx !== null) {
        clearCanvas(canvasCtx);
      }
      currentRangesScaled = [];
      currentRangeData.textContent = "None";
      currentRangeRepInfoData.textContent = "None";
      hoveredRangeData.textContent = "Hover range to show";
      hoveredRangeRepInfoData.textContent = "Hover range to show";
    }
  };
}

/**
 * Represent the current position in the canvas.
 * @param {number|undefined} position - The current position
 * @param {number} minimumPosition - minimum possible position represented in
 * the canvas.
 * @param {number} maximumPosition - maximum possible position represented in
 * the canvas.
 * @param {Object} canvasCtx - The canvas' 2D context
 */
function paintCurrentPosition(
  position : number,
  minimumPosition : number,
  maximumPosition : number,
  canvasCtx : CanvasRenderingContext2D,
  configState : ObservableState<ConfigState>
) {
  if (typeof position === "number" &&
      position >= minimumPosition &&
      position < maximumPosition)
  {
    const lengthCanvas = maximumPosition - minimumPosition;
    const isDark = configState.getCurrentState(STATE_PROPS.CSS_MODE) === "dark";
    canvasCtx.fillStyle = isDark ? "#FFFFFF" : "#FF2323";
    canvasCtx.fillRect(Math.ceil((position - minimumPosition) /
                                    lengthCanvas * CANVAS_WIDTH) - 1,
                       5,
                       50,
                       CANVAS_HEIGHT - 10);
  }
}

interface ScaledRangeInfo {
  scaledStart: number;
  scaledEnd: number;
  start: number;
  end: number;
  letter: string;
  representationInfo: InventoryTimelineRepresentationInfo | undefined;
}

/**
 * Scale given bufferedData in terms of percentage between the minimum and
 * maximum position. Filter out ranges which are not part of it.
 * @param {Array.<Object>} inventoryInfo
 * @param {number} minimumPosition
 * @param {number} maximumPosition
 * @returns {Array.<Object>}
 */
function scaleSegments(
  inventoryInfo : InventoryTimelineInfo,
  minimumPosition : number,
  maximumPosition : number
) : ScaledRangeInfo[] {
  const scaledSegments = [];
  const wholeDuration = maximumPosition - minimumPosition;
  for (let i = 0; i < inventoryInfo.ranges.length; i++) {
    const { start, end, letter } = inventoryInfo.ranges[i];
    const representationInfo = inventoryInfo.representations[letter];
    if (end > minimumPosition && start < maximumPosition) {
      const startPoint = Math.max(start - minimumPosition, 0);
      const endPoint = Math.min(end - minimumPosition, maximumPosition);
      const scaledStart = startPoint / wholeDuration;
      const scaledEnd = endPoint / wholeDuration;
      scaledSegments.push({ scaledStart,
                            scaledEnd,
                            start,
                            end,
                            letter,
                            representationInfo });
    }
  }
  return scaledSegments;
}

/**
 * Clear.
 * @param {Object} canvasContext
 */
function clearCanvas(canvasContext : CanvasRenderingContext2D) : void {
  canvasContext.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function getColorFromLetter(
  letter: string
) : string {
  const charCode = letter.charCodeAt(0);
  return isNaN(charCode) ? COLORS[0] :
                           COLORS[charCode % COLORS.length];
}
