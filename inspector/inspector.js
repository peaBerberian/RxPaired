(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };

  // src/constants.ts
  var SERVER_URL = "ws://127.0.0.1:22625";
  var CLIENT_SCRIPT_URL = "http://127.0.0.1:8081/client.js";
  var MAX_DISPLAYED_LOG_ELEMENTS = 5e3;
  var MODULE_CONFIG_LS_ITEM = "module-config";

  // src/observable_state.ts
  var ObservableState = class {
    constructor() {
      this._currentState = {};
      this._callbacks = {};
      this._pendingUpdates = {};
    }
    getCurrentState(stateName) {
      if (stateName === void 0) {
        return __spreadValues({}, this._currentState);
      } else {
        return this._currentState[stateName];
      }
    }
    updateState(stateName, updateType, value) {
      const prevUpdate = this._pendingUpdates[stateName];
      if (prevUpdate === void 0) {
        this._pendingUpdates[stateName] = { updateType, value };
      } else if (updateType !== "push" /* PUSH */) {
        this._pendingUpdates[stateName] = { updateType, value };
      } else {
        let allValues;
        if (Array.isArray(prevUpdate.value)) {
          allValues = [...prevUpdate.value, ...value];
        } else {
          console.error("Pushing on a value that wasn't an array before");
          allValues = value;
        }
        this._pendingUpdates[stateName] = {
          updateType: "push" /* PUSH */,
          value: allValues
        };
      }
      if (updateType === "replace" /* REPLACE */) {
        this._currentState[stateName] = value;
      } else if (updateType === "push" /* PUSH */) {
        if (!Array.isArray(value)) {
          console.error("Pushed a new state that wasn't an Array");
          return;
        }
        if (this._currentState[stateName] === void 0) {
          this._currentState[stateName] = value;
        } else if (!Array.isArray(this._currentState[stateName])) {
          console.error("Pushed a new state on a value that wasn't an Array");
          return;
        } else {
          const prevValue = this._currentState[stateName];
          if (!Array.isArray(prevValue)) {
            console.error("Pushing on a value that wasn't an array before");
            this._currentState[stateName] = value;
          } else {
            prevValue.push(...value);
          }
        }
      } else {
        console.error("Unknown state updateType", updateType);
      }
    }
    commitUpdates() {
      const currUpdates = this._pendingUpdates;
      this._pendingUpdates = {};
      const allkeys = Object.keys(currUpdates);
      allkeys.forEach((stateName) => {
        if (this._callbacks[stateName] === void 0) {
          return;
        }
        const { updateType, value } = currUpdates[stateName];
        this._callbacks[stateName].slice().forEach((cb) => {
          if (!this._callbacks[stateName].includes(cb)) {
            return;
          }
          try {
            cb(updateType, value);
          } catch (err) {
            console.warn("Subscription threw an error", err);
          }
        });
      });
    }
    subscribe(stateName, cb, includeCurrent) {
      let currentCbs = this._callbacks[stateName];
      if (currentCbs === void 0) {
        currentCbs = [];
        this._callbacks[stateName] = currentCbs;
      }
      currentCbs.push(cb);
      if (includeCurrent === true) {
        try {
          cb("initial", this._currentState[stateName]);
        } catch (err) {
          console.warn("Subscription threw an error", err);
        }
      }
      return () => {
        this.unsubscribe(stateName, cb);
      };
    }
    unsubscribe(stateName, cb) {
      const cbs = this._callbacks[stateName];
      if (cbs === void 0) {
        console.error("Unsubscribing inexistant subscription.");
        return;
      }
      let initialCheck = true;
      while (true) {
        const indexOf = cbs.indexOf(cb);
        if (indexOf === -1) {
          if (initialCheck) {
            console.error("Unsubscribing inexistant subscription.");
          }
          return;
        }
        cbs.splice(indexOf, 1);
        if (cbs.length === 0) {
          delete this._callbacks[stateName];
          return;
        }
        initialCheck = false;
      }
    }
    dispose() {
      this._currentState = {};
      this._pendingUpdates = {};
      this._callbacks = {};
    }
  };

  // src/dom-utils.ts
  function createElement(elementName, {
    textContent,
    className
  } = {}) {
    const elt = document.createElement(elementName);
    if (className !== void 0) {
      elt.className = className;
    }
    if (textContent !== void 0) {
      elt.textContent = textContent;
    }
    return elt;
  }
  function createCompositeElement(rootElementName, parts, { className } = {}) {
    const elt = document.createElement(rootElementName);
    if (className !== void 0) {
      elt.className = className;
    }
    for (const subElt of parts) {
      if (typeof subElt === "string") {
        elt.appendChild(document.createTextNode(subElt));
      } else {
        elt.appendChild(subElt);
      }
    }
    return elt;
  }
  function createButton({
    className,
    textContent,
    title,
    disabled,
    onClick
  }) {
    const buttonElt = createElement("button", {
      className,
      textContent
    });
    if (title !== void 0) {
      buttonElt.title = title;
    }
    if (onClick !== void 0) {
      buttonElt.onclick = onClick;
    }
    if (disabled !== void 0) {
      buttonElt.disabled = disabled;
    }
    return buttonElt;
  }

  // src/modules/buffer_content_module.ts
  var CANVAS_WIDTH = 2e4;
  var CANVAS_HEIGHT = 100;
  function clearCanvas(canvasContext) {
    canvasContext.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
  function paintCurrentPosition(position, minimumPosition, maximumPosition, canvasCtx, configState2) {
    if (typeof position === "number" && position >= minimumPosition && position < maximumPosition) {
      const lengthCanvas = maximumPosition - minimumPosition;
      const isDark = configState2.getCurrentState("cssMode" /* CSS_MODE */) === "dark";
      canvasCtx.fillStyle = isDark ? "#FFFFFF" : "#FF2323";
      canvasCtx.fillRect(Math.ceil((position - minimumPosition) / lengthCanvas * CANVAS_WIDTH) - 1, 5, 50, CANVAS_HEIGHT - 10);
    }
  }
  function scaleSegments(bufferedData, minimumPosition, maximumPosition) {
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
        scaledSegments.push({
          scaledStart,
          scaledEnd,
          bufferedInfos
        });
      }
    }
    return scaledSegments;
  }
  function BufferContentModule({ state, configState: configState2 }) {
    const canvasElt = createElement("canvas", {
      className: "canvas-buffer-size"
    });
    const canvasCtx = canvasElt.getContext("2d");
    function paintRange(scaledSegment) {
      if (canvasCtx === null) {
        return;
      }
      const startX = scaledSegment.scaledStart * CANVAS_WIDTH;
      const endX = scaledSegment.scaledEnd * CANVAS_WIDTH;
      const isDark = configState2.getCurrentState("cssMode" /* CSS_MODE */) === "dark";
      canvasCtx.fillStyle = isDark ? "#c864c8" : "#000000";
      canvasCtx.fillRect(Math.ceil(startX), 0, Math.ceil(endX - startX), CANVAS_HEIGHT);
    }
    state.subscribe("bufferedRanges" /* BUFFERED_RANGES */, reRender, true);
    state.subscribe("duration" /* CONTENT_DURATION */, reRender);
    state.subscribe("position" /* POSITION */, reRender);
    configState2.subscribe("cssMode" /* CSS_MODE */, reRender);
    const canvasParent = createCompositeElement("div", [
      canvasElt
    ]);
    canvasParent.style.textAlign = "center";
    canvasParent.style.border = "1px solid black";
    canvasParent.style.height = "20px";
    canvasElt.style.height = "20px";
    const bufferChartBodyElt = createElement("div", {
      className: "buffer-chart-body module-body"
    });
    bufferChartBodyElt.appendChild(canvasParent);
    bufferChartBodyElt.style.overflow = "auto";
    return {
      body: bufferChartBodyElt,
      destroy() {
        state.unsubscribe("bufferedRanges" /* BUFFERED_RANGES */, reRender);
        state.unsubscribe("position" /* POSITION */, reRender);
        state.unsubscribe("duration" /* CONTENT_DURATION */, reRender);
        configState2.unsubscribe("cssMode" /* CSS_MODE */, reRender);
      }
    };
    function reRender() {
      var _a, _b, _c, _d;
      const buffered = state.getCurrentState("bufferedRanges" /* BUFFERED_RANGES */);
      if (canvasCtx === null) {
        return;
      }
      canvasElt.width = CANVAS_WIDTH;
      canvasElt.height = CANVAS_HEIGHT;
      clearCanvas(canvasCtx);
      if (buffered === void 0) {
        return;
      }
      const currentTime = state.getCurrentState("position" /* POSITION */);
      const duration = state.getCurrentState("duration" /* CONTENT_DURATION */);
      const minimumBuffered = (_b = (_a = buffered == null ? void 0 : buffered[0]) == null ? void 0 : _a[0]) != null ? _b : 0;
      const maximumBuffered = (_d = duration != null ? duration : (_c = buffered == null ? void 0 : buffered[buffered.length - 1]) == null ? void 0 : _c[1]) != null ? _d : 1e3;
      let minimumPosition;
      let maximumPosition;
      if (maximumBuffered > 2e4 && maximumBuffered - minimumBuffered > 11e3) {
        if (currentTime === void 0) {
          minimumPosition = minimumBuffered;
          maximumPosition = maximumBuffered;
        } else {
          minimumPosition = currentTime - 5500;
          maximumPosition = currentTime + 5500;
        }
      } else if (maximumBuffered < 11e3) {
        minimumPosition = 0;
        maximumPosition = maximumBuffered;
      } else {
        minimumPosition = minimumBuffered;
        maximumPosition = maximumBuffered;
      }
      if (minimumPosition >= maximumPosition) {
        return;
      }
      const currentRangeScaled = scaleSegments(buffered, minimumPosition, maximumPosition);
      for (let i = 0; i < currentRangeScaled.length; i++) {
        paintRange(currentRangeScaled[i]);
      }
      if (currentTime !== void 0) {
        paintCurrentPosition(currentTime, minimumPosition, maximumPosition, canvasCtx, configState2);
      }
    }
  }

  // src/modules/buffer_size_module.ts
  var HEIGHT_MARGIN_BOTTOM = 5;
  var HEIGHT_MARGIN_TOP = 20;
  var DEFAULT_DRAWABLE_HEIGHT = 300;
  var DEFAULT_DRAWABLE_WIDTH = 850;
  var TIME_SAMPLES_MS = 6e4;
  var DEFAULT_CANVAS_WIDTH = DEFAULT_DRAWABLE_WIDTH;
  var DEFAULT_CANVAS_HEIGHT = DEFAULT_DRAWABLE_HEIGHT + HEIGHT_MARGIN_TOP + HEIGHT_MARGIN_BOTTOM;
  var CANVAS_ASPECT_RATIO = DEFAULT_CANVAS_WIDTH / DEFAULT_CANVAS_HEIGHT;
  var MINIMUM_MAX_BUFFER_SIZE = 20;
  function BufferSizeModule({ state, configState: configState2 }) {
    const bufferSizeBodyElt = createElement("div", {
      className: "buffer-size-body module-body"
    });
    const [
      bufferSizeElt,
      disposeBufferSizeChart
    ] = createBufferSizeChart(bufferSizeBodyElt, state, configState2);
    bufferSizeBodyElt.appendChild(bufferSizeElt);
    bufferSizeBodyElt.style.resize = "vertical";
    bufferSizeBodyElt.style.overflow = "auto";
    return {
      body: bufferSizeBodyElt,
      destroy() {
        disposeBufferSizeChart();
      }
    };
  }
  function createBufferSizeChart(parentResizableElement, state, configState2) {
    let currentMaxSize = MINIMUM_MAX_BUFFER_SIZE;
    const canvasElt = createElement("canvas", {
      className: "canvas-buffer-size"
    });
    canvasElt.width = DEFAULT_CANVAS_WIDTH;
    canvasElt.height = DEFAULT_CANVAS_HEIGHT;
    const canvasCtx = canvasElt.getContext("2d");
    reRender();
    state.subscribe("bufferGaps" /* BUFFER_GAPS */, reRender);
    configState2.subscribe("cssMode" /* CSS_MODE */, reRender);
    const resizeObserver = new ResizeObserver(onBodyResize);
    resizeObserver.observe(parentResizableElement);
    let lastClientHeight;
    const canvasParent = createCompositeElement("div", [
      canvasElt
    ]);
    canvasParent.style.textAlign = "center";
    return [
      canvasParent,
      () => {
        state.unsubscribe("bufferGaps" /* BUFFER_GAPS */, reRender);
        configState2.unsubscribe("cssMode" /* CSS_MODE */, reRender);
        resizeObserver.unobserve(parentResizableElement);
      }
    ];
    function reRender() {
      const bufferGaps = state.getCurrentState("bufferGaps" /* BUFFER_GAPS */);
      if (bufferGaps !== void 0 && bufferGaps.length > 0) {
        const lastDate = bufferGaps.length === 0 ? null : bufferGaps[bufferGaps.length - 1].timestamp;
        const minimumTime = Math.max(0, (lastDate != null ? lastDate : 0) - TIME_SAMPLES_MS);
        let i;
        for (i = bufferGaps.length - 1; i >= 1; i--) {
          if (bufferGaps[i].timestamp <= minimumTime) {
            break;
          }
        }
        const consideredData = bufferGaps.slice(i);
        onNewData(consideredData);
      } else {
        onNewData([]);
      }
    }
    function onBodyResize() {
      const clientHeight = parentResizableElement.clientHeight;
      const wantedHeight = clientHeight - 20;
      if (lastClientHeight === clientHeight) {
        return;
      }
      canvasElt.height = wantedHeight;
      canvasElt.width = CANVAS_ASPECT_RATIO * wantedHeight;
      reRender();
      lastClientHeight = parentResizableElement.clientHeight;
    }
    function onNewData(data) {
      if (canvasCtx === null) {
        return;
      }
      clearAndResizeCanvas(canvasCtx);
      if (data.length === 0) {
        canvasCtx.font = "14px Arial";
        const posX = canvasElt.width / 2 - 40;
        const isDark = configState2.getCurrentState("cssMode" /* CSS_MODE */) === "dark";
        if (isDark) {
          canvasCtx.fillStyle = "#ffffff";
        } else {
          canvasCtx.fillStyle = "#000000";
        }
        canvasCtx.fillText("No data yet", posX, 14 + 5);
        return;
      }
      currentMaxSize = getNewMaxBufferSize();
      const minDate = data[0].timestamp;
      let height = canvasElt.height - HEIGHT_MARGIN_TOP - HEIGHT_MARGIN_BOTTOM;
      const gridHeight = height / currentMaxSize;
      const gridWidth = canvasElt.width / TIME_SAMPLES_MS;
      drawData();
      drawGrid();
      function getNewMaxBufferSize() {
        const maxPoint = Math.max(...data.map((d) => {
          var _a;
          return (_a = d.bufferGap) != null ? _a : 0;
        }));
        if (maxPoint >= currentMaxSize) {
          return maxPoint + 5;
        } else if (maxPoint < currentMaxSize - 5) {
          return Math.max(maxPoint + 5, MINIMUM_MAX_BUFFER_SIZE);
        }
        return currentMaxSize;
      }
      function drawGrid() {
        if (canvasCtx === null) {
          return;
        }
        canvasCtx.beginPath();
        canvasCtx.strokeStyle = "lightgrey";
        canvasCtx.lineWidth = 1;
        height = canvasElt.height - HEIGHT_MARGIN_TOP - HEIGHT_MARGIN_BOTTOM;
        let nbGridLines;
        if (height > 300) {
          nbGridLines = 10;
        } else if (height > 200) {
          nbGridLines = 7;
        } else if (height > 100) {
          nbGridLines = 5;
        } else if (height > 50) {
          nbGridLines = 3;
        } else {
          nbGridLines = 2;
        }
        const stepHeight = height / nbGridLines;
        const stepVal = currentMaxSize / nbGridLines;
        for (let i = 0; i <= nbGridLines; i++) {
          const nHeight = stepHeight * i + HEIGHT_MARGIN_TOP;
          canvasCtx.moveTo(0, nHeight);
          canvasCtx.font = "14px Arial";
          const currStepVal = (stepVal * (nbGridLines - i)).toFixed(1);
          const isDark = configState2.getCurrentState("cssMode" /* CSS_MODE */) === "dark";
          if (isDark) {
            canvasCtx.fillStyle = "#ffffff";
          } else {
            canvasCtx.fillStyle = "#000000";
          }
          canvasCtx.fillText(`${currStepVal} s`, 0, nHeight);
          canvasCtx.lineTo(canvasElt.width, nHeight);
        }
        canvasCtx.stroke();
      }
      function drawData() {
        var _a, _b;
        if (canvasCtx === null) {
          return;
        }
        canvasCtx.beginPath();
        canvasCtx.strokeStyle = "rgb(200, 100, 200)";
        canvasCtx.lineWidth = 2;
        canvasCtx.moveTo(0, bufferValueToY((_a = data[0].bufferGap) != null ? _a : 0));
        for (let i = 1; i < data.length; i++) {
          canvasCtx.lineTo(dateToX(data[i].timestamp), bufferValueToY((_b = data[i].bufferGap) != null ? _b : 0));
        }
        canvasCtx.stroke();
      }
      function bufferValueToY(bufferVal) {
        return HEIGHT_MARGIN_TOP + (currentMaxSize - bufferVal) * gridHeight;
      }
      function dateToX(date) {
        return (date - minDate) * gridWidth;
      }
    }
  }
  function clearAndResizeCanvas(canvasContext) {
    const canvasElt = canvasContext.canvas;
    canvasContext.clearRect(0, 0, canvasElt.width, canvasElt.height);
  }

  // src/modules/how_to_use_module.ts
  function HowToUseModule({ tokenId }) {
    const liElt1 = createCompositeElement("li", [
      'Load in your HTML page the following script before all other running scripts: "',
      createElement("span", {
        textContent: `${CLIENT_SCRIPT_URL}#${tokenId}`,
        className: "emphasized"
      }),
      '"',
      createElement("br"),
      "For example, you can just add before the first script tag: ",
      createElement("span", {
        textContent: `<script src="${CLIENT_SCRIPT_URL.replace(/"/g, '\\"')}#${tokenId}"><\/script>`,
        className: "emphasized"
      })
    ]);
    const link = createElement("a", { textContent: CLIENT_SCRIPT_URL });
    link.href = CLIENT_SCRIPT_URL;
    const liElt2 = createCompositeElement("li", [
      "Add manually the content of this script to the beginning of the first script tag of your page: ",
      link,
      " and manually set the `",
      createElement("span", { className: "emphasized", textContent: "__TOKEN__" }),
      "` constant on top of that script to ",
      createElement("span", { className: "emphasized", textContent: `"${tokenId}"` }),
      "."
    ]);
    const howToBodyElt = createCompositeElement("div", [
      "To start debugging you can either:",
      createElement("br"),
      createCompositeElement("ul", [
        createElement("br"),
        liElt1,
        createElement("br"),
        liElt2
      ])
    ]);
    return {
      body: howToBodyElt
    };
  }

  // src/modules/log_module.ts
  function LogModule({ state }) {
    const logContainerElt = createElement("div", {
      className: "log-body module-body"
    });
    const unsubscribe = state.subscribe("logsHistory" /* LOGS_HISTORY */, (updateType, values) => {
      if (values === void 0) {
        logContainerElt.innerHTML = "";
        return;
      }
      if (updateType === "replace" /* REPLACE */) {
        logContainerElt.innerHTML = "";
        values.forEach((val) => onNewLog(val, logContainerElt));
      } else {
        values.forEach((val) => onNewLog(val, logContainerElt));
      }
    });
    return {
      body: logContainerElt,
      clear() {
        if (logContainerElt !== void 0) {
          logContainerElt.innerHTML = "";
        }
      },
      destroy() {
        unsubscribe();
      }
    };
  }
  function onNewLog(logTxt, logContainerElt) {
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
    while (logContainerElt.children.length > MAX_DISPLAYED_LOG_ELEMENTS - 1) {
      logContainerElt.removeChild(logContainerElt.children[0]);
    }
    const hasVerticalScrollbar = logContainerElt.scrollHeight > logContainerElt.clientHeight;
    const wasScrolledToBottom = !hasVerticalScrollbar || logContainerElt.scrollHeight - logContainerElt.clientHeight <= logContainerElt.scrollTop + 5;
    const preElt = document.createElement("pre");
    preElt.textContent = formattedMsg;
    if (namespace !== void 0) {
      preElt.className = "log-line log-" + namespace.toLowerCase();
    } else {
      preElt.className = "log-line log-unknown";
    }
    logContainerElt.appendChild(preElt);
    if (wasScrolledToBottom) {
      logContainerElt.scrollTop = logContainerElt.scrollHeight;
    }
  }

  // src/modules/player_general_info_module.ts
  function PlayerGeneralInfoModule({ state }) {
    var _a;
    const stateData = createElement("span", {
      textContent: (_a = state.getCurrentState("state" /* PLAYER_STATE */)) != null ? _a : "Unknown",
      className: "emphasized"
    });
    const positionData = createElement("span", {
      textContent: getCurrentPositionTextContent(state),
      className: "emphasized"
    });
    const bufferGapData = createElement("span", {
      textContent: getCurrentBufferGapTextContent(state),
      className: "emphasized"
    });
    const durationData = createElement("span", {
      textContent: getCurrentDurationTextContent(state),
      className: "emphasized"
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
      durationData
    ], { className: "gen-info-body module-body" });
    const unsubscribeState = state.subscribe("state" /* PLAYER_STATE */, () => {
      const newState = state.getCurrentState("state" /* PLAYER_STATE */);
      stateData.textContent = newState != null ? newState : "Unknown";
    });
    const unsubscribePosition = state.subscribe("position" /* POSITION */, () => {
      positionData.textContent = getCurrentPositionTextContent(state);
    });
    const unsubscribeBufferGaps = state.subscribe("bufferGaps" /* BUFFER_GAPS */, () => {
      bufferGapData.textContent = getCurrentBufferGapTextContent(state);
    });
    const unsubscribeDuration = state.subscribe("duration" /* CONTENT_DURATION */, () => {
      durationData.textContent = getCurrentDurationTextContent(state);
    });
    return {
      body: generalInfoBodyElt,
      destroy() {
        unsubscribeState();
        unsubscribePosition();
        unsubscribeBufferGaps();
        unsubscribeDuration();
      }
    };
  }
  function getCurrentPositionTextContent(state) {
    const newPos = state.getCurrentState("position" /* POSITION */);
    if (newPos === void 0) {
      return "undefined";
    } else {
      return (+newPos).toFixed(2);
    }
  }
  function getCurrentBufferGapTextContent(state) {
    const buffGaps = state.getCurrentState("bufferGaps" /* BUFFER_GAPS */);
    if (buffGaps === void 0) {
      return "undefined";
    } else {
      const lastBuffGap = buffGaps[buffGaps.length - 1];
      if (lastBuffGap !== void 0 && lastBuffGap.bufferGap !== void 0) {
        return lastBuffGap.bufferGap.toFixed(2);
      }
      return "undefined";
    }
  }
  function getCurrentDurationTextContent(state) {
    const duration = state.getCurrentState("duration" /* CONTENT_DURATION */);
    if (duration === void 0) {
      return "Unknown";
    } else {
      return (+duration).toFixed(2);
    }
  }

  // src/modules/index.ts
  var ALL_MODULES = [
    {
      moduleTitle: "How to use this tool",
      moduleId: "howto",
      moduleFn: HowToUseModule,
      isClosable: true
    },
    {
      moduleTitle: "Player general information",
      moduleId: "gen-infos",
      moduleFn: PlayerGeneralInfoModule,
      isClosable: true
    },
    {
      moduleTitle: "Buffer gap evolution chart",
      moduleId: "buffer-size",
      moduleFn: BufferSizeModule,
      isClosable: true
    },
    {
      moduleTitle: "Buffer content chart",
      moduleId: "buffer-content",
      moduleFn: BufferContentModule,
      isClosable: true
    },
    {
      moduleTitle: "Logs",
      moduleId: "log",
      moduleFn: LogModule,
      isClosable: false
    }
  ];
  var modules_default = ALL_MODULES;

  // src/utils.ts
  function checkTokenValidity(tokenId) {
    if (!/^[A-Za-z0-9]+$/.test(tokenId)) {
      const error = new Error("Error: Your token must only contain alphanumeric characters");
      displayError(error);
      throw error;
    }
  }
  function displayError(err) {
    let message;
    if (err != null) {
      if (typeof err === "string") {
        message = err;
      } else if (typeof err.message === "string") {
        message = err.message;
      }
    }
    if (message === void 0) {
      message = "Encountered unknown Error";
    }
    const errorDiv = createElement("div", {
      className: "error-msg",
      textContent: `${new Date().toISOString()}: Error: ${message}`
    });
    const bodyElements = document.body.children;
    if (bodyElements.length > 0) {
      document.body.insertBefore(errorDiv, bodyElements[0]);
    } else {
      document.body.appendChild(errorDiv);
    }
  }
  function getDefaultModuleOrder() {
    return modules_default.map(({ moduleId }) => moduleId);
  }

  // src/create_modules.ts
  function createModules(containerElt, tokenId, configState2, inspectorState) {
    var _a;
    let storedModulesOrder = (_a = configState2.getCurrentState("modulesOrder" /* MODULES_ORDER */)) != null ? _a : [];
    if (storedModulesOrder.length === 0) {
      storedModulesOrder = getDefaultModuleOrder();
      configState2.updateState("modulesOrder" /* MODULES_ORDER */, "replace" /* REPLACE */, storedModulesOrder);
      configState2.commitUpdates();
    }
    let someModuleWasMissing = false;
    const modulesInOrder = [];
    const leftModulesToIterateOn = modules_default.slice();
    for (const storedModuleId of storedModulesOrder) {
      const index = leftModulesToIterateOn.findIndex(({ moduleId }) => moduleId === storedModuleId);
      if (index !== -1) {
        modulesInOrder.push(leftModulesToIterateOn[index]);
        leftModulesToIterateOn.splice(index, 1);
      } else {
        console.warn(`Stored module id ${storedModuleId} does not exist anymore`);
        someModuleWasMissing = true;
      }
    }
    modulesInOrder.push(...leftModulesToIterateOn);
    if (someModuleWasMissing || leftModulesToIterateOn.length > 0) {
      const newOrder = modulesInOrder.map(({ moduleId }) => moduleId);
      configState2.updateState("modulesOrder" /* MODULES_ORDER */, "replace" /* REPLACE */, newOrder);
      configState2.commitUpdates();
    }
    for (const moduleInfo of modulesInOrder) {
      const moduleWrapperElt = createModule(moduleInfo);
      if (moduleWrapperElt !== null) {
        moduleWrapperElt.dataset.moduleId = moduleInfo.moduleId;
        containerElt.appendChild(moduleWrapperElt);
      }
    }
    configState2.subscribe("modulesOrder" /* MODULES_ORDER */, () => {
      var _a2;
      let moduleWrapperElts = containerElt.getElementsByClassName("module-wrapper");
      const newModuleIdOrder = (_a2 = configState2.getCurrentState("modulesOrder" /* MODULES_ORDER */)) != null ? _a2 : [];
      let modWrapIdx;
      for (modWrapIdx = 0; modWrapIdx < moduleWrapperElts.length; modWrapIdx++) {
        const moduleWrapperElt = moduleWrapperElts[modWrapIdx];
        const moduleId = moduleWrapperElt.dataset.moduleId;
        if (moduleId === void 0) {
          console.error("An element has an unknown module id");
          return;
        } else if (!newModuleIdOrder.includes(moduleId)) {
          containerElt.removeChild(moduleWrapperElt);
          moduleWrapperElts = containerElt.getElementsByClassName("module-wrapper");
          modWrapIdx--;
        } else if (modWrapIdx >= newModuleIdOrder.length) {
          console.error("There should not be more modules than the wanted ones");
          return;
        } else {
          const expectedModuleId = newModuleIdOrder[modWrapIdx];
          if (expectedModuleId !== moduleId) {
            let expectedElement;
            for (let innerIdx = 0; innerIdx < moduleWrapperElts.length; innerIdx++) {
              const elt = moduleWrapperElts[innerIdx];
              if (elt.dataset.moduleId === expectedModuleId) {
                expectedElement = elt;
              }
            }
            if (expectedElement === void 0) {
              const moduleInfo = modules_default.find(({ moduleId: modId }) => modId === expectedModuleId);
              if (moduleInfo === void 0) {
                console.error(`Module "${expectedModuleId}" unfound`);
                return;
              } else {
                const newWrapperElt = createModule(moduleInfo);
                if (newWrapperElt !== null) {
                  newWrapperElt.dataset.moduleId = moduleInfo.moduleId;
                  containerElt.insertBefore(newWrapperElt, moduleWrapperElts[modWrapIdx]);
                  moduleWrapperElts = containerElt.getElementsByClassName("module-wrapper");
                }
              }
            } else {
              containerElt.insertBefore(expectedElement, moduleWrapperElts[modWrapIdx]);
              moduleWrapperElts = containerElt.getElementsByClassName("module-wrapper");
            }
          }
        }
      }
      for (let newModIdx = modWrapIdx; newModIdx < newModuleIdOrder.length; newModIdx++) {
        const moduleId = newModuleIdOrder[newModIdx];
        const moduleInfo = modules_default.find(({ moduleId: modId }) => modId === moduleId);
        if (moduleInfo === void 0) {
          console.error(`Module "${moduleId}" unfound`);
          return;
        } else {
          const newWrapperElt = createModule(moduleInfo);
          if (newWrapperElt !== null) {
            newWrapperElt.dataset.moduleId = moduleInfo.moduleId;
            containerElt.appendChild(newWrapperElt);
            moduleWrapperElts = containerElt.getElementsByClassName("module-wrapper");
          }
        }
      }
    });
    function createModule(moduleInfo) {
      var _a2, _b;
      const moduleContext = { tokenId, state: inspectorState, configState: configState2 };
      const { moduleFn, moduleTitle, moduleId, isClosable } = moduleInfo;
      const isClosed = ((_a2 = configState2.getCurrentState("closedModules" /* CLOSED_MODULES */)) != null ? _a2 : []).includes(moduleId);
      if (isClosed) {
        putModuleInClosedElements();
        return null;
      }
      const moduleRes = (_b = moduleFn(moduleContext)) != null ? _b : {};
      const {
        body,
        clear,
        destroy
      } = moduleRes;
      if (!(body instanceof HTMLElement)) {
        throw new Error("A module's body should be an HTMLElement");
      }
      const moduleWrapperElt = createElement("div", { className: "module-wrapper" });
      body.classList.add("module-body");
      const buttons = [];
      const resizeWidthButtonElt = createButton({ className: "btn-width-resize" });
      buttons.push(resizeWidthButtonElt);
      const moveDownButton = createButton({
        className: "btn-move-down-module",
        title: "Move the module one level down",
        onClick: moveModuleDown
      });
      moveDownButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M413.1 222.5l22.2 22.2c9.4 9.4 9.4 24.6 0 33.9L241 473c-9.4 9.4-24.6 9.4-33.9 0L12.7 278.6c-9.4-9.4-9.4-24.6 0-33.9l22.2-22.2c9.5-9.5 25-9.3 34.3.4L184 343.4V56c0-13.3 10.7-24 24-24h32c13.3 0 24 10.7 24 24v287.4l114.8-120.5c9.3-9.8 24.8-10 34.3-.4z"/></svg>';
      buttons.push(moveDownButton);
      const moveUpButton = createButton({
        className: "btn-move-up-module",
        title: "Move the module one level up",
        onClick: moveModuleUp
      });
      moveUpButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M34.9 289.5l-22.2-22.2c-9.4-9.4-9.4-24.6 0-33.9L207 39c9.4-9.4 24.6-9.4 33.9 0l194.3 194.3c9.4 9.4 9.4 24.6 0 33.9L413 289.4c-9.5 9.5-25 9.3-34.3-.4L264 168.6V456c0 13.3-10.7 24-24 24h-32c-13.3 0-24-10.7-24-24V168.6L69.2 289.1c-9.3 9.8-24.8 10-34.3.4z"/></svg>';
      buttons.push(moveUpButton);
      if (typeof clear === "function") {
        const clearButton = createButton({
          className: "btn-clear-module",
          textContent: "\u{1F6AB}",
          title: "Clear content of this module",
          onClick: clear
        });
        buttons.push(clearButton);
      }
      const minimizedButtonElt = createButton({ className: "btn-min-max-module" });
      buttons.push(minimizedButtonElt);
      if (isClosable) {
        buttons.push(createClosingButton());
      }
      const moduleTitleElt = createCompositeElement("div", [
        createElement("span", {
          textContent: moduleTitle != null ? moduleTitle : "Unnamed module",
          className: "module-title-text"
        }),
        createCompositeElement("span", buttons, { className: "module-title-buttons" })
      ], { className: "module-title" });
      moduleWrapperElt.appendChild(moduleTitleElt);
      moduleWrapperElt.appendChild(body);
      let currentDisplayedWidthRatio;
      let isModuleCurrentlyMinimized;
      configState2.subscribe("closedModules" /* CLOSED_MODULES */, onModuleClosing);
      configState2.subscribe("minimizedModules" /* MINIMIZED_MODULES */, onMinimizedModule, true);
      configState2.subscribe("widthRatios" /* WIDTH_RATIOS */, onWidthRatioChange, true);
      configState2.subscribe("modulesOrder" /* MODULES_ORDER */, onModuleOrderChange, true);
      return moduleWrapperElt;
      function onModuleOrderChange() {
        const moduleIdOrder = configState2.getCurrentState("modulesOrder" /* MODULES_ORDER */);
        moveUpButton.disabled = moduleId === (moduleIdOrder == null ? void 0 : moduleIdOrder[0]);
        moveDownButton.disabled = moduleId === (moduleIdOrder == null ? void 0 : moduleIdOrder[moduleIdOrder.length - 1]);
      }
      function onWidthRatioChange() {
        var _a3, _b2;
        const widthRatios = configState2.getCurrentState("widthRatios" /* WIDTH_RATIOS */);
        if (((_a3 = widthRatios == null ? void 0 : widthRatios[moduleId]) != null ? _a3 : 1) === currentDisplayedWidthRatio) {
          return;
        }
        currentDisplayedWidthRatio = (_b2 = widthRatios == null ? void 0 : widthRatios[moduleId]) != null ? _b2 : 1;
        if (currentDisplayedWidthRatio === 2) {
          moduleWrapperElt.style.width = "calc(50% - 12px)";
          resizeWidthButtonElt.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 349.454 349.454"><path d="M347.258,169.425l-82.373-82.375c-2.929-2.929-7.678-2.929-10.606-0.001l-14.143,14.142 c-1.407,1.407-2.197,3.314-2.197,5.304c0,1.989,0.79,3.896,2.196,5.303l45.429,45.43H63.892l45.429-45.428 c1.406-1.406,2.196-3.314,2.196-5.303c0-1.989-0.79-3.897-2.196-5.303L95.178,87.05c-2.929-2.928-7.677-2.93-10.607,0L2.196,169.424  C0.79,170.83,0,172.738,0,174.727s0.79,3.897,2.196,5.303l82.376,82.375c1.465,1.464,3.385,2.197,5.304,2.197  c1.919,0,3.839-0.732,5.304-2.197l14.143-14.143c1.406-1.406,2.196-3.314,2.196-5.303c0-1.989-0.79-3.897-2.196-5.303l-45.43-45.429  h221.672l-45.43,45.429c-1.406,1.406-2.196,3.314-2.196,5.303c0,1.989,0.79,3.897,2.196,5.303l14.143,14.143  c1.407,1.407,3.314,2.197,5.304,2.197c1.989,0,3.897-0.79,5.304-2.197l82.373-82.374  C350.186,177.102,350.186,172.353,347.258,169.425z"/></svg>';
          resizeWidthButtonElt.title = "Take full width";
          resizeWidthButtonElt.onclick = () => {
            const lastWidthRatios = configState2.getCurrentState("widthRatios" /* WIDTH_RATIOS */);
            if (lastWidthRatios !== void 0) {
              lastWidthRatios[moduleId] = 1;
            }
            configState2.updateState("widthRatios" /* WIDTH_RATIOS */, "replace" /* REPLACE */, lastWidthRatios);
            configState2.commitUpdates();
          };
        } else {
          moduleWrapperElt.style.width = "100%";
          resizeWidthButtonElt.innerHTML = '<svg width="15px" height="15px" viewBox="5 5 5 5" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 4.5L5.5 7.5L8.5 10.5"></path></svg>';
          resizeWidthButtonElt.title = "Take half width";
          resizeWidthButtonElt.onclick = () => {
            const lastWidthRatios = configState2.getCurrentState("widthRatios" /* WIDTH_RATIOS */);
            if (lastWidthRatios !== void 0) {
              lastWidthRatios[moduleId] = 2;
            }
            configState2.updateState("widthRatios" /* WIDTH_RATIOS */, "replace" /* REPLACE */, lastWidthRatios);
            configState2.commitUpdates();
          };
        }
      }
      function onMinimizedModule() {
        var _a3;
        const isMinimized = ((_a3 = configState2.getCurrentState("minimizedModules" /* MINIMIZED_MODULES */)) != null ? _a3 : []).includes(moduleId);
        if (isModuleCurrentlyMinimized === isMinimized) {
          return;
        }
        isModuleCurrentlyMinimized = isMinimized;
        if (isModuleCurrentlyMinimized) {
          body.style.display = "none";
          minimizedButtonElt.title = "Maximize this module";
          minimizedButtonElt.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 50 512 400"><path d="M472,48H40.335a72.027,72.027,0,0,0-72,72V456a72.027,72.027,0,0,0,72,72H472a72.027,72.027,0,0,0,72-72V72A72.027,72.027,0,0,0,472,48Zm-8,32v71.981L48.335,151.49V80ZM48.335,448V183.49L464,183.981V448Z"/></svg>';
          minimizedButtonElt.onclick = () => {
            removeModuleIdFromState(configState2, moduleId, "minimizedModules" /* MINIMIZED_MODULES */);
            configState2.commitUpdates();
          };
        } else {
          body.style.display = "block";
          minimizedButtonElt.title = "Minimize this module";
          minimizedButtonElt.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M464 352H48c-26.5 0-48 21.5-48 48v32c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48v-32c0-26.5-21.5-48-48-48z"/></svg>';
          minimizedButtonElt.onclick = () => {
            addModuleIdToState(configState2, moduleId, "minimizedModules" /* MINIMIZED_MODULES */);
            configState2.commitUpdates();
          };
        }
      }
      function onModuleClosing(_updateType, value) {
        if (value === void 0 || !value.includes(moduleId)) {
          return;
        }
        configState2.unsubscribe("closedModules" /* CLOSED_MODULES */, onModuleClosing);
        configState2.unsubscribe("minimizedModules" /* MINIMIZED_MODULES */, onMinimizedModule);
        configState2.unsubscribe("widthRatios" /* WIDTH_RATIOS */, onWidthRatioChange);
        configState2.unsubscribe("modulesOrder" /* MODULES_ORDER */, onModuleOrderChange);
        if (typeof destroy === "function") {
          destroy();
        } else if (destroy !== void 0) {
          console.error("Module: `destroy` should either be a function or undefined");
        }
        const parent = moduleWrapperElt.parentElement;
        if (parent !== null) {
          parent.removeChild(moduleWrapperElt);
        }
        putModuleInClosedElements();
        configState2.commitUpdates();
      }
      function moveModuleUp() {
        var _a3;
        const modulesOrder = (_a3 = configState2.getCurrentState("modulesOrder" /* MODULES_ORDER */)) != null ? _a3 : [];
        const indexOfModuleId = modulesOrder.indexOf(moduleId);
        if (indexOfModuleId === 0) {
          return;
        }
        if (indexOfModuleId === -1) {
          modulesOrder.push(moduleId);
        } else {
          modulesOrder[indexOfModuleId] = modulesOrder[indexOfModuleId - 1];
          modulesOrder[indexOfModuleId - 1] = moduleId;
        }
        configState2.updateState("modulesOrder" /* MODULES_ORDER */, "replace" /* REPLACE */, modulesOrder);
        configState2.commitUpdates();
      }
      function moveModuleDown() {
        var _a3;
        const modulesOrder = (_a3 = configState2.getCurrentState("modulesOrder" /* MODULES_ORDER */)) != null ? _a3 : [];
        const indexOfModuleId = modulesOrder.indexOf(moduleId);
        if (indexOfModuleId === modulesOrder.length - 1) {
          return;
        }
        if (indexOfModuleId === -1) {
          modulesOrder.push(moduleId);
        } else {
          modulesOrder[indexOfModuleId] = modulesOrder[indexOfModuleId + 1];
          modulesOrder[indexOfModuleId + 1] = moduleId;
        }
        configState2.updateState("modulesOrder" /* MODULES_ORDER */, "replace" /* REPLACE */, modulesOrder);
        configState2.commitUpdates();
      }
      function createClosingButton() {
        const button = createButton({
          className: "btn-close-module",
          title: "Close this module",
          onClick() {
            addModuleIdToState(configState2, moduleId, "closedModules" /* CLOSED_MODULES */);
            removeModuleIdFromState(configState2, moduleId, "modulesOrder" /* MODULES_ORDER */);
            configState2.commitUpdates();
          }
        });
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="5.28 5.28 13.43 13.43"><path id="x" d="M18.717 6.697l-1.414-1.414-5.303 5.303-5.303-5.303-1.414 1.414 5.303 5.303-5.303 5.303 1.414 1.414 5.303-5.303 5.303 5.303 1.414-1.414-5.303-5.303z"/></svg>';
        return button;
      }
      function putModuleInClosedElements() {
        let closedElements = document.getElementsByClassName("closed-modules")[0];
        if (closedElements === void 0) {
          closedElements = createCompositeElement("div", [
            createElement("span", {
              textContent: "Closed modules (click to re-open)",
              className: "closed-modules-title"
            })
          ], { className: "closed-modules" });
          document.body.appendChild(closedElements);
        }
        const closedModuleNameElt = createElement("span", {
          className: "closed-module-elt",
          textContent: moduleTitle
        });
        const unsub = configState2.subscribe("closedModules" /* CLOSED_MODULES */, (updateType) => {
          var _a3;
          if (updateType === "push" /* PUSH */) {
            return;
          }
          const closedModules = (_a3 = configState2.getCurrentState("closedModules" /* CLOSED_MODULES */)) != null ? _a3 : [];
          if (closedModules.includes(moduleId)) {
            return;
          }
          reOpenClosedModule();
        });
        closedModuleNameElt.onclick = () => {
          removeModuleIdFromState(configState2, moduleId, "closedModules" /* CLOSED_MODULES */);
          reOpenClosedModule();
        };
        closedElements.appendChild(closedModuleNameElt);
        removeModuleIdFromState(configState2, moduleId, "minimizedModules" /* MINIMIZED_MODULES */);
        removeModuleIdFromState(configState2, moduleId, "modulesOrder" /* MODULES_ORDER */);
        configState2.commitUpdates();
        function reOpenClosedModule() {
          unsub();
          if (closedModuleNameElt.parentElement !== null) {
            closedModuleNameElt.parentElement.removeChild(closedModuleNameElt);
          }
          const remainingClosedModules = document.body.getElementsByClassName("closed-module-elt");
          if (remainingClosedModules.length === 0 && closedElements.parentElement !== null) {
            closedElements.parentElement.removeChild(closedElements);
          }
          addModuleIdToState(configState2, moduleId, "modulesOrder" /* MODULES_ORDER */);
          configState2.commitUpdates();
        }
      }
    }
  }
  function removeModuleIdFromState(configState2, moduleId, stateName) {
    const arr = configState2.getCurrentState(stateName);
    if (arr === void 0) {
      return;
    }
    const indexOfModuleId = arr.indexOf(moduleId);
    if (indexOfModuleId !== -1) {
      arr.splice(indexOfModuleId, 1);
      configState2.updateState(stateName, "replace" /* REPLACE */, arr);
    }
  }
  function addModuleIdToState(configState2, moduleId, stateName) {
    var _a;
    const arr = (_a = configState2.getCurrentState(stateName)) != null ? _a : [];
    if (!arr.includes(moduleId)) {
      arr.push(moduleId);
      configState2.updateState(stateName, "replace" /* REPLACE */, arr);
    }
  }

  // src/update_state_from_log.ts
  function updateStateFromLog(state, newLog) {
    state.updateState("logsHistory" /* LOGS_HISTORY */, "push" /* PUSH */, [newLog]);
    if (newLog.indexOf("current playback timeline") > -1) {
      processPlaybackTimelineLog(state, newLog);
    } else if (newLog.indexOf("playerStateChange event") > -1) {
      processPlayerStateChangeLog(state, newLog);
    } else if (newLog.indexOf("Updating duration ") > -1) {
      const regexDur = /Updating duration ([0-9]+(?:\.[0-9]+)?)/;
      const match = newLog.match(regexDur);
      let duration;
      if (match !== null) {
        duration = +match[1];
        state.updateState("duration" /* CONTENT_DURATION */, "replace" /* REPLACE */, duration);
      } else {
        console.error("Has duration log format changed");
      }
    }
  }
  function processPlaybackTimelineLog(state, logTxt) {
    const splitted = logTxt.split("\n");
    const lastIdx = splitted.length - 1;
    const positionPart = splitted[lastIdx - 1];
    const regexPos = /\^([0-9]+(?:\.[0-9]+)?)/;
    const match = positionPart.match(regexPos);
    let position;
    if (match !== null) {
      position = +match[1];
      state.updateState("position" /* POSITION */, "replace" /* REPLACE */, position);
      let bufferLine = splitted[lastIdx - 2];
      if (bufferLine === void 0) {
        console.error("Has buffer log format changed?");
      } else {
        bufferLine = bufferLine.trim();
        let bufferGap;
        const ranges = [];
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
            rangeEnd = parseFloat(bufferLine.substring(indexOfPipe + 1, indexOfTilde).trim());
          }
          if (isNaN(rangeEnd)) {
            console.error("Has buffer range end log format changed?");
            break;
          }
          ranges.push([rangeStart, rangeEnd]);
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
        state.updateState("bufferedRanges" /* BUFFERED_RANGES */, "replace" /* REPLACE */, ranges);
        const timestamp = parseFloat(logTxt);
        if (isNaN(timestamp)) {
          console.error("Has timestamp format changed?");
        }
        state.updateState("bufferGaps" /* BUFFER_GAPS */, "push" /* PUSH */, [{ bufferGap, timestamp }]);
      }
    } else {
      console.error("Has position log format changed?");
    }
  }
  function processPlayerStateChangeLog(state, logTxt) {
    const stateRegex = /(\w+)$/;
    const match = logTxt.match(stateRegex);
    if (match !== null) {
      const playerState = match[1];
      if (playerState === "STOPPED") {
        state.updateState("position" /* POSITION */, "replace" /* REPLACE */, void 0);
        state.updateState("bufferGaps" /* BUFFER_GAPS */, "replace" /* REPLACE */, void 0);
        state.updateState("bufferedRanges" /* BUFFERED_RANGES */, "replace" /* REPLACE */, void 0);
      }
      state.updateState("state" /* PLAYER_STATE */, "replace" /* REPLACE */, playerState);
    } else {
      console.error("Has state log format changed?");
    }
  }

  // src/pages/live_debugging.ts
  function generateLiveDebuggingPage(password, tokenId, configState2) {
    const inspectorState = new ObservableState();
    const currentSocket = startWebsocketConnection(password, tokenId);
    window.sendEvalToDevice = sendEvalToDevice;
    const headerElt = createLiveDebuggerHeaderElement(tokenId, currentSocket, configState2, inspectorState);
    document.body.appendChild(headerElt);
    const modulesContainerElt = createElement("div");
    document.body.appendChild(modulesContainerElt);
    createModules(modulesContainerElt, tokenId, configState2, inspectorState);
    currentSocket.addEventListener("close", function() {
      displayError("WebSocket connection closed");
    });
    currentSocket.addEventListener("error", function() {
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
    function sendEvalToDevice(instruction) {
      currentSocket.send(JSON.stringify({
        type: "eval",
        value: {
          id: String(Math.random().toString(36)),
          instruction
        }
      }));
    }
  }
  function createLiveDebuggerHeaderElement(tokenId, currentSocket, configState2, inspectorState) {
    const header = document.createElement("div");
    header.className = "header";
    const tokenTitleElt = document.createElement("div");
    tokenTitleElt.className = "token-title";
    tokenTitleElt.innerHTML = `<span class="header-item page-title">Live Debugger</span><span class="header-item"><span class="token-title-desc">Token:</span> <span class="token-title-val">${tokenId}</span>  </span>`;
    header.appendChild(tokenTitleElt);
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "header-item";
    buttonsContainer.appendChild(createExportLogsButton(inspectorState));
    buttonsContainer.appendChild(createCloseConnectionButton(currentSocket));
    buttonsContainer.appendChild(createClearAllButton(inspectorState));
    buttonsContainer.appendChild(createClearStoredConfigButton(configState2));
    buttonsContainer.appendChild(createDarkLightModeButton(configState2));
    header.appendChild(buttonsContainer);
    return header;
  }
  function createClearStoredConfigButton(configState2) {
    const buttonElt = document.createElement("button");
    buttonElt.textContent = "\u{1F9F9} Clear page config";
    buttonElt.onclick = function() {
      configState2.updateState("closedModules" /* CLOSED_MODULES */, "replace" /* REPLACE */, []);
      configState2.updateState("minimizedModules" /* MINIMIZED_MODULES */, "replace" /* REPLACE */, []);
      configState2.updateState("widthRatios" /* WIDTH_RATIOS */, "replace" /* REPLACE */, {});
      configState2.updateState("modulesOrder" /* MODULES_ORDER */, "replace" /* REPLACE */, getDefaultModuleOrder());
      configState2.commitUpdates();
    };
    configState2.subscribe("closedModules" /* CLOSED_MODULES */, check);
    configState2.subscribe("modulesOrder" /* MODULES_ORDER */, check);
    configState2.subscribe("minimizedModules" /* MINIMIZED_MODULES */, check);
    configState2.subscribe("widthRatios" /* WIDTH_RATIOS */, check);
    check();
    function check() {
      var _a, _b, _c, _d;
      const closedModules = (_a = configState2.getCurrentState("closedModules" /* CLOSED_MODULES */)) != null ? _a : [];
      const minimizedModules = (_b = configState2.getCurrentState("minimizedModules" /* MINIMIZED_MODULES */)) != null ? _b : [];
      const widthRatios = (_c = configState2.getCurrentState("widthRatios" /* WIDTH_RATIOS */)) != null ? _c : {};
      const modulesOrder = (_d = configState2.getCurrentState("modulesOrder" /* MODULES_ORDER */)) != null ? _d : [];
      const defaultModuleOrder = getDefaultModuleOrder();
      const hasDefaultModuleOrder = modulesOrder.length === defaultModuleOrder.length && modulesOrder.every((moduleId, index) => moduleId === defaultModuleOrder[index]);
      buttonElt.disabled = closedModules.length === 0 && minimizedModules.length === 0 && Object.keys(widthRatios).length === 0 && hasDefaultModuleOrder;
    }
    return buttonElt;
  }
  function createCloseConnectionButton(currentSocket) {
    const buttonElt = document.createElement("button");
    buttonElt.textContent = "\u270B Stop listening";
    buttonElt.onclick = function() {
      if (currentSocket !== null) {
        currentSocket.close();
      }
      buttonElt.disabled = true;
    };
    return buttonElt;
  }
  function createExportLogsButton(inspectorState) {
    const buttonElt = document.createElement("button");
    buttonElt.textContent = "\u{1F4BE} Export";
    buttonElt.onclick = function() {
      exportLogs(inspectorState);
    };
    return buttonElt;
  }
  function createClearAllButton(inspectorState) {
    const buttonElt = document.createElement("button");
    buttonElt.textContent = "\u{1F9F9} Clear all logs";
    buttonElt.onclick = function() {
      const allProps = Object.keys(inspectorState.getCurrentState());
      allProps.forEach((prop) => {
        inspectorState.updateState(prop, "replace" /* REPLACE */, void 0);
      });
      inspectorState.commitUpdates();
    };
    return buttonElt;
  }
  function createDarkLightModeButton(configState2) {
    const buttonElt = createButton({ className: "btn-dark-light-mode" });
    let isDark;
    configState2.subscribe("cssMode" /* CSS_MODE */, () => {
      isDark = configState2.getCurrentState("cssMode" /* CSS_MODE */) === "dark";
      if (isDark) {
        document.body.classList.replace("light", "dark");
        buttonElt.textContent = "\u263C Light mode";
      } else {
        document.body.classList.replace("dark", "light");
        buttonElt.textContent = "\u{1F318} Dark mode";
      }
    }, true);
    buttonElt.onclick = function() {
      configState2.updateState("cssMode" /* CSS_MODE */, "replace" /* REPLACE */, isDark ? "light" : "dark");
      configState2.commitUpdates();
    };
    return buttonElt;
  }
  function exportLogs(inspectorState) {
    var _a;
    const aElt = document.createElement("a");
    aElt.style.display = "none";
    document.body.appendChild(aElt);
    const logsHistory = (_a = inspectorState.getCurrentState("logsHistory" /* LOGS_HISTORY */)) != null ? _a : [];
    const logExport = logsHistory.join("\n");
    const blob = new Blob([logExport], { type: "octet/stream" });
    const url = window.URL.createObjectURL(blob);
    aElt.href = url;
    aElt.download = "log-export-" + new Date().toISOString() + ".txt";
    aElt.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(aElt);
  }
  function startWebsocketConnection(password, tokenId) {
    const wsUrl = `${SERVER_URL}/${password}/${tokenId}`;
    const socket = new WebSocket(wsUrl);
    return socket;
  }

  // src/pages/password.ts
  function generatePasswordPage() {
    document.body.appendChild(createPasswordInputElement());
  }
  function createPasswordInputElement() {
    const passwordWrapperElt = document.createElement("div");
    const passwordInputElt = document.createElement("input");
    passwordInputElt.placeholder = "Enter server password";
    const passwordSendElt = document.createElement("button");
    passwordSendElt.textContent = "Set password";
    passwordSendElt.onclick = () => {
      const val = passwordInputElt.value;
      location.hash = "#!pass=" + val;
    };
    passwordWrapperElt.appendChild(passwordInputElt);
    passwordWrapperElt.appendChild(passwordSendElt);
    return passwordWrapperElt;
  }

  // src/pages/token.ts
  function generateTokenPage(password) {
    document.body.appendChild(createGenerateTokenButton(password));
    const orElt = document.createElement("p");
    orElt.textContent = "OR";
    document.body.appendChild(orElt);
    document.body.appendChild(createTokenInputElement(password));
  }
  function createGenerateTokenButton(password) {
    return createButton({
      className: "btn-generate-token",
      textContent: "Generate Token",
      onClick() {
        const tokenId = generateToken();
        window.location.hash = `#!pass=${password}!token=${tokenId}`;
      }
    });
  }
  function createTokenInputElement(password) {
    const tokenWrapperElt = document.createElement("div");
    const tokenInputElt = document.createElement("input");
    tokenInputElt.placeholder = "Enter the wanted token";
    const tokenSendElt = document.createElement("button");
    tokenSendElt.textContent = "Set token";
    tokenSendElt.onclick = () => {
      const val = tokenInputElt.value;
      checkTokenValidity(val);
      location.hash = "#!pass=" + password + "!token=" + val;
    };
    tokenWrapperElt.appendChild(tokenInputElt);
    tokenWrapperElt.appendChild(tokenSendElt);
    return tokenWrapperElt;
  }
  function generateToken() {
    return Math.random().toString(36).substring(2, 8);
  }

  // src/index.ts
  window.addEventListener("hashchange", () => {
    window.location.reload();
  });
  var configState = new ObservableState();
  configState.subscribe("cssMode" /* CSS_MODE */, () => {
    if (configState.getCurrentState("cssMode" /* CSS_MODE */) === "dark") {
      document.body.classList.replace("light", "dark");
    } else {
      document.body.classList.replace("dark", "light");
    }
  });
  initializeGlobalConfig();
  var initialHashValues = window.location.hash.split("!");
  var passStr = initialHashValues.filter((val) => val.startsWith("pass="))[0];
  if (passStr === void 0 || passStr.length < 6) {
    generatePasswordPage();
  } else {
    const password = passStr.substring("pass=".length);
    const tokenStr = initialHashValues.filter((val) => val.startsWith("token="))[0];
    if (tokenStr === void 0) {
      generateTokenPage(password);
    } else {
      const tokenId = tokenStr.substring("token=".length);
      checkTokenValidity(tokenId);
      generateLiveDebuggingPage(password, tokenId, configState);
    }
  }
  function initializeGlobalConfig() {
    var _a, _b, _c, _d;
    let currentModuleConfig = {};
    const storedModulesInfo = localStorage.getItem(MODULE_CONFIG_LS_ITEM);
    if (typeof storedModulesInfo === "string") {
      try {
        currentModuleConfig = JSON.parse(storedModulesInfo);
      } catch (err) {
        console.error("Could not parse previous stored module config", err);
      }
    }
    let currentMode = configState.getCurrentState("cssMode" /* CSS_MODE */);
    if (currentMode === void 0) {
      currentMode = localStorage.getItem("cssMode" /* CSS_MODE */) === "dark" ? "dark" : "light";
    }
    configState.updateState("cssMode" /* CSS_MODE */, "replace" /* REPLACE */, currentMode);
    configState.updateState("closedModules" /* CLOSED_MODULES */, "replace" /* REPLACE */, (_a = currentModuleConfig["closedModules" /* CLOSED_MODULES */]) != null ? _a : []);
    configState.updateState("widthRatios" /* WIDTH_RATIOS */, "replace" /* REPLACE */, (_b = currentModuleConfig["widthRatios" /* WIDTH_RATIOS */]) != null ? _b : {});
    configState.updateState("minimizedModules" /* MINIMIZED_MODULES */, "replace" /* REPLACE */, (_c = currentModuleConfig["minimizedModules" /* MINIMIZED_MODULES */]) != null ? _c : []);
    configState.updateState("modulesOrder" /* MODULES_ORDER */, "replace" /* REPLACE */, (_d = currentModuleConfig["modulesOrder" /* MODULES_ORDER */]) != null ? _d : []);
    configState.commitUpdates();
    configState.subscribe("cssMode" /* CSS_MODE */, () => {
      const isDark = configState.getCurrentState("cssMode" /* CSS_MODE */) === "dark";
      localStorage.setItem("cssMode" /* CSS_MODE */, isDark ? "dark" : "light");
    });
    configState.subscribe("closedModules" /* CLOSED_MODULES */, () => {
      var _a2;
      const closedModules = (_a2 = configState.getCurrentState("closedModules" /* CLOSED_MODULES */)) != null ? _a2 : [];
      currentModuleConfig["closedModules" /* CLOSED_MODULES */] = closedModules;
      localStorage.setItem(MODULE_CONFIG_LS_ITEM, JSON.stringify(currentModuleConfig));
    });
    configState.subscribe("widthRatios" /* WIDTH_RATIOS */, () => {
      var _a2;
      const closedModules = (_a2 = configState.getCurrentState("widthRatios" /* WIDTH_RATIOS */)) != null ? _a2 : {};
      currentModuleConfig["widthRatios" /* WIDTH_RATIOS */] = closedModules;
      localStorage.setItem(MODULE_CONFIG_LS_ITEM, JSON.stringify(currentModuleConfig));
    });
    configState.subscribe("minimizedModules" /* MINIMIZED_MODULES */, () => {
      var _a2;
      const closedModules = (_a2 = configState.getCurrentState("minimizedModules" /* MINIMIZED_MODULES */)) != null ? _a2 : [];
      currentModuleConfig["minimizedModules" /* MINIMIZED_MODULES */] = closedModules;
      localStorage.setItem(MODULE_CONFIG_LS_ITEM, JSON.stringify(currentModuleConfig));
    });
    configState.subscribe("modulesOrder" /* MODULES_ORDER */, () => {
      var _a2;
      const closedModules = (_a2 = configState.getCurrentState("modulesOrder" /* MODULES_ORDER */)) != null ? _a2 : [];
      currentModuleConfig["modulesOrder" /* MODULES_ORDER */] = closedModules;
      localStorage.setItem(MODULE_CONFIG_LS_ITEM, JSON.stringify(currentModuleConfig));
    });
  }
})();
