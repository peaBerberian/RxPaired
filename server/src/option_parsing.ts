import { generatePassword } from "./utils.js";

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

export interface ParsedOptions {
  inspectorPort: number;
  devicePort: number;
  shouldCreateLogFiles: boolean;
  password: string | null;
  historySize: number;
  maxTokenDuration: number;
  maxLogLength: number;
  wrongPasswordLimit: number;
  inspectorConnectionLimit: number;
  deviceConnectionLimit: number;
  deviceMessageLimit: number;
  inspectorMessageLimit: number;
  persistentTokensFile: string | null;
  logFile: string;
  disableNoToken: boolean;
}

interface OptionDescriptionForHelpMessage {
  shortForm: string | null;
  longForm: string;
  argumentDescription: string | null;
  description: string;
}

const optionsDescription: OptionDescriptionForHelpMessage[] = [
  {
    shortForm: "cp",
    longForm: "inspector-port",
    argumentDescription: "port",
    description:
      "Port used for inspector-to-server communication.\n" +
      `Defaults to ${DEFAULT_INSPECTOR_PORT}.`,
  },
  {
    shortForm: "dp",
    longForm: "device-port",
    argumentDescription: "port",
    description:
      "Port used for device-to-server communication.\n" +
      `Defaults to ${DEFAULT_DEVICE_PORT}.`,
  },
  {
    shortForm: "f",
    longForm: "create-log-files",
    argumentDescription: null,
    description:
      "If set, a log file will also be written for each token and for each day\n" +
      "(server time) this token is used, in the current directory.",
  },
  {
    shortForm: null,
    longForm: "force-password",
    argumentDescription: "password",
    description:
      "Force the password to be a given string" +
      " (must be alphanumeric, case-sentive)",
  },
  {
    shortForm: null,
    longForm: "no-password",
    argumentDescription: null,
    description: "Disable the usage of a password.",
  },
  {
    shortForm: null,
    longForm: "history-size",
    argumentDescription: "size",
    description:
      "Number of logs kept in memory for each token in case of web inspectors\n(re-)" +
      "connecting after the device already emitted logs.\n" +
      `${DEFAULT_HISTORY_SIZE} by default.`,
  },
  {
    shortForm: null,
    longForm: "max-token-duration",
    argumentDescription: "duration",
    description:
      "Maximum number of seconds a new token is created for, in seconds.\n" +
      `Defaults to ${DEFAULT_MAX_TOKEN_DURATION}.`,
  },
  {
    shortForm: null,
    longForm: "max-log-length",
    argumentDescription: "length",
    description:
      "Maximum length a log can have, in terms of UTF-16 code points.\n" +
      "Longer logs will be skipped.\n" +
      `${DEFAULT_MAX_LOG_LENGTH} by default.`,
  },
  {
    shortForm: null,
    longForm: "wrong-password-limit",
    argumentDescription: "number",
    description:
      "Maximum authorized number of bad passwords received in 24 hours.\n" +
      "Exceeding that limit will stop the server.\n" +
      `Defaults to ${DEFAULT_WRONG_PASSWORD_LIMIT}.`,
  },
  {
    shortForm: null,
    longForm: "inspector-connection-limit",
    argumentDescription: "number",
    description:
      "Maximum authorized number of web inspector connection per 24 hours.\n" +
      "Exceeding that limit will stop the server.\n" +
      `Defaults to ${DEFAULT_INSPECTOR_CONNECTION_LIMIT}.`,
  },
  {
    shortForm: null,
    longForm: "device-connection-limit",
    argumentDescription: "number",
    description:
      "Maximum authorized number of device connection per 24 hours.\n" +
      "Exceeding that limit will stop the server.\n" +
      `Defaults to ${DEFAULT_DEVICE_CONNECTION_LIMIT}.`,
  },
  {
    shortForm: null,
    longForm: "device-message-limit",
    argumentDescription: "number",
    description:
      "Maximum authorized number of message any device (e.g. logs) can send " +
      "per 24 hours.\n" +
      "Exceeding that limit will stop the server.\n" +
      `Defaults to ${DEFAULT_DEVICE_MESSAGE_LIMIT}.`,
  },
  {
    shortForm: null,
    longForm: "inspector-message-limit",
    argumentDescription: "number",
    description:
      "Maximum authorized number of message any web inspector can send per 24 " +
      "hours.\n" +
      "Exceeding that limit will stop the server. " +
      `Defaults to ${DEFAULT_INSPECTOR_MESSAGE_LIMIT}.`,
  },
  {
    shortForm: null,
    longForm: "persistent-tokens-storage",
    argumentDescription: "path",
    description:
      "If set, the RxPaired-server will store information on persistent " +
      "tokens on disk\n" +
      "(at the given path) so they can be retrieved if the server reboots.",
  },
  {
    shortForm: null,
    longForm: "log-file",
    argumentDescription: "path",
    description:
      "Path to the server's log file.\n" +
      `Defaults to ${DEFAULT_LOG_FILE_PATH}.`,
  },
  {
    shortForm: null,
    longForm: "disable-no-token",
    argumentDescription: null,
    description:
      'Disable "no-token" mode, where devices can send logs without having ' +
      "to create\n" +
      'a "token" first through the inspector. ',
  },
];

