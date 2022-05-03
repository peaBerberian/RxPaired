import { InspectorState, MAX_DISPLAYED_LOG_ELEMENTS, STATE_PROPS } from "../constants";
import { createElement } from "../dom-utils";
import ObservableState, { UPDATE_TYPE } from "../observable_state";

/**
 * @param {Object} args
 */
export default function LogModule(
  { state } : { state : ObservableState<InspectorState> }
) {
  const logContainerElt = createElement("div", {
    className: "log-body module-body",
  });
  const unsubscribe = state.subscribe(STATE_PROPS.LOGS_HISTORY, (updateType, values) => {
    if (values === undefined) {
      logContainerElt.innerHTML = "";
      return;
    }
    if (updateType === UPDATE_TYPE.REPLACE) {
      logContainerElt.innerHTML = "";
      values.forEach(val => onNewLog(val, logContainerElt));
    } else {
      values.forEach(val => onNewLog(val, logContainerElt));
    }
  });

  return {
    body: logContainerElt,
    clear() {
      if (logContainerElt !== undefined) {
        // selectedLogElt = null;
        logContainerElt.innerHTML = "";
      }
    },
    destroy() {
      unsubscribe();
    },
  };
}

/**
 * @param {string} logTxt
 * @param {HTMLElement} logContainerElt
 */
export function onNewLog(
  logTxt : string,
  logContainerElt : HTMLElement
) : void {
  let namespace;
  let formattedMsg = logTxt;
  const indexOfNamespaceStart = logTxt.indexOf("[");
  if (indexOfNamespaceStart >= 0) {
    const indexOfNamespaceEnd = logTxt.indexOf("]");
    if (indexOfNamespaceEnd > 0) {
      namespace = logTxt.substring(indexOfNamespaceStart + 1, indexOfNamespaceEnd);
      formattedMsg = logTxt.replace(/\n/g, "\n" + " ".repeat(indexOfNamespaceEnd + 2));
    }
  }
  while (logContainerElt.children.length > MAX_DISPLAYED_LOG_ELEMENTS - 1) {
    logContainerElt.removeChild(logContainerElt.children[0]);
  }

  const hasVerticalScrollbar =
    logContainerElt.scrollHeight > logContainerElt.clientHeight;
  const wasScrolledToBottom = !hasVerticalScrollbar ||
    logContainerElt.scrollHeight -
      logContainerElt.clientHeight <= logContainerElt.scrollTop + 5;

  const preElt = document.createElement("pre");
  preElt.textContent = formattedMsg;
  if (namespace !== undefined) {
    preElt.className = "log-line log-" + namespace.toLowerCase();
  } else {
    preElt.className = "log-line log-unknown";
  }
  // preElt.onclick = () => {
  //   if (selectedLogElt !== null) {
  //     selectedLogElt.classList.remove("focused");
  //     if (selectedLogElt === preElt) {
  //       selectedLogElt = null;
  //       return;
  //     }
  //   }
  //   selectedLogElt = preElt;
  //   preElt.classList.add("focused");
  // };
  logContainerElt.appendChild(preElt);
  if (wasScrolledToBottom) {
    logContainerElt.scrollTop = logContainerElt.scrollHeight;
  }
}

