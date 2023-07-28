#!/usr/bin/env node
import { appendFile } from "fs";
import { IncomingMessage } from "http";
import process from "process";
import * as commander from "commander";
import WebSocket, { WebSocketServer } from "ws";
import activeTokensList from "./active_tokens_list.js";
import logger from "./logger.js";
import createCheckers from "./safe_checks.js";

/**
 * Regular expression to extract timestamp and date from the initial "Init" log
 * sent by devices.
 * The first number is the timestamp in milliseconds and the second the
 * corresponding date on the device at the time the timestamp was generated.
 */
const INIT_REGEX = /^Init v1 ([0-9]+(?:\.[0-9]+)?) ([0-9]+(?:\.[0-9]+)?)$/;

const DEFAULT_INSPECTOR_PORT = 22625;
const DEFAULT_DEVICE_PORT = 22626;
const DEFAULT_HISTORY_SIZE = 0;
const DEFAULT_MAX_TOKEN_DURATION = 4 * 60 * 60;
const DEFAULT_MAX_LOG_LENGTH = 3000;
const DEFAULT_WRONG_PASSWORD_LIMIT = 50;
const DEFAULT_DEVICE_CONNECTION_LIMIT = 500;
const DEFAULT_INSPECTOR_CONNECTION_LIMIT = 500;
const DEFAULT_DEVICE_MESSAGE_LIMIT = 1e6;
const DEFAULT_INSPECTOR_MESSAGE_LIMIT = 1000;
const DEFAULT_LOG_FILE_PATH = "server_logs.txt";

const { program } = commander;

program
  .description("RxPaired - RxPlayer's Light Remote Inspector")
  .option("-cp, --inspector-port <port>",
          "Port used for inspector-to-server communication. " +
          `Defaults to ${DEFAULT_INSPECTOR_PORT}.`)
  .option("-dp, --device-port <port>",
          "Port used for device-to-server communication. " +
          `Defaults to ${DEFAULT_DEVICE_PORT}.`)
  .option("-f, --create-log-files",
          "If set, a log file will also be written for each token and for each " +
          "day (server time) this token is used, in the current directory.")
  .option("--force-password <password>",
          "Force the password to be a given string" +
          " (must be alphanumeric, case-sentive)")
  .option("--no-password",
          "Disable the usage of a password.")
  .option("--history-size <size>",
          "Number of logs kept in memory for each token in case of web inspectors (re-)" +
          "connecting after the device already emitted logs." +
          ` ${DEFAULT_HISTORY_SIZE} by default.`)
  .option("--max-token-duration <duration>",
          "Maximum number of seconds a new token is created for, in seconds. " +
          `Defaults to ${DEFAULT_MAX_TOKEN_DURATION}.`)
  .option("--max-log-length <length>",
          "Maximum length a log can have, in terms of UTF-16 code points. " +
          "Longer logs will be skipped. 500 by default.")
  .option("--wrong-password-limit <number>",
          "Maximum authorized number of bad passwords received in 24 hours. " +
          "Exceeding that limit will stop the server. " +
          `Defaults to ${DEFAULT_WRONG_PASSWORD_LIMIT}.`)
  .option("--inspector-connection-limit <number>",
          "Maximum authorized number of web inspector connection per 24 hours. " +
          "Exceeding that limit will stop the server. " +
          ` Defaults to ${DEFAULT_INSPECTOR_CONNECTION_LIMIT}.`)
  .option("--device-connection-limit <number>",
          "Maximum authorized number of device connection per 24 hours. " +
          "Exceeding that limit will stop the server. " +
          ` Defaults to ${DEFAULT_DEVICE_CONNECTION_LIMIT}.`)
  .option("--device-message-limit <number>",
          "Maximum authorized number of message any device (e.g. logs) can send " +
          "per 24 hours. " +
          "Exceeding that limit will stop the server. " +
          ` Defaults to ${DEFAULT_DEVICE_MESSAGE_LIMIT}.`)
  .option("--inspector-message-limit <number>",
          "Maximum authorized number of message any web inspector can send per 24 " +
          "hours. Exceeding that limit will stop the server. " +
          ` Defaults to ${DEFAULT_INSPECTOR_MESSAGE_LIMIT}.`)
  .option("--log-file <path>",
          "Path to the server's log file. " +
          ` Defaults to ${DEFAULT_LOG_FILE_PATH}.`);

program.parse(process.argv);
const options = program.opts();

const inspectorPort = options.inspectorPort === undefined ?
  DEFAULT_INSPECTOR_PORT :
  +options.inspectorPort;
const devicePort = options.devicePort === undefined ?
  DEFAULT_DEVICE_PORT :
  +options.devicePort;
const usePassword = Boolean(options.password);
const forcePassword = typeof options.forcePassword === "string" ?
  options.forcePassword :
  undefined;
