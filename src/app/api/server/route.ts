import os from "os";
import { statfs } from "fs/promises";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function snapshot() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const value of Object.values(cpu.times)) total += value;
    idle += cpu.times.idle;
  }
  return { idle, total };
}
let previous = snapshot();

function cpuPercent() {
  const now = snapshot();
  const total = now.total - previous.total;
  const idle = now.idle - previous.idle;
  previous = now;
  return total > 0 ? Math.round((1 - idle / total) * 100) : 0;
}

export async function GET() {
  let disk: { total: number; used: number } | null = null;
  try {
    const s = await statfs(process.cwd());
    const total = s.blocks * s.bsize;
    disk = { total, used: total - s.bavail * s.bsize };
  } catch {
    disk = null;
  }
  const total = os.totalmem();
  const network = Object.entries(os.networkInterfaces()).flatMap(
    ([name, list]) =>
      (list ?? [])
        .filter((item) => item.family === "IPv4" && !item.internal)
        .map((item) => ({ name, address: item.address })),
  );
  return NextResponse.json({
    time: new Date().toISOString(),
    uptime: os.uptime(),
    processUptime: process.uptime(),
    node: process.version,
    platform: `${os.type()} ${os.release()}`,
    cpu: {
      percent: cpuPercent(),
      cores: os.cpus().length,
      model: os.cpus()[0]?.model ?? "",
    },
    memory: { total, used: total - os.freemem() },
    disk,
    network,
  });
}