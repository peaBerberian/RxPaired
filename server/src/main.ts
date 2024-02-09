import { appendFile } from "fs";
import { IncomingMessage } from "http";
import process from "process";
import WebSocket, { WebSocketServer } from "ws";
import ActiveTokensList, {
  TokenMetadata,
  TokenType,
} from "./active_tokens_list.js";
import logger from "./logger.js";
import parseOptions from "./option_parsing.js";
import PersistentTokensStorage from "./persistent_tokens_storage.js";
import createCheckers from "./safe_checks.js";
import { generatePassword } from "./utils.js";

/**
 * Regular expression to extract timestamp and date from the initial "Init" log
 * sent by devices.
 * The first number is the timestamp in milliseconds and the second the
 * corresponding date on the device at the time the timestamp was generated.
 */
const INIT_REGEX = /^Init v1 ([0-9]+(?:\.[0-9]+)?) ([0-9]+(?:\.[0-9]+)?)$/;

const options = parseOptions(process.argv.slice(2));
logger.setLogFile(options.logFile);

const persistentTokensStorage = new PersistentTokensStorage();

let activeTokensList: ActiveTokensList;
if (options.persistentTokensFile !== null) {
  const stored = await persistentTokensStorage.initializeWithPath(
    options.persistentTokensFile
  );
  activeTokensList = new ActiveTokensList(stored);
} else {
  activeTokensList = new ActiveTokensList([]);
}

const deviceSocket = new WebSocketServer({ port: options.devicePort });
const htmlInspectorSocket = new WebSocketServer({
  port: options.inspectorPort,
});