const shouldCreateLogFiles = Boolean(options.createLogFiles);

/** Maximum duration a Token can be used for, in milliseconds. */
const maxTokenDuration = options.maxTokenDuration === undefined ?
  DEFAULT_MAX_TOKEN_DURATION * 1000 :
  +options.maxTokenDuration * 1000;

const maxLogLength = options.maxLogLength === undefined ?
  DEFAULT_MAX_LOG_LENGTH :
  +options.maxLogLength;

const historySize = options.historySize === undefined ?
  DEFAULT_HISTORY_SIZE :
  +options.historySize;

/**
 * Maximum bad password that should at maximum be received, per 24 hours rolling.
 * it.
 * If that limit is exceeded, the server will stop.
 */
const wrongPasswordLimit = options.wrongPasswordLimit === undefined ?
  DEFAULT_WRONG_PASSWORD_LIMIT :
  +options.wrongPasswordLimit;

/**
 * Maximum new web inspectors that should at connect per 24 hours rolling.
 * it.
 * If that limit is exceeded, the server will stop.
 */
const inspectorConnectionLimit = options.inspectorConnectionLimit === undefined ?
  DEFAULT_INSPECTOR_CONNECTION_LIMIT :
  +options.inspectorConnectionLimit;

/**
 * Maximum new devices that should at connect per 24 hours rolling.
 * it.
 * If that limit is exceeded, the server will stop.
 */
const deviceConnectionLimit = options.deviceConnectionLimit === undefined ?
  DEFAULT_DEVICE_CONNECTION_LIMIT :
  +options.deviceConnectionLimit;

const deviceMessageLimit = options.deviceMessageLimit === undefined ?
  DEFAULT_DEVICE_MESSAGE_LIMIT :
  +options.deviceMessageLimit;

const inspectorMessageLimit = options.inspectorMessageLimit === undefined ?
  DEFAULT_INSPECTOR_MESSAGE_LIMIT :
  +options.inspectorMessageLimit;

const logFile = typeof options.logFile === "string" ?
  options.logFile :
  undefined;

logger.setLogFile(logFile ?? DEFAULT_LOG_FILE_PATH);

[
  [inspectorPort, "--inspector-port"],
  [devicePort, "--device-port"],
  [maxTokenDuration, "--max-token-duration"],
  [maxLogLength, "--max-log-length"],
  [historySize, "--history-size"],
  [deviceMessageLimit, "--device-message-limit"],
  [wrongPasswordLimit, "--wrong-password-limit"],
  [inspectorConnectionLimit, "--inspector-connection-limit"],
  [deviceConnectionLimit, "--device-connection-limit"],
  [inspectorMessageLimit, "--inspector-message-limit"],
].forEach((opt) => {
  if (isNaN(+opt[0])) {
    console.error(`Invalid "${opt[1]}" option, not a number.`);
    process.exit(1);
  }
});

let password : string | null = null;
if (usePassword) {
  if (forcePassword !== undefined) {
    if (!isAlphaNumeric(forcePassword)) {
      console.error("Invalid password. It can only contains A-Z, a-z, " +
                    " and 0-9 set of latin letters and numbers");
      process.exit(1);
    }
    password = forcePassword;
  } else {
    password = generatePassword();
  }
  console.log("Generated password:", password);
}

const deviceSocket = new WebSocketServer({ port: devicePort });
const htmlInspectorSocket = new WebSocketServer({ port: inspectorPort });

const checkers = createCheckers({
  deviceSocket,
  htmlInspectorSocket,
  maxTokenDuration,
  inspectorMessageLimit,
  deviceMessageLimit,
  wrongPasswordLimit,
  inspectorConnectionLimit,
  deviceConnectionLimit,
});

