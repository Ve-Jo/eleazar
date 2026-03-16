import { generateImage, resetPerformanceStats, cleanup } from "../src/utils/imageGenerator.ts";

const ONE_BY_ONE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XGD10AAAAASUVORK5CYII=";

const baseProps = {
  grid: [
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  score: 1024,
  earning: 55.0,
  locale: "en",
  interaction: {
    user: {
      id: "bench-user",
      username: "bench",
      displayName: "Bench",
      avatarURL: ONE_BY_ONE_PNG,
    },
    guild: {
      id: "bench-guild",
      name: "Bench Guild",
      iconURL: ONE_BY_ONE_PNG,
    },
  },
  database: {
    economy: { balance: 1000 },
    levelProgress: {
      chat: { level: 5, currentXP: 200, requiredXP: 500, totalXP: 2000 },
      game: { level: 3, currentXP: 150, requiredXP: 500, totalXP: 900 },
    },
    earnedGameXP: 0,
  },
};

const i18nMock = {
  getLocale: () => "en",
  setLocale: () => "en",
  __: (key: string) => key,
  initialized: true,
};

type BenchmarkConfig = {
  label: string;
  renderBackend: "satori" | "takumi";
  doublePass: boolean;
};

const configs: BenchmarkConfig[] = [
  { label: "satori-single", renderBackend: "satori", doublePass: false },
  { label: "takumi-single", renderBackend: "takumi", doublePass: false },
];

async function prewarmStaticLayer(config: BenchmarkConfig) {
  if (!config.doublePass) return;
  await generateImage(
    "2048",
    baseProps,
    { image: 1, emoji: 1, debug: false },
    i18nMock,
    {
      renderMode: "game",
      renderBackend: config.renderBackend,
      doublePass: true,
      prewarmStaticLayer: true,
      prewarmStaticOnly: true,
      disableThrottle: true,
    }
  );
}

async function runBenchmark(config: BenchmarkConfig) {
  await resetPerformanceStats();
  await cleanup(true);

  await prewarmStaticLayer(config);
  await generateImage(
    "2048",
    baseProps,
    { image: 1, emoji: 1, debug: false },
    i18nMock,
    {
      renderMode: "game",
      renderBackend: config.renderBackend,
      doublePass: config.doublePass,
      disableThrottle: true,
    }
  );

  const durationMs = 60_000;
  const start = Date.now();
  let count = 0;

  while (Date.now() - start < durationMs) {
    await generateImage(
      "2048",
      baseProps,
      { image: 1, emoji: 1, debug: false },
      i18nMock,
      {
        renderMode: "game",
        renderBackend: config.renderBackend,
        doublePass: config.doublePass,
        disableThrottle: true,
      }
    );
    count += 1;
  }

  const elapsed = Date.now() - start;
  const perMinute = Math.round((count / elapsed) * 60_000);

  console.log(
    `${config.label}: ${count} renders in ${(elapsed / 1000).toFixed(
      1
    )}s (~${perMinute} renders/minute)`
  );
}

async function main() {
  console.log("Starting 2048 render benchmark (60s per config)...");

  for (const config of configs) {
    console.log(`\nRunning ${config.label}...`);
    await runBenchmark(config);
  }

  await cleanup(true);
}

main().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exitCode = 1;
});
