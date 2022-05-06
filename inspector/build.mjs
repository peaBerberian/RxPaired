#!/usr/bin/env node

import path from "path";
import process from "process";
import esbuild from "esbuild";
import { fileURLToPath } from 'url';

const currentDirName = getCurrentDirectoryName();

if (
  typeof process.env.npm_config_inspector_debugger_url !== "string" ||
  typeof process.env.npm_config_device_script_url !== "string"
) {
  console.error("Error: Invalid environment variable(s)." + "\n" +
    "Please make sure that you:\n"+
    `  1. Declared an ".npmrc" file in the "${currentDirName}" directory based on ` +
    "the content of the following file: " +
      path.join(currentDirName, ".npmrc.sample") +
    ".\n" +
    "  2. Called this script through an npm script command (e.g. npm run *script*).");
  process.exit(1);
}
let inspectorDebuggerUrl = process.env.npm_config_inspector_debugger_url;
if (!/^(http|ws)s?:\/\//.test(inspectorDebuggerUrl)) {
  console.error("Error: Invalid inspector_debugger_url." + "\n" +
    "Please make sure that this url uses either the http, https, ws or wss.");
  process.exit(1);
}
if (inspectorDebuggerUrl.startsWith("http")) {
  inspectorDebuggerUrl = "ws" + inspectorDebuggerUrl.slice(4);
}

const { argv } = process;
if (argv.includes("-h") || argv.includes("--help")) {
  displayHelp();
  process.exit(0);
}
const shouldWatch = argv.includes("-w") || argv.includes("--watch");
const shouldMinify = argv.includes("-m") || argv.includes("--minify");
buildWebInspector({ minify: shouldMinify, watch: shouldWatch });

/**
 * Build the inspector with the given options.
 * @param {Object} options
 * @param {boolean} [options.minify] - If `true`, the output will be minified.
 * @param {boolean} [options.watch] - If `true`, the files involved
 * will be watched and the code re-built each time one of them changes.
 */
function buildWebInspector(options) {
  const minify = !!options.minify;
  const watch = !!options.watch;
  let beforeTime = process.hrtime.bigint();

  esbuild.build({
    entryPoints: [path.join(currentDirName, "src", "index.ts")],
    bundle: true,
    minify,
    watch: !watch ? undefined : {
      onRebuild(error, result) {
        if (error) {
          console.error(`\x1b[31m[${getHumanReadableHours()}]\x1b[0m Inspector re-build failed:`,
                        err);
        } else {
          if (result.errors > 0 || result.warnings > 0) {
            const { errors, warnings } = result;
            console.log(`\x1b[33m[${getHumanReadableHours()}]\x1b[0m ` +
                        `Inspector re-built with ${errors.length} error(s) and ` +
                        ` ${warnings.length} warning(s) ` +
                        `(in ${stats.endTime - stats.startTime} ms).`);
          }
          console.log(`\x1b[32m[${getHumanReadableHours()}]\x1b[0m ` +
                      "Inspector re-built!");
        }
      },
    },
    outfile: path.join(currentDirName, "inspector.js"),
    define: {
      _INSPECTOR_DEBUGGER_URL_: JSON.stringify(inspectorDebuggerUrl),
      __DEVICE_SCRIPT_URL__: JSON.stringify(process.env.npm_config_device_script_url),
    }
  }).then(
  (result) => {
    if (result.errors > 0 || result.warnings > 0) {
      const { errors, warnings } = result;
      console.log(`\x1b[33m[${getHumanReadableHours()}]\x1b[0m ` +
                  `Inspector built with ${errors.length} error(s) and ` +
                  ` ${warnings.length} warning(s) ` +
                  `(in ${stats.endTime - stats.startTime} ms).`);
    }
    const fullTime = (process.hrtime.bigint() - beforeTime) / 1000000n;
    console.log(`\x1b[32m[${getHumanReadableHours()}]\x1b[0m ` +
                `Inspector build done in ${fullTime}ms`);
  },
  (err) => {
    console.error(`\x1b[31m[${getHumanReadableHours()}]\x1b[0m Inspector build failed:`,
                  err);
    process.exit(1);
  });
}

/**
 * Returns the current time in a human-readable format.
 * @returns {string}
 */
function getHumanReadableHours() {
  const date = new Date();
  return String(date.getHours()).padStart(2, "0") + ":" +
    String(date.getMinutes()).padStart(2, "0") + ":" +
    String(date.getSeconds()).padStart(2, "0") + "." +
    String(date.getMilliseconds()).padStart(4, "0");
};

/**
 * Display through `console.log` an helping message relative to how to run this
 * script.
 */
function displayHelp() {
  console.log(
  /* eslint-disable indent */
`Usage: node build.js [options]
Options:
  -h, --help             Display this help
  -m, --minify           Minify the built demo
  -w, --watch            Re-build each time either the demo or library files change`,
  /* eslint-enable indent */
  );
}

/**
 * Returns the path to the directory where the current script is found.
 * @returns {String}
 */
function getCurrentDirectoryName() {
  return path.dirname(fileURLToPath(import.meta.url));
}
