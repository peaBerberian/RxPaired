import strHtml from "str-html";
import { ConfigState, InspectorState, LogViewState, STATE_PROPS } from "../constants";
import ObservableState, { UPDATE_TYPE } from "../observable_state";
import { convertDateToLocalISOString } from "../utils";

const MAX_ELEMENTS = 50;

export default function ManifestParsingTimeHistoryModule({
  state,
  logView,
  configState,
}: {
  state: ObservableState<InspectorState>;
  logView: ObservableState<LogViewState>;
  configState: ObservableState<ConfigState>;
}) {
  const manifestParsingHistoryElt = strHtml`<div>No manifest parsing information</div>`;
  const moduleBodyElt = strHtml`<div class="state-history-body module-body">
    ${manifestParsingHistoryElt}
  </div>`;
  const renderParsingTimeHistory = () => {
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
        <th>Time since prev. parsing (ms)</th>
      </tr>
    </table>`;
    for (let i = manifestParsingTimeHistory.length - 1; i >= 0; i--) {
      const info = manifestParsingTimeHistory[i];
      let innerText: string;
      if (configState.getCurrentState(STATE_PROPS.TIME_REPRESENTATION) === "date") {
        const dateAtPageLoad = logView.getCurrentState(STATE_PROPS.DATE_AT_PAGE_LOAD) ?? 0
        innerText = convertDateToLocalISOString(new Date(info.timestamp + dateAtPageLoad));
      } else {
        innerText = `${info.timestamp}`
      }

      const timestampElt = strHtml`<td>${innerText}</td>`;
      timestampElt.style.cursor = "pointer";
      timestampElt.style.textDecoration = "underline";
      timestampElt.onclick = () => {
        logView.updateState(
          STATE_PROPS.LOG_MIN_TIMESTAMP_DISPLAYED,
          UPDATE_TYPE.REPLACE,
          0
        );
        logView.updateState(  
          STATE_PROPS.LOG_MAX_TIMESTAMP_DISPLAYED,
          UPDATE_TYPE.REPLACE,
          info.timestamp
        );
        logView.commitUpdates();
      };
      tableElt.appendChild(
        strHtml`<tr>
          ${timestampElt}
          <td>
            ${info.timeMs.toFixed(2)}
          </td>
          <td>
            ${
              i === 0
                ? "-"
                : (
                    info.timestamp -
                    manifestParsingTimeHistory[i - 1].timestamp
                  ).toFixed(2)
            }
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
  }
  const unsubscribeHistory = state.subscribe(
    STATE_PROPS.MANIFEST_PARSING_TIME_HISTORY,
    renderParsingTimeHistory,
    true
  );

  const unsubscribeTimeRepresentation = configState.subscribe(
    STATE_PROPS.TIME_REPRESENTATION,
    renderParsingTimeHistory,
    true
  );
  return {
    body: moduleBodyElt,
    destroy() {
      unsubscribeHistory();
      unsubscribeTimeRepresentation();
    },
  };

  function displayNoStateInformation() {
    manifestParsingHistoryElt.textContent = "No state information";
    moduleBodyElt.classList.add("empty");
  }
}
