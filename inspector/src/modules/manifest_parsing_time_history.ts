import { InspectorState, STATE_PROPS } from "../constants";
import { createCompositeElement, createElement } from "../dom-utils";
import ObservableState from "../observable_state";

const MAX_ELEMENTS = 50;

export default function ManifestParsingTimeHistoryModule({
  state,
}: {
  state: ObservableState<InspectorState>;
}) {
  const manifestParsingHistoryElt = createElement("div", {
    textContent: "No manifest parsing information",
  });
  const moduleBodyElt = createCompositeElement(
    "div",
    [manifestParsingHistoryElt],
    {
      className: "state-history-body module-body",
    }
  );
  const unsubscribeHistory = state.subscribe(
    STATE_PROPS.MANIFEST_PARSING_TIME_HISTORY,
    () => {
      manifestParsingHistoryElt.innerHTML = "";

      // TODO more optimized: rely on push
      const manifestParsingTimeHistory = state.getCurrentState(
        STATE_PROPS.MANIFEST_PARSING_TIME_HISTORY
      );

      if (manifestParsingTimeHistory === undefined) {
        displayNoStateInformation();
        return;
      }

      const tableElt = createElement("table");
      const firstTableRowElt = createCompositeElement("tr", [
        createElement("th", {
          textContent: "TS",
        }),
        createElement("th", {
          textContent: "Parsing Time (ms)",
        }),
        createElement("th", {
          textContent: "Distance since prev. (ms)",
        }),
      ]);
      tableElt.appendChild(firstTableRowElt);
      for (let i = manifestParsingTimeHistory?.length - 1; i >= 0; i--) {
        const info = manifestParsingTimeHistory[i];
        tableElt.appendChild(
          createCompositeElement("tr", [
            createElement("td", {
              textContent: String(info.timestamp),
            }),
            createElement("td", {
              textContent: String(info.timeMs.toFixed(2)),
            }),
            createElement("td", {
              textContent: String(
                i === 0
                  ? "-"
                  : (info.timestamp - manifestParsingTimeHistory[i - 1].timestamp)
                    .toFixed(2)
              ),
            }),
          ])
        );
        if (tableElt.childNodes.length >= MAX_ELEMENTS - 1) {
          manifestParsingHistoryElt.appendChild(tableElt);
          moduleBodyElt.classList.remove("empty");
          return;
        }
      }
      if (tableElt.childNodes.length === 1) {
        displayNoStateInformation();
        return;
      }
      manifestParsingHistoryElt.appendChild(tableElt);
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
    manifestParsingHistoryElt.textContent = "No state information";
    moduleBodyElt.classList.add("empty");
  }
}
