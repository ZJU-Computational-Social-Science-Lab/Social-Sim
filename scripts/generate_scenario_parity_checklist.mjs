import fs from "node:fs";
import { execSync } from "node:child_process";

const repoRoot = "/Users/jianqiaolong/Documents/GitHub/Social-Sim";
const serverRegistry = execSync(
  `git -C ${repoRoot} show origin/server:src/socialsim4/core/scenarios/registry.py`,
  { encoding: "utf8" }
);

const serverEn = JSON.parse(
  execSync(`git -C ${repoRoot} show origin/server:frontend/locales/en.json`, {
    encoding: "utf8",
  })
);
const serverZh = JSON.parse(
  execSync(`git -C ${repoRoot} show origin/server:frontend/locales/zh.json`, {
    encoding: "utf8",
  })
);
const currentEn = JSON.parse(
  fs.readFileSync(`${repoRoot}/frontend/locales/en.json`, "utf8")
);
const currentZh = JSON.parse(
  fs.readFileSync(`${repoRoot}/frontend/locales/zh.json`, "utf8")
);

const DISTORTION_ONLY_PARAM_KEYS = new Set([
  "distortion_strength",
  "conflict_sensitivity",
  "block_probability",
]);

const PAYOFF_KEYS = new Set([
  "cooperate_reward",
  "sucker_penalty",
  "temptation_reward",
  "defect_penalty",
]);

const ACTION_EDITOR_SCENARIOS = new Set(["battle_of_the_sexes", "stag_hunt"]);
const ACTION_EDITOR_KEYS = new Set([
  "action_1_name",
  "action_1_description",
  "action_2_name",
  "action_2_description",
]);

const PAYOFF_FALLBACKS = {
  cooperate_reward: 3,
  sucker_penalty: 0,
  temptation_reward: 5,
  defect_penalty: 1,
};

