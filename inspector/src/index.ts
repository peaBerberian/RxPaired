import { ConfigState, MODULE_CONFIG_LS_ITEM, STATE_PROPS } from "./constants";
import ObservableState, { UPDATE_TYPE } from "./observable_state";
import generateLiveDebuggingPage from "./pages/live_debugging";
import generatePasswordPage from "./pages/password";
import generatePostAnalysisPage from "./pages/post-analysis";
import generateTokenPage from "./pages/token";
import { checkTokenValidity } from "./utils";

window.addEventListener("hashchange", () => { window.location.reload(); });

const configState = new ObservableState<ConfigState>();
configState.subscribe(STATE_PROPS.CSS_MODE, () => {
  if (configState.getCurrentState(STATE_PROPS.CSS_MODE) === "dark") {
    document.body.classList.replace("light", "dark");
  } else {
    document.body.classList.replace("dark", "light");
  }
});

initializeGlobalConfig();

// format of the hash:
// #!pass=<SERVER_SIDE_CHECKED_PASSWORD>!token=<TOKEN>
// The password is mandatory, the token is only set if it has been generated.
const initialHashValues = window.location.hash.split("!");
const isPost = initialHashValues.filter((val) => val.startsWith("post"))[0];
const passStr = initialHashValues.filter((val) => val.startsWith("pass="))[0];

if (isPost) {
  generatePostAnalysisPage(configState);
} else if (passStr === undefined || passStr.length < 6) {
  generatePasswordPage();
} else {
  const password = passStr.substring("pass=".length);
  const tokenStr = initialHashValues.filter((val) => val.startsWith("token="))[0];
  if (tokenStr === undefined) {
    generateTokenPage(password);
  } else {
    const tokenId = tokenStr.substring("token=".length);
    checkTokenValidity(tokenId);
    generateLiveDebuggingPage(password, tokenId, configState);
  }
}

/**
 * @param {Object} configState
 */
function initializeGlobalConfig() {
  let currentModuleConfig : ConfigState = {};
  const storedModulesInfo = localStorage.getItem(MODULE_CONFIG_LS_ITEM);
  if (typeof storedModulesInfo === "string") {
    try {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      currentModuleConfig = JSON.parse(storedModulesInfo);
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    } catch (err) {
      console.error("Could not parse previous stored module config", err);
    }
  }

  let currentMode = configState.getCurrentState(STATE_PROPS.CSS_MODE);
  if (currentMode === undefined) {
    currentMode = localStorage.getItem(STATE_PROPS.CSS_MODE) === "dark" ?
      "dark" :
      "light";
  }

  configState.updateState(STATE_PROPS.CSS_MODE, UPDATE_TYPE.REPLACE, currentMode);
  configState.updateState(
    STATE_PROPS.CLOSED_MODULES,
    UPDATE_TYPE.REPLACE,
    currentModuleConfig[STATE_PROPS.CLOSED_MODULES] ?? []
  );
  configState.updateState(
    STATE_PROPS.WIDTH_RATIOS,
    UPDATE_TYPE.REPLACE,
    currentModuleConfig[STATE_PROPS.WIDTH_RATIOS] ?? {}
  );
  configState.updateState(
    STATE_PROPS.MINIMIZED_MODULES,
    UPDATE_TYPE.REPLACE,
    currentModuleConfig[STATE_PROPS.MINIMIZED_MODULES] ?? []
  );
  configState.updateState(
    STATE_PROPS.MODULES_ORDER,
    UPDATE_TYPE.REPLACE,
    currentModuleConfig[STATE_PROPS.MODULES_ORDER] ?? []
  );
  configState.commitUpdates();
  configState.subscribe(STATE_PROPS.CSS_MODE, () => {
    const isDark = configState.getCurrentState(STATE_PROPS.CSS_MODE) === "dark";
    localStorage.setItem(STATE_PROPS.CSS_MODE, isDark ? "dark" : "light");
  });
  configState.subscribe(STATE_PROPS.CLOSED_MODULES, () => {
    const closedModules = configState.getCurrentState(STATE_PROPS.CLOSED_MODULES) ?? [];
    currentModuleConfig[STATE_PROPS.CLOSED_MODULES] = closedModules;
    localStorage.setItem(MODULE_CONFIG_LS_ITEM, JSON.stringify(currentModuleConfig));
  });
  configState.subscribe(STATE_PROPS.WIDTH_RATIOS, () => {
    const closedModules = configState.getCurrentState(STATE_PROPS.WIDTH_RATIOS) ?? {};
    currentModuleConfig[STATE_PROPS.WIDTH_RATIOS] = closedModules;
    localStorage.setItem(MODULE_CONFIG_LS_ITEM, JSON.stringify(currentModuleConfig));
  });
  configState.subscribe(STATE_PROPS.MINIMIZED_MODULES, () => {
    const closedModules = configState
      .getCurrentState(STATE_PROPS.MINIMIZED_MODULES) ?? [];
    currentModuleConfig[STATE_PROPS.MINIMIZED_MODULES] = closedModules;
    localStorage.setItem(MODULE_CONFIG_LS_ITEM, JSON.stringify(currentModuleConfig));
  });
  configState.subscribe(STATE_PROPS.MODULES_ORDER, () => {
    const closedModules = configState.getCurrentState(STATE_PROPS.MODULES_ORDER) ?? [];
    currentModuleConfig[STATE_PROPS.MODULES_ORDER] = closedModules;
    localStorage.setItem(MODULE_CONFIG_LS_ITEM, JSON.stringify(currentModuleConfig));
  });
}
