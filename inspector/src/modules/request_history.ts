import { InspectorState, RequestInformation, STATE_PROPS } from "../constants";
import { createCompositeElement, createElement } from "../dom-utils";
import ObservableState from "../observable_state";
import { ModuleFunction } from ".";

export default function generateRequestHistoryModule(
  mediaType: "audio" | "video" | "text"
): ModuleFunction {
  return function RequestInformationModule({
    state,
  }: {
    state: ObservableState<InspectorState>;
  }) {
    const requestDataElt = createElement("div", {
      textContent: "No request information",
    });
    const moduleBodyElt = createCompositeElement("div", [requestDataElt], {
      className: "module-body",
    });
    const stateProp =
      mediaType === "audio"
        ? STATE_PROPS.AUDIO_REQUEST_HISTORY
        : mediaType === "video"
        ? STATE_PROPS.VIDEO_REQUEST_HISTORY
        : STATE_PROPS.TEXT_REQUEST_HISTORY;
    const unsubscribeHistory = state.subscribe(stateProp, () => {
      requestDataElt.innerHTML = "";

      // TODO more optimized: rely on push
      const requestInfo = state.getCurrentState(stateProp);

      if (requestInfo === undefined) {
        requestDataElt.textContent = "No request information";
        return;
      }
      let canStillReceivePending = true;
      const tableElt = createElement("table");
      const firstTableRowElt = createCompositeElement("tr", [
        createElement("th", {
          textContent: "TS",
        }),
        createElement("th", {
          textContent: "status",
        }),
        createElement("th", {
          textContent: "Duration (ms)",
        }),
        createElement("th", {
          textContent: "Period",
        }),
        createElement("th", {
          textContent: "Representation",
        }),
        createElement("th", {
          textContent: "Start Time (s)",
        }),
        createElement("th", {
          textContent: "Duration (s)",
        }),
      ]);
      tableElt.appendChild(firstTableRowElt);
      for (let i = requestInfo?.length - 1; i >= 0; i--) {
        const req = requestInfo[i];
        if (canStillReceivePending && req.eventType === "start") {
          tableElt.appendChild(
            createCompositeElement("tr", [
              createElement("td", {
                textContent: String(req.timestamp),
              }),
              createElement("td", {
                textContent: "pending",
              }),
              createElement("td", {
                textContent: " - ",
              }),
              createElement("td", {
                textContent: req.periodId,
              }),
              createElement("td", {
                textContent: req.representationId,
              }),
              createElement("td", {
                textContent:
                  req.segmentStart === -1
                    ? "init"
                    : String(req.segmentStart),
              }),
              createElement("td", {
                textContent:
                  req.segmentDuration === -1
                    ? "-"
                    : String(req.segmentDuration),
              }),
            ])
          );
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
                createCompositeElement("tr", [
                  createElement("td", {
                    textContent: String(reqBase.timestamp),
                  }),
                  createElement("td", {
                    textContent: req.eventType,
                  }),
                  createElement("td", {
                    textContent: String(
                      (req.timestamp - reqBase.timestamp).toFixed(2)
                    ),
                  }),
                  createElement("td", {
                    textContent: req.periodId,
                  }),
                  createElement("td", {
                    textContent: req.representationId,
                  }),
                  createElement("td", {
                    textContent:
                      req.segmentStart === -1
                        ? "init"
                        : String(req.segmentStart),
                  }),
                  createElement("td", {
                    textContent:
                      req.segmentDuration === -1
                        ? "-"
                        : String(req.segmentDuration),
                  }),
                ])
              );
              if (tableElt.childNodes.length >= 11) {
                requestDataElt.appendChild(tableElt);
                return;
              }
              break;
            }
          }
        }
      }
      if (tableElt.childNodes.length === 1) {
        requestDataElt.textContent = "No request information";
        return;
      }
      requestDataElt.appendChild(tableElt);
    });
    return {
      body: moduleBodyElt,
      destroy() {
        unsubscribeHistory();
      },
    };
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