deviceSocket.on("connection", (ws, req) => {
  if (req.url === undefined) {
    ws.close();
    return;
  }
  const tokenId = req.url.substring(1);
  const existingTokenIndex = activeTokensList.findIndex(tokenId);
  if (existingTokenIndex === -1) {
    writeLog("warn", "Received device request with invalid token.",
             // Avoid filling the logging storage with bad tokens
             { tokenId: tokenId.length > 100 ? undefined : tokenId });
    ws.close();
    return;
  }
  const existingToken = activeTokensList.getFromIndex(existingTokenIndex);
  if (existingToken === undefined) {
    // should never happen
    return;
  }
  if (existingToken.device !== null) {
    writeLog("warn",
             "A device was already connected with this token. " +
             ". Closing all token users.", { tokenId });
    ws.close();
    activeTokensList.removeIndex(existingTokenIndex);
    existingToken.device.close();
    existingToken.device = null;
    while (existingToken.inspectors.length > 0) {
      const inspectorInfo = existingToken.inspectors.pop();
      if (inspectorInfo !== undefined) {
        inspectorInfo.webSocket.close();
        clearInterval(inspectorInfo.pingInterval);
      }
    }
    return;
  }
  writeLog("log", "Received authorized device connection",
           { address: req.socket.remoteAddress, tokenId });

  checkers.checkNewDeviceLimit();

  existingToken.device = ws;
  existingToken.pingInterval = setInterval(() => {
    ws.send("ping");
  }, 10000);
  ws.on("message", message => {
    checkers.checkDeviceMessageLimit();
    let messageStr = message.toString();
    if (messageStr.length > maxLogLength) {
      return;
    }

    if (messageStr === "pong") {
      return;
    } else if (existingToken?.device !== null && messageStr.startsWith("Init ")) {
      writeLog("log", "received Init message",
               { address: req.socket.remoteAddress, tokenId });
      const matches = messageStr.match(INIT_REGEX);
      if (matches === null) {
        writeLog("warn", "Error while trying to parse the `Init` initial message from " +
                 "a device. Is it valid?",
                 { address: req.socket.remoteAddress, tokenId, message: messageStr });
      } else {
        const timestamp = +matches[1];
        const dateMs = +matches[2];
        existingToken.setDeviceInitData({ timestamp, dateMs });
        const { history, maxHistorySize } = existingToken.getCurrentHistory();
        messageStr = JSON.stringify({
          type: "Init",
          value: { timestamp, dateMs, history, maxHistorySize },
        });
      }
    } else {
      existingToken?.addLogToHistory(messageStr);
      if (shouldCreateLogFiles) {
        appendFile(getLogFileName(tokenId), messageStr + "\n", function() {
          // on finished. Do nothing for now.
        });
      }
    }
    if (existingToken.getDeviceInitData() === null) {
      return;
    }
    for (const inspector of existingToken.inspectors) {
      sendMessageToInspector(messageStr, inspector.webSocket, req, tokenId);
    }
  });
  ws.on("close", () => {
    writeLog("log", "Device disconnected.",
             { address: req.socket.remoteAddress, tokenId });
    if (existingToken.pingInterval !== null) {
      clearInterval(existingToken.pingInterval);
    }
    existingToken.device = null;
    if (existingToken.inspectors.length === 0) {
      const indexOfToken = activeTokensList.findIndex(tokenId);
      if (indexOfToken === -1) {
        writeLog("warn", "Closing device's token not found", { tokenId });
        return;
      }
      writeLog("log", "Removing token",
               { tokenId, remaining: activeTokensList.size() - 1 });
      activeTokensList.removeIndex(indexOfToken);
    }
  });
});

