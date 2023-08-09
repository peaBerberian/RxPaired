import { InspectorState } from "./constants";
import LogProcessors, { StateUpdate } from "./log_processors";
import ObservableState, { UPDATE_TYPE } from "./observable_state";

/**
 * Function called when a new log is received, so it can update the
 * `ObservableState` accordingly, which will have the effect of updating the
 * modules relying on those updated states.
 * @param {Object} state
 * @param {string} newLog
 */
export default function updateStateFromLog(
  state: ObservableState<InspectorState>,
  newLog: string,
): void {
  for (const proc of LogProcessors) {
    if (proc.filter(newLog)) {
      const updateRes = proc.processor(newLog);
      for (const update of updateRes) {
        state.updateState(
          update.property,
          update.updateType,
          update.updateValue,
        );
      }
    }
  }
}

/**
 * Function called when several logs are received at once.
 * It can be seen as an optimized `updateStateFromLog` function when a high
 * number of logs are encountered.
 * @param {Object} state
 * @param {string} logs
 */
export function updateStatesFromLogGroup(
  state: ObservableState<InspectorState>,
  logs: string[],
): void {
  const pendingUpdates: Array<StateUpdate<keyof InspectorState>> = [];

  /**
   * All state property that already have been set (and thus don't need to
   * be anymore, as we're parsing logs from the newest to the oldest here).
   */
  const updatedStates = new Set<keyof InspectorState>();

  /**
   * All LogProcessors that may still offer state updates.
   * To infer this information, the LogProcessor's `updatedProps` property is
   * compared to the `updatedStates` constant.
   * If there's no left property that the `LogProcessor` might change, it is
   * removed.
   */
  const remainingChecks = LogProcessors.slice();

  for (let i = logs.length - 1; i >= 0; i--) {
    if (remainingChecks.length === 0) {
      break;
    }
    const currLog = logs[i];
    for (let checkIdx = 0; checkIdx < remainingChecks.length; checkIdx++) {
      const currCheck = remainingChecks[checkIdx];
      if (currCheck.filter(currLog)) {
        const updates = currCheck.processor(currLog);
        for (const update of updates) {
          if (!updatedStates.has(update.property)) {
            pendingUpdates.push(update);
            if (update.updateType === UPDATE_TYPE.REPLACE) {
              updatedStates.add(update.property);
            }
          }
        }
        for (
          let innerCheckIdx = 0;
          innerCheckIdx < remainingChecks.length;
          innerCheckIdx++
        ) {
          const innerCheck = remainingChecks[innerCheckIdx];
          if (innerCheck.updatedProps.every((u) => updatedStates.has(u))) {
            remainingChecks.splice(innerCheckIdx, 1);
          }
        }
      }
    }
  }

  const reversedUpdates = pendingUpdates.reverse();
  for (const update of reversedUpdates) {
    state.updateState(update.property, update.updateType, update.updateValue);
  }
}