export default function parseOptions(args: string[]): ParsedOptions {
  if (args.includes("-h") || args.includes("--help")) {
    displayHelp();
    process.exit(0);
  }

  let shouldGeneratePassword = true;
  const parsed: ParsedOptions = {
    inspectorPort: DEFAULT_INSPECTOR_PORT,
    devicePort: DEFAULT_DEVICE_PORT,
    shouldCreateLogFiles: false,
    password: null,
    historySize: DEFAULT_HISTORY_SIZE,
    maxTokenDuration: DEFAULT_MAX_TOKEN_DURATION,
    maxLogLength: DEFAULT_MAX_LOG_LENGTH,
    wrongPasswordLimit: DEFAULT_WRONG_PASSWORD_LIMIT,
    inspectorConnectionLimit: DEFAULT_INSPECTOR_CONNECTION_LIMIT,
    deviceConnectionLimit: DEFAULT_DEVICE_CONNECTION_LIMIT,
    deviceMessageLimit: DEFAULT_DEVICE_MESSAGE_LIMIT,
    inspectorMessageLimit: DEFAULT_INSPECTOR_MESSAGE_LIMIT,
    persistentTokensFile: null,
    logFile: DEFAULT_LOG_FILE_PATH,
    disableNoToken: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg.trim()) {
      case "-cp":
      case "--inspector-port":
        i++;
        parsed.inspectorPort = checkNumberArg(arg, args[i]);
        break;

      case "-dp":
      case "--device-port":
        i++;
        parsed.devicePort = checkNumberArg(arg, args[i]);
        break;

      case "-f":
      case "--create-log-files":
        parsed.shouldCreateLogFiles = true;
        break;

      case "--force-password":
        i++;
        if (args[i] === undefined) {
          console.error(
            `Missing password argument for "--force-password" option.`
          );
          process.exit(1);
        } else if (!/^[A-Za-z0-9]+$/.test(args[i])) {
          console.error(
            `Invalid password argument for "--force-password" option. ` +
              `Must be only alphanumeric characters, got "${args[i]}"`
          );
          process.exit(1);
        } else if (!shouldGeneratePassword) {
          console.error(`Both setting and disabling a password. Exiting`);
          process.exit(1);
        }
        parsed.password = args[i];
        shouldGeneratePassword = false;
        break;

      case "--no-password":
        if (parsed.password !== null) {
          console.error(`Both setting and disabling a password. Exiting`);
          process.exit(1);
        }
        parsed.password = null;
        shouldGeneratePassword = false;
        break;

      case "--history-size":
        i++;
        parsed.historySize = checkNumberArg(arg, args[i]);
        break;

      case "--max-token-duration":
        i++;
        parsed.maxTokenDuration = checkNumberArg(arg, args[i]);
        break;

      case "--max-log-length":
        i++;
        parsed.maxLogLength = checkNumberArg(arg, args[i]);
        break;

      case "--wrong-password-limit":
        i++;
        parsed.wrongPasswordLimit = checkNumberArg(arg, args[i]);
        break;

      case "--inspector-connection-limit":
        i++;
        parsed.inspectorConnectionLimit = checkNumberArg(arg, args[i]);
        break;

      case "--device-connection-limit":
        i++;
        parsed.deviceConnectionLimit = checkNumberArg(arg, args[i]);
        break;

      case "--inspector-message-limit":
        i++;
        parsed.inspectorMessageLimit = checkNumberArg(arg, args[i]);
        break;

      case "--device-message-limit":
        i++;
        parsed.deviceMessageLimit = checkNumberArg(arg, args[i]);
        break;

      case "--persistent-tokens-storage":
        i++;
        if (args[i] === undefined) {
          console.error(
            `Missing password argument for "--persistent-tokens-storage" option.`
          );
          process.exit(1);
        }
        parsed.persistentTokensFile = args[i];
        break;

      case "--log-file":
        i++;
        if (args[i] === undefined) {
          console.error(`Missing password argument for "--log-file" option.`);
          process.exit(1);
        }
        parsed.logFile = args[i];
        break;

      case "--disable-no-token":
        parsed.disableNoToken = true;
        break;

      default:
        console.error(`Unknown option: "${arg}"`);
        process.exit(1);
    }
  }

  if (shouldGeneratePassword) {
    parsed.password = generatePassword();
    console.log("Generated password:", parsed.password);
  }

  return parsed;

  function checkNumberArg(arg: string, val: string | undefined): number {
    const toInt = val === undefined ? NaN : parseInt(val, 10);
    if (isNaN(toInt)) {
      if (val === undefined || val.startsWith("-")) {
        console.error(`Missing port argument for "${arg}" option.`);
      } else {
        console.error(
          `Invalid "${arg}" argument. Expected a number, ` + `ot "${val}".`
        );
      }
      process.exit(1);
    }
    return toInt;
  }
}

