import strHtml from "str-html";
import { ConfigState, STATE_PROPS } from "../constants";
import ObservableState, { UPDATE_TYPE } from "../observable_state";
import { getDefaultModuleOrder } from "../utils";

/**
 * Returns an HTML element corresponding to the light/dark mode button.
 * @param {Object} configState
 * @returns {HTMLButtonElement}
 */
export function createDarkLightModeButton(
  configState: ObservableState<ConfigState>,
): HTMLButtonElement {
  const buttonElt =
    strHtml`<button class="btn-dark-light-mode" />` as HTMLButtonElement;
  let isDark: boolean;
  configState.subscribe(
    STATE_PROPS.CSS_MODE,
    () => {
      isDark = configState.getCurrentState(STATE_PROPS.CSS_MODE) === "dark";
      if (isDark) {
        document.body.classList.replace("light", "dark");
        buttonElt.textContent = "☼ Light mode";
      } else {
        document.body.classList.replace("dark", "light");
        buttonElt.textContent = "🌘 Dark mode";
      }
    },
    true,
  );
  buttonElt.onclick = function () {
    configState.updateState(
      STATE_PROPS.CSS_MODE,
      UPDATE_TYPE.REPLACE,
      isDark ? "light" : "dark",
    );
    configState.commitUpdates();
  };
  return buttonElt;
}

/**
 * @param {Object} configState
 * @returns {HTMLElement}
 */
export function createClearStoredConfigButton(
  configState: ObservableState<ConfigState>,
): HTMLElement {
  const buttonElt = document.createElement("button");
  buttonElt.textContent = "🧹 Clear page config";
  buttonElt.onclick = function () {
    // TODO "clear" `updateType` and clearing all but module-related config?
    configState.updateState(
      STATE_PROPS.CLOSED_MODULES,
      UPDATE_TYPE.REPLACE,
      [],
    );
    configState.updateState(
      STATE_PROPS.MINIMIZED_MODULES,
      UPDATE_TYPE.REPLACE,
      [],
    );
    configState.updateState(STATE_PROPS.WIDTH_RATIOS, UPDATE_TYPE.REPLACE, {});
    configState.updateState(
      STATE_PROPS.MODULES_ORDER,
      UPDATE_TYPE.REPLACE,
      getDefaultModuleOrder(),
    );
    configState.commitUpdates();
  };
  configState.subscribe(STATE_PROPS.CLOSED_MODULES, check);
  configState.subscribe(STATE_PROPS.MODULES_ORDER, check);
  configState.subscribe(STATE_PROPS.MINIMIZED_MODULES, check);
  configState.subscribe(STATE_PROPS.WIDTH_RATIOS, check);
  check();

  function check() {
    const closedModules =
      configState.getCurrentState(STATE_PROPS.CLOSED_MODULES) ?? [];
    const minimizedModules =
      configState.getCurrentState(STATE_PROPS.MINIMIZED_MODULES) ?? [];
    const widthRatios =
      configState.getCurrentState(STATE_PROPS.WIDTH_RATIOS) ?? {};
    const modulesOrder =
      configState.getCurrentState(STATE_PROPS.MODULES_ORDER) ?? [];
    const defaultModuleOrder = getDefaultModuleOrder();
    const hasDefaultModuleOrder =
      modulesOrder.length === defaultModuleOrder.length &&
      modulesOrder.every(
        (moduleId: string, index: number) =>
          moduleId === defaultModuleOrder[index],
      );
    buttonElt.disabled =
      closedModules.length === 0 &&
      minimizedModules.length === 0 &&
      Object.keys(widthRatios).length === 0 &&
      hasDefaultModuleOrder;
  }
  return buttonElt;
}

export function createTimeRepresentationSwitch(logView: ObservableState<ConfigState>) {
  const isTimestamp = true; // otherwise it's a date
  const timeLabel = "Display: 🕒 Time";
  const dateLabel = "Display: 🗓️ Date";
  const label = strHtml`<label for="timeRepresentation">${isTimestamp ? timeLabel : dateLabel}</label>`;
  const checkbox = strHtml`<input
    type="checkbox"
    name="timeRepresentation"
    id="timeRepresentation"
    value="${isTimestamp}"
  />` as HTMLInputElement
  function onChange(): void {
    label.innerText = checkbox.checked ?  dateLabel : timeLabel;
    logView.updateState(
      STATE_PROPS.TIME_REPRESENTATION,
      UPDATE_TYPE.REPLACE,
      checkbox.checked ? "date" : "timestamp",
    );
    logView.commitUpdates();
  }
  checkbox.onchange = onChange;
  const wrapper = strHtml`<span></span>`;
  wrapper.appendChild(label);
  wrapper.appendChild(checkbox);
  return wrapper;
}
