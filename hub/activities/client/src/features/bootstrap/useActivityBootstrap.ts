import { useEffect, useRef, useState } from "react";
import { DiscordSDK } from "@discord/embedded-app-sdk";

import { exchangeActivityToken, fetchActivityConfig } from "../../lib/activityApi.ts";
import { getColyseusClient, getColyseusEndpoint } from "../../lib/colyseusClient.ts";
import { getGuildIdFromUrl } from "../../lib/activityView.ts";
import type { AuthState, SetupDiagnostics, SetupState } from "../../types/activityUi.ts";

type DiscordAuthorizeInput = Parameters<DiscordSDK["commands"]["authorize"]>[0];

type SetupAuthResult = AuthState & {
  diagnostics: SetupDiagnostics;
};

function createInitialDiagnostics(): SetupDiagnostics {
  return {
    origin: window.location.origin,
    href: window.location.href,
    guildId: getGuildIdFromUrl(),
    channelId: "",
    currentStep: "boot",
    multiplayerStatus: "disabled",
  };
}

export function useActivityBootstrap() {
  const [forceDebugPanel] = useState(() => {
    const debugParam = new URLSearchParams(window.location.search).get("debug");
    if (debugParam === "0" || debugParam === "false") {
      return false;
    }

    return true;
  });
  const [setup, setSetup] = useState<SetupState>({
    loading: true,
    error: null,
    auth: null,
    sdkReady: false,
    diagnostics: null,
  });
  const [diagnostics, setDiagnostics] = useState<SetupDiagnostics>(createInitialDiagnostics);
  const sdkRef = useRef<DiscordSDK | null>(null);

  const updateDiagnostics = (patch: Partial<SetupDiagnostics>) => {
    setDiagnostics((previous) => ({
      ...previous,
      origin: window.location.origin,
      href: window.location.href,
      ...patch,
    }));
  };

  useEffect(() => {
    const multiplayerEndpoint = getColyseusEndpoint();
    if (!multiplayerEndpoint) {
      updateDiagnostics({
        multiplayerStatus: "disabled",
      });
      return;
    }

    try {
      getColyseusClient();
      updateDiagnostics({
        multiplayerStatus: "ready",
        colyseusUrl: multiplayerEndpoint,
      });
    } catch (error: any) {
      updateDiagnostics({
        multiplayerStatus: "error",
        lastError: error?.message || "Failed to initialize Colyseus client",
        colyseusUrl: multiplayerEndpoint,
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setupSdk(): Promise<SetupAuthResult> {
      updateDiagnostics({
        currentStep: "config",
        lastError: "",
        guildId: getGuildIdFromUrl(),
      });

      const configPayload = await fetchActivityConfig();
      const configuredClientId =
        configPayload.clientId ||
        import.meta.env.VITE_ACTIVITY_CLIENT_ID ||
        import.meta.env.VITE_DISCORD_CLIENT_ID;

      if (!configuredClientId) {
        throw new Error("Missing Activity client id in /api/config or VITE env vars.");
      }

      const discordSdk = new DiscordSDK(configuredClientId);
      sdkRef.current = discordSdk;
      await discordSdk.ready();

      const nextDiagnostics: SetupDiagnostics = {
        clientId: configuredClientId,
        origin: window.location.origin,
        href: window.location.href,
        guildId: discordSdk.guildId || getGuildIdFromUrl(),
        channelId: discordSdk.channelId || "",
        errorStep: "authorize",
        currentStep: "sdk-ready",
      };

      setDiagnostics(nextDiagnostics);

      const authorizeParams: Omit<DiscordAuthorizeInput, "prompt"> = {
        client_id: configuredClientId,
        response_type: "code",
        state: crypto.randomUUID(),
        scope: ["identify"],
      };

      const authorizeResult = await discordSdk.commands.authorize(authorizeParams);
      const tokenPayload = await exchangeActivityToken(authorizeResult.code);
      if (!tokenPayload.access_token) {
        throw new Error(
          tokenPayload.message ||
            tokenPayload.error_description ||
            tokenPayload.error ||
            "Failed to exchange OAuth token."
        );
      }

      const auth = await discordSdk.commands.authenticate({
        access_token: tokenPayload.access_token,
      });

      if (!auth?.user?.id) {
        throw new Error("Discord authenticate command failed.");
      }

      return {
        accessToken: tokenPayload.access_token,
        userId: auth.user.id,
        guildId: discordSdk.guildId || getGuildIdFromUrl(),
        diagnostics: {
          ...nextDiagnostics,
          currentStep: "authenticated",
        },
      };
    }

    async function run() {
      try {
        const auth = await setupSdk();
        if (cancelled) {
          return;
        }

        setSetup({
          loading: false,
          error: null,
          auth,
          sdkReady: true,
          diagnostics: auth.diagnostics,
        });
      } catch (error: any) {
        if (cancelled) {
          return;
        }

        const nextDiagnostics: SetupDiagnostics = {
          clientId: sdkRef.current?.clientId || undefined,
          origin: window.location.origin,
          href: window.location.href,
          guildId: sdkRef.current?.guildId || getGuildIdFromUrl(),
          channelId: sdkRef.current?.channelId || "",
          errorStep: "authorize",
          currentStep: diagnostics.currentStep || "authorize",
          lastError: error?.message || "Discord SDK auth unavailable.",
          multiplayerStatus: diagnostics.multiplayerStatus,
          colyseusUrl: diagnostics.colyseusUrl,
        };

        setDiagnostics(nextDiagnostics);
        setSetup({
          loading: false,
          error: `${error?.message || "Discord SDK auth unavailable."} Trying local read-only preview...`,
          auth: null,
          sdkReady: false,
          diagnostics: nextDiagnostics,
        });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    diagnostics,
    setup,
    showDebugPanel: import.meta.env.DEV || forceDebugPanel,
  };
}
