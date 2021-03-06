/** To set to the token given. */
const __TOKEN__ = "";

(function() {
  const wsUrl = _DEVICE_DEBUGGER_URL_;

  let token = __TOKEN__;
  if (token === "") {
    const currentScriptSrc = document.currentScript.src;
    if (currentScriptSrc == null) {
      return;
    }
    const indexOfNumSign = currentScriptSrc.indexOf("#");
    if (indexOfNumSign === -1) {
      return;
    }
    token = currentScriptSrc.substring(indexOfNumSign + 1);
  }

  /** To set to true if you also want to log when xhr are received / sent */
  const SHOULD_LOG_REQUESTS = true;

  /** WebSocket connection used for debugging. */
  const socket = new WebSocket(wsUrl + "/" + token);

  /** Unsent Log queue used before WebSocket initialization */
  const logQueue = [];

  const MAX_LOG_LENGTH = 2000;

  /** Method used to send log. */
  let sendLog = (log) => {
    /* Push to internal queue until initialization. */
    logQueue.push(log);
  };

  function formatAndSendLog(namespace, log) {
    const time = performance.now().toFixed(2);
    const logText = `${time} [${namespace}] ${log}`;
    sendLog(logText);
  }

  function processArg(arg) {
    let processed;
    switch (typeof arg) {
      case "function":
      case "symbol":
      case "bigint":
        processed = "";
        break;

      case "string":
      case "number":
      case "boolean":
      case "undefined":
        processed = arg;
        break;

      case "object":
        if (arg === null) {
          processed = "null";
        } else if (arg instanceof Error) {
          processed = "NAME: " + String(arg.name) +
            " ~ CODE: " + String(arg.code) +
            " ~ MESSAGE: " + String(arg.message);
        } else {
          processed = "{}";
        }
        break;
      default:
        processed = "";
        break;
    }
    if (typeof processed === "string" && processed.length > MAX_LOG_LENGTH) {
      return processed.substring(0, MAX_LOG_LENGTH - 1) + "…";
    }
    return processed;
  }

  const spyRemovers = [ "log", "error", "info", "warn", "debug"].map(meth => {
    const oldConsoleFn = console[meth];
    console[meth] = function (...args) {
      const argStr = args.map(processArg).join(" ");
      formatAndSendLog(meth, argStr);
      return oldConsoleFn.apply(this, args);
    };
    return function () {
      console[meth] = oldConsoleFn;
    }
  });

  if (SHOULD_LOG_REQUESTS) {
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function () {
      const method = arguments[0];
      const url = arguments[1];
      if (typeof method !== "string" || typeof url !== "string") {
        return originalXhrOpen.apply(this, arguments);
      }
      this.addEventListener("load", function () {
        formatAndSendLog("Network", `Loaded ${method} XHR from: ${url} ` +
                                    `(status: ${this.status})`);
      });
      this.addEventListener("error", function () {
        formatAndSendLog("Network", `Errored ${method} XHR from: ${url}`);
      });
      this.abort = function() {
        formatAndSendLog("Network", `Aborted ${method} XHR from: ${url}`);
        return XMLHttpRequest.prototype.abort.apply(this, arguments);
      };
      this.send = function () {
        formatAndSendLog("Network", `Sending ${method} XHR to: ${url}`);
        return XMLHttpRequest.prototype.send.apply(this, arguments);
      };
      return originalXhrOpen.apply(this, arguments);
    };
    spyRemovers.push(function () {
      XMLHttpRequest.prototype.open = originalXhrOpen;
    });

    const originalFetch = window.fetch;
    window.fetch = function() {
      let url;
      let method;
      if (arguments[0] == null) {
        url = undefined;
      } else if (typeof arguments[0] === "string") {
        url = arguments[0];
      } else if (arguments[0] instanceof URL) {
        url = arguments[0].href;
      } else if (typeof arguments[0].url === "string") {
        url = arguments[0].url;
      } else {
        try {
          url = arguments[0].toString();
        } catch (_) {}
      }
      if (arguments[0] == null) {
        method = "GET";
      } else if (typeof arguments[0].method === "string") {
        method = arguments[0].method;
      } else if (arguments[1] != null && typeof arguments[1].method === "string") {
        method = arguments[0].method;
      } else {
        method = "GET";
      }
      formatAndSendLog("Network", `Sending ${method} fetch to: ${url}`);
      const realFetch = originalFetch.apply(this, arguments);
      return realFetch.then(
        (res) => {
          formatAndSendLog("Network", `Loaded ${method} fetch from: ${url} ` +
                                      `(status: ${res.status})`);
          return res;
        },
        (err) => {
          formatAndSendLog("Network", `Errored/Aborted ${method} fetch from: ${url}`);
          throw err;
        });
    };
    spyRemovers.push(function() {
      window.fetch = originalFetch;
    });
  }

  sendLog("Init v1 " + performance.now() + " " + Date.now());

  const TextDecoder =
    typeof window !== "object"               ? null :
    typeof window.TextDecoder !== "function" ? null :
                                               window.TextDecoder;
  const escape = window.escape;

  /**
   * Creates a string from the given Uint8Array containing utf-8 code units.
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  function utf8ToStr(data) {
    if (TextDecoder !== null) {
      try {
        // TextDecoder use UTF-8 by default
        const decoder = new TextDecoder();
        return decoder.decode(data);
      } catch (e) {
      }
    }

    let uint8 = data;

    // If present, strip off the UTF-8 BOM.
    if (uint8[0] === 0xEF && uint8[1] === 0xBB && uint8[2] === 0xBF) {
      uint8 = uint8.subarray(3);
    }

    // We're basically doing strToUtf8 in reverse.
    // You can look at that other function for the whole story.

    // Generate string containing escaped UTF-8 code units
    const utf8Str = stringFromCharCodes(uint8);

    let escaped;
    if (typeof escape === "function") {
      // Transform UTF-8 escape sequence into percent-encoded escape sequences.
      escaped = escape(utf8Str);
    } else {
      // Let's implement a simple escape function
      // http://ecma-international.org/ecma-262/9.0/#sec-escape-string
      const nonEscapedChar = /[A-Za-z0-9*_+-./]/;
      escaped = "";
      for (let i = 0; i < utf8Str.length; i++) {
        if (nonEscapedChar.test(utf8Str[i])) {
          escaped += utf8Str[i];
        } else {
          const charCode = utf8Str.charCodeAt(i);
          escaped += charCode >= 256 ? "%u" + intToHex(charCode, 4) :
                                       "%" + intToHex(charCode, 2);
        }
      }
    }

    // Decode the percent-encoded UTF-8 string into the proper JS string.
    // Example: "g#%E3%82%AC" -> "g#€"
    return decodeURIComponent(escaped);
  }

  /**
   * Creates a new string from the given array of char codes.
   * @param {Uint8Array} args
   * @returns {string}
   */
  function stringFromCharCodes(args) {
    const max = 16000;
    let ret = "";
    for (let i = 0; i < args.length; i += max) {
      const subArray = args.subarray(i, i + max);

      // NOTE: ugly I know, but TS is problematic here (you can try)
      ret += String.fromCharCode.apply(null, subArray);
    }
    return ret;
  }

  /**
   * Transform an integer into an hexadecimal string of the given length, padded
   * to the left with `0` if needed.
   * @example
   * ```
   * intToHex(5, 4); // => "0005"
   * intToHex(5, 2); // => "05"
   * intToHex(10, 1); // => "a"
   * intToHex(268, 3); // => "10c"
   * intToHex(4584, 6) // => "0011e8"
   * intToHex(123456, 4); // => "1e240" (we do nothing when going over 4 chars)
   * ```
   * @param {number} num
   * @param {number} size
   * @returns {string}
   */
  function intToHex(num, size) {
    const toStr = num.toString(16);
    return toStr.length >= size ? toStr :
      new Array(size - toStr.length + 1).join("0") + toStr;
  }

  function decycle(obj) {
    const encounteredRefs = new WeakMap();
    return (function recursivelyDecycle(value, path) {
      if (
        typeof value !== "object" ||
        value === null ||
        value instanceof Boolean ||
        value instanceof Date ||
        value instanceof Number ||
        value instanceof RegExp ||
        value instanceof String
      ) {
        const old_path = encounteredRefs.get(value);
        if (old_path !== undefined) {
          return {$cycle: old_path};
        }
        encounteredRefs.set(value, path);
        let newVal;
        if (Array.isArray(value)) {
          newVal = [];
          value.forEach(function (element, i) {
            newVal[i] = recursivelyDecycle(element, path + "[" + i + "]");
          });
        } else {
          newVal = {};
          Object.keys(value).forEach(function (name) {
            newVal[name] = recursivelyDecycle(
              value[name],
              path + "[" + JSON.stringify(name) + "]"
            );
          });
        }
        return newVal;
      } else if (typeof value === "bigint") {
        return "$BigInt(" + obj.toString() + ")";
      } else {
        return value;
      }
    }(obj, "$"));
  };

  function safeJsonStringify(val) {
    try {
      return JSON.stringify(val);
    } catch (err) {
      try {
        return JSON.stringify(decycle(val));
      } catch (err2) {
        const message = err2 != cycle && typeof err2.message === "string" ?
          err2.message :
          "undefined error";
        // Should not happen, but still...
        console.error("---- Could not stringify object: " + message + " ----");
        return "{}";
      }
    }
  }

  /**
   * Stop spying on JavaScript methods, just reset their original behavior.
   */
  function abort() {
    logQueue.length = 0;
    spyRemovers.forEach(cb => cb());
    spyRemovers.length = 0;
  }

  socket.addEventListener("open", function () {
    sendLog = (log) => socket.send(log);
    for (const log of logQueue) {
      sendLog(log);
    }
    logQueue.length = 0;
  });

  socket.addEventListener("error", abort);
  socket.addEventListener("close", abort);

  socket.addEventListener("message", function (event) {
    if (event == null || event.data == null) {
      socket.send(safeJsonStringify({
        type: "websocket-warning",
        value: "No message received from WebSocket",
      }));
      return ;
    }

    let formattedObj;
    try {
      if (typeof event.data === "string") {
        formattedObj = JSON.parse(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        formattedObj = JSON.parse(utf8ToStr(new Uint8Array(event.data)));
      } else {
        throw new Error("Unknown format");
      }
    } catch (formattingError) {
      socket.send(safeJsonStringify({
        type: "websocket-warning",
        value: "Unrecognized message format received from WebSocket: " +
          "not an UTF-8-encoded JSON",
      }));
    }

    if (formattedObj.type === "eval") {
      if (
        typeof formattedObj.value !== "object" ||
        formattedObj.value === null ||
        typeof formattedObj.value.instruction !== "string" ||
        typeof formattedObj.value.id !== "string"
      ) {
        socket.send(safeJsonStringify({
          type: "websocket-warning",
          value: "Evaluation value in the wrong format",
        }));
        return ;
      }
      let val;
      try {
        // Contrary to popular belief eval is the best and surest function ever
        val = evaluate(formattedObj.value.instruction);
      } catch (err) {
        socket.send(safeJsonStringify({
          type: "eval-error",
          value: {
            error: err,
            id: formattedObj.value.id,
          }
        }));
        return;
      }
      socket.send(safeJsonStringify({
        type: "eval-result",
        value: {
          data: processEvalReturn(val),
          id: formattedObj.value.id,
        },
      }));
      return;
    }
  });

  function processEvalReturn(val) {
    let processed;
    switch (typeof val) {
      case "function":
      case "symbol":
      case "bigint":
        processed = val.toString();
        break;

      case "string":
        processed = JSON.stringify(val);
        break;
      case "number":
      case "boolean":
      case "undefined":
        processed = val;
        break;

      case "object":
        try {
          processed = safeJsonStringify(arg);
        } catch (_) {}
        break;
      default:
        processed = "";
        break;
    }
    if (typeof processed === "string" && processed.length > MAX_LOG_LENGTH) {
      return processed.substring(0, MAX_LOG_LENGTH - 1) + "…";
    }
    return processed;
  }
  window.__RX_PLAYER_DEBUG_MODE__ = true;
})();

function evaluate(obj){
  return Function(`"use strict"; ${obj}`)();
}
