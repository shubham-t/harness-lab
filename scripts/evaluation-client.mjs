// Terminal status can be visible before the runner releases its operation lock.
// Retry only that explicit conflict; do not hide a failed browser assessment.
export async function evaluateStoppedRun(api, id, { wait = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 40 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const run = await api(`/api/runs/${id}`);
    if (!['running', 'pausing'].includes(run.status) && !run.activeSessionStartedAt) {
      try { return await api(`/api/runs/${id}/checks`, {}); }
      catch (error) {
        if (error.message !== 'This run is busy. Pause it and wait for the current operation to finish.') throw error;
      }
    }
    if (attempt + 1 < attempts) await wait(250);
  }
  throw new Error(`Run ${id} has not released its operation lock; evaluation was not completed.`);
}