const checkers = createCheckers(activeTokensList, {
  deviceSocket,
  htmlInspectorSocket,
  maxTokenDuration: options.maxTokenDuration,
  inspectorMessageLimit: options.inspectorMessageLimit,
  deviceMessageLimit: options.deviceMessageLimit,
  wrongPasswordLimit: options.wrongPasswordLimit,
  inspectorConnectionLimit: options.inspectorConnectionLimit,
  deviceConnectionLimit: options.deviceConnectionLimit,
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
  if (!options.disableNoToken && tokenId.startsWith("!notoken")) {
    if (options.password !== null) {
      const pw = tokenId.substring("!notoken/".length);
      if (pw !== options.password) {
        writeLog(
          "warn",
          "Received inspector request with invalid password: " + pw,
          { address: req.socket.remoteAddress }
        );
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
        const lastColonIdx = address.lastIndexOf(":");
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
      options.historySize,
      options.maxTokenDuration
    );
    existingTokenIndex = activeTokensList.findIndex(tokenId);
  } else {
    existingTokenIndex = activeTokensList.findIndex(tokenId);
    if (existingTokenIndex === -1) {
      writeLog(
        "warn",
        "Received device request with invalid token.",
        // Avoid filling the logging storage with bad tokens
        { tokenId: tokenId.length > 100 ? undefined : tokenId }
      );
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
  const logFileName = getLogFileName(logFileNameSuffix);

  checkers.checkNewDeviceLimit();

  if (existingToken.device !== null) {
    writeLog(
      "warn",
      "A device was already connected with this token. " +
        "Closing previous token user.",
      { tokenId }
    );
    const device = existingToken.device;
    existingToken.device = null;
    device.close();
  }
  writeLog("log", "Received authorized device connection", {
    address: req.socket.remoteAddress,
    tokenId,
  });

  existingToken.device = ws;
  existingToken.pingInterval = setInterval(() => {
    ws.send("ping");
  }, 10000);
  ws.send("ack");
  ws.on("message", (message) => {
    checkers.checkDeviceMessageLimit();
    /* eslint-disable-next-line @typescript-eslint/no-base-to-string */
    const messageStr = message.toString();

    /** The log that is about to be written on the disk in the log file. */
    let storedMsg = "";

    /** The log that is about to be sent to the inspector. */
    let inspectorMsg = "";

    /** The log that is about to be added to the history.
     * History is sent once an inspector connect on an already started
     * session so it can have the logs before he actually connect.
     */
    let historyMsg = "";

    if (messageStr.length > options.maxLogLength) {
      return;
    }
    if (messageStr === "pong") {
      return;
    }
    if (existingToken?.device !== null && messageStr.startsWith("Init ")) {
      writeLog("log", "received Init message", {
        address: req.socket.remoteAddress,
        tokenId,
      });
      const matches = messageStr.match(INIT_REGEX);
      if (matches === null) {
        writeLog(
          "warn",
          "Error while trying to parse the `Init` initial message from " +
            "a device. Is it valid?",
          { address: req.socket.remoteAddress, tokenId, message: messageStr }
        );
      } else {
        const timestamp = +matches[1];
        const dateMs = +matches[2];
        existingToken.setDeviceInitData({ timestamp, dateMs });
        const { history, maxHistorySize } = existingToken.getCurrentHistory();
        inspectorMsg = JSON.stringify({
          type: "Init",
          value: { timestamp, dateMs, history, maxHistorySize },
        });
        storedMsg = JSON.stringify({
          type: "Init",
          value: { timestamp, dateMs },
        });
      }
    } else if (messageStr[0] === "{") {
      try {
        /* eslint-disable */ // In a try so anything goes :p
        const parsed = JSON.parse(messageStr);
        if (parsed.type === "eval-result" || parsed.type === "eval-error") {
          inspectorMsg = messageStr;
        }
      } catch (_) {
        // We don't care
      }
    } else {
      inspectorMsg = messageStr;
      storedMsg = messageStr;
      historyMsg = messageStr;
    }
    if (historyMsg) {
      existingToken?.addLogToHistory(historyMsg);
    }
    if (storedMsg && options.shouldCreateLogFiles) {
      appendFile(logFileName, storedMsg + "\n", function () {
        // on finished. Do nothing for now.
      });
    }

    if (existingToken.getDeviceInitData() === null) {
      return;
    }
    for (const inspector of existingToken.inspectors) {
      sendMessageToInspector(inspectorMsg, inspector.webSocket, req, tokenId);
    }
  });
  ws.on("close", () => {
    if (existingToken.device !== ws) {
      return;
    }
    writeLog("log", "Device disconnected.", {
      address: req.socket.remoteAddress,
      tokenId,
    });
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
      writeLog("log", "Removing token", {
        tokenId,
        remaining: activeTokensList.size() - 1,
      });
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
  if (receivedPassword !== (options.password ?? "")) {
    writeLog(
      "warn",
      "Received inspector request with invalid password: " + receivedPassword,
      { address: req.socket.remoteAddress }
    );
    ws.close();
    checkers.checkBadPasswordLimit();
    return;
  }

  // Special token "list" request:
  // Regularly returns the list of currently active tokens
  if (urlParts.command === "list") {
    writeLog("log", "Received inspector request for list of tokens", {
      address: req.socket.remoteAddress,
    });
    const itv = setInterval(sendCurrentListOfTokens, 3000);
    sendCurrentListOfTokens();
    ws.onclose = () => {
      clearInterval(itv);
    };
    function sendCurrentListOfTokens() {
      checkers.forceExpirationCheck();
      const now = performance.now();
      ws.send(
        JSON.stringify({
          isNoTokenEnabled: !options.disableNoToken,
          tokenList: activeTokensList.getList().map((t) => {
            return {
              tokenId: t.tokenId,
              date: t.date,
              timestamp: t.timestamp,
              isPersistent: t.tokenType === TokenType.Persistent,
              msUntilExpiration: Math.max(t.getExpirationDelay(now), 0),
            };
          }),
        })
      );
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
    writeLog(
      "warn",
      "Received inspector request with token too long: " +
        String(tokenId.length)
    );
    ws.close();
    return;
  } else if (!/[a-z0-9]+/.test(tokenId)) {
    writeLog("warn", "Received inspector request with invalid token.", {
      tokenId,
    });
    ws.close();
    return;
  }

  writeLog("log", "Inspector: Received authorized inspector connection.", {
    address: req.socket.remoteAddress,
    tokenId,
    command: urlParts.command,
  });

  const isPersistentTokenCreation = urlParts.command === "persist";

  let existingToken = activeTokensList.find(tokenId);
  if (existingToken === undefined) {
    writeLog("log", "Creating new token", {
      tokenId,
      remaining: activeTokensList.size() + 1,
    });
    existingToken = activeTokensList.create(
      isPersistentTokenCreation
        ? TokenType.Persistent
        : TokenType.FromInspector,
      tokenId,
      options.historySize,
      urlParts.expirationDelay ?? options.maxTokenDuration
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

  ws.on("message", (message) => {
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
      writeLog("warn", "Could not parse message given by inspector.", {
        address: req.socket.remoteAddress,
        tokenId,
        message: messageStr.length < 200 ? messageStr : undefined,
      });
    }
    if (!isEvalMessage(messageObj)) {
      writeLog("warn", "Unknown message type received by inspector", {
        address: req.socket.remoteAddress,
        tokenId,
      });
      return;
    }
    if (existingToken === undefined || existingToken.device === null) {
      writeLog("warn", "Could not send eval message: no device connected", {
        address: req.socket.remoteAddress,
        tokenId,
      });
      return;
    }

    writeLog("log", "Eval message received by inspector.", {
      address: req.socket.remoteAddress,
      tokenId,
    });

    try {
      existingToken.device.send(messageStr);
    } catch (err) {
      writeLog("warn", "Error while sending message to a device", { tokenId });
    }
  });

  ws.on("close", () => {
    if (existingToken === undefined || tokenId === undefined) {
      return;
    }
    writeLog("log", "Inspector disconnected.", {
      address: req.socket.remoteAddress,
      tokenId,
    });
    const indexOfInspector = existingToken.inspectors.findIndex(
      (obj) => obj.webSocket === ws
    );
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
      writeLog("log", "Removing token.", {
        tokenId,
        remaining: activeTokensList.size() - 1,
      });
      activeTokensList.removeIndex(indexOfToken);
    }
  });
});
logger.log(`Emitting to web inspectors at ws://127.0.0.1:${options.inspectorPort}`);
logger.log(`Listening for device logs at ws://127.0.0.1:${options.devicePort}`);

function sendMessageToInspector(
  message: string,
  inspector: WebSocket.WebSocket,
  req: IncomingMessage,
  tokenId: string
): void {
  try {
    inspector.send(message);
  } catch (err) {
    writeLog("warn", "Error while sending log to an inspector", {
      address: req.socket?.remoteAddress ?? undefined,
      tokenId,
    });
  }
}

function getLogFileName(tokenId: string): string {
  return "logs-" + new Date().toISOString() + "-" + tokenId + ".txt";
}

interface EvalMessage {
  type: "eval";
  value: {
    instruction: string;
    id: string;
  };
}

function isEvalMessage(msg: unknown): msg is EvalMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as EvalMessage).type === "eval" &&
    typeof (msg as EvalMessage).value === "object" &&
    (msg as EvalMessage).value !== null &&
    typeof (msg as EvalMessage).value.id === "string" &&
    typeof (msg as EvalMessage).value.instruction === "string"
  );
}

function writeLog(
  level: "log" | "warn",
  msg: string,
  infos:
    | {
        address?: string | undefined;
        command?: string | undefined;
        tokenId?: string | undefined;
        message?: string | undefined;
        remaining?: number;
      }
    | undefined = {}
): void {
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

function parseInspectorUrl(url: string): {
  password: string | undefined;
  command: string | undefined;
  tokenId: string | undefined;
  expirationDelay: number | undefined;
} {
  const parts = url.substring(1).split("/");
  let pass;
  let command;
  let tokenId;
  let expirationMsStr;
  if (options.password !== null) {
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
