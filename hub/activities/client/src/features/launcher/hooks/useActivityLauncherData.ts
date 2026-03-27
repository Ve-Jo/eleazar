import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import type {
  ActivityLauncherPayload,
  ActivityMutationEnvelope,
} from "../../../../../../shared/src/contracts/hub.ts";
import { fetchActivityLauncherData, postActivityMutation } from "../../../lib/activityApi.ts";
import { getGuildIdFromUrl } from "../../../lib/activityView.ts";
import type { SetupState } from "../../../types/activityUi.ts";

type LauncherMutationInput = {
  path: string;
  body: Record<string, unknown>;
  actionSchema: z.ZodTypeAny;
};

export function useActivityLauncherData(setup: SetupState) {
  const [launcherData, setLauncherData] = useState<ActivityLauncherPayload | null>(null);
  const queryClient = useQueryClient();

  const launcherQueryKey = [
    "activity-launcher",
    setup.auth?.guildId || getGuildIdFromUrl() || "unknown-guild",
    setup.auth?.userId || "anonymous",
    setup.auth?.accessToken ? "authorized" : "preview",
  ] as const;

  const launcherQuery = useQuery({
    queryKey: launcherQueryKey,
    queryFn: () => fetchActivityLauncherData(setup.auth),
    enabled: !setup.loading,
  });

  const launcherMutation = useMutation<
    ActivityMutationEnvelope<Record<string, unknown>>,
    Error,
    LauncherMutationInput
  >({
    mutationFn: ({ path, body, actionSchema }) =>
      postActivityMutation<Record<string, unknown>>(
        path,
        body,
        setup.auth,
        actionSchema as z.ZodType<Record<string, unknown>>
      ),
  });

  useEffect(() => {
    if (launcherQuery.data) {
      setLauncherData(launcherQuery.data);
    }
  }, [launcherQuery.data]);

  const performMutation = async <TAction extends Record<string, unknown>>(
    path: string,
    body: Record<string, unknown>,
    actionSchema: z.ZodType<TAction>
  ) => {
    const payload = await launcherMutation.mutateAsync({
      path,
      body,
      actionSchema,
    });

    setLauncherData(payload.launcher);
    queryClient.setQueryData(launcherQueryKey, payload.launcher);

    return payload as ActivityMutationEnvelope<TAction>;
  };

  const refreshLauncher = async () => {
    await queryClient.invalidateQueries({
      queryKey: launcherQueryKey,
    });
  };

  return {
    launcherData,
    launcherQuery,
    launcherQueryKey,
    performMutation,
    refreshLauncher,
    setLauncherData,
  };
}
