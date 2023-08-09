import strHtml from "str-html";
import { InspectorState, STATE_PROPS } from "../constants";
import ObservableState from "../observable_state";

const MAX_ELEMENTS = 50;

export default function ManifestParsingTimeHistoryModule({
  state,
}: {
  state: ObservableState<InspectorState>;
}) {
  const manifestParsingHistoryElt = strHtml`<div>No manifest parsing information</div>`;
  const moduleBodyElt = strHtml`<div class="state-history-body module-body">${
    manifestParsingHistoryElt
  }</div>`;
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

      const tableElt = strHtml`<table>
        <tr>
          <th>TS</th>
          <th>Parsing Time (ms)</th>
          <th>Distance since prev. (ms)</th>
        </tr>
      </table>`;
      for (let i = manifestParsingTimeHistory?.length - 1; i >= 0; i--) {
        const info = manifestParsingTimeHistory[i];
        tableElt.appendChild(
          strHtml`<tr>
            <td>${info.timestamp}</td>
            <td>
              ${info.timeMs.toFixed(2)}
            </td>
            <td>
              ${i === 0 ?
                  "-" :
                  (info.timestamp - manifestParsingTimeHistory[i - 1].timestamp)
                    .toFixed(2)}
            </td>
          </tr>`
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
