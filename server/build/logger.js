import { appendFile } from "fs";
export default new (class Logger {
    constructor() {
        this._logFile = null;
    }
    setLogFile(logFile) {
        this._logFile = logFile;
    }
    log(...args) {
        console.log(...args);
        const logStr = new Date().toISOString() + " - LOG - " + args.join(" ");
        if (this._logFile !== null) {
            appendFile("server-logs.txt", logStr + "\n", function () {
                // on finished. Do nothing for now.
            });
        }
    }
    warn(...args) {
        console.warn(...args);
        const logStr = new Date().toISOString() + " - WARN - " + args.join(" ");
        if (this._logFile !== null) {
            appendFile("server-logs.txt", logStr + "\n", function () {
                // on finished. Do nothing for now.
            });
        }
    }
})();
