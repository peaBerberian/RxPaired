import { ConfigState, InspectorState, STATE_PROPS } from "./constants";
import {
  createButton,
  createCompositeElement,
  createElement,
} from "./dom-utils";
import modules, { ModuleInformation } from "./modules/index";
import ObservableState, { UPDATE_TYPE } from "./observable_state";
import {
  closeSvg,
  fullWidthSvg,
  halfWidthSvg,
  maximizeSvg,
  minimizeSvg,
  moveDownSvg,
  moveUpSvg,
} from "./svg";
import { getDefaultModuleOrder } from "./utils";

/**
 * @param {Object} config
 */
export default function createModules({
  containerElt,
  context,
  tokenId,
  configState,
  inspectorState,
} : {
  containerElt : HTMLElement;
  tokenId? : string | undefined;
  configState : ObservableState<ConfigState>;
  inspectorState : ObservableState<InspectorState>;
  context : "live-debugging" | "post-analysis";
}) : void {
  let storedModulesOrder = configState.getCurrentState(STATE_PROPS.MODULES_ORDER) ?? [];
  if (storedModulesOrder.length === 0) {
    storedModulesOrder = getDefaultModuleOrder();
    configState.updateState(STATE_PROPS.MODULES_ORDER,
                            UPDATE_TYPE.REPLACE,
                            storedModulesOrder);
    configState.commitUpdates();
  }

  let someModuleWasMissing = false;
  const modulesInOrder = [];
  const leftModulesToIterateOn = modules
    .filter(({ contexts }) => contexts.includes(context));
  for (const storedModuleId of storedModulesOrder) {
    const index = leftModulesToIterateOn
      .findIndex(({ moduleId }) => moduleId === storedModuleId);
    if (index !== -1) {
      modulesInOrder.push(leftModulesToIterateOn[index]);
      leftModulesToIterateOn.splice(index, 1);
    } else {
      console.warn(`Stored module id ${storedModuleId} does not exist anymore`);
      someModuleWasMissing = true;
    }
  }

  // Add all unfound modules at the end
  modulesInOrder.push(...leftModulesToIterateOn);

  if (someModuleWasMissing || leftModulesToIterateOn.length > 0) {
    // ♫ And I'm not the kind that likes to tell you
    // Just what you want me to ♫
    const newOrder = modulesInOrder.map(({ moduleId }) => moduleId);
    configState.updateState(STATE_PROPS.MODULES_ORDER, UPDATE_TYPE.REPLACE, newOrder);
  }
  configState.commitUpdates();

  for (const moduleInfo of modulesInOrder) {
    const moduleWrapperElt = createModule(moduleInfo);
    if (moduleWrapperElt !== null) {
      moduleWrapperElt.dataset.moduleId = moduleInfo.moduleId;
      containerElt.appendChild(moduleWrapperElt);
    }
  }

  configState.subscribe(STATE_PROPS.MODULES_ORDER, () => {
    let moduleWrapperElts = containerElt.getElementsByClassName("module-wrapper");
    const newModuleIdOrder = configState.getCurrentState(STATE_PROPS.MODULES_ORDER) ?? [];

    let modWrapIdx;
    for (modWrapIdx = 0; modWrapIdx < moduleWrapperElts.length; modWrapIdx++) {
      // TODO better check than the `as`
      const moduleWrapperElt = moduleWrapperElts[modWrapIdx] as HTMLElement;
      const moduleId = moduleWrapperElt.dataset.moduleId;
      if (moduleId === undefined) {
        console.error("An element has an unknown module id");
        return;
      } else if (!newModuleIdOrder.includes(moduleId)) {
        containerElt.removeChild(moduleWrapperElt);
        moduleWrapperElts = containerElt.getElementsByClassName("module-wrapper");
        modWrapIdx--;
      } else if (modWrapIdx >= newModuleIdOrder.length) {
        console.error("There should not be more modules than the wanted ones");
        return;
      } else {
        const expectedModuleId = newModuleIdOrder[modWrapIdx];
        if (expectedModuleId !== moduleId) {
          let expectedElement;
          for (let innerIdx = 0; innerIdx < moduleWrapperElts.length; innerIdx++) {
            // TODO better check than the `as`
            const elt = moduleWrapperElts[innerIdx] as HTMLElement;
            if (elt.dataset.moduleId === expectedModuleId) {
              expectedElement = elt;
            }
          }
          if (expectedElement === undefined) {
            const moduleInfo = modules
              .find(({ moduleId: modId }) => modId === expectedModuleId);
            if (moduleInfo === undefined) {
              console.error(`Module "${expectedModuleId}" unfound`);
              return ;
            } else {
              const newWrapperElt = createModule(moduleInfo);
              if (newWrapperElt !== null) {
                newWrapperElt.dataset.moduleId = moduleInfo.moduleId;
                containerElt.insertBefore(newWrapperElt, moduleWrapperElts[modWrapIdx]);
                moduleWrapperElts = containerElt.getElementsByClassName("module-wrapper");
              }
            }
          } else {
            containerElt.insertBefore(expectedElement, moduleWrapperElts[modWrapIdx]);
            moduleWrapperElts = containerElt.getElementsByClassName("module-wrapper");
          }
        }
      }
    }

    for (let newModIdx = modWrapIdx; newModIdx < newModuleIdOrder.length; newModIdx++) {
      const moduleId = newModuleIdOrder[newModIdx];
      const moduleInfo = modules
        .find(({ moduleId: modId }) => modId === moduleId);
      if (moduleInfo === undefined) {
        console.error(`Module "${moduleId}" unfound`);
        return ;
      } else {
        const newWrapperElt = createModule(moduleInfo);
        if (newWrapperElt !== null) {
          newWrapperElt.dataset.moduleId = moduleInfo.moduleId;
          containerElt.appendChild(newWrapperElt);
          moduleWrapperElts = containerElt.getElementsByClassName("module-wrapper");
        }
      }
    }
  });

  function createModule(moduleInfo : ModuleInformation) {
    const moduleContext = { tokenId, state : inspectorState, configState };
    const { moduleFn, moduleTitle, moduleId, isClosable } = moduleInfo;
    const isClosed = (configState.getCurrentState(STATE_PROPS.CLOSED_MODULES) ?? [])
      .includes(moduleId);
    if (isClosed) {
      putModuleInClosedElements();
      return null;
    }
    const moduleRes = moduleFn(moduleContext);
    if (moduleRes === null) {
      return null;
    }
    const {
      body,
      clear,
      destroy,
    } = moduleRes;
    if (!(body instanceof HTMLElement)) {
      throw new Error("A module's body should be an HTMLElement");
    }

    const moduleWrapperElt = createElement("div", { className: "module-wrapper" });
    body.classList.add("module-body");
    const buttons = [];
    const resizeWidthButtonElt = createButton({ className: "btn-width-resize" });
    buttons.push(resizeWidthButtonElt);
    const moveDownButton = createButton({
      className: "btn-move-down-module",
      title: "Move the module one level down",
      onClick: moveModuleDown,
    });
    moveDownButton.innerHTML = moveDownSvg;
    buttons.push(moveDownButton);
    const moveUpButton = createButton({
      className: "btn-move-up-module",
      title: "Move the module one level up",
      onClick: moveModuleUp,
    });
    moveUpButton.innerHTML = moveUpSvg;
    buttons.push(moveUpButton);

    if (typeof clear === "function") {
      const clearButton = createButton({
        className: "btn-clear-module",
        textContent: "🚫",
        title: "Clear content of this module",
        onClick: clear,
      });
      buttons.push(clearButton);
    }
    const minimizedButtonElt = createButton({ className: "btn-min-max-module" });
    buttons.push(minimizedButtonElt);
    if (isClosable) {
      buttons.push(createClosingButton());
    }
    const moduleTitleElt = createCompositeElement("div", [
      createElement("span", {
        textContent: moduleTitle ?? "Unnamed module",
        className: "module-title-text",
      }),
      createCompositeElement("span", buttons, { className: "module-title-buttons" }),
    ], { className: "module-title" });
    moduleWrapperElt.appendChild(moduleTitleElt);
    moduleWrapperElt.appendChild(body);

    let currentDisplayedWidthRatio : number | undefined;
    let isModuleCurrentlyMinimized : boolean | undefined;
    configState.subscribe(STATE_PROPS.CLOSED_MODULES, onModuleClosing);
    configState.subscribe(STATE_PROPS.MINIMIZED_MODULES, onMinimizedModule, true);
    configState.subscribe(STATE_PROPS.WIDTH_RATIOS, onWidthRatioChange, true);
    configState.subscribe(STATE_PROPS.MODULES_ORDER, onModuleOrderChange, true);

    return moduleWrapperElt;

    function onModuleOrderChange() {
      const moduleIdOrder = configState.getCurrentState(STATE_PROPS.MODULES_ORDER);
      moveUpButton.disabled = moduleId === moduleIdOrder?.[0];
      moveDownButton.disabled = moduleId === moduleIdOrder?.[moduleIdOrder.length - 1];
    }

    function onWidthRatioChange() {
      const widthRatios = configState.getCurrentState(STATE_PROPS.WIDTH_RATIOS);
      const newWidthRatio = widthRatios?.[moduleId] ??
        (moduleInfo.isHalfWidthByDefault ? 2 : 1) ??
        1;

      if (newWidthRatio === currentDisplayedWidthRatio) {
        return;
      }

      currentDisplayedWidthRatio = newWidthRatio;
      if (currentDisplayedWidthRatio === 2) {
        moduleWrapperElt.style.width = "calc(50% - 12px)";
        resizeWidthButtonElt.innerHTML = fullWidthSvg;
        resizeWidthButtonElt.title = "Take full width";
        resizeWidthButtonElt.onclick = () => {
          const lastWidthRatios = configState.getCurrentState(STATE_PROPS.WIDTH_RATIOS);
          if (lastWidthRatios !== undefined) {
            lastWidthRatios[moduleId] = 1;
          }
          configState.updateState(STATE_PROPS.WIDTH_RATIOS,
                                  UPDATE_TYPE.REPLACE,
                                  lastWidthRatios);
          configState.commitUpdates();
        };
      } else {
        moduleWrapperElt.style.width = "100%";
        resizeWidthButtonElt.innerHTML = halfWidthSvg;
        resizeWidthButtonElt.title = "Take half width";
        resizeWidthButtonElt.onclick = () => {
          const lastWidthRatios = configState.getCurrentState(STATE_PROPS.WIDTH_RATIOS);
          if (lastWidthRatios !== undefined) {
            lastWidthRatios[moduleId] = 2;
          }
          configState.updateState(STATE_PROPS.WIDTH_RATIOS,
                                  UPDATE_TYPE.REPLACE,
                                  lastWidthRatios);
          configState.commitUpdates();
        };
      }
    }

    function onMinimizedModule() {
      const isMinimized =
        (configState.getCurrentState(STATE_PROPS.MINIMIZED_MODULES) ?? [])
          .includes(moduleId);
      if (isModuleCurrentlyMinimized === isMinimized) {
        return;
      }
      isModuleCurrentlyMinimized = isMinimized;
      if (isModuleCurrentlyMinimized) {
        body.style.display = "none";
        minimizedButtonElt.title = "Maximize this module";
        minimizedButtonElt.innerHTML = maximizeSvg;
        minimizedButtonElt.onclick = () => {
          removeModuleIdFromState(configState, moduleId, STATE_PROPS.MINIMIZED_MODULES);
          configState.commitUpdates();
        };
      } else {
        body.style.display = "block";
        minimizedButtonElt.title = "Minimize this module";
        minimizedButtonElt.innerHTML = minimizeSvg;

        minimizedButtonElt.onclick = () => {
          addModuleIdToState(configState, moduleId, STATE_PROPS.MINIMIZED_MODULES);
          configState.commitUpdates();
        };
      }
    }

    function onModuleClosing(
      _updateType : UPDATE_TYPE,
      value : string[] | undefined
    ) : void {
      if (value === undefined || !value.includes(moduleId)) {
        return;
      }

      configState.unsubscribe(STATE_PROPS.CLOSED_MODULES, onModuleClosing);
      configState.unsubscribe(STATE_PROPS.MINIMIZED_MODULES, onMinimizedModule);
      configState.unsubscribe(STATE_PROPS.WIDTH_RATIOS, onWidthRatioChange);
      configState.unsubscribe(STATE_PROPS.MODULES_ORDER, onModuleOrderChange);
      if (typeof destroy === "function") {
        destroy();
      } else if (destroy !== undefined) {
        console.error("Module: `destroy` should either be a function or undefined");
      }
      const parent = moduleWrapperElt.parentElement;
      if (parent !== null) {
        parent.removeChild(moduleWrapperElt);
      }

      putModuleInClosedElements();
      configState.commitUpdates();
    }

    function moveModuleUp() {
      const modulesOrder = configState.getCurrentState(STATE_PROPS.MODULES_ORDER) ?? [];
      const indexOfModuleId = modulesOrder.indexOf(moduleId);
      if (indexOfModuleId === 0) {
        return;
      }
      if (indexOfModuleId === -1) {
        modulesOrder.push(moduleId);
      } else {
        modulesOrder[indexOfModuleId] = modulesOrder[indexOfModuleId - 1];
        modulesOrder[indexOfModuleId - 1] = moduleId;
      }
      configState.updateState(STATE_PROPS.MODULES_ORDER,
                              UPDATE_TYPE.REPLACE,
                              modulesOrder);
      configState.commitUpdates();
    }

    function moveModuleDown() {
      const modulesOrder = configState.getCurrentState(STATE_PROPS.MODULES_ORDER) ?? [];
      const indexOfModuleId = modulesOrder.indexOf(moduleId);
      if (indexOfModuleId === modulesOrder.length - 1) {
        return;
      }
      if (indexOfModuleId === -1) {
        modulesOrder.push(moduleId);
      } else {
        modulesOrder[indexOfModuleId] = modulesOrder[indexOfModuleId + 1];
        modulesOrder[indexOfModuleId + 1] = moduleId;
      }
      configState.updateState(STATE_PROPS.MODULES_ORDER,
                              UPDATE_TYPE.REPLACE,
                              modulesOrder);
      configState.commitUpdates();
    }

    // function moveModuleOnPageBottom() {
    //   const modulesOrder = configState.getCurrentState(STATE_PROPS.MODULES_ORDER);
    //   const indexOfModuleId = modulesOrder.indexOf(moduleId);
    //   if (indexOfModuleId === modulesOrder.length - 1) {
    //     return;
    //   }
    //   if (indexOfModuleId !== -1) {
    //     modulesOrder.splice(indexOfModuleId, 1);
    //   }
    //   modulesOrder.push(moduleId);
    //   configState.updateState(STATE_PROPS.MODULES_ORDER,
    //                           UPDATE_TYPE.REPLACE,
    //                           modulesOrder);
    //   configState.commitUpdates();
    // }

    // function moveModuleOnPageTop() {
    //   const modulesOrder = configState.getCurrentState(STATE_PROPS.MODULES_ORDER);
    //   const indexOfModuleId = modulesOrder.indexOf(moduleId);
    //   if (indexOfModuleId === modulesOrder.length - 1) {
    //     return;
    //   }
    //   if (indexOfModuleId !== -1) {
    //     modulesOrder.splice(indexOfModuleId, 1);
    //   }
    //   modulesOrder.unshift(moduleId);
    //   configState.updateState(STATE_PROPS.MODULES_ORDER,
    //                           UPDATE_TYPE.REPLACE,
    //                           modulesOrder);
    //   configState.commitUpdates();
    // }

    function createClosingButton() {
      const button = createButton({
        className: "btn-close-module",
        title: "Close this module",
        onClick() {
          addModuleIdToState(configState, moduleId, STATE_PROPS.CLOSED_MODULES);
          removeModuleIdFromState(configState, moduleId, STATE_PROPS.MODULES_ORDER);
          configState.commitUpdates();
        },
      });
      button.innerHTML = closeSvg;
      return button;
    }

    function putModuleInClosedElements() {
      let closedElements = document.getElementsByClassName("closed-modules")[0];
      if (closedElements === undefined) {
        closedElements = createCompositeElement("div", [
          createElement("span", {
            textContent: "Closed modules (click to re-open)",
            className: "closed-modules-title",
          }),
        ], { className: "closed-modules" });
        document.body.appendChild(closedElements);
      }

      const closedModuleNameElt = createElement("span", {
        className: "closed-module-elt",
        textContent: moduleTitle,
      });

      const unsub = configState
        .subscribe(STATE_PROPS.CLOSED_MODULES, (updateType : string) => {
          if (updateType === UPDATE_TYPE.PUSH) {
            return;
          }
          const closedModules = configState
            .getCurrentState(STATE_PROPS.CLOSED_MODULES) ?? [];
          if (closedModules.includes(moduleId)) {
            return;
          }
          reOpenClosedModule();
        });

      closedModuleNameElt.onclick = () => {
        removeModuleIdFromState(configState, moduleId, STATE_PROPS.CLOSED_MODULES);
        reOpenClosedModule();
      };
      closedElements.appendChild(closedModuleNameElt);

      // Un-minimize module if it was
      removeModuleIdFromState(configState, moduleId, STATE_PROPS.MINIMIZED_MODULES);
      removeModuleIdFromState(configState, moduleId, STATE_PROPS.MODULES_ORDER);
      configState.commitUpdates();

      function reOpenClosedModule() {
        unsub();
        if (closedModuleNameElt.parentElement !== null) {
          closedModuleNameElt.parentElement.removeChild(closedModuleNameElt);
        }
        const remainingClosedModules =
          document.body.getElementsByClassName("closed-module-elt");
        if (
          remainingClosedModules.length === 0 &&
          closedElements.parentElement !== null
        ) {
          closedElements.parentElement.removeChild(closedElements);
        }
        addModuleIdToState(configState, moduleId, STATE_PROPS.MODULES_ORDER);
        configState.commitUpdates();
      }
    }
  }
}

