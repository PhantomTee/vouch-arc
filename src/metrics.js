// Prometheus text exposition format (no external deps).
// Metrics tracked:
//   vouch_escrows_created_total      — escrows created on-chain
//   vouch_escrows_settled_total      — escrows released to worker
//   vouch_disputes_raised_total      — disputes raised
//   vouch_disputes_resolved_total    — disputes resolved (auto or human)
//   vouch_verification_failures_total — code/inference verification failures
//   vouch_job_duration_seconds        — end-to-end job time histogram

const HELP = {
  vouch_escrows_created_total:          "Total escrows created on-chain",
  vouch_escrows_settled_total:          "Total escrows settled (paid to worker)",
  vouch_disputes_raised_total:          "Total disputes raised by clients",
  vouch_disputes_resolved_total:        "Total disputes resolved (auto or human review)",
  vouch_verification_failures_total:    "Total verification failures (code or inference)",
  vouch_job_duration_seconds:           "End-to-end job duration in seconds (histogram)",
};

const HISTOGRAM_BUCKETS = {
  vouch_job_duration_seconds: [1, 5, 15, 30, 60, 120, 300],
};

const counters = new Map();
const histograms = new Map();

function labelStr(labels) {
  const keys = Object.keys(labels);
  if (!keys.length) return "";
  return `{${keys.map((k) => `${k}="${String(labels[k]).replace(/"/g, '\\"')}"`).join(",")}}`;
}

export function inc(name, labels = {}, amount = 1) {
  const key = name + labelStr(labels);
  counters.set(key, (counters.get(key) ?? 0) + amount);
}

export function observe(name, value) {
  if (!histograms.has(name)) {
    const les = [...(HISTOGRAM_BUCKETS[name] ?? [0.1, 0.5, 1, 5, 10]), Infinity];
    histograms.set(name, { sum: 0, count: 0, buckets: new Map(les.map((le) => [le, 0])) });
  }
  const h = histograms.get(name);
  h.sum   += value;
  h.count += 1;
  for (const le of h.buckets.keys()) {
    if (value <= le) h.buckets.set(le, h.buckets.get(le) + 1);
  }
}

export function metricsText() {
  const lines = [];

  const countersByName = new Map();
  for (const [key, val] of counters) {
    const name = key.split("{")[0];
    if (!countersByName.has(name)) countersByName.set(name, []);
    countersByName.get(name).push([key, val]);
  }
  for (const [name, entries] of countersByName) {
    if (HELP[name]) lines.push(`# HELP ${name} ${HELP[name]}`);
    lines.push(`# TYPE ${name} counter`);
    for (const [key, val] of entries) lines.push(`${key} ${val}`);
  }

  for (const [name, h] of histograms) {
    if (HELP[name]) lines.push(`# HELP ${name} ${HELP[name]}`);
    lines.push(`# TYPE ${name} histogram`);
    for (const [le, count] of h.buckets) {
      lines.push(`${name}_bucket{le="${le === Infinity ? "+Inf" : le}"} ${count}`);
    }
    lines.push(`${name}_sum ${h.sum}`);
    lines.push(`${name}_count ${h.count}`);
  }

  return lines.join("\n") + "\n";
}
