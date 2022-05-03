import { ConfigState, STATE_PROPS } from "../constants";
import { createCompositeElement, createElement } from "../dom-utils";
import ObservableState from "../observable_state";
import { ModuleFunctionArguments } from ".";

const CANVAS_WIDTH = 20000;
const CANVAS_HEIGHT = 100;

/**
 * Clear the whole canvas.
 * @param {Object} canvasContext
 */
function clearCanvas(canvasContext : CanvasRenderingContext2D) : void {
  canvasContext.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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
  scaledStart : number;
  scaledEnd : number;
  bufferedInfos : [number, number];
}

/**
 * Scale given bufferedData in terms of percentage between the minimum and
 * maximum position. Filter out ranges which are not part of it.
 * @param {Array.<Object>} bufferedData
 * @param {number} minimumPosition
 * @param {number} maximumPosition
 * @returns {Array.<Object>}
 */
function scaleSegments(
  bufferedData : Array<[number, number]>,
  minimumPosition : number,
  maximumPosition : number
) : ScaledRangeInfo[] {
  const scaledSegments = [];
  const wholeDuration = maximumPosition - minimumPosition;
  for (let i = 0; i < bufferedData.length; i++) {
    const bufferedInfos = bufferedData[i];
    const [start, end] = bufferedInfos;
    if (end > minimumPosition && start < maximumPosition) {
      const startPoint = Math.max(start - minimumPosition, 0);
      const endPoint = Math.min(end - minimumPosition, maximumPosition);
      const scaledStart = startPoint / wholeDuration;
      const scaledEnd = endPoint / wholeDuration;
      scaledSegments.push({ scaledStart,
                            scaledEnd,
                            bufferedInfos });
    }
  }
  return scaledSegments;
}

/**
 * Display a graph representing what has been buffered according to the data
 * given.
 * Allow to seek on click, display the current time, and display a tooltip
 * describing the buffered data when hovering represented data.
 * @param {Object}
 */
