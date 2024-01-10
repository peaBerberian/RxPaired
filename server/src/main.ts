import { appendFile } from "fs";
import { IncomingMessage } from "http";
import process from "process";
import * as commander from "commander";
import WebSocket, { WebSocketServer } from "ws";
import ActiveTokensList, {
  TokenMetadata, TokenType,
} from "./active_tokens_list.js";
import logger from "./logger.js";
import PersistentTokensStorage from "./persistent_tokens_storage.js";
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
  .option("--persistent-tokens-storage <path>",
          "If set, the RxPaired-server will store information on persistent " +
          "tokens on disk (at the given path) so they can be retrieved if the " +
          "server reboots.")
  .option("--log-file <path>",
          "Path to the server's log file. " +
          ` Defaults to ${DEFAULT_LOG_FILE_PATH}.`)
  .option("--disable-no-token",
          "Disable \"no-token\" mode, where devices can send logs without having " +
          "to create a \"token\" first through the inspector. ");

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

const persistentTokensFile = typeof options.persistentTokensStorage === "string" ?
  options.persistentTokensStorage :
  undefined;

/** Maximum duration a Token can be used for, in seconds. */
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

const disableNoToken = options.disableNoToken === true;

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

const persistentTokensStorage = new PersistentTokensStorage();

let activeTokensList: ActiveTokensList;
if (persistentTokensFile !== undefined) {
  const stored = persistentTokensStorage.initializeWithPath(persistentTokensFile);
  activeTokensList = new ActiveTokensList(stored);
} else {
  activeTokensList = new ActiveTokensList([]);
}

const deviceSocket = new WebSocketServer({ port: devicePort });
const htmlInspectorSocket = new WebSocketServer({ port: inspectorPort });

