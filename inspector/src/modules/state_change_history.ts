import strHtml from "str-html";
import { InspectorState, STATE_PROPS } from "../constants";
import ObservableState, { UPDATE_TYPE } from "../observable_state";

export default function StateChangeInformationModule({
  state,
}: {
  state: ObservableState<InspectorState>;
}) {
  const stateHistoryElt = strHtml`<div>No state information</div>`;
  const moduleBodyElt = strHtml`<div class="state-history-body module-body">${stateHistoryElt}</div>`;
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

      const tableElt = strHtml`<table>
        <tr>
          <th>State</th>
          <th>TS</th>
          <th>Time in prev. state (ms)</th>
          <th>Focus</th>
        </tr>
      </table>`;
      for (let i = stateHistory?.length - 1; i >= 0; i--) {
        const stateInfo = stateHistory[i];
        const tsMaxButton = strHtml`<button>◎</button>`;
        tsMaxButton.onclick = function () {
          state.updateState(
            STATE_PROPS.LOG_MIN_TIMESTAMP_DISPLAYED,
            UPDATE_TYPE.REPLACE,
            0
          );
          state.updateState(
            STATE_PROPS.LOG_MAX_TIMESTAMP_DISPLAYED,
            UPDATE_TYPE.REPLACE,
            stateInfo.timestamp
          );
          state.commitUpdates();
        };

        tableElt.appendChild(
          strHtml`<tr>
            <td>${stateInfo.state}</td>
            <td>${stateInfo.timestamp}</td>
            <td>
              ${
                i === 0
                  ? "-"
                  : (
                      stateInfo.timestamp - stateHistory[i - 1].timestamp
                    ).toFixed(2)
              }
            </td>
            <td>${tsMaxButton}</td>
          </tr>`
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
