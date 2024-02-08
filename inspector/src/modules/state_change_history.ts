import strHtml from "str-html";
import { ConfigState, InspectorState, LogViewState, STATE_PROPS } from "../constants";
import ObservableState, { UPDATE_TYPE } from "../observable_state";
import { convertDateToLocalISOString } from "../utils";

export default function StateChangeInformationModule({
  state,
  logView,
  configState,
}: {
  state: ObservableState<InspectorState>;
  logView: ObservableState<LogViewState>;
  configState: ObservableState<ConfigState>;
}) {
  const stateHistoryElt = strHtml`<div>No state information</div>`;
  const moduleBodyElt = strHtml`<div class="state-history-body module-body">${[
    stateHistoryElt
  ]}</div>`;

  const renderStateHistory = () => {
    stateHistoryElt.innerHTML = "";

    // TODO more optimized: rely on push
    const stateHistory = state.getCurrentState(
      STATE_PROPS.STATE_CHANGE_HISTORY
    );

    if (stateHistory === undefined) {
      displayNoStateInformation();
      return;
    }

    const tableElt = strHtml`<table>
      <tr>
        <th>State</th>
        <th>TS</th>
        <th>Time in prev. state (ms)</th>
        <th>Time Travel</th>
      </tr>
    </table>`;
    for (let i = stateHistory?.length - 1; i >= 0; i--) {
      const stateInfo = stateHistory[i];
      const tsFocusButton = strHtml`<button>◎</button>`;
      tsFocusButton.title =
        "Focus on this log and set it as the last one in the history";
      tsFocusButton.onclick = function () {
        logView.updateState(
          STATE_PROPS.LOG_MIN_TIMESTAMP_DISPLAYED,
          UPDATE_TYPE.REPLACE,
          0
        );
        logView.updateState(
          STATE_PROPS.LOG_MAX_TIMESTAMP_DISPLAYED,
          UPDATE_TYPE.REPLACE,
          stateInfo.timestamp
        );
        logView.updateState(
          STATE_PROPS.SELECTED_LOG_ID,
          UPDATE_TYPE.REPLACE,
          stateInfo.logId
        );
        logView.commitUpdates();
      };

      let innerText: string;
      if (configState.getCurrentState(STATE_PROPS.TIME_REPRESENTATION) === "date") {
        const dateAtPageLoad = logView.getCurrentState(STATE_PROPS.DATE_AT_PAGE_LOAD) ?? 0
        innerText = convertDateToLocalISOString(new Date(stateInfo.timestamp + dateAtPageLoad));
      } else {
        innerText = `${stateInfo.timestamp}`
      }
      const timestampElt = strHtml`<td>${innerText}</td>`;
      tableElt.appendChild(
        strHtml`<tr>
          <td>${stateInfo.state}</td>
          ${timestampElt}
          <td>
            ${
              i === 0
                ? "-"
                : (
                    stateInfo.timestamp - stateHistory[i - 1].timestamp
                  ).toFixed(2)
            }
          </td>
          <td>${tsFocusButton}</td>
        </tr>`
      );
    }
    if (tableElt.childNodes.length === 1) {
      displayNoStateInformation();
      return;
    }
    stateHistoryElt.appendChild(tableElt);
    moduleBodyElt.classList.remove("empty");
  };
  const unsubscribeHistory = state.subscribe(
    STATE_PROPS.STATE_CHANGE_HISTORY,
    renderStateHistory,
    true
  );

  const unsubscribeTimeRepresentation= configState.subscribe(
    STATE_PROPS.TIME_REPRESENTATION,
    renderStateHistory,
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
    stateHistoryElt.textContent = "No state information";
    moduleBodyElt.classList.add("empty");
  }
}