const RESOURCE_CONFIG_FALLBACKS = {
  resource_name: "Tokens",
  resource_name_custom: "",
  initial_amount: 20,
  multiplier: 1.5,
  action_name: "Contribute",
  action_description: "Contribute {resource} to the shared pool",
};

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function extractBalancedBlock(text, startIndex, openChar, closeChar) {
  const start = text.indexOf(openChar, startIndex);
  if (start === -1) return "";

  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (!inDouble && char === "'") {
      inSingle = !inSingle;
      continue;
    }

    if (!inSingle && char === '"') {
      inDouble = !inDouble;
      continue;
    }

    if (inSingle || inDouble) {
      continue;
    }

    if (char === openChar) {
      depth += 1;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return "";
}

function extractDictBlock(text, startIndex) {
  return extractBalancedBlock(text, startIndex, "{", "}");
}

function extractListBlock(text, startIndex) {
  return extractBalancedBlock(text, startIndex, "[", "]");
}

function parseDefault(raw) {
  if (!raw) return "";
  const value = raw.trim().replace(/,$/, "");

  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  if (value === "True") return true;
  if (value === "False") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);

  if ((value.startsWith("[") && value.endsWith("]")) || (value.startsWith("{") && value.endsWith("}"))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function extractTopLevelObjects(listText) {
  const objects = [];
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let start = -1;

  for (let i = 0; i < listText.length; i += 1) {
    const char = listText[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (!inDouble && char === "'") {
      inSingle = !inSingle;
      continue;
    }

    if (!inSingle && char === '"') {
      inDouble = !inDouble;
      continue;
    }

    if (inSingle || inDouble) {
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        objects.push(listText.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function parseScenarioBlock(block) {
  const id = (block.match(/"id"\s*:\s*"([^"]+)"/) || [])[1] || "";
  const category =
    (block.match(/"category"\s*:\s*"([^"]+)"/) || [])[1] || "";
  const displayType =
    (block.match(/"display_type"\s*:\s*"([^"]+)"/) || [])[1] || "";
  const scenarioName = (block.match(/"name"\s*:\s*"([^"]+)"/) || [])[1] || "";

  const actions = [];
  const actionsMatch = block.match(
    /"actions"\s*:\s*\[(.*?)\]\s*,\s*(?:"category_actions"|"default_action_ids"|}\s*,?$)/s
  );

  if (actionsMatch) {
    const actionRegex =
      /\{[^{}]*"name"\s*:\s*"([^"]+)"[^{}]*"description"\s*:\s*"([^"]*)"[^{}]*\}/g;
    let match;
    while ((match = actionRegex.exec(actionsMatch[1]))) {
      actions.push({ name: match[1], description: match[2] });
    }
  }

  const params = [];
  const parametersKeyIndex = block.indexOf('"parameters"');
  if (parametersKeyIndex !== -1) {
    const paramsList = extractListBlock(block, parametersKeyIndex);
    const paramText = paramsList.slice(1, -1);
    const paramObjects = extractTopLevelObjects(paramText);

    for (const obj of paramObjects) {
      const key = (obj.match(/"key"\s*:\s*"([^"]+)"/) || [])[1];
      if (!key) continue;

      const label = (obj.match(/"label"\s*:\s*"([^"]*)"/) || [])[1] || "";
      const type = (obj.match(/"type"\s*:\s*"([^"]+)"/) || [])[1] || "";
      const uiHint = (obj.match(/"ui_hint"\s*:\s*"([^"]+)"/) || [])[1] || "";
      const description =
        (obj.match(/"description"\s*:\s*"([^"]*)"/) || [])[1] || "";
      const defaultRaw =
        (obj.match(/"default"\s*:\s*([^\n]+)\n/) || [])[1] || "";

      params.push({
        key,
        label,
        type,
        uiHint,
        description,
        default: parseDefault(defaultRaw),
      });
    }
  }

  return { id, category, displayType, scenarioName, actions, params };
}

function parseServerScenarios(registryText) {
  const scenarioRegex = /([A-Z0-9_]+): Dict\[str, Any\] = \{/g;
  const scenarios = [];
  let match;

  while ((match = scenarioRegex.exec(registryText))) {
    const block = extractDictBlock(registryText, match.index);
    if (!block) continue;

    const parsed = parseScenarioBlock(block);
    if (parsed.id) scenarios.push(parsed);
  }

  return scenarios;
}

function uiVisibility(scenarioId, displayType, paramKey) {
  if (displayType === "payoff_matrix") {
    if (PAYOFF_KEYS.has(paramKey)) return "yes (PayoffInput)";
    if (ACTION_EDITOR_SCENARIOS.has(scenarioId) && ACTION_EDITOR_KEYS.has(paramKey)) {
      return "yes (ActionEditor)";
    }
    return "no";
  }

  if (scenarioId === "policy_erosion" && DISTORTION_ONLY_PARAM_KEYS.has(paramKey)) {
    return "conditional (only when cascade_mode=distortion_cascade)";
  }

  return "yes (ParameterField)";
}

function defaultMatch(scenario, param) {
  if (Object.prototype.hasOwnProperty.call(PAYOFF_FALLBACKS, param.key)) {
    return Object.is(PAYOFF_FALLBACKS[param.key], param.default)
      ? "yes"
      : `no (PayoffInput fallback=${JSON.stringify(PAYOFF_FALLBACKS[param.key])})`;
  }

  if (
    scenario.id === "public_goods" &&
    Object.prototype.hasOwnProperty.call(RESOURCE_CONFIG_FALLBACKS, param.key)
  ) {
    return Object.is(RESOURCE_CONFIG_FALLBACKS[param.key], param.default)
      ? "yes"
      : `no (ResourceConfig fallback=${JSON.stringify(
          RESOURCE_CONFIG_FALLBACKS[param.key]
        )})`;
  }

  if (ACTION_EDITOR_SCENARIOS.has(scenario.id) && ACTION_EDITOR_KEYS.has(param.key)) {
    const actionIndex = param.key.startsWith("action_1") ? 0 : 1;
    const field = param.key.endsWith("_name") ? "name" : "description";
    const actionValue = scenario.actions[actionIndex]?.[field] || "";

    return actionValue === param.default
      ? "yes"
      : `check (ActionEditor uses actions[${actionIndex}].${field}=${JSON.stringify(
          actionValue
        )})`;
  }

  return "yes";
}

function copyMatch(param) {
  const key = param.key;

  const serverEnLabel = getByPath(serverEn, `experimentBuilder.paramLabels.${key}`);
  const currentEnLabel = getByPath(currentEn, `experimentBuilder.paramLabels.${key}`);
  const serverZhLabel = getByPath(serverZh, `experimentBuilder.paramLabels.${key}`);
  const currentZhLabel = getByPath(currentZh, `experimentBuilder.paramLabels.${key}`);

  const serverEnDesc = getByPath(
    serverEn,
    `experimentBuilder.paramDescriptions.${key}`
  );
  const currentEnDesc = getByPath(
    currentEn,
    `experimentBuilder.paramDescriptions.${key}`
  );
  const serverZhDesc = getByPath(
    serverZh,
    `experimentBuilder.paramDescriptions.${key}`
  );
  const currentZhDesc = getByPath(
    currentZh,
    `experimentBuilder.paramDescriptions.${key}`
  );

  const labelMatches =
    ((serverEnLabel === undefined && currentEnLabel === undefined) ||
      serverEnLabel === currentEnLabel) &&
    ((serverZhLabel === undefined && currentZhLabel === undefined) ||
      serverZhLabel === currentZhLabel);

  const descriptionMatches =
    ((serverEnDesc === undefined && currentEnDesc === undefined) ||
      serverEnDesc === currentEnDesc) &&
    ((serverZhDesc === undefined && currentZhDesc === undefined) ||
      serverZhDesc === currentZhDesc);

  if (!labelMatches || !descriptionMatches) {
    return "no";
  }

  const fallbackNotes = [];
  if (serverEnLabel === undefined) {
    fallbackNotes.push("label via backend param.label fallback");
  }
  if (serverEnDesc === undefined && param.description) {
    fallbackNotes.push("description via backend param.description fallback");
  }

  if (fallbackNotes.length === 0) {
    return "yes";
  }

  return `yes (${fallbackNotes.join("; ")})`;
}

function formatDefault(value) {
  if (typeof value === "string") {
    return `"${value.replaceAll("|", "\\|")}"`;
  }
  return String(value);
}

const scenarios = parseServerScenarios(serverRegistry);

let markdown = "# Scenario Parameter Parity Checklist\n\n";
markdown += "Baseline: origin/server scenario registry + origin/server locale text.\n";
markdown +=
  "Columns: server key, current Step2 visibility, default consistency, copy consistency (en/zh locale + backend fallback behavior).\n\n";

const nonPassingRows = [];

for (const scenario of scenarios) {
  const scenarioNameKey = `scenario.${scenario.category}.${scenario.id}.name`;
  const scenarioDescKey = `scenario.${scenario.category}.${scenario.id}.description`;

  const scenarioNameMatch =
    getByPath(serverEn, scenarioNameKey) === getByPath(currentEn, scenarioNameKey) &&
    getByPath(serverZh, scenarioNameKey) === getByPath(currentZh, scenarioNameKey);

  const scenarioDescMatch =
    getByPath(serverEn, scenarioDescKey) === getByPath(currentEn, scenarioDescKey) &&
    getByPath(serverZh, scenarioDescKey) === getByPath(currentZh, scenarioDescKey);

  markdown += `## ${scenario.id} (${scenario.category})\n\n`;
  markdown += `- Scenario name copy match: ${scenarioNameMatch ? "yes" : "no"}\n`;
  markdown += `- Scenario description copy match: ${scenarioDescMatch ? "yes" : "no"}\n\n`;

  if (!scenario.params.length) {
    markdown += "- No parameters in server baseline.\n\n";
    continue;
  }

  markdown += "| Param Key | Server Default | UI Shows? | Default Match? | Copy Match? |\n";
  markdown += "|---|---:|---|---|---|\n";

  for (const param of scenario.params) {
    const visibility = uiVisibility(scenario.id, scenario.displayType, param.key);
    const defaultConsistency = defaultMatch(scenario, param);
    const copyConsistency = copyMatch(param);

    markdown += `| ${param.key} | ${formatDefault(param.default)} | ${visibility} | ${defaultConsistency} | ${copyConsistency} |\n`;

    if (
      visibility === "no" ||
      defaultConsistency !== "yes" ||
      copyConsistency.startsWith("no")
    ) {
      nonPassingRows.push({
        scenarioId: scenario.id,
        key: param.key,
        visibility,
        defaultConsistency,
        copyConsistency,
      });
    }
  }

  markdown += "\n";
}

markdown += "## Summary\n\n";
if (nonPassingRows.length === 0) {
  markdown += "- All rows pass visibility/default/copy checks.\n";
} else {
  markdown += `- Rows needing review: ${nonPassingRows.length}\n`;
  for (const row of nonPassingRows) {
    markdown += `- ${row.scenarioId}.${row.key}: show=${row.visibility}; default=${row.defaultConsistency}; copy=${row.copyConsistency}\n`;
  }
}

const outputPath = `${repoRoot}/frontend/docs/scenario-parameter-parity-checklist.md`;
fs.writeFileSync(outputPath, markdown, "utf8");

console.log("Generated frontend/docs/scenario-parameter-parity-checklist.md");
console.log(`Scenarios: ${scenarios.length}`);
console.log(`Rows needing review: ${nonPassingRows.length}`);