/**
 * Display through `console.log` an helping message relative to how to run this
 * script.
 */
function displayHelp() {
  let maxLenOptsName = 0;
  const lines = ["Usage: node RxPaired-inspector.mjs [options]", "Options:"];
  const SPACES_AFTER_OPTIONS = 3;

  const fullOptions = optionsDescription.concat({
    shortForm: "h",
    longForm: "help",
    description: "Display this help information",
    argumentDescription: null,
  });
  for (const option of fullOptions) {
    let str = "";
    if (option.shortForm !== null) {
      str = `-${option.shortForm}`;
      if (option.longForm) {
        str += `, --${option.longForm}`;
      }
    } else {
      str = `--${option.longForm}`;
    }

    if (option.argumentDescription !== null) {
      str += ` <${option.argumentDescription}>`;
    }
    maxLenOptsName = Math.max(maxLenOptsName, str.length);
    lines.push(str);
  }

  let currentLineIdx = 2;
  for (const option of fullOptions) {
    const prevLine = lines[currentLineIdx];
    const nbOfSpaces = maxLenOptsName - prevLine.length + SPACES_AFTER_OPTIONS;
    const newLine =
      prevLine +
      " ".repeat(nbOfSpaces) +
      option.description.replace(
        /\n/g,
        "\n" + " ".repeat(maxLenOptsName + SPACES_AFTER_OPTIONS)
      );
    lines[currentLineIdx] = newLine;
    currentLineIdx++;
  }

  console.log(lines.join("\n"));
}
