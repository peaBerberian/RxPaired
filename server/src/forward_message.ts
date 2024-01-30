type Receiver = "inspector" | "history" | "disk"

/**
 * When receiving a websocket msg, the msg will be forwarded to a receiver:
 * - the inspector with websocket
 * - a log file on the disk
 * - an history stored in the javascript memory
 * To limit size of the message on this different 'receiver' this utils
 * allow to create variants of a message more or less verbose depending
 * on the receiver.
 * */ 
export function createForwardedMessage() {
  return {
    inspector: "", // the web inspector
    history: "",   // the history containing last messages in memory
    disk: "",      // the files that have been written on the disk
    setMessage(msg: string, receiver: Receiver | Receiver[]) {
      if(Array.isArray(receiver)) {
        receiver.forEach((r) => this[r] = msg)
      } else {
        this[receiver] = msg
      }
    },
    getMessage(receiver: Receiver) {
      return this[receiver];
    }
  }
}