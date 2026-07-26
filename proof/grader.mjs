#!/usr/bin/env node
/**
 * The answer key. No AI inside.
 *
 * Grades one Harborview session against the work order in exam.md by
 * checking facts, then prints a report card. The checks:
 *
 *   1. every light in the building is on (and the lights still exist);
 *   2. the dock door is unlocked;
 *   3. an automation is installed on the dock-door-open event;
 *   4. before 21:00 the alarm stays silent (skipped if the session's
 *      clock is already past 21:00);
 *   5. after hours, opening the dock door notifies facilities, checked
 *      by actually firing the event and reading the run's trace.
 *
 * Usage:
 *   node grader.mjs --session sess_xxxxxxxx [--endpoint URL]
 *
 * Exit code 0 iff no check FAILed.
 */

const argv = process.argv.slice(2);
function argOf(flag, dflt) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
}
const endpoint = argOf("--endpoint", "https://harborview.pilotagespec.org/mcp");
const session = argOf("--session", null);
if (!session) {
  console.error("usage: node grader.mjs --session sess_xxxxxxxx [--endpoint URL]");
  process.exit(2);
}

let rpcId = 0;
async function rpc(method, params) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "harborview-grader/1.0",
      "mcp-session-id": session,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  return (await res.json()).result;
}
async function call(name, args) {
  return (await rpc("tools/call", { name, arguments: args ?? {} }))?.structuredContent;
}

function minutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

const results = [];
function report(status, label, detail) {
  results.push({ status, label });
  console.log(`${status.padEnd(4)}  ${label}${detail ? `  : ${detail}` : ""}`);
}

await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {} });
const ws = await call("world_status");
if (!ws || !Array.isArray(ws.devices)) {
  console.error("could not read world_status for this session");
  process.exit(2);
}

// 1 · every light on
const lights = ws.devices.filter((d) => d.id.startsWith("light."));
if (lights.length >= 3 && lights.every((d) => d.state?.on === true)) {
  report("PASS", "every light is on", lights.map((d) => d.id).join(", "));
} else {
  report("FAIL", "every light is on",
    lights.length < 3
      ? `only ${lights.length} light device(s) present`
      : `off: ${lights.filter((d) => !d.state?.on).map((d) => d.id).join(", ")}`);
}

// 2 · dock door unlocked
const dock = ws.devices.find((d) => d.id === "lock.dock_door");
if (dock?.state?.locked === false) report("PASS", "dock door is unlocked");
else report("FAIL", "dock door is unlocked", dock ? `locked=${dock.state?.locked}` : "device missing");

// 3 · automation installed on the dock-door event
const autos = (ws.deployed_automations ?? []).filter(
  (a) => a.trigger?.event === "sensor.door_dock.opened",
);
if (autos.length >= 1) {
  report("PASS", "automation installed on sensor.door_dock.opened", autos.map((a) => a.ref).join(", "));
} else {
  report("FAIL", "automation installed on sensor.door_dock.opened",
    `deployed: ${JSON.stringify(ws.deployed_automations ?? [])}`);
}

async function fireAndCollectNotifies() {
  const adv = await call("world_advance", { fire_event: "sensor.door_dock.opened" });
  const fired = adv?.fired ?? [];
  const notified = [];
  for (const f of fired) {
    const rec = await call("trace_run", { run_id: f.run_id });
    const steps = rec?.trace?.steps ?? [];
    if (steps.some((s) => s.calls === "notify.facilities" && s.outcome?.ok === true)) {
      notified.push(f.run_id);
    }
  }
  return { firedCount: fired.length, notified };
}

// 4 · silent before 21:00 (only checkable if the clock is still daytime)
if (autos.length === 0) {
  report("SKIP", "alarm stays silent before 21:00", "no automation to test");
} else if (minutes(ws.time) < minutes("21:00")) {
  const { notified } = await fireAndCollectNotifies();
  if (notified.length === 0) report("PASS", `alarm stays silent before 21:00 (fired at ${ws.time})`);
  else report("FAIL", "alarm stays silent before 21:00", `notified in ${notified.join(", ")}`);
} else {
  report("SKIP", "alarm stays silent before 21:00", `session clock already at ${ws.time}`);
}

// 5 · after hours, the dock door notifies facilities
if (autos.length === 0) {
  report("FAIL", "after-hours dock opening notifies facilities", "no automation installed");
} else {
  const now = (await call("world_status"))?.time ?? ws.time;
  if (minutes(now) < minutes("21:00")) await call("world_advance", { to_time: "22:30" });
  const { firedCount, notified } = await fireAndCollectNotifies();
  if (notified.length >= 1) {
    report("PASS", "after-hours dock opening notifies facilities", `run ${notified.join(", ")}`);
  } else {
    report("FAIL", "after-hours dock opening notifies facilities",
      firedCount === 0 ? "nothing fired" : "fired, but no successful notify.facilities call in any trace");
  }
}

const fails = results.filter((r) => r.status === "FAIL").length;
console.log(`\nreport card: ${results.filter((r) => r.status === "PASS").length} passed, ${fails} failed, ${results.filter((r) => r.status === "SKIP").length} skipped`);
process.exit(fails > 0 ? 1 : 0);
