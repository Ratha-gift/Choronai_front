"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Box } from "@/components/ui/box";
import { useCollection } from "@/data/collections";
import { useLanguage } from "@/i18n";
import { LoginHistory } from "@/components/layout/login-history";

type Metrics = {
  time: string;
  uptime: number;
  processUptime: number;
  node: string;
  platform: string;
  cpu: { percent: number; cores: number; model: string };
  memory: { total: number; used: number };
  disk: { total: number; used: number } | null;
  network: { name: string; address: string }[];
};
type Level = "error" | "warning" | "backup" | "security" | "info";
type Log = { id: number; time: string; level: Level; text: string };

const LEVEL_LABEL: Record<Level, string> = {
  error: "danger",
  warning: "warning",
  backup: "info",
  security: "primary",
  info: "default",
};

const gb = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;
const pct = (used: number, total: number) =>
  total ? Math.round((used / total) * 100) : 0;
function duration(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}
const tone = (value: number) =>
  value >= 90 ? "bad" : value >= 75 ? "warn" : "good";

function Meter({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="sv-card">
      <div className="sv-card-head">
        <span>{label}</span>
        <b>{value}%</b>
      </div>
      <div className="sv-meter">
        <i className={tone(value)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <small className="muted">{detail}</small>
    </div>
  );
}

function Status({ ok, children }: { ok: boolean; children: string }) {
  return (
    <div className="sv-card sv-status">
      <i className={`sv-dot ${ok ? "good" : "bad"}`} />
      <div>
        <b>{children}</b>
        <small className={ok ? "sv-ok" : "text-danger"}>{ok ? "Online" : "Offline"}</small>
      </div>
    </div>
  );
}

export default function ServerStatusPage() {
  const { l } = useLanguage();
  const branches = useCollection("branches").rows;
  const sales = useCollection("sales").rows;

  const [m, setM] = useState<Metrics | null>(null);
  const [apiOk, setApiOk] = useState(true);
  const [dbOk, setDbOk] = useState(true);
  const [latency, setLatency] = useState(0);
  const [checkedAt, setCheckedAt] = useState("");
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [filter, setFilter] = useState<Level | "all">("all");
  const counter = useRef(0);
  const flags = useRef({ cpu: false, mem: false, disk: false, api: true });

  const addLog = useCallback((level: Level, text: string) => {
    setLogs((old) =>
      [{ id: ++counter.current, time: new Date().toLocaleTimeString(), level, text }, ...old].slice(0, 100),
    );
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/server", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Metrics;
      setLatency(Math.round(performance.now() - start));
      setM(data);
      setApiOk(true);
      if (!flags.current.api) addLog("info", "API recovered");
      flags.current.api = true;

      const cpu = data.cpu.percent;
      const mem = pct(data.memory.used, data.memory.total);
      const disk = data.disk ? pct(data.disk.used, data.disk.total) : 0;
      if (cpu >= 85 !== flags.current.cpu) {
        flags.current.cpu = cpu >= 85;
        if (cpu >= 85) addLog("warning", `High CPU usage: ${cpu}%`);
      }
      if (mem >= 85 !== flags.current.mem) {
        flags.current.mem = mem >= 85;
        if (mem >= 85) addLog("warning", `High memory usage: ${mem}%`);
      }
      if (disk >= 90 !== flags.current.disk) {
        flags.current.disk = disk >= 90;
        if (disk >= 90) addLog("error", `Disk almost full: ${disk}%`);
      }
    } catch {
      setApiOk(false);
      if (flags.current.api) addLog("error", "API request failed");
      flags.current.api = false;
    }
    try {
      localStorage.setItem("sv-test", "1");
      localStorage.removeItem("sv-test");
      setDbOk(true);
    } catch {
      setDbOk(false);
    }
    setCheckedAt(new Date().toLocaleTimeString());
    setBusy(false);
  }, [addLog]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [auto, load]);
  // Real sign-ins come from the server: see <LoginHistory /> below.

  function backup() {
    const data: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith("choronai-")) data[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `choronai-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    localStorage.setItem("choronai-last-backup", new Date().toISOString());
    addLog("backup", `Backup downloaded (${Object.keys(data).length} collections)`);
  }

  const mem = m ? pct(m.memory.used, m.memory.total) : 0;
  const disk = m?.disk ? pct(m.disk.used, m.disk.total) : 0;
  const lastBackup =
    typeof window !== "undefined" ? localStorage.getItem("choronai-last-backup") : null;
  const shown = filter === "all" ? logs : logs.filter((x) => x.level === filter);

  return (
    <div className="sv-page">
      {/* Page bar that stays at the top while the sections scroll. */}
      <header className="box-header sv-topbar">
        <span className="box-icon">
          <Icon name="dashboard" />
        </span>
        <h2>{l(["Server Status", "ស្ថានភាព Server"])}</h2>
        <div className="box-actions">
          <a href="/">
            <Icon name="home" size={15} />
            <span>{l(["Back to Dashboard", "ត្រឡប់ទៅផ្ទាំងគ្រប់គ្រង"])}</span>
          </a>
        </div>
      </header>
      <Box icon="list" title="System Overview">
        <div className="sv-toolbar">
          <span className="muted">
            {l(["Last checked", "ពិនិត្យចុងក្រោយ"])}: {checkedAt || "—"}
          </span>
          <label className="checkbox-inline">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            {l(["Auto refresh (10s)", "ផ្ទុកឡើងវិញស្វ័យប្រវត្តិ (10វិ)"])}
          </label>
          <button className="btn btn-default" disabled={busy} onClick={load}>
            {l(["Refresh", "ផ្ទុកឡើងវិញ"])}
          </button>
        </div>
        <div className="sv-grid">
          <Status ok={apiOk && !!m}>Server</Status>
          <Status ok={dbOk}>Database</Status>
          <Status ok={apiOk}>API</Status>
          <div className="sv-card">
            <div className="sv-card-head"><span>Uptime</span></div>
            <b className="sv-big">{m ? duration(m.uptime) : "—"}</b>
            <small className="muted">API: {apiOk ? `${latency} ms` : "—"}</small>
          </div>
        </div>
        {m && (
          <p className="help-note">
            {m.platform} · Node {m.node} · {l(["App running", "កម្មវិធីដើរ"])} {duration(m.processUptime)}
          </p>
        )}
      </Box>

      <Box icon="chart" title="Resource Monitoring">
        <div className="sv-grid">
          <Meter label="CPU" value={m?.cpu.percent ?? 0} detail={m ? `${m.cpu.cores} cores` : "—"} />
          <Meter label="RAM" value={mem} detail={m ? `${gb(m.memory.used)} / ${gb(m.memory.total)}` : "—"} />
          <Meter
            label="Disk"
            value={disk}
            detail={m?.disk ? `${gb(m.disk.used)} / ${gb(m.disk.total)}` : l(["Not available", "មិនមាន"])}
          />
          <div className="sv-card">
            <div className="sv-card-head"><span>Network</span></div>
            {m?.network.length ? (
              m.network.map((n) => (
                <small key={n.name + n.address} className="sv-net">
                  <b>{n.name}</b> {n.address}
                </small>
              ))
            ) : (
              <small className="muted">—</small>
            )}
            <small className="muted">Latency: {apiOk ? `${latency} ms` : "—"}</small>
          </div>
        </div>
      </Box>

      <Box icon="home" title="Branch Monitoring">
        <div className="table-responsive">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{l(["Branch", "សាខា"])}</th>
                <th>{l(["Sales", "ការលក់"])}</th>
                <th>{l(["Total", "សរុប"])}</th>
                <th>{l(["Last sale", "ការលក់ចុងក្រោយ"])}</th>
                <th>{l(["Status", "ស្ថានភាព"])}</th>
              </tr>
            </thead>
            <tbody>
              {branches.length === 0 && (
                <tr><td colSpan={5} className="no-data">—</td></tr>
              )}
              {branches.map((b) => {
                const name = String(b.name);
                const mine = sales.filter((s) => s.branch === name);
                const total = mine.reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0);
                const last = mine.map((s) => String(s.date)).sort().pop();
                const active = !!last && Date.now() - new Date(last).getTime() < 7 * 86400000;
                return (
                  <tr key={b.id}>
                    <td>{name}</td>
                    <td>{mine.length}</td>
                    <td>{total.toLocaleString()} ៛</td>
                    <td>{last ? new Date(last).toLocaleString() : "—"}</td>
                    <td>
                      <span className={`label label-${active ? "success" : "warning"}`}>
                        {active ? "Active" : "Idle"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="help-note">
          {l(["Active = a sale in the last 7 days.", "Active = មានការលក់ក្នុង ៧ ថ្ងៃចុងក្រោយ។"])}
        </p>
      </Box>

      <Box icon="alert" title="Logs & Alerts">
        <div className="sv-toolbar">
          <div className="segmented">
            {(["all", "error", "warning", "backup", "security"] as const).map((x) => (
              <button key={x} className={filter === x ? "active" : ""} onClick={() => setFilter(x)}>
                {x}
              </button>
            ))}
          </div>
          <span className="muted">
            Backup: {lastBackup ? new Date(lastBackup).toLocaleString() : l(["never", "មិនទាន់មាន"])}
          </span>
          <button className="btn btn-primary" onClick={backup}>
            {l(["Backup now", "Backup ឥឡូវ"])}
          </button>
        </div>
        <ul className="sv-logs">
          {shown.length === 0 && <li className="muted">—</li>}
          {shown.map((log) => (
            <li key={log.id}>
              <span className="muted">{log.time}</span>
              <span className={`label label-${LEVEL_LABEL[log.level]}`}>{log.level}</span>
              <span>{log.text}</span>
            </li>
          ))}
        </ul>
      </Box>
      <LoginHistory />
    </div>
  );
}