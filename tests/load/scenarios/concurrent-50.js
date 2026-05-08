/**
 * Concurrent load test: 50 users running game theory experiments simultaneously.
 * Uses three real experiment scenarios with LLM-backed agents.
 *
 * Scenarios: Prisoner's Dilemma, Public Goods Game, Open Discussion
 * Run: k6 run -e BASE_URL=http://localhost:8000 tests/load/scenarios/concurrent-50.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Counter, Gauge } from "k6/metrics";
import { authenticate, createSimulation, advanceChain, checkHealth, SCENARIOS } from "../lib/helpers.js";

const createSimDuration = new Trend("create_simulation_duration", true);
const advanceDuration = new Trend("advance_chain_duration", true);
const errorCount = new Counter("errors");
const activeSims = new Gauge("active_simulations");

const scenarioKeys = Object.keys(SCENARIOS);

export const options = {
  stages: [
    { duration: "60s", target: 50 },  // Ramp to 50 users over 60s
    { duration: "120s", target: 50 }, // Hold 50 users for 2 min
    { duration: "30s", target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(90)<300000"],       // 5 min for LLM calls
    http_req_failed: ["rate<0.3"],             // Allow 30% failure under heavier load
    create_simulation_duration: ["p(90)<10000"],
    advance_chain_duration: ["p(90)<300000"],  // 5 min for advance with real LLM
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";

export default function () {
  const vuId = __VU;
  // Round-robin scenario selection across VUs
  const scenarioKey = scenarioKeys[(vuId - 1) % scenarioKeys.length];
  const scenario = SCENARIOS[scenarioKey];

  group(`VU ${vuId}: ${scenario.name}`, () => {
    const token = authenticate(BASE_URL);
    if (!token) {
      errorCount.add(1);
      return;
    }

    // Create simulation with this VU's assigned scenario
    let sim;
    group("Create Simulation", () => {
      const start = Date.now();
      sim = createSimulation(BASE_URL, token, `Load Test ${scenario.name} VU${vuId}`, scenario);
      createSimDuration.add(Date.now() - start);
      if (!sim?.id) {
        errorCount.add(1);
      }
    });

    if (!sim?.id) return;

    // Advance tree (1 turn)
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

    sleep(1);
  });
}
