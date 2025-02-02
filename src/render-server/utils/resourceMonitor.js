let lastRSS = 0;

let currentLabel = "";

const monitor = async () => {
  const used = process.memoryUsage();
  const currentRSS = Math.round(used.rss / (1024 * 1024));

  // Memory change tracking
  if (currentRSS !== lastRSS) {
    const diff = currentRSS - lastRSS;
    const labelInfo = currentLabel ? ` [${currentLabel}]` : "";
    console.log(
      `RSS ${
        diff > 0 ? "increased" : "decreased"
      }: ${lastRSS} MB -> ${currentRSS} MB ` +
        `(${diff > 0 ? "+" : ""}${diff} MB) ` +
        `(uptime: ${Math.round(process.uptime())}s)${labelInfo}`
    );
    lastRSS = currentRSS;
  }
};

process.on("memoryLabel", (label) => {
  currentLabel = label;
  monitor();
});

export function startResourceMonitor(interval = 500) {
  monitor();
  return setInterval(monitor, interval);
}

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});
