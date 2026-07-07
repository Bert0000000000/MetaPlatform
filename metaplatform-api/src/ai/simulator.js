/**
 * Discrete-Event Simulator (Phase 4 — Data Stack)
 *
 * Monte Carlo simulation for process / queue / capacity what-if scenarios.
 * Models a set of resources handling arrivals with stochastic inter-arrival
 * and service times.
 *
 * Example scenarios:
 *   - "What if 10 agents handle 100 calls/hour with 5min average service time?"
 *   - "What if our data ingestion pipeline has 4 workers and 200 jobs/min?"
 *
 * Inputs:
 *   - arrivalsPerHour (target arrival rate, or seed an empirical distribution)
 *   - serviceTimeSec  (mean service time, exponential by default)
 *   - resources       (number of parallel servers)
 *   - durationHours   (sim window)
 *   - trials          (number of Monte Carlo runs)
 *
 * Outputs per trial:
 *   - utilization     (fraction of time resources were busy)
 *   - avgWaitSec      (average time jobs spent in queue)
 *   - p95WaitSec      (95th percentile wait)
 *   - maxQueueLength  (peak concurrent queue size)
 *   - completedJobs
 */

// Box-Muller transform for standard normal
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function randExp(mean) {
  return -mean * Math.log(1 - Math.random());
}

function quantile(sortedArr, q) {
  if (sortedArr.length === 0) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] !== undefined) {
    return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
  }
  return sortedArr[base];
}

/**
 * Run a single simulation trial.
 */
function runTrial({
  arrivalsPerHour,
  serviceTimeSec,
  resources,
  durationHours,
}) {
  const totalArrivals = Math.round(arrivalsPerHour * durationHours);
  const interArrivalMeanSec = 3600 / arrivalsPerHour;

  const serverAvailableAt = new Array(resources).fill(0); // epoch seconds
  const waitTimes = [];
  let maxQueueLength = 0;
  let completed = 0;
  let totalBusySec = 0;

  let clock = 0;
  const queue = []; // jobs waiting

  // Generate arrivals in order
  for (let i = 0; i < totalArrivals; i++) {
    const inter = Math.max(0.01, randExp(interArrivalMeanSec));
    clock += inter;

    // Assign job to the earliest-available server
    const nextServer = serverAvailableAt.indexOf(Math.min(...serverAvailableAt));
    if (serverAvailableAt[nextServer] <= clock) {
      // No wait
      const svc = Math.max(0.01, randExp(serviceTimeSec));
      serverAvailableAt[nextServer] = clock + svc;
      totalBusySec += svc;
      completed++;
      waitTimes.push(0);
    } else {
      // Queue
      queue.push(clock);
      maxQueueLength = Math.max(maxQueueLength, queue.length);
    }
  }

  // Drain queue
  while (queue.length > 0) {
    const nextServer = serverAvailableAt.indexOf(Math.min(...serverAvailableAt));
    const nextTime = Math.max(serverAvailableAt[nextServer], queue[0]);
    const svc = Math.max(0.01, randExp(serviceTimeSec));
    serverAvailableAt[nextServer] = nextTime + svc;
    totalBusySec += svc;
    waitTimes.push(nextTime - queue.shift());
    completed++;
  }

  const utilization = totalBusySec / (resources * durationHours * 3600);
  const sortedWait = waitTimes.sort((a, b) => a - b);
  return {
    utilization: Number(utilization.toFixed(4)),
    avgWaitSec: Number((waitTimes.reduce((s, x) => s + x, 0) / Math.max(waitTimes.length, 1)).toFixed(2)),
    p50WaitSec: Number(quantile(sortedWait, 0.5).toFixed(2)),
    p95WaitSec: Number(quantile(sortedWait, 0.95).toFixed(2)),
    p99WaitSec: Number(quantile(sortedWait, 0.99).toFixed(2)),
    maxQueueLength,
    completedJobs: completed,
  };
}

/**
 * Run multiple Monte Carlo trials and aggregate.
 *
 * @param {object} params
 * @returns {Promise<{mean, p95, distribution, trials}>}
 */
export async function simulate(params) {
  const {
    arrivalsPerHour = 100,
    serviceTimeSec = 300,        // 5 minutes
    resources = 5,
    durationHours = 8,
    trials = 100,
  } = params;

  const results = [];
  for (let i = 0; i < trials; i++) {
    results.push(runTrial({ arrivalsPerHour, serviceTimeSec, resources, durationHours }));
  }

  // Aggregate across trials
  const mean = (key) => results.reduce((s, r) => s + r[key], 0) / results.length;
  const values = (key) => results.map((r) => r[key]).sort((a, b) => a - b);

  const utilization = values("utilization");
  const wait = values("avgWaitSec");
  const p95Wait = values("p95WaitSec");

  return {
    params,
    trials,
    mean: {
      utilization: Number(mean("utilization").toFixed(4)),
      avgWaitSec: Number(mean("avgWaitSec").toFixed(2)),
      p95WaitSec: Number(mean("p95WaitSec").toFixed(2)),
      completedJobs: Math.round(mean("completedJobs")),
    },
    percentiles: {
      utilization_p50: Number(quantile(utilization, 0.5).toFixed(4)),
      utilization_p95: Number(quantile(utilization, 0.95).toFixed(4)),
      wait_p50: Number(quantile(wait, 0.5).toFixed(2)),
      wait_p95: Number(quantile(wait, 0.95).toFixed(2)),
      p95Wait_p95: Number(quantile(p95Wait, 0.95).toFixed(2)),
    },
    sampleTrial: results[0],
    timestamp: new Date().toISOString(),
  };
}

export default { simulate };