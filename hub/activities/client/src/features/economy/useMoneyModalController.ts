import { useState } from "react";
import { z } from "zod";

import type { ActivityLauncherPayload } from "../../../../../shared/src/contracts/hub.ts";
import {
  parsePositiveAmount,
  type MoneyMoveDirection,
  type MoneyMoveMode,
} from "../../lib/activityMath.ts";
import type { MoneyModalState, NoticeState } from "../../types/activityUi.ts";

type MoneyNoticeHandler = (notice: NoticeState) => void;

type UseMoneyModalControllerOptions = {
  launcherData: ActivityLauncherPayload | null;
  performMutation: <TAction extends Record<string, unknown>>(
    path: string,
    body: Record<string, unknown>,
    actionSchema: z.ZodType<TAction>
  ) => Promise<{ action?: TAction }>;
  onNotice: MoneyNoticeHandler;
};

export function useMoneyModalController({
  launcherData,
  performMutation,
  onNotice,
}: UseMoneyModalControllerOptions) {
  const [moneyModal, setMoneyModal] = useState<MoneyModalState>({
    open: false,
    direction: "deposit",
    input: "",
    selectedPreset: null,
    submitting: false,
    error: null,
  });

  const openMoneyModal = (direction: MoneyMoveDirection) => {
    setMoneyModal({
      open: true,
      direction,
      input: "",
      selectedPreset: null,
      submitting: false,
      error: null,
    });
  };

  const closeMoneyModal = () => {
    setMoneyModal((previous) => ({
      ...previous,
      open: false,
      error: null,
    }));
  };

  const setMoneyInput = (value: string) => {
    setMoneyModal((previous) => ({
      ...previous,
      input: value,
      selectedPreset: null,
      error: null,
    }));
  };

  const setMoneyPreset = (value: number) => {
    setMoneyModal((previous) => ({
      ...previous,
      selectedPreset: value,
      input: "",
      error: null,
    }));
  };

  const submitMoneyMove = async () => {
    if (!launcherData) {
      return;
    }

    const amountMode: MoneyMoveMode =
      moneyModal.selectedPreset !== null ? "percent" : "fixed";
    const parsedAmount =
      amountMode === "percent"
        ? moneyModal.selectedPreset || 0
        : parsePositiveAmount(moneyModal.input);

    if (parsedAmount <= 0) {
      setMoneyModal((previous) => ({
        ...previous,
        error: launcherData.strings.modal.enterValidAmount,
      }));
      return;
    }

    setMoneyModal((previous) => ({
      ...previous,
      submitting: true,
      error: null,
    }));

    try {
      const payload = await performMutation<{
        direction: MoneyMoveDirection;
        amount: number;
        amountMode: MoneyMoveMode;
      }>(
        "/api/economy/move",
        {
          direction: moneyModal.direction,
          amountMode,
          amount: parsedAmount,
        },
        z.object({
          direction: z.enum(["deposit", "withdraw"]),
          amount: z.number(),
          amountMode: z.enum(["percent", "fixed"]),
        })
      );

      setMoneyModal({
        open: false,
        direction: moneyModal.direction,
        input: "",
        selectedPreset: null,
        submitting: false,
        error: null,
      });
      onNotice({
        kind: "success",
        message:
          payload.action?.direction === "deposit"
            ? launcherData.strings.balance.depositTitle
            : launcherData.strings.balance.withdrawTitle,
      });
    } catch (error: any) {
      setMoneyModal((previous) => ({
        ...previous,
        submitting: false,
        error: error?.message || launcherData.strings.modal.moveFailed,
      }));
    }
  };

  return {
    closeMoneyModal,
    moneyModal,
    openMoneyModal,
    setMoneyInput,
    setMoneyModal,
    setMoneyPreset,
    submitMoneyMove,
  };
}