export default function BufferContentModule(
  { state, configState } : ModuleFunctionArguments
) {
  const canvasElt = createElement("canvas", {
    className: "canvas-buffer-size",
  }) as HTMLCanvasElement;
  const canvasCtx = canvasElt.getContext("2d");

  /**
   * Paint a given range in the canvas
   * @param {Object} scaledSegment - Buffered segment information with added
   * "scaling" information to know where it fits in the canvas.
   */
  function paintRange(
    scaledSegment : ScaledRangeInfo
  ) : void {
    if (canvasCtx === null) {
      return;
    }
    const startX = scaledSegment.scaledStart * CANVAS_WIDTH;
    const endX = scaledSegment.scaledEnd * CANVAS_WIDTH;
    const isDark = configState.getCurrentState(STATE_PROPS.CSS_MODE) === "dark";
    canvasCtx.fillStyle = isDark ? "#c864c8" : "#000000";
    canvasCtx.fillRect(Math.ceil(startX),
                       0,
                       Math.ceil(endX - startX),
                       CANVAS_HEIGHT);
  }

  state.subscribe(STATE_PROPS.BUFFERED_RANGES, reRender, true);
  state.subscribe(STATE_PROPS.CONTENT_DURATION, reRender);
  state.subscribe(STATE_PROPS.POSITION, reRender);
  configState.subscribe(STATE_PROPS.CSS_MODE, reRender);

  const canvasParent = createCompositeElement("div", [
    canvasElt,
  ]);
  canvasParent.style.textAlign = "center";
  canvasParent.style.border = "1px solid black";
  canvasParent.style.height = "20px";
  canvasElt.style.height = "20px";

  const bufferChartBodyElt = createElement("div", {
    className: "buffer-chart-body module-body",
  });

  bufferChartBodyElt.appendChild(canvasParent);
  bufferChartBodyElt.style.overflow = "auto";

  return {
    body: bufferChartBodyElt,
    destroy() {
      state.unsubscribe(STATE_PROPS.BUFFERED_RANGES, reRender);
      state.unsubscribe(STATE_PROPS.POSITION, reRender);
      state.unsubscribe(STATE_PROPS.CONTENT_DURATION, reRender);
      configState.unsubscribe(STATE_PROPS.CSS_MODE, reRender);
    },
  };

  function reRender() {
    const buffered = state.getCurrentState(
      STATE_PROPS.BUFFERED_RANGES
    );
    if (canvasCtx === null) {
      return;
    }

    canvasElt.width = CANVAS_WIDTH;
    canvasElt.height = CANVAS_HEIGHT;
    clearCanvas(canvasCtx);
    if (buffered === undefined) {
      return;
    }

    const currentTime = state.getCurrentState(STATE_PROPS.POSITION);
    const duration = state.getCurrentState(STATE_PROPS.CONTENT_DURATION);
    const minimumBuffered = buffered?.[0]?.[0] ?? 0;
    const maximumBuffered = duration ??
                            buffered?.[buffered.length - 1]?.[1] ?? 1000;
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
      return;
    }
    const currentRangeScaled =
      scaleSegments(buffered, minimumPosition, maximumPosition);

    for (let i = 0; i < currentRangeScaled.length; i++) {
      paintRange(currentRangeScaled[i]);
    }
    if (currentTime !== undefined) {
      paintCurrentPosition(currentTime,
                           minimumPosition,
                           maximumPosition,
                           canvasCtx,
                           configState);
    }
  }

  // const getMousePositionInPercentage = (event : MouseEvent) => {
  //   if (canvasElt === null) {
  //     return;
  //   }
  //   const rect = canvasElt.getBoundingClientRect();
  //   const point0 = rect.left;
  //   const clickPosPx = Math.max(event.clientX - point0, 0);
  //   const endPointPx = Math.max(rect.right - point0, 0);
  //   if (!endPointPx) {
  //     return 0;
  //   }
  //   return clickPosPx / endPointPx;
  // };

  // const getMousePosition = (event : MouseEvent) => {
  //   const mousePercent = getMousePositionInPercentage(event);
  //   return mousePercent === undefined ?
  //     undefined :
  //     mousePercent * duration + minimumPosition;
  // };

  // const toolTipOffset = canvasElt !== null ?
  //   canvasElt.getBoundingClientRect().left :
  //   0;

  // const onMouseMove = (event : MouseEvent) => {
  //   const mousePercent = getMousePositionInPercentage(event);
  //   for (let i = 0; i < currentRangeScaled.length; i++) {
  //     const scaledSegment = currentRangeScaled[i];
  //     if (mousePercent >= scaledSegment.scaledStart &&
  //         mousePercent < scaledSegment.scaledEnd)
  //     {
  //       const { start, end } = scaledSegment.bufferedInfos;
  //       const { adaptation,
  //               representation } = scaledSegment.bufferedInfos.infos;
  //       setTipVisible(true);
  //       setTipPosition(event.clientX);

  //       let newTipText = "";
  //       switch (adaptation.type) {
  //         case "video":
  //           newTipText += `width: ${representation.width}` + "\n" +
  //                         `height: ${representation.height}` + "\n" +
  //                         `codec: ${representation.codec}` + "\n" +
  //                         `bitrate: ${representation.bitrate}` + "\n";
  //           break;
  //         case "audio":
  //           newTipText += `language: ${adaptation.language}` + "\n" +
  //                         `audioDescription: ${!!adaptation.isAudioDescription}` + "\n" +
  //                         `codec: ${representation.codec}` + "\n" +
  //                         `bitrate: ${representation.bitrate}` + "\n";
  //           break;
  //         case "text":
  //           newTipText += `language: ${adaptation.language}` + "\n" +
  //                         `closedCaption: ${!!adaptation.isClosedCaption}` + "\n";
  //           break;
  //       }
  //       newTipText += `segment: [${start.toFixed(1)}, ${end.toFixed(1)}]`;
  //       setTipText(newTipText);
  //       return;
  //     }
  //   }
  //   hideTip(); // if none found
  // };

  // const hideTip = () => {
  //   setTipVisible(false);
  //   setTipPosition(0);
  //   setTipText("");
  // };

  // return (
  //   <div className="container-buffer-graph">
  //     <div className="buffer-graph-title">
  //       {`${capitalizeFirstLetter(type)} Buffer`}
  //     </div>
  //     <div
  //       className="canvas-buffer-graph-container"
  //       onMouseLeave={hideTip}
  //       onMouseMove={onMouseMove}
  //     >
  //       { tipVisible ?
  //         <ToolTip
  //           className="buffer-content-tip"
  //           text={tipText}
  //           xPosition={tipPosition}
  //           offset={toolTipOffset}
  //         /> :
  //         null }
  //       <canvas
  //         onClick={(event) => seek(getMousePosition(event))}
  //         height={String(CANVAS_HEIGHT)}
  //         width={String(CANVAS_WIDTH)}
  //         className="canvas-buffer-graph"
  //         ref={canvasEl} />
  //     </div>
  //   </div>
  // );
}
