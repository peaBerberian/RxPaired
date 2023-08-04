import { InspectorState, STATE_PROPS } from "../constants";
import { createCompositeElement, createElement } from "../dom-utils";
import ObservableState from "../observable_state";

export default function StateChangeInformationModule({
  state,
}: {
  state: ObservableState<InspectorState>;
}) {
  const stateHistoryElt = createElement("div", {
    textContent: "No state information",
  });
  const moduleBodyElt = createCompositeElement("div", [stateHistoryElt], {
    className: "state-history-body module-body",
  });
  const unsubscribeHistory = state.subscribe(
    STATE_PROPS.STATE_CHANGE_HISTORY,
    () => {
      stateHistoryElt.innerHTML = "";

      // TODO more optimized: rely on push
      const stateHistory = state.getCurrentState(
        STATE_PROPS.STATE_CHANGE_HISTORY
      );

      if (stateHistory === undefined) {
        displayNoStateInformation();
        return;
      }

      const tableElt = createElement("table");
      const firstTableRowElt = createCompositeElement("tr", [
        createElement("th", {
          textContent: "State",
        }),
        createElement("th", {
          textContent: "TS",
        }),
        createElement("th", {
          textContent: "Diff since prev.",
        }),
      ]);
      tableElt.appendChild(firstTableRowElt);
      for (let i = stateHistory?.length - 1; i >= 0; i--) {
        const stateInfo = stateHistory[i];
        tableElt.appendChild(
          createCompositeElement("tr", [
            createElement("td", {
              textContent: stateInfo.state,
            }),
            createElement("td", {
              textContent: String(stateInfo.timestamp),
            }),
            createElement("td", {
              textContent: String(
                i === 0
                  ? "-"
                  : (stateInfo.timestamp - stateHistory[i - 1].timestamp).toFixed(2)
              ),
            }),
          ])
        );
      }
      if (tableElt.childNodes.length === 1) {
        displayNoStateInformation();
        return;
      }
      stateHistoryElt.appendChild(tableElt);
      moduleBodyElt.classList.remove("empty");
    },
    true
  );
  return {
    body: moduleBodyElt,
    destroy() {
      unsubscribeHistory();
    },
  };

  function displayNoStateInformation() {
    stateHistoryElt.textContent = "No state information";
    moduleBodyElt.classList.add("empty");
  }
}
