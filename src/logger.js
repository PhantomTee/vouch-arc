import { hostname as getHostname } from "node:os";

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
const levelMin = LEVELS[(process.env.LOG_LEVEL ?? "info").toLowerCase()] ?? LEVELS.info;
const pid = process.pid;
const host = getHostname();

function write(level, msg, extra) {
  if (level < levelMin) return;
  const line = JSON.stringify({ level, time: Date.now(), pid, hostname: host, msg, ...extra });
  process.stderr.write(line + "\n");
}

function makeLogger(bindings = {}) {
  return {
    trace: (msg, x = {}) => write(10, msg, { ...bindings, ...x }),
    debug: (msg, x = {}) => write(20, msg, { ...bindings, ...x }),
    info:  (msg, x = {}) => write(30, msg, { ...bindings, ...x }),
    warn:  (msg, x = {}) => write(40, msg, { ...bindings, ...x }),
    error: (msg, x = {}) => write(50, msg, { ...bindings, ...x }),
    fatal: (msg, x = {}) => write(60, msg, { ...bindings, ...x }),
    child: (b) => makeLogger({ ...bindings, ...b }),
  };
}

export const logger = makeLogger();
