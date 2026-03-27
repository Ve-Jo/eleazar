import type { ActivityLauncherPayload } from "../../../../shared/src/contracts/hub.ts";

import { parsePositiveAmount, resolveMoveAmount, getMoveSourceAvailable } from "../lib/activityMath.ts";
import { formatNumber } from "../lib/activityView.ts";
import type { MoneyModalState } from "../types/activityUi.ts";
import MetricPill from "./MetricPill.tsx";

type MoneyModalProps = {
  launcherData: ActivityLauncherPayload;
  state: MoneyModalState;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onPresetSelect: (value: number) => void;
  onSubmit: () => void;
};

export default function MoneyModal({
  launcherData,
  state,
  onClose,
  onInputChange,
  onPresetSelect,
  onSubmit,
}: MoneyModalProps) {
  const locale = launcherData.locale;
  const sourceAvailable = getMoveSourceAvailable(launcherData.balance, state.direction);
  const previewAmount =
    state.selectedPreset !== null
      ? resolveMoveAmount(launcherData.balance, state.direction, "percent", state.selectedPreset)
      : parsePositiveAmount(state.input);
  const sourceLabel =
    state.direction === "deposit"
      ? launcherData.strings.common.wallet
      : launcherData.strings.common.bank;
  const destinationLabel =
    state.direction === "deposit"
      ? launcherData.strings.common.bank
      : launcherData.strings.common.wallet;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-shell"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="micro-label">
              {state.direction === "deposit"
                ? launcherData.strings.balance.depositTitle
                : launcherData.strings.balance.withdrawTitle}
            </div>
            <h3>
              {state.direction === "deposit"
                ? launcherData.strings.modal.confirmDeposit
                : launcherData.strings.modal.confirmWithdraw}
            </h3>
          </div>
          <button className="icon-button" onClick={onClose}>
            x
          </button>
        </div>

        <div className="modal-stats">
          <MetricPill
            label={`${launcherData.strings.modal.source}: ${sourceLabel}`}
            value={formatNumber(sourceAvailable, locale)}
          />
          <MetricPill
            label={`${launcherData.strings.modal.destination}: ${destinationLabel}`}
            value={formatNumber(previewAmount, locale)}
          />
        </div>

        <label className="field-label">
          <span>{launcherData.strings.modal.amountLabel}</span>
          <input
            className="amount-input"
            inputMode="decimal"
            placeholder={launcherData.strings.modal.amountPlaceholder}
            value={state.input}
            onChange={(event) => onInputChange(event.target.value)}
          />
        </label>

        <div className="preset-row">
          {[25, 50, 100].map((preset) => (
            <button
              key={preset}
              className={`preset-chip ${state.selectedPreset === preset ? "is-active" : ""}`}
              onClick={() => onPresetSelect(preset)}
            >
              {preset}%
            </button>
          ))}
        </div>

        {state.error ? <p className="inline-error">{state.error}</p> : null}

        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>
            {launcherData.strings.modal.cancel}
          </button>
          <button
            className="action-button"
            disabled={state.submitting || previewAmount <= 0}
            onClick={onSubmit}
          >
            {state.submitting
              ? "..."
              : state.direction === "deposit"
              ? launcherData.strings.modal.confirmDeposit
              : launcherData.strings.modal.confirmWithdraw}
          </button>
        </div>
      </div>
    </div>
  );
}
