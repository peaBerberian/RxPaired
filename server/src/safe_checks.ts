import { performance } from "perf_hooks";
import { WebSocketServer } from "ws";
import activeTokensList from "./active_tokens_list.js";
import logger from "./logger.js";

export default function createCheckers({
  debugSocket,
  htmlClientSocket,
  maxTokenDuration,
  clientMessageLimit,
  deviceMessageLimit,
  wrongPasswordLimit,
  clientConnectionLimit,
  deviceConnectionLimit,
} : {
  debugSocket : WebSocketServer;
  htmlClientSocket : WebSocketServer;
  maxTokenDuration : number;
  clientMessageLimit : number;
  deviceMessageLimit : number;
  wrongPasswordLimit : number;
  clientConnectionLimit : number;
  deviceConnectionLimit : number;
}) {

  /** Count the number of device messages received in the current 24 hours considered. */
  let deviceMessageInCurrent24Hours = 0;

  /** Count the number of client messages received in the current 24 hours considered. */
  let clientMessageInCurrent24Hours = 0;

  /**
   * Has a new element each time a new bad password in the last 24h has been
   * communicated.
   * Each element is the timestamp, in terms of `performance.now()`, at which the
   * wrong password was communicated.
   */
  const badPasswordEvents : number[] = [];

  /**
   * Has a new element each time a new client has connected in the last 24h.
   * Each element is the timestamp, in terms of `performance.now()`, at which the
   * new client has connected.
   */
  const newClientEvents : number[] = [];

  /**
   * Has a new element each time a new device has connected in the last 24h.
   * Each element is the timestamp, in terms of `performance.now()`, at which the
   * new device has connected.
   */
  const newDeviceEvents : number[] = [];

  /* Clear list of bad events older than 24 hours every 10 minutes. */
  setInterval(() => {
    const now = performance.now();
    [badPasswordEvents, newClientEvents, newDeviceEvents].forEach(evts => {
      while (evts.length > 0 && now - evts[0] > 24 * 60 * 60 * 1000) {
        evts.shift();
      }
    });

    // Also close old tokens
    for (let i = 0; i < activeTokensList.size(); i++) {
      const tokenInfo = activeTokensList.getFromIndex(i);
      if (tokenInfo === undefined) {
        continue;
      }
      if (now - tokenInfo.timestamp > maxTokenDuration) {
        logger.warn("Revokating old token", tokenInfo.tokenId);
        activeTokensList.removeIndex(i);
        i--; // We removed i, so we now need to re-check what is at its place for
             // the next loop iteration
        if (tokenInfo.device !== null) {
          tokenInfo.device.close();
          tokenInfo.device = null;
        }
        while (tokenInfo.clients.length > 0) {
          const clientInfo = tokenInfo.clients.pop();
          if (clientInfo !== undefined) {
            clientInfo.webSocket.close();
            clearInterval(clientInfo.pingInterval);
          }
        }
      }
    }
  }, 10 * 60 * 1000);

  setInterval(() => {
    deviceMessageInCurrent24Hours = 0;
    clientMessageInCurrent24Hours = 0;
  }, 24 * 60 * 60 * 1000);

  return {
    checkClientMessageLimit() {
      if (clientMessageLimit === undefined) {
        return;
      } else if (++clientMessageInCurrent24Hours > clientMessageLimit) {
        logger.warn("Maximum number of client messages per 24h reached, " +
                    "closing everything",
                    clientMessageInCurrent24Hours);
        htmlClientSocket.close();
        debugSocket.close();
        process.exit(1);
      }
    },

    checkDeviceMessageLimit() {
      if (deviceMessageLimit === undefined) {
        return;
      } else if (++deviceMessageInCurrent24Hours > deviceMessageLimit) {
        logger.warn("Maximum number of device messages per 24h reached, " +
                    "closing everything",
                    deviceMessageInCurrent24Hours);
        htmlClientSocket.close();
        debugSocket.close();
        process.exit(1);
      }
    },

    checkBadPasswordLimit()  {
      if (wrongPasswordLimit === undefined) {
        return;
      }
      badPasswordEvents.push(performance.now());
      if (badPasswordEvents.length > wrongPasswordLimit) {
        logger.warn("Maximum number of bad passwords reached, closing everything");
        htmlClientSocket.close();
        debugSocket.close();
        process.exit(1);
      }
    },

    checkNewClientLimit()  {
      newClientEvents.push(performance.now());
      if (newClientEvents.length > clientConnectionLimit) {
        logger.warn("Maximum number of new clients reached, closing everything");
        htmlClientSocket.close();
        debugSocket.close();
        process.exit(1);
      }
    },

    checkNewDeviceLimit()  {
      if (deviceConnectionLimit === undefined) {
        return;
      }
      newDeviceEvents.push(performance.now());
      if (newDeviceEvents.length > deviceConnectionLimit) {
        logger.warn("Maximum number of new devices reached, closing everything");
        htmlClientSocket.close();
        debugSocket.close();
        process.exit(1);
      }
    },
  };
}
