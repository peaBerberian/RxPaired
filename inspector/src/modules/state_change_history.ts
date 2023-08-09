import strHtml from "str-html";
import { InspectorState, STATE_PROPS } from "../constants";
import ObservableState from "../observable_state";

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
        STATE_PROPS.STATE_CHANGE_HISTORY,
      );

      if (stateHistory === undefined) {
        displayNoStateInformation();
        return;
      }

      const tableElt = strHtml`<table>
        <tr>
          <th>State</th>
          <th>TS</th>
          <th>Diff since prev. (ms)</th>
        </tr>
      </table>`;
      for (let i = stateHistory?.length - 1; i >= 0; i--) {
        const stateInfo = stateHistory[i];
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
          </tr>`,
        );
      }
      if (tableElt.childNodes.length === 1) {
        displayNoStateInformation();
        return;
      }
      stateHistoryElt.appendChild(tableElt);
      moduleBodyElt.classList.remove("empty");
    },
    true,
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
