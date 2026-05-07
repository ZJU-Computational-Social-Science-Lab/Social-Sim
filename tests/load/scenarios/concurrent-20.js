/**
 * Concurrent load test: 20 users creating and running simulations simultaneously.
 * Simulates the launch event scenario with 2-second stagger.
 *
 * Run: k6 run -e BASE_URL=http://your-server:8090 tests/load/scenarios/concurrent-20.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Counter, Gauge } from "k6/metrics";
import { authenticate, createSimulation, advanceChain, checkHealth } from "../lib/helpers.js";

// Custom metrics
const createSimDuration = new Trend("create_simulation_duration", true);
const advanceDuration = new Trend("advance_chain_duration", true);
const errorCount = new Counter("errors");
const activeSims = new Gauge("active_simulations");

export const options = {
  stages: [
    { duration: "40s", target: 20 },   // Ramp to 20 users over 40s (2s stagger)
    { duration: "60s", target: 20 },   // Hold 20 users for 60s
    { duration: "20s", target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(90)<10000"],
    http_req_failed: ["rate<0.1"],
    create_simulation_duration: ["p(90)<5000"],
    advance_chain_duration: ["p(90)<60000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8090";

export default function () {
  const vuId = __VU;

  group(`VU ${vuId}: Full Simulation Lifecycle`, () => {
    // Auth (each VU gets unique email)
    const token = authenticate(BASE_URL, `load-vu${vuId}@test.com`, "testpass123");

    // Create simulation
    let sim;
    group("Create Simulation", () => {
      const start = Date.now();
      sim = createSimulation(BASE_URL, token, `Load Test VU${vuId}`);
      createSimDuration.add(Date.now() - start);
      if (!sim || !sim.id) {
        errorCount.add(1);
        return;
      }
    });

    if (!sim || !sim.id) return;

    // Advance tree (1 turn to keep it fast)
    group("Advance Chain", () => {
      const start = Date.now();
      advanceChain(BASE_URL, token, sim.id, 1);
      advanceDuration.add(Date.now() - start);
    });

    // Check health
    const health = checkHealth(BASE_URL);
    if (health) {
      activeSims.add(health.active_simulations || 0);
    }

    // Brief pause between iterations
    sleep(1);
  });
}
