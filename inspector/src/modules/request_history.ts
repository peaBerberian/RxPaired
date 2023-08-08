import strHtml from "str-html";
import { InspectorState, RequestInformation, STATE_PROPS } from "../constants";
import ObservableState from "../observable_state";
import { ModuleFunction } from ".";

const MAX_REQ_ELEMENTS = 50;

export default function generateRequestHistoryModule(
  mediaType: "audio" | "video" | "text"
): ModuleFunction {
  return function RequestInformationModule({
    state,
  }: {
    state: ObservableState<InspectorState>;
  }) {
    const requestDataElt = strHtml`<div>No request information</div>`;
    const moduleBodyElt = strHtml`<div class="request-history-body module-body">
      ${requestDataElt}
    </>`;
    const stateProp =
      mediaType === "audio"
        ? STATE_PROPS.AUDIO_REQUEST_HISTORY
        : mediaType === "video"
        ? STATE_PROPS.VIDEO_REQUEST_HISTORY
        : STATE_PROPS.TEXT_REQUEST_HISTORY;

    let pendingRequestInfo: {
      element: HTMLElement;
      timestamp: number;
    } | null = null;

    const unsubscribeLogHistory = state.subscribe(
      STATE_PROPS.LOGS_HISTORY,
      updatePendingTimeElt
    );
    const unsubscribeSelected = state.subscribe(
      STATE_PROPS.SELECTED_LOG_INDEX,
      updatePendingTimeElt
    );

    const unsubscribeHistory = state.subscribe(stateProp, () => {
      requestDataElt.innerHTML = "";
      pendingRequestInfo = null;

      // TODO more optimized: rely on push
      const requestInfo = state.getCurrentState(stateProp);

      if (requestInfo === undefined) {
        displayNoRequestInformation();
        return;
      }
      let canStillReceivePending = true;
      const tableElt = strHtml`<table>
        <ts>
          <th>TS</th>
          <th>status</th>
          <th>Duration (ms)</th>
          <th>Period</th>
          <th>Representation</th>
          <th>StartTime (s)</th>
          <th>Duration (s)</th>
        </ts>
      </table>`;
      for (let i = requestInfo?.length - 1; i >= 0; i--) {
        const req = requestInfo[i];
        if (canStillReceivePending && req.eventType === "start") {
          pendingRequestInfo = {
            element: strHtml`<td> - </td>`,
            timestamp: req.timestamp,
          };
          updatePendingTimeElt();

          const newElt = strHtml`<tr>
            <td>${req.timestamp}</td>
            <td>pending</td>
            ${pendingRequestInfo.element}
            <td>${req.periodId}</td>
            <td>${req.representationId}</td>
            <td>
              ${ req.segmentStart === -1 ? "init" : req.segmentStart }
            </td>
            <td>
              ${req.segmentDuration === -1 ? "-" : req.segmentDuration }
            </td>
          </tr>`;
          tableElt.appendChild(newElt);
          canStillReceivePending = false;
        } else if (req.eventType !== "start") {
          canStillReceivePending = false;
          if (req.eventType === "aborted") {
            // There's a small issue in the RxPlayer where init segments might
            // be aborted synchronously before their success is anounced. This
            // should have no effect on playback however.
            // TODO fix it in the RxPlayer
            let shouldIgnore = false;
            for (let j = i + 1; j < requestInfo.length; j++) {
              const reqNext = requestInfo[j];
              if (isRequestingSameSegment(reqNext, req)) {
                if (reqNext.eventType === "success") {
                  shouldIgnore = true;
                }
                break;

              }
            }
            if (shouldIgnore) {
              continue;
            }
          }
          for (let j = i - 1; j >= 0; j--) {
            const reqBase = requestInfo[j];
            if (isRequestingSameSegment(reqBase, req) && reqBase.eventType === "start") {
              tableElt.appendChild(
                strHtml`<tr>
                  <td>${reqBase.timestamp}</td>
                  <td>pending</td>
                  <td>
                    ${(req.timestamp - reqBase.timestamp).toFixed(2)}
                  </td>
                  <td>${req.periodId}</td>
                  <td>${req.representationId}</td>
                  <td>
                    ${ req.segmentStart === -1 ? "init" : req.segmentStart }
                  </td>
                  <td>
                    ${req.segmentDuration === -1 ? "-" : req.segmentDuration }
                  </td>
                </tr>`
              );
              if (tableElt.childNodes.length >= MAX_REQ_ELEMENTS - 1) {
                requestDataElt.appendChild(tableElt);
                moduleBodyElt.classList.remove("empty");
                return;
              }
              break;
            }
          }
        }
      }
      if (tableElt.childNodes.length === 1) {
        displayNoRequestInformation();
        return;
      }
      requestDataElt.appendChild(tableElt);
      moduleBodyElt.classList.remove("empty");
    }, true);
    return {
      body: moduleBodyElt,
      destroy() {
        unsubscribeLogHistory();
        unsubscribeSelected();
        unsubscribeHistory();
      },
    };

    function displayNoRequestInformation() {
      requestDataElt.textContent = "No request information";
      moduleBodyElt.classList.add("empty");
    }

    function updatePendingTimeElt() {
      if (pendingRequestInfo === null) {
        return;
      }
      let lastKnownTimestamp: number | undefined;
      const logs = state.getCurrentState(STATE_PROPS.LOGS_HISTORY) ?? [];
      const selected = state.getCurrentState(STATE_PROPS.SELECTED_LOG_INDEX) ??
        logs.length - 1;
      if (selected !== -1 && logs.length > selected) {
        lastKnownTimestamp = parseFloat(logs[selected]);
        if (isNaN(lastKnownTimestamp)) {
          lastKnownTimestamp = undefined;
        }
      }
      pendingRequestInfo.element.textContent = lastKnownTimestamp === undefined ?
        " - " :
        `+${(lastKnownTimestamp - pendingRequestInfo.timestamp).toFixed(2)}ms`;
    }
  };
}

function isRequestingSameSegment(
  req1: RequestInformation,
  req2: RequestInformation
) {
  return req1.periodId === req2.periodId &&
    req1.adaptationId === req2.adaptationId &&
    req1.representationId === req2.representationId &&
    req1.segmentStart === req2.segmentStart &&
    req1.segmentDuration === req2.segmentDuration;
}
