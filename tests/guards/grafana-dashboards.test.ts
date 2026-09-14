import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* Provisioned dashboards are JSON that nothing type-checks and no test would
 * otherwise touch. They fail silently: a panel pointed at the wrong datasource
 * renders "No data" in exactly the same way as a panel whose query is correct
 * but whose system is idle, so the dashboard looks like it is working.
 *
 * That is not hypothetical — the four stat panels on the product dashboard
 * shipped asking Prometheus to run SQL, because the panel-level datasource was
 * left at the generator's default while the target carried the right one. */

const DASHBOARD_DIR = path.join(process.cwd(), "monitoring", "grafana", "dashboards");
const DATASOURCES = path.join(
  process.cwd(),
  "monitoring",
  "grafana",
  "provisioning",
  "datasources",
  "datasources.yml",
);

interface Target {
  refId?: string;
  datasource?: { type?: string; uid?: string };
  expr?: string;
  rawSql?: string;
  format?: string;
}

interface Panel {
  type: string;
  title: string;
  datasource?: { type?: string; uid?: string };
  targets?: Target[];
  gridPos?: { h: number; w: number; x: number; y: number };
}

interface Dashboard {
  uid: string;
  title: string;
  panels: Panel[];
  time?: { from: string; to: string };
}

const files = readdirSync(DASHBOARD_DIR).filter((f) => f.endsWith(".json"));

const dashboards: Array<[string, Dashboard]> = files.map((file) => [
  file,
  JSON.parse(readFileSync(path.join(DASHBOARD_DIR, file), "utf8")) as Dashboard,
]);

/* Parsed with a regex rather than a YAML dependency: the file is provisioning
 * config with a fixed shape, and the only thing needed from it is the set of
 * uids a dashboard is allowed to name. */
const declaredUids = new Set(
  [...readFileSync(DATASOURCES, "utf8").matchAll(/^\s*uid:\s*(\S+)\s*$/gm)].map((m) => m[1]!),
);

describe("provisioned dashboards", () => {
  it("ships at least one", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("declares the datasources they are provisioned with", () => {
    expect(declaredUids).toContain("canvasflow-prometheus");
    expect(declaredUids).toContain("canvasflow-postgres");
  });

  it.each(dashboards)("%s has a uid and a title", (_file, dash) => {
    expect(dash.uid).toBeTruthy();
    expect(dash.title).toBeTruthy();
    expect(Array.isArray(dash.panels)).toBe(true);
  });

  it("gives every dashboard a distinct uid", () => {
    const uids = dashboards.map(([, d]) => d.uid);
    expect(new Set(uids).size).toBe(uids.length);
  });
});

describe("every panel", () => {
  const panels = dashboards.flatMap(([file, dash]) =>
    dash.panels.map((panel) => [`${file} :: ${panel.title}`, panel] as const),
  );

  it.each(panels)("%s has at least one target", (_name, panel) => {
    expect(panel.targets?.length ?? 0).toBeGreaterThan(0);
  });

  it.each(panels)("%s is laid out", (_name, panel) => {
    expect(panel.gridPos).toBeDefined();
    expect(panel.gridPos!.w).toBeGreaterThan(0);
    expect(panel.gridPos!.h).toBeGreaterThan(0);
  });

  /* The bug this file exists for. */
  it.each(panels)("%s runs its queries against its own datasource", (_name, panel) => {
    const targetUids = new Set(
      (panel.targets ?? []).map((t) => t.datasource?.uid).filter(Boolean) as string[],
    );

    if (targetUids.size === 0) return;

    expect(
      targetUids.size,
      "a panel cannot mix datasources without an explicit mixed datasource",
    ).toBe(1);

    expect(
      panel.datasource?.uid,
      "panel datasource must match the datasource its targets name — Grafana runs the " +
        "panel's, so a mismatch renders No data with no error anywhere",
    ).toBe([...targetUids][0]);
  });

  it.each(panels)("%s names a datasource that is provisioned", (_name, panel) => {
    if (panel.datasource?.uid) expect(declaredUids).toContain(panel.datasource.uid);
  });

  /* A Prometheus panel carrying rawSql, or a Postgres panel carrying a PromQL
   * expression, is the same mistake wearing different clothes. */
  it.each(panels)("%s uses the query language its datasource speaks", (_name, panel) => {
    for (const target of panel.targets ?? []) {
      const uid = target.datasource?.uid;
      if (uid === "canvasflow-prometheus") {
        expect(target.expr, "a Prometheus target needs expr").toBeTruthy();
        expect(target.rawSql).toBeUndefined();
      }
      if (uid === "canvasflow-postgres") {
        expect(target.rawSql, "a Postgres target needs rawSql").toBeTruthy();
        expect(target.expr).toBeUndefined();
      }
    }
  });
});

/* Every panel on the product dashboard buckets by day. With Grafana's default
 * six-hour window each one renders "Data outside time range" — which reads as
 * a broken dashboard rather than a badly chosen window. */
describe("default time ranges", () => {
  it("gives the daily product dashboard a window wide enough to contain a day", () => {
    const product = dashboards.find(([, d]) => d.uid === "canvasflow-product")?.[1];
    expect(product).toBeDefined();
    expect(product!.time?.from).toMatch(/^now-(\d+)d$/);
  });

  /* Prometheus is configured with 15-day retention. A Prometheus panel on a
   * dashboard that defaults to a wider window than that renders a graph whose
   * left half is permanently blank — the data does not exist and never will.
   * Such a panel has to pin its own range with timeFrom. */
  const PROMETHEUS_RETENTION_DAYS = 15;

  it.each(dashboards)("%s keeps Prometheus panels inside the retention window", (_file, dash) => {
    const match = /^now-(\d+)d$/.exec(dash.time?.from ?? "");
    const windowDays = match ? Number(match[1]) : 0;
    if (windowDays <= PROMETHEUS_RETENTION_DAYS) return;

    for (const panel of dash.panels) {
      if (panel.datasource?.uid !== "canvasflow-prometheus") continue;
      expect(
        (panel as { timeFrom?: string }).timeFrom,
        `"${panel.title}" queries Prometheus on a ${windowDays}-day dashboard, but only ` +
          `${PROMETHEUS_RETENTION_DAYS} days are retained — pin it with timeFrom`,
      ).toBeTruthy();
    }
  });
});