const checkers = createCheckers(activeTokensList, {
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

  let tokenId = req.url.substring(1);
  let logFileNameSuffix = tokenId;
  let existingToken: TokenMetadata;
  let existingTokenIndex: number;
  if (!disableNoToken && tokenId.startsWith("!notoken/")) {
    if (usePassword && password !== null) {
      const pw = tokenId.substring("!notoken/".length);
      if (pw !== password) {
        writeLog("warn", "Received inspector request with invalid password: " +
                 pw,
                 { address: req.socket.remoteAddress });
        ws.close();
        checkers.checkBadPasswordLimit();
        return;
      }
    }

    const address = req.socket.remoteAddress;
    if (address !== undefined && address !== "") {
      // Strip last part of address for fear of GDPR compliancy?
      const lastDotIdx = address.lastIndexOf(".");
      if (lastDotIdx > 0) {
        logFileNameSuffix = address.substring(0, lastDotIdx);
      } else {
        const lastColonIdx = address.lastIndexOf(".");
        if (lastColonIdx > 0) {
          logFileNameSuffix = address.substring(0, lastColonIdx);
        }
      }
    }
    tokenId = generatePassword();
    logFileNameSuffix += `-${tokenId}`;
    existingToken = activeTokensList.create(
      TokenType.FromDevice,
      tokenId,
      historySize,
      maxTokenDuration
    );
    existingTokenIndex = activeTokensList.findIndex(tokenId);
  } else {
    existingTokenIndex = activeTokensList.findIndex(tokenId);
    if (existingTokenIndex === -1) {
      writeLog("warn", "Received device request with invalid token.",
               // Avoid filling the logging storage with bad tokens
               { tokenId: tokenId.length > 100 ? undefined : tokenId });
      ws.close();
      return;
    }
    const token = activeTokensList.getFromIndex(existingTokenIndex);
    if (token === undefined) {
      // should never happen
      return;
    }
    existingToken = token;
  }

  checkers.checkNewDeviceLimit();

  if (existingToken.device !== null) {
    writeLog("warn",
             "A device was already connected with this token. " +
             "Closing previous token user.", { tokenId });
    const device = existingToken.device;
    existingToken.device = null;
    device.close();
  }
  writeLog("log", "Received authorized device connection",
           { address: req.socket.remoteAddress, tokenId });


  existingToken.device = ws;
  existingToken.pingInterval = setInterval(() => {
    ws.send("ping");
  }, 10000);
  ws.send("ack");
  ws.on("message", message => {
    checkers.checkDeviceMessageLimit();
    /* eslint-disable-next-line @typescript-eslint/no-base-to-string */
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
      let bypassHistoryAndLogfile = false;
      if (messageStr[0] !== "{") {
        try {
          /* eslint-disable */ // In a try so anything goes :p
          const parsed = JSON.parse(messageStr);
          if (parsed.type === "eval-result" || parsed.type === "eval-error") {
            /* eslint-enable */
            bypassHistoryAndLogfile = true;
          }
        } catch (_) {
          // We don't care
        }
      }
      if (!bypassHistoryAndLogfile) {
        existingToken?.addLogToHistory(messageStr);
        if (shouldCreateLogFiles) {
          appendFile(getLogFileName(logFileNameSuffix), messageStr + "\n", function() {
            // on finished. Do nothing for now.
          });
        }
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
    if (existingToken.device !== ws) {
      return;
    }
    writeLog("log", "Device disconnected.",
             { address: req.socket.remoteAddress, tokenId });
    if (existingToken.pingInterval !== null) {
      clearInterval(existingToken.pingInterval);
    }
    existingToken.device = null;
    if (
      existingToken.tokenType !== TokenType.Persistent &&
      existingToken.inspectors.length === 0
    ) {
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
  if (req.url === undefined) {
    ws.close();
    return;
  }
  const urlParts = parseInspectorUrl(req.url);
  const receivedPassword = urlParts.password ?? "";
  if (receivedPassword !== (password ?? "")) {
    writeLog("warn", "Received inspector request with invalid password: " +
             receivedPassword,
             { address: req.socket.remoteAddress });
    ws.close();
    checkers.checkBadPasswordLimit();
    return;
  }

  // Special token "list" request:
  // Regularly returns the list of currently active tokens
  if (urlParts.command === "list") {
    writeLog("log",
             "Received inspector request for list of tokens",
             { address: req.socket.remoteAddress });
    const itv = setInterval(sendCurrentListOfTokens, 3000);
    sendCurrentListOfTokens();
    ws.onclose = () => {
      clearInterval(itv);
    };
    function sendCurrentListOfTokens() {
      checkers.forceExpirationCheck();
      const now = performance.now();
      ws.send(JSON.stringify({
        isNoTokenEnabled: !disableNoToken,
        tokenList: activeTokensList.getList().map(t => {
          return {
            tokenId: t.tokenId,
            date: t.date,
            timestamp: t.timestamp,
            isPersistent: t.tokenType === TokenType.Persistent,
            msUntilExpiration: Math.max(t.getExpirationDelay(now), 0),
          };
        }),
      }));
    }
    return;
  }

  const tokenId = urlParts.tokenId;
  if (tokenId === undefined) {
    ws.close();
    return;
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
           { address: req.socket.remoteAddress, tokenId, command: urlParts.command });

  const isPersistentTokenCreation = urlParts.command === "persist";

  let existingToken = activeTokensList.find(tokenId);
  if (existingToken === undefined) {
    writeLog("log", "Creating new token",
             { tokenId, remaining: activeTokensList.size() + 1 });
    existingToken = activeTokensList.create(
      isPersistentTokenCreation ?
        TokenType.Persistent :
        TokenType.FromInspector,
      tokenId,
      historySize,
      urlParts.expirationDelay ?? maxTokenDuration
    );
  } else {
    if (isPersistentTokenCreation) {
      existingToken.tokenType = TokenType.Persistent;
    }
    if (urlParts.expirationDelay !== undefined) {
      existingToken.updateExpirationDelay(urlParts.expirationDelay);
    }
    writeLog("log", "Adding new inspector to token.", { tokenId });
  }

  if (isPersistentTokenCreation) {
    persistentTokensStorage.addToken(existingToken);
  }

  const pingInterval = setInterval(() => {
    ws.send("ping");
  }, 10000);
  existingToken.inspectors.push({
    webSocket: ws,
    pingInterval,
  });

  sendMessageToInspector("ack", ws, req, tokenId);

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
  checkers.forceExpirationCheck();

  ws.on("message", message => {
    checkers.checkInspectorMessageLimit();
    /* eslint-disable-next-line @typescript-eslint/no-base-to-string */
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
    if (
      existingToken.tokenType !== TokenType.Persistent &&
      existingToken.inspectors.length === 0 &&
      existingToken.device === null
    ) {
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
    command? : string | undefined;
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
  if (infos.command !== undefined) {
    args.push(`command=${infos.command}`);
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

function parseInspectorUrl(
  url: string
):
  {
    password: string | undefined;
    command: string | undefined;
    tokenId: string | undefined;
    expirationDelay: number | undefined;
  }
{
  const parts = url.substring(1).split("/");
  let pass;
  let command;
  let tokenId;
  let expirationMsStr;
  if ((usePassword && password !== null)) {
    pass = parts[0];
    if (parts.length >= 2 && parts[1].startsWith("!")) {
      command = parts[1].substring(1);
      tokenId = parts[2];
      expirationMsStr = parts[3];
    } else {
      command = undefined;
      tokenId = parts[1];
      expirationMsStr = parts[2];
    }
  } else {
    if (parts.length >= 1 && parts[0].startsWith("!")) {
      command = parts[0].substring(1);
      tokenId = parts[1];
      expirationMsStr = parts[2];
    } else {
      command = undefined;
      tokenId = parts[0];
      expirationMsStr = parts[1];
    }
  }
  let expirationDelay: number | undefined = +expirationMsStr;
  if (isNaN(expirationDelay)) {
    expirationDelay = undefined;
  }
  return {
    password: pass,
    tokenId,
    command,
    expirationDelay,
  };
}