/**
 * @param {Object} configState
 * @param {string} moduleId
 * @param {string} stateName
 */
function removeModuleIdFromState(
  configState : ObservableState<ConfigState>,
  moduleId : string,
  stateName : STATE_PROPS.MODULES_ORDER |
              STATE_PROPS.CLOSED_MODULES |
              STATE_PROPS.MINIMIZED_MODULES
) {
  const arr = configState.getCurrentState(stateName);
  if (arr === undefined) {
    return;
  }
  const indexOfModuleId = arr.indexOf(moduleId);
  if (indexOfModuleId !== -1) {
    arr.splice(indexOfModuleId, 1);
    configState.updateState(stateName, UPDATE_TYPE.REPLACE, arr);
  }
}

/**
 * @param {Object} configState
 * @param {string} moduleId
 * @param {string} stateName
 */
function addModuleIdToState(
  configState : ObservableState<ConfigState>,
  moduleId : string,
  stateName : STATE_PROPS.MODULES_ORDER |
              STATE_PROPS.CLOSED_MODULES |
              STATE_PROPS.MINIMIZED_MODULES
) {
  const arr = configState.getCurrentState(stateName) ?? [];
  if (!arr.includes(moduleId)) {
    arr.push(moduleId);
    configState.updateState(stateName, UPDATE_TYPE.REPLACE, arr);
  }
}