htmlInspectorSocket.on("connection", (ws, req) => {
  let tokenId : string | undefined;
  if (req.url === undefined) {
    ws.close();
    return;
  }
  if (usePassword && password !== null) {
    // format of a request: /<PASSWORD>/<TOKEN>
    const receivedPassword = req.url.substring(1, password.length + 1);
    if (receivedPassword !== password) {
      writeLog("warn", "Received inspector request with invalid password: " +
               receivedPassword,
               { address: req.socket.remoteAddress });
      ws.close();
      checkers.checkBadPasswordLimit();
      return;
    }
    tokenId = req.url.substring(1 + password.length + 1);
  } else {
    // format of a request: /<TOKEN>
    tokenId = req.url.substring(1);
  }

  checkers.checkNewInspectorLimit();
  if (tokenId.length > 100) {
    writeLog("warn", "Received inspector request with token too long: " +
                     String(tokenId.length));
    ws.close();
    return;
  } else if (!/[a-z0-9]+/.test(tokenId)) {
    writeLog("warn", "Received inspector request with invalid token.", { tokenId });
    ws.close();
    return;
  }

  writeLog("log", "Inspector: Received authorized inspector connection.",
           { address: req.socket.remoteAddress, tokenId });

  let existingToken = activeTokensList.find(tokenId);
  if (existingToken === undefined) {
    writeLog("log", "Creating new token",
             { tokenId, remaining: activeTokensList.size() + 1 });
    existingToken = activeTokensList.create(tokenId, historySize);
  } else {
    writeLog("log", "Adding new inspector to token.", { tokenId });
  }

  const pingInterval = setInterval(() => {
    ws.send("ping");
  }, 10000);
  existingToken.inspectors.push({
    webSocket: ws,
    pingInterval,
  });

  const deviceInitData = existingToken.getDeviceInitData();
  if (deviceInitData !== null) {
    const { timestamp, dateMs } = deviceInitData;
    const { history, maxHistorySize } = existingToken.getCurrentHistory();
    const message = JSON.stringify({
      type: "Init",
      value: {
        timestamp,
        dateMs,
        history,
        maxHistorySize,
      },
    });
    sendMessageToInspector(message, ws, req, tokenId);
  }

  ws.on("message", message => {
    checkers.checkInspectorMessageLimit();
    const messageStr = message.toString();

    if (messageStr === "pong") {
      return;
    }

    let messageObj;
    try {
      messageObj = JSON.parse(messageStr) as unknown;
    } catch (err) {
      writeLog("warn", "Could not parse message given by inspector.",
               { address: req.socket.remoteAddress,
                 tokenId,
                 message: messageStr.length < 200 ? messageStr : undefined });
    }
    if (!isEvalMessage(messageObj)) {
      writeLog("warn", "Unknown message type received by inspector",
               { address: req.socket.remoteAddress, tokenId });
      return;
    }
    if (existingToken === undefined || existingToken.device === null) {
      writeLog("warn", "Could not send eval message: no device connected",
               { address: req.socket.remoteAddress, tokenId });
      return;
    }

    writeLog("log", "Eval message received by inspector.",
             { address: req.socket.remoteAddress, tokenId });

    try {
      existingToken.device.send(messageStr);
    } catch (err) {
      writeLog("warn", "Error while sending message to a device", { tokenId });
    }
  });

  ws.on("close", () => {
    if (existingToken === undefined || tokenId === undefined) {
      return ;
    }
    writeLog("log", "Inspector disconnected.",
             { address: req.socket.remoteAddress, tokenId });
    const indexOfInspector = existingToken.inspectors
      .findIndex((obj) => obj.webSocket === ws);
    if (indexOfInspector === -1) {
      writeLog("warn", "Closing inspector not found.", { tokenId });
      return;
    }
    clearInterval(existingToken.inspectors[indexOfInspector].pingInterval);
    existingToken.inspectors.splice(indexOfInspector, 1);
    if (existingToken.inspectors.length === 0 && existingToken.device === null) {
      const indexOfToken = activeTokensList.findIndex(tokenId);
      if (indexOfToken === -1) {
        writeLog("warn", "Closing inspector's token not found.", { tokenId });
        return;
      }
      writeLog("log", "Removing token.",
               { tokenId, remaining: activeTokensList.size() - 1 });
      activeTokensList.removeIndex(indexOfToken);
    }
  });
});
logger.log(`Emitting to web inspectors at ws://127.0.0.1:${inspectorPort}`);
logger.log(`Listening for device logs at ws://127.0.0.1:${devicePort}`);

function sendMessageToInspector(
  message : string,
  inspector : WebSocket.WebSocket,
  req : IncomingMessage,
  tokenId : string
) : void {
  try {
    inspector.send(message);
  } catch (err) {
    writeLog("warn", "Error while sending log to an inspector", {
      address: req.socket?.remoteAddress ?? undefined,
      tokenId,
    });
  }
}

function generatePassword() {
  return generateHalfToken() + generateHalfToken();
  function generateHalfToken() {
    return Math.random().toString(36).substring(2); // remove `0.`
  }
}

function getLogFileName(tokenId : string) : string {
  return "logs-" + getISODate() + "-" + tokenId + ".txt";
}

function getISODate() : string {
  return new Date().toISOString().split("T")[0];
}

interface EvalMessage {
  type : "eval";
  value : {
    instruction : string;
    id : string;
  };
}

function isEvalMessage(
  msg : unknown
) : msg is EvalMessage {
  return typeof msg === "object" &&
    msg !== null &&
    (msg as EvalMessage).type === "eval" &&
    typeof (msg as EvalMessage).value === "object" &&
    (msg as EvalMessage).value !== null &&
    typeof (msg as EvalMessage).value.id === "string" &&
    typeof (msg as EvalMessage).value.instruction === "string";
}

function writeLog(
  level : "log" | "warn",
  msg : string,
  infos : {
    address? : string | undefined;
    tokenId? : string | undefined;
    message? : string | undefined;
    remaining? : number;
  } | undefined = {}
) : void {
  const args = [msg];
  if (infos.address !== undefined) {
    args.push(`address=${infos.address}`);
  }
  if (infos.tokenId !== undefined) {
    args.push(`token=${infos.tokenId}`);
  }
  if (infos.message !== undefined) {
    args.push(`message=${infos.message}`);
  }
  if (infos.remaining !== undefined) {
    args.push(`remaining=${infos.remaining}`);
  }
  logger[level](...args);
}

/**
 * Returns `true` if the given string is only composed of alphanumeric
 * characters (upper-case A-Z letters, lower-case a-z letters, numbers).
 * @param {string} str
 * @returns {Boolean}
 */
function isAlphaNumeric(str: string): boolean {
  for (let i = 0, len = str.length; i < len; i++) {
    const code = str.charCodeAt(i);
    if (!(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 91) && // upper alpha (A-Z)
        !(code > 96 && code < 123)) { // lower alpha (a-z)
      return false;
    }
  }
  return true;
}
