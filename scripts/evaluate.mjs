// Runs real model trials against the running local server. This incurs API usage.
const args = process.argv.slice(2);
const value = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const trials = Number(value('--trials', '1'));
const scenarios = value('--scenarios', 'draft').split(',');
const origin = value('--url', 'http://127.0.0.1:4318');
if (!Number.isInteger(trials) || trials < 1 || trials > 10 || !scenarios.every(s => ['draft', 'unicode', 'longform'].includes(s))) throw new Error('Use --trials 1..10 and --scenarios draft,unicode,longform');
async function api(route, data) {
  const result = await fetch(origin + route, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Harness-Client': 'local' }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const body = await result.json(); if (!result.ok) throw new Error(body.error); return body;
}
const state = await api('/api/state');
if (!state.provider.configured) throw new Error('Open the local setup screen and configure a real model connection first.');
console.log(`Running ${trials * scenarios.length * 2} real model trials. Model: ${state.provider.model}. Same task, file/browser tools, starting files and budgets; optional verification and memory tools differ.`);
const runIds = [];
for (const scenario of scenarios) {
  for (let trial = 1; trial <= trials; trial++) {
    // Alternate execution order to reduce a consistent first/second ordering effect.
    for (const mode of trial % 2 ? ['minimal', 'engineered'] : ['engineered', 'minimal']) {
      const run = await api('/api/runs', { mode, scenario });
      runIds.push(run.id);
      await api(`/api/runs/${run.id}/start`, {});
      const began = Date.now();
      let latest;
      do {
        await new Promise(resolve => setTimeout(resolve, 1500));
        latest = await api(`/api/runs/${run.id}`);
        if (Date.now() - began > 15 * 60 * 1000) { await api(`/api/runs/${run.id}/pause`, {}); throw new Error(`Trial ${run.id} exceeded 15 minutes; paused.`); }
      } while (['running', 'pausing'].includes(latest.status) || latest.activeSessionStartedAt);
      // Independent presenter measurement after the agent stops. It cannot
      // influence that run's decisions or turn a failed run into a completion.
      latest = await api(`/api/runs/${run.id}/checks`, {});
      console.log(JSON.stringify({ trial, scenario, mode, id: run.id, status: latest.status, checks: latest.checks ? `${latest.checks.passed}/${latest.checks.total}` : 'unavailable', usage: latest.usage, elapsedMs: latest.elapsedMs }));
    }
  }
}
console.log('Trial IDs:', runIds.join(', '));
console.log('View Runs & evals in the dashboard for actual outcomes. Approval is not automatically granted by this script.');
