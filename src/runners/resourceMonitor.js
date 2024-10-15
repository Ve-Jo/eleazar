import os from "os";

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function monitorResources() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  console.log("=== Resource Usage ===");
  console.log(
    `RAM: ${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${(
      (usedMem / totalMem) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `Heap: ${formatBytes(memUsage.heapUsed)} / ${formatBytes(
      memUsage.heapTotal
    )}`
  );
  console.log(
    `CPU: User ${cpuUsage.user / 1000000}s, System ${
      cpuUsage.system / 1000000
    }s`
  );
  console.log("=====================");
}

export function startResourceMonitor(interval = 60000) {
  setInterval(monitorResources, interval);
}
