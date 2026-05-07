/**
 * Shared helpers for k6 load test scenarios.
 *
 * Provides authentication, simulation creation, and tree advancement
 * utilities used across all test scenarios.
 */

import http from "k6/http";
import { check } from "k6";

/**
 * Authenticate and get JWT access token.
 * Registers user if login fails (first-run auto-registration).
 */
export function authenticate(baseUrl, email, password) {
  // Try login first
  let loginRes = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({
    email: email,
    password: password,
  }), { headers: { "Content-Type": "application/json" } });

  if (loginRes.status === 200) {
    return loginRes.json("access_token");
  }

  // Register if login fails
  let regRes = http.post(`${baseUrl}/api/auth/register`, JSON.stringify({
    email: email,
    password: password,
    full_name: `Load Test User`,
  }), { headers: { "Content-Type": "application/json" } });

  check(regRes, { "register ok": (r) => r.status === 201 });

  // Login after registration
  loginRes = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({
    email: email,
    password: password,
  }), { headers: { "Content-Type": "application/json" } });

  check(loginRes, { "login ok": (r) => r.status === 200 });
  return loginRes.json("access_token");
}

/**
 * Create a simulation with a simple village scene.
 *
 * @param {string} baseUrl - Target server URL
 * @param {string} token   - JWT access token
 * @param {string} name    - Simulation name
 * @param {string} provider - LLM provider dialect: "mock" (default), "ollama", or "openai".
 *                            Pass "ollama" or "openai" in the mixed-providers scenario to
 *                            trigger real LLM calls. Requires matching provider to be
 *                            configured and reachable from the server.
 */
export function createSimulation(baseUrl, token, name, provider = "mock") {
  const llmConfig = provider === "mock"
    ? { dialect: "mock" }
    : { dialect: provider };

  const payload = {
    name: name,
    scene_type: "village",
    scene_config: {
      max_turns: 10,
    },
    agent_config: {
      agents: [
        {
          name: "Alice",
          profile: "A test agent",
          role: "villager",
          llm_config: llmConfig,
        },
        {
          name: "Bob",
          profile: "Another test agent",
          role: "villager",
          llm_config: llmConfig,
        },
      ],
    },
  };

  const res = http.post(`${baseUrl}/api/simulations`, JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  check(res, { "create sim ok": (r) => r.status === 201 });
  return res.json();
}

/**
 * Advance a simulation tree chain from the root node.
 */
export function advanceChain(baseUrl, token, simId, turns) {
  const res = http.post(
    `${baseUrl}/api/simulations/${simId}/tree/advance_chain`,
    JSON.stringify({ parent: 1, turns: turns }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      timeout: "120s",
    }
  );

  check(res, { "advance ok": (r) => r.status === 200 });
  return res.json();
}

/**
 * Check the health endpoint and return metrics.
 */
export function checkHealth(baseUrl) {
  const res = http.get(`${baseUrl}/api/health`);
  check(res, { "health ok": (r) => r.status === 200 });
  return res.json();
}
