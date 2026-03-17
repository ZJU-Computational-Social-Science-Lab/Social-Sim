from __future__ import annotations

import re
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from socialsim4.core.actions.base_actions import SendMessageAction, YieldAction
from socialsim4.core.agent import Agent
from socialsim4.core.agent.parsing import strip_thinking_tokens
from socialsim4.core.scene import Scene


DEFAULT_TIER_ORDER = ["top", "mid", "low"]
POLICY_MARKERS = ["原文", "不可改写条款", "报告要求", "执行要求", "目标："]
POLICY_LINE_MARKERS = {
    "goal": ["政策目标", "目标", "总体要求", "工作要求"],
    "scope": ["调整范围", "适用范围", "覆盖范围"],
    "standard": ["调整标准", "下调", "比例", "薪酬标准", "固定薪酬"],
    "support": ["配套要求", "稳岗安排", "心理支持", "申诉反馈渠道"],
    "execution": ["执行要求", "落实", "整改", "排查", "培训", "核验", "完成"],
    "report": ["报告要求", "报送", "汇总", "周报", "台账", "上报", "签到表", "填报"],
    "resource": ["资源", "预算", "经费", "人员", "保障", "技术支持", "专项"],
    "accountability": ["责任分工", "问责", "考核", "督办", "责任", "压实责任", "跟踪问效"],
    "invariant": ["不可改写条款", "严禁", "不得", "必须", "一律"],
}
AGENT_SIGNAL_MARKERS = {
    "burden": ["负担", "压力", "成本", "加班", "重复", "繁琐", "一线", "基层", "执行难"],
    "autonomy": ["灵活", "自主", "因地制宜", "协调", "平衡", "裁量", "缓行", "试点"],
    "control": ["问责", "纪律", "考核", "刚性", "统一部署", "压实责任", "督办", "从严"],
    "resource": ["预算", "人手", "资源", "经费", "设备", "支持", "保障", "条件"],
    "stability": ["稳定", "风险", "舆情", "安全", "秩序", "审慎", "稳妥"],
}
NOTICE_ANALYSIS_MARKERS = [
    "解读", "评估", "合理性", "优点", "缺点", "优缺点", "利弊", "优势", "不足",
    "问题", "建议", "看法", "分析", "研判", "评论", "谈谈", "怎么看", "是否可行",
]
NOTICE_EXECUTION_MARKERS = [
    "贯彻", "落实", "执行", "推进", "部署", "传达", "整改", "排查", "督办", "落实情况",
]
_scene_debug_dir = Path("test_results")
_scene_debug_dir.mkdir(exist_ok=True)
_scene_debug_file = _scene_debug_dir / f"policy_cascade_final_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"


def _normalize_tier_token(value: str) -> str:
    normalized = value.strip().lower().replace("_", "-").replace(" ", "-")
    if normalized in {"top", "top-tier", "high", "high-tier"} or "高层" in value:
        return "top"
    if normalized in {"mid", "mid-tier", "middle", "middle-tier"} or "中层" in value:
        return "mid"
    if normalized in {"low", "low-tier", "base", "base-tier"} or "基层" in value:
        return "low"
    return ""


def _parse_tier_order(raw_value) -> List[str]:
    if type(raw_value) is list:
        values = [str(item).strip() for item in raw_value]
    else:
        values = re.split(r"[,，\n]+", str(raw_value or ""))
        values = [value.strip() for value in values]

    cleaned: List[str] = []
    seen = set()
    for value in values:
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(value)
    return cleaned or list(DEFAULT_TIER_ORDER)


class PolicyCascadeScene(Scene):
    """Strict top→mid→low cascade, single action per tier, downstream-only delivery."""

    TYPE = "policy_cascade_scene"

    def __init__(
        self,
        name: str,
        initial_event: str,
        tier_order: List[str] | None = None,
        cascade_mode: str = "strict_cascade",
        distortion_strength: float = 0.6,
        conflict_sensitivity: float = 0.5,
        block_probability: float = 0.25,
    ):
        super().__init__(name, initial_event)
        self.tier_order = _parse_tier_order(tier_order or DEFAULT_TIER_ORDER)
        self.state["current_tier_idx"] = 0
        self.state["tier_seen"] = {t: [] for t in self.tier_order}
        self.state["tier_transmitted"] = {t: False for t in self.tier_order}
        self.state["tier_order"] = list(self.tier_order)
        self.state["latest_policy"] = ""
        self.state["source_policy"] = ""
        self.state["relayed_policy"] = ""
        self.state["latest_notice"] = str(initial_event or "")
        self.state["task_mode"] = "notice"
        self.state["notice_kind"] = "execution"
        self.state["cascade_mode"] = cascade_mode
        self.state["distortion_strength"] = distortion_strength
        self.state["conflict_sensitivity"] = conflict_sensitivity
        self.state["block_probability"] = block_probability
        self.state["private_events"] = {}
        self.state["active_tier_targets"] = {}
        self.state["complete"] = False
        self._tier_map: Dict[str, str] = {}
        self._agents_by_tier: Dict[str, List[str]] = {t: [] for t in self.tier_order}

    def configure_from_config(self, config: dict) -> None:
        params = config.get("parameters") or {}
        raw_order = params.get("tier_order") or config.get("tier_order")
        self.tier_order = _parse_tier_order(raw_order)
        cascade_mode = str(params.get("cascade_mode") or config.get("cascade_mode") or "strict_cascade").strip() or "strict_cascade"
        distortion_strength = float(params.get("distortion_strength") or config.get("distortion_strength") or 0.6)
        conflict_sensitivity = float(params.get("conflict_sensitivity") or config.get("conflict_sensitivity") or 0.5)
        block_probability = float(params.get("block_probability") or config.get("block_probability") or 0.25)
        self.state["tier_order"] = list(self.tier_order)
        self.state["tier_seen"] = {tier: [] for tier in self.tier_order}
        self.state["tier_transmitted"] = {tier: False for tier in self.tier_order}
        self.state["cascade_mode"] = cascade_mode
        self.state["distortion_strength"] = distortion_strength
        self.state["conflict_sensitivity"] = conflict_sensitivity
        self.state["block_probability"] = block_probability
        self.state["source_policy"] = ""
        self.state["relayed_policy"] = ""
        self.state["private_events"] = {}
        self.state["active_tier_targets"] = {}
        self._agents_by_tier = {tier: [] for tier in self.tier_order}

    # ----- Lifecycle -----

    def set_simulator(self, simulator):
        self.simulator = simulator
        self._rebuild_tiers()
        self._normalize_active_tier()

    def reset_for_run(self):
        self.state["complete"] = False
        self.state["tier_seen"] = {t: [] for t in self.tier_order}
        self.state["tier_transmitted"] = {t: False for t in self.tier_order}
        self.state["active_tier_targets"] = {}
        self._rebuild_tiers()
        if self._private_recipient_names():
            self.state["current_tier_idx"] = self._private_active_tier_idx()
        else:
            self.state["current_tier_idx"] = 0
        self._normalize_active_tier()

    def on_event(self, sim, event_type: str, data):
        if event_type in {"environment", "broadcast"}:
            self.state["current_tier_idx"] = 0
            self.state["tier_seen"] = {t: [] for t in self.tier_order}
            self.state["tier_transmitted"] = {t: False for t in self.tier_order}
            self.state["private_events"] = {}
            self.state["active_tier_targets"] = {}
            desc = data.get("description") or data.get("content") or data.get("message") or ""
            cleaned_desc = self._clean_policy_text(str(desc))
            self.state["latest_notice"] = cleaned_desc
            enters_cascade = self._should_enter_cascade(cleaned_desc, event_type)
            if enters_cascade:
                self.state["latest_policy"] = cleaned_desc
                self.state["source_policy"] = cleaned_desc
                self.state["relayed_policy"] = cleaned_desc
                self.state["task_mode"] = "cascade"
                self.state["notice_kind"] = "execution"
            else:
                self.state["latest_policy"] = ""
                self.state["source_policy"] = ""
                self.state["relayed_policy"] = ""
                self.state["task_mode"] = "notice"
                self.state["notice_kind"] = self._detect_notice_kind(cleaned_desc)
            if self._cascade_mode() == "distortion_cascade":
                sim.emit_event(
                    "cascade_input_classified",
                    {
                        "event_type": event_type,
                        "content": cleaned_desc,
                        "entered_distortion_chain": bool(enters_cascade),
                        "mode": self._cascade_mode(),
                    },
                )
            self.state["complete"] = False
            self._rebuild_tiers()
            self._normalize_active_tier()
        return None

    def on_private_event(self, sim, event_type: str, data, recipients: List[str]):
        if event_type not in {"environment", "broadcast"}:
            return None

        desc = data.get("description") or data.get("content") or data.get("message") or ""
        cleaned_desc = self._clean_policy_text(str(desc))
        enters_cascade = self._should_enter_cascade(cleaned_desc, event_type)
        private_payload = {
            "latest_notice": cleaned_desc,
            "latest_policy": cleaned_desc if enters_cascade else "",
            "source_policy": cleaned_desc if enters_cascade else "",
            "relayed_policy": cleaned_desc if enters_cascade else "",
            "task_mode": "cascade" if enters_cascade else "notice",
            "notice_kind": "execution" if enters_cascade else self._detect_notice_kind(cleaned_desc),
        }

        private_events = self.state.get("private_events") or {}
        for name in recipients:
            private_events[name] = dict(private_payload)
        self.state["private_events"] = private_events
        active_targets = self.state.get("active_tier_targets") or {}
        for name in recipients:
            tier = self._tier_map.get(name) or ""
            if not tier:
                continue
            current = list(active_targets.get(tier) or [])
            if name not in current:
                current.append(name)
            active_targets[tier] = current
        self.state["active_tier_targets"] = active_targets

        if enters_cascade:
            visible_to = recipients[0] if recipients else ""
            visible_tier = self._tier_map.get(visible_to) or ""
            sim.emit_event(
                "private_cascade_input",
                {
                    "event_type": event_type,
                    "content": cleaned_desc,
                    "visible_to": visible_to,
                    "visible_tier": visible_tier,
                    "recipients": list(recipients),
                },
            )

        self.state["complete"] = False
        self.state["tier_seen"] = {t: [] for t in self.tier_order}
        self.state["tier_transmitted"] = {t: False for t in self.tier_order}
        self._rebuild_tiers()

        recipient_tiers = [self._tier_map.get(name) for name in recipients if self._tier_map.get(name)]
        if recipient_tiers:
            first_tier = min(self.tier_order.index(tier) for tier in recipient_tiers)
            self.state["current_tier_idx"] = first_tier
        else:
            self.state["current_tier_idx"] = 0
        self._normalize_active_tier()
        return None

    # ----- Tier helpers -----

    def _normalize_allowed_tier(self, value: str) -> str:
        text = str(value or "").strip()
        if not text:
            return ""

        for tier in self.tier_order:
            if text.lower() == tier.lower():
                return tier

        legacy = _normalize_tier_token(text)
        if legacy:
            for tier in self.tier_order:
                if _normalize_tier_token(tier) == legacy:
                    return tier

        compact = re.sub(r"[\s_-]+", "", text).lower()
        for tier in self.tier_order:
            tier_compact = re.sub(r"[\s_-]+", "", tier).lower()
            if compact == tier_compact or compact in tier_compact or tier_compact in compact:
                return tier

        return ""

    def _extract_tier(self, agent: Agent) -> str:
        tier = self._normalize_allowed_tier(str(agent.properties.get("tier", ""))) if hasattr(agent, "properties") else ""
        if tier:
            return tier

        profile_tier = self._normalize_allowed_tier(str(agent.properties.get("政治职位层级", ""))) if hasattr(agent, "properties") else ""
        if profile_tier:
            return profile_tier

        text = " ".join([
            str(getattr(agent, "role_prompt", "")),
            str(getattr(agent, "user_profile", "")),
        ])
        match = re.search(r"政治职位层级[:：]\s*([^|\n]+)", text)
        if match:
            matched = self._normalize_allowed_tier(match.group(1))
            if matched:
                return matched

        inferred = self._normalize_allowed_tier(text)
        if inferred:
            return inferred

        return self.tier_order[min(1, len(self.tier_order) - 1)]

    def _tier_role_kind(self, tier: str) -> str:
        idx = self.tier_order.index(tier) if tier in self.tier_order else 0
        if idx <= 0:
            return "top"
        if idx >= len(self.tier_order) - 1:
            return "low"
        return "mid"

    def _cascade_mode(self) -> str:
        mode = str(self.state.get("cascade_mode", "strict_cascade") or "strict_cascade")
        if mode not in {"strict_cascade", "distortion_cascade"}:
            return "strict_cascade"
        return mode

    def _distortion_strength(self) -> float:
        return float(self.state.get("distortion_strength", 0.6) or 0.0)

    def _conflict_sensitivity(self) -> float:
        return float(self.state.get("conflict_sensitivity", 0.5) or 0.0)

    def _block_probability(self) -> float:
        return float(self.state.get("block_probability", 0.25) or 0.0)

    def _deterministic_score(self, *parts: str) -> float:
        text = "|".join(str(part or "") for part in parts)
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:8]
        return int(digest, 16) / 0xFFFFFFFF

    def _clamp01(self, value: float) -> float:
        return max(0.0, min(1.0, float(value)))

    def _keyword_score(self, text: str, keywords: List[str]) -> float:
        if not text:
            return 0.0
        hits = [keyword for keyword in keywords if keyword in text]
        return self._clamp01(len(hits) / max(1, len(keywords)))

    def _agent_signal_text(self, agent: Agent) -> str:
        parts = [
            str(agent.name or ""),
            str(getattr(agent, "role_prompt", "") or ""),
            str(getattr(agent, "user_profile", "") or ""),
        ]
        properties = getattr(agent, "properties", {}) or {}
        for key, value in properties.items():
            if key == "tier":
                continue
            parts.append(f"{key}:{value}")
        return "\n".join(parts)

    def _agent_signal_profile(self, agent: Agent) -> Dict[str, float]:
        text = self._agent_signal_text(agent)
        return {
            key: self._keyword_score(text, keywords)
            for key, keywords in AGENT_SIGNAL_MARKERS.items()
        }

    def _policy_signal_profile(self) -> Dict[str, float]:
        text = "\n".join([
            str(self.state.get("source_policy", "") or ""),
            str(self.state.get("relayed_policy", "") or ""),
            str(self.state.get("latest_notice", "") or ""),
        ])
        profile = {
            key: self._keyword_score(text, keywords)
            for key, keywords in POLICY_LINE_MARKERS.items()
        }
        profile["burden"] = self._clamp01(
            profile["execution"] * 0.35
            + profile["report"] * 0.35
            + profile["accountability"] * 0.2
            + profile["invariant"] * 0.1
        )
        profile["resource_gap"] = self._clamp01(
            profile["execution"] * 0.4
            + profile["report"] * 0.25
            + profile["accountability"] * 0.2
            - profile["resource"] * 0.45
        )
        return profile

    def _block_tendency(self, agent: Agent, tier: str) -> float:
        pressure = self._conflict_pressure(agent, tier)
        seed = self._deterministic_score(
            "block",
            agent.name,
            tier,
            self.state.get("source_policy", ""),
            self.state.get("relayed_policy", ""),
            self.state.get("latest_notice", ""),
        )
        activation = self._clamp01(
            0.1
            + self._distortion_strength() * 0.55
            + self._conflict_sensitivity() * 0.35
        )
        return self._clamp01(
            self._block_probability()
            + pressure * activation * 0.55
            + seed * 0.05
        )

    def _distortion_reason(self, agent: Agent, tier: str) -> str:
        agent_profile = self._agent_signal_profile(agent)
        policy_profile = self._policy_signal_profile()
        scored = [
            ("基层执行负担高", policy_profile["burden"] * (0.35 + agent_profile["burden"] * 0.35)),
            ("资源保障与任务要求不匹配", policy_profile["resource_gap"] * (0.2 + agent_profile["resource"] * 0.3)),
            ("考核问责压力触发本层自保", policy_profile["accountability"] * (0.15 + agent_profile["autonomy"] * 0.2)),
            ("报送链条过重导致转述弱化", policy_profile["report"] * (0.1 + agent_profile["burden"] * 0.15)),
        ]
        top_reasons = [label for label, score in sorted(scored, key=lambda item: item[1], reverse=True)[:2] if score > 0.08]
        if not top_reasons:
            top_reasons = ["本层判断需要重新筛选政策重点"]

        role_kind = self._tier_role_kind(tier)
        if role_kind == "top":
            role_note = "高层优先保留统筹、问责和重点指标。"
        elif role_kind == "mid":
            role_note = "中层优先保留可操作任务，压缩跨部门协调成本。"
        else:
            role_note = "基层优先保留最低可执行动作，降低一线负担。"

        return "；".join(top_reasons + [role_note])

    def _emit_distortion_event(self, simulator, agent: Agent, tier: str, input_policy: str, agent_draft: str, final_action: str, final_message: str) -> None:
        pressure = self._conflict_pressure(agent, tier)
        tendency = self._block_tendency(agent, tier)
        original_norm = " ".join(str(input_policy or "").split())
        final_norm = " ".join(str(final_message or "").split())
        changed = final_action == "yield" or original_norm != final_norm
        simulator.emit_event(
            "cascade_distortion",
            {
                "agent": agent.name,
                "tier": tier,
                "mode": self._cascade_mode(),
                "blocked": final_action == "yield",
                "changed": changed,
                "original_message": input_policy,
                "agent_draft_message": agent_draft,
                "final_message": final_message,
                "reason": self._distortion_reason(agent, tier),
                "pressure": round(pressure, 4),
                "block_tendency": round(tendency, 4),
                "distortion_strength": round(self._distortion_strength(), 4),
                "conflict_sensitivity": round(self._conflict_sensitivity(), 4),
                "block_probability": round(self._block_probability(), 4),
            },
        )

    def _split_policy_line(self, line: str) -> tuple[str, str]:
        parts = re.split(r"[:：]", line, maxsplit=1)
        if len(parts) == 2:
            return parts[0].strip(), parts[1].strip()
        return "", line.strip()

    def _line_kind(self, line: str) -> str:
        normalized = re.sub(r'^\s*(?:\d+[\.、]\s*)?', '', str(line or '').strip())
        if normalized == "原文：":
            return "meta"
        if ("通知" in normalized or "公告" in normalized) and (
            normalized.startswith("关于")
            or "关于" in normalized
            or normalized.startswith("「")
            or normalized.startswith("【")
        ):
            return "title"
        header, _ = self._split_policy_line(normalized)
        if header:
            for kind, markers in POLICY_LINE_MARKERS.items():
                if any(marker in header for marker in markers):
                    return kind
        for kind, markers in POLICY_LINE_MARKERS.items():
            if any(marker in normalized for marker in markers):
                return kind
        return "general"

    def _policy_lines_for_distortion(self, message: str) -> List[tuple[str, str]]:
        source = str(self.state.get("source_policy", "") or "").strip()
        if not source:
            source = self._sanitize_message(message)
        if not source:
            source = str(self.state.get("relayed_policy", "") or self.state.get("latest_policy", "") or "")
        lines = [line.rstrip() for line in source.splitlines() if line.strip()]
        result: List[tuple[str, str]] = []
        current_kind = "general"
        for raw_line in lines:
            stripped = raw_line.strip()
            kind = self._line_kind(stripped)
            if stripped.startswith("*") or stripped.startswith("•") or stripped.startswith("-"):
                kind = current_kind
            elif current_kind == "invariant" and stripped.startswith(("“", '"', "'", "‘")):
                kind = "invariant"
            elif kind == "general" and current_kind in {"report", "execution"} and stripped.startswith(("（", "(", "附", "其中", "包括")):
                kind = current_kind
            elif kind not in {"general", "meta", "title"}:
                current_kind = kind
            result.append((kind, stripped))
        return result

    def _clean_policy_body(self, text: str) -> str:
        return str(text or "").strip().rstrip("。；;，,:：")

    def _soften_body(self, body: str, strength: float) -> str:
        softened = str(body or "").strip()
        replacements = [
            ("必须", "优先"),
            ("立即", "尽快"),
            ("全部", "重点"),
            ("统一", "先行"),
            ("问责", "跟踪"),
            ("督办", "协调"),
        ]
        if strength >= 0.35:
            for old, new in replacements:
                softened = softened.replace(old, new)
        if strength >= 0.65:
            softened = re.sub(r"(\d+小时内|当天|本周内|周五18点前|立即)", "条件具备后再统一推进", softened)
        return softened

    def _rewrite_line_for_distortion(self, kind: str, tier: str, line: str, strength: float, pressure: float) -> str:
        role_kind = self._tier_role_kind(tier)
        header, body = self._split_policy_line(line)
        softened = self._clean_policy_body(self._soften_body(body, strength))
        clean_body = self._clean_policy_body(body)
        if kind == "title":
            return line
        if kind == "meta":
            return line
        if strength < 0.35:
            return line
        elif strength <= 0.55:
            if kind == "goal":
                return f"政策目标：{softened or clean_body}。"
            if kind == "scope":
                return f"适用范围仍按原文执行：{softened or clean_body}。"
            if kind == "standard":
                return f"调整标准原则上保持不变：{softened or clean_body}。"
            if kind == "support":
                return f"配套安排继续同步说明：{softened or clean_body}。"
            if kind == "execution":
                return f"执行时继续按原要求推进：{softened or clean_body}。"
            if kind == "report":
                return f"报告要求继续保留：{softened or clean_body}。"
            if kind == "resource":
                return f"资源支持继续保留原则安排：{softened or clean_body}。"
            if kind == "accountability":
                return f"责任链条继续明确：{softened or clean_body}。"
            if kind == "invariant":
                return line
            return line
        if kind == "goal":
            if role_kind == "top":
                return f"阶段目标：继续围绕{softened or clean_body}推进，但先突出最核心指标。"
            if role_kind == "mid":
                return f"当前先按阶段性目标处理：{softened or clean_body}，其余部分分批推进。"
            return f"一线仅保留最低目标：{softened or clean_body}。"
        if kind == "scope":
            if role_kind == "top":
                return f"适用范围暂按原口径掌握：{softened or clean_body}。"
            if role_kind == "mid":
                return f"当前执行范围先收敛为：{softened or clean_body}。"
            return f"一线当前仅按以下范围理解：{softened or clean_body}。"
        if kind == "standard":
            if role_kind == "top":
                return f"调整标准先保留关键口径：{softened or clean_body}。"
            if role_kind == "mid":
                return f"本层只下传最核心的调整标准：{softened or clean_body}。"
            return f"基层仅掌握与执行直接相关的标准：{softened or clean_body}。"
        if kind == "support":
            if role_kind == "top":
                return f"配套安排原则上保留：{softened or clean_body}。"
            if role_kind == "mid":
                return f"配套安排先保留必要部分：{softened or clean_body}。"
            return f"一线仅保留必要配套说明：{softened or clean_body}。"
        if kind == "execution":
            if role_kind == "top":
                return f"执行重点：各单位先围绕{softened or clean_body}落实，细项后续再补。"
            if role_kind == "mid":
                return f"现阶段执行安排调整为：优先处理{softened or clean_body}。"
            return f"基层先完成最小动作：{softened or clean_body}。"
        if kind == "report":
            if strength >= 0.75:
                return "报送要求调整为：先内部掌握情况，后续视条件统一汇总。"
            if role_kind == "low":
                return f"报送部分先简化为现场记录：{softened or clean_body}。"
            return f"报送安排改为部门内部先汇总：{softened or clean_body}。"
        if kind == "resource":
            if role_kind == "top":
                return f"资源保障部分暂保留原则性表述：{softened or clean_body}。"
            return "资源支持暂按现有条件消化，新增保障后续再协调。"
        if kind == "accountability":
            if role_kind == "top":
                return f"考核问责仍然保留，但先聚焦关键事项：{softened or clean_body}。"
            if pressure >= 0.6:
                return "考核要求暂不向下展开，先看本轮执行反馈。"
            return f"跟踪要求调整为阶段性检查：{softened or clean_body}。"
        if kind == "invariant":
            return line
        if kind == "title":
            return line
        if kind == "meta":
            return line
        if role_kind == "top":
            return f"本层转述：{softened or clean_body or header}。"
        if role_kind == "mid":
            return f"结合本层压力，改写为：{softened or clean_body or header}。"
        return f"一线暂按以下方式理解：{softened or clean_body or header}。"

    def _line_priority(self, kind: str, tier: str) -> int:
        role_kind = self._tier_role_kind(tier)
        if role_kind == "top":
            order = ["goal", "scope", "standard", "support", "resource", "report", "accountability", "execution", "invariant", "general"]
        elif role_kind == "mid":
            order = ["standard", "execution", "scope", "support", "report", "goal", "accountability", "resource", "invariant", "general"]
        else:
            order = ["execution", "support", "report", "standard", "scope", "goal", "general", "resource", "accountability", "invariant"]
        return order.index(kind) if kind in order else len(order)

    def _must_keep_line(self, kind: str, line: str, strength: float, tier: str) -> bool:
        if kind in {"title", "meta"}:
            return True
        if kind == "invariant":
            return True
        if strength <= 0.55:
            return kind in {"goal", "scope", "standard", "support", "report", "resource", "accountability"}
        if self._tier_role_kind(tier) == "top":
            return kind in {"goal", "standard", "resource", "report"}
        return kind in {"standard", "execution", "report"}

    def _conflict_pressure(self, agent: Agent, tier: str) -> float:
        role_kind = self._tier_role_kind(tier)
        tier_base = 0.18 if role_kind == "top" else 0.42 if role_kind == "mid" else 0.68
        agent_profile = self._agent_signal_profile(agent)
        policy_profile = self._policy_signal_profile()
        semantic_conflict = (
            policy_profile["burden"] * (0.35 + agent_profile["burden"] * 0.35)
            + policy_profile["resource_gap"] * (0.2 + agent_profile["resource"] * 0.3)
            + policy_profile["accountability"] * (0.15 + agent_profile["autonomy"] * 0.2)
            + policy_profile["report"] * (0.1 + agent_profile["burden"] * 0.15)
        )
        semantic_conflict -= agent_profile["control"] * policy_profile["accountability"] * 0.25
        semantic_conflict -= agent_profile["stability"] * policy_profile["goal"] * 0.1
        if role_kind == "top":
            semantic_conflict -= 0.08
        elif role_kind == "low":
            semantic_conflict += 0.08
        semantic_conflict = self._clamp01(semantic_conflict)
        sensitivity = self._conflict_sensitivity()
        return self._clamp01(tier_base * (1 - sensitivity) + semantic_conflict * sensitivity)

    def _should_block(self, agent: Agent, tier: str) -> bool:
        return self._block_tendency(agent, tier) >= 0.5

    def _distort_message(self, agent: Agent, tier: str, message: str) -> str:
        normalized = self._sanitize_message(message)
        if not normalized:
            return normalized
        strength = self._distortion_strength()
        if strength <= 0:
            return normalized

        lines = self._policy_lines_for_distortion(normalized)
        if not lines:
            return normalized

        content_lines = [item for item in lines if item[0] not in {"title", "meta"}]
        if content_lines:
            lines = content_lines

        prefix = self._distortion_intro(tier, strength)

        pressure = self._conflict_pressure(agent, tier)
        keep_count = max(1, min(len(lines), self._distortion_anchor_limit(tier, strength)))
        ranked = sorted(lines, key=lambda item: self._line_priority(item[0], tier))
        required: List[tuple[str, str]] = []
        for item in ranked:
            if self._must_keep_line(item[0], item[1], strength, tier) and item not in required:
                required.append(item)
        selected: List[tuple[str, str]] = list(required)
        for item in ranked:
            if len(selected) >= keep_count:
                break
            if item not in selected:
                selected.append(item)
        if len(required) > keep_count:
            keep_count = len(required)
        selected = selected[:keep_count]
        rewritten = [
            self._rewrite_line_for_distortion(kind, tier, line, strength, pressure)
            for kind, line in selected
        ]
        if not rewritten:
            return normalized

        parts = [prefix, normalized, self._distortion_constraint_label(tier, strength)]
        parts.extend(rewritten)
        if pressure >= 0.75:
            parts.append("其余内容待条件成熟后再决定是否继续下传。")
        return "\n".join(part for part in parts if part)

    def _rebuild_tiers(self) -> None:
        self._tier_map = {}
        names = list(self.simulator.agents.keys())
        for name, agent in self.simulator.agents.items():
            self._tier_map[name] = self._extract_tier(agent)

        present = {t for t in self._tier_map.values() if t in self.tier_order}
        if len(present) < len(self.tier_order) and names:
            for idx, name in enumerate(names):
                tier = self._tier_map.get(name)
                if tier not in self.tier_order:
                    forced = self.tier_order[min(idx, len(self.tier_order) - 1)]
                    self._tier_map[name] = forced
                    present.add(forced)

        self._agents_by_tier = {t: [] for t in self.tier_order}
        for name, tier in self._tier_map.items():
            if tier in self.tier_order:
                self._agents_by_tier[tier].append(name)

    def _normalize_active_tier(self) -> None:
        idx = int(self.state.get("current_tier_idx", 0))
        while idx < len(self.tier_order):
            tier = self.tier_order[idx]
            if self._agents_by_tier.get(tier):
                break
            idx += 1
        self.state["current_tier_idx"] = min(idx, len(self.tier_order) - 1)

    def _active_tier(self) -> str:
        self._normalize_active_tier()
        idx = int(self.state.get("current_tier_idx", 0))
        return self.tier_order[min(max(idx, 0), len(self.tier_order) - 1)]

    def _private_event_for(self, agent_name: str) -> dict:
        private_events = self.state.get("private_events") or {}
        return private_events.get(agent_name) or {}

    def _private_recipient_names(self) -> List[str]:
        private_events = self.state.get("private_events") or {}
        return [name for name in private_events.keys() if name]

    def _private_active_tier_idx(self) -> int:
        names = self._private_recipient_names()
        tiers = [self._tier_map.get(name) for name in names if self._tier_map.get(name)]
        if not tiers:
            return 0
        return min(self.tier_order.index(tier) for tier in tiers)

    def _network_connections_for(self, agent_name: str) -> List[str]:
        social_network = self.state.get("social_network") or {}
        if type(social_network) is not dict or not social_network:
            return []
        raw_connections = social_network.get(agent_name) or []
        if type(raw_connections) is not list:
            return []
        return [name for name in raw_connections if name in self.simulator.agents and name != agent_name]

    def _active_targets_for_tier(self, tier: str) -> List[str]:
        active_targets = self.state.get("active_tier_targets") or {}
        targets = list(active_targets.get(tier) or [])
        return [name for name in targets if (self._tier_map.get(name) or self._extract_tier(self.simulator.agents[name])) == tier]

    def _upstream_merge_message(self, recipient: str, upstream_messages: List[dict]) -> str:
        if len(upstream_messages) == 1:
            return str(upstream_messages[0].get("message") or "")
        lines = ["你同时收到多个上层版本，请先综合这些意见，再形成一个统一的本层传递版本："]
        for idx, item in enumerate(upstream_messages, start=1):
            sender = str(item.get("sender") or f"上层节点{idx}")
            message = str(item.get("message") or "").strip()
            lines.append(f"版本{idx}（来自 {sender}）：\n{message}")
        lines.append("请综合以上多个上层版本后，再按你当前层级职责继续向下传递。")
        return "\n\n".join(lines)

    def _queue_private_cascade_targets(self, recipients: List[str], sender: Agent, relayed_message: str, source_policy: str) -> None:
        if not recipients:
            return
        private_events = self.state.get("private_events") or {}
        active_targets = self.state.get("active_tier_targets") or {}
        notice = str(self.state.get("latest_notice") or source_policy or relayed_message or "")
        for recipient in recipients:
            existing = dict(private_events.get(recipient) or {})
            upstream_messages = list(existing.get("upstream_messages") or [])
            candidate = {"sender": sender.name, "message": relayed_message}
            if candidate not in upstream_messages:
                upstream_messages.append(candidate)
            merged_message = self._upstream_merge_message(recipient, upstream_messages)
            private_events[recipient] = {
                "latest_notice": notice,
                "latest_policy": merged_message,
                "source_policy": source_policy,
                "relayed_policy": merged_message,
                "task_mode": "cascade",
                "notice_kind": "execution",
                "upstream_messages": upstream_messages,
            }
            tier = self._tier_map.get(recipient) or ""
            if tier:
                current = list(active_targets.get(tier) or [])
                if recipient not in current:
                    current.append(recipient)
                active_targets[tier] = current
        self.state["private_events"] = private_events
        self.state["active_tier_targets"] = active_targets

    def _downstream_targets(self, agent: Agent) -> List[str]:
        tier = self._tier_map.get(agent.name) or self._extract_tier(agent)
        idx = self.tier_order.index(tier) if tier in self.tier_order else 0
        if idx + 1 >= len(self.tier_order):
            return []
        next_tier = self.tier_order[idx + 1]
        candidates = self._agents_by_tier.get(next_tier, [])
        social_connections = self._network_connections_for(agent.name)
        if not social_connections:
            return candidates
        return [name for name in candidates if name in social_connections]

    def _is_policy_announcement(self, text: str) -> bool:
        return any(marker in text for marker in POLICY_MARKERS)

    def _should_enter_cascade(self, text: str, event_type: str) -> bool:
        cleaned = str(text or "").strip()
        if not cleaned:
            return False

        initial_text = self._clean_policy_text(str(getattr(self.initial_event, "content", "") or ""))
        if event_type == "broadcast" and cleaned == initial_text and not str(self.state.get("relayed_policy", "") or self.state.get("latest_policy", "") or "").strip():
            return False

        if self._cascade_mode() != "distortion_cascade":
            return self._is_policy_announcement(text)

        return True

    def _extract_min_chars(self, text: str) -> int:
        match = re.search(r"不少于\s*(\d+)\s*字|至少\s*(\d+)\s*字", text)
        if not match:
            return 0
        value = match.group(1) or match.group(2) or "0"
        return int(value)

    def _detect_notice_kind(self, text: str) -> str:
        if any(marker in text for marker in NOTICE_ANALYSIS_MARKERS):
            return "analysis"
        if any(marker in text for marker in NOTICE_EXECUTION_MARKERS):
            return "execution"
        return "execution"

    def _gov_meeting_terms(self, tier: str) -> List[str]:
        role_kind = self._tier_role_kind(tier)
        if role_kind == "top":
            return [
                "传达学习", "会议精神", "统筹推进", "统一部署", "压实责任", "狠抓落实",
                "督促检查", "跟踪问效", "问责机制", "组织领导", "决策部署", "牵头负责",
            ]
        if role_kind == "mid":
            return [
                "细化举措", "分解任务", "对标对表", "协同推进", "专班推进", "建立台账",
                "清单化管理", "节点推进", "定期调度", "周报机制", "协调联动", "督办落实",
            ]
        return [
            "现场核验", "逐项排查", "问题整改", "及时上报", "一线落实", "闭环管理",
            "销号管理", "复查复核", "反馈情况", "责任到人", "逐条落实", "应改尽改",
        ]

    def _analysis_structure_keywords(self, tier: str) -> List[str]:
        shared = ["优点", "缺点", "建议", "风险", "合理性"]
        return shared + self._gov_meeting_terms(tier)

    def _tier_keywords(self, tier: str) -> List[str]:
        role_kind = self._tier_role_kind(tier)
        if role_kind == "top":
            return ["统筹", "资源", "考核", "问责", "部署", "督办", "压实责任", "跟踪问效"] + self._gov_meeting_terms(tier)
        if role_kind == "mid":
            return ["拆解", "协调", "时间表", "周报", "台账", "分解任务", "协同推进", "定期调度"] + self._gov_meeting_terms(tier)
        return ["排查", "上报", "反馈", "核验", "整改", "闭环", "复查", "销号"] + self._gov_meeting_terms(tier)

    def _cross_tier_words(self, tier: str) -> List[str]:
        role_kind = self._tier_role_kind(tier)
        if role_kind == "top":
            return [
                "基层执行", "基层落实", "中层协调", "中层执行", "现场核验", "逐项排查", "复查复核", "销号管理",
                "任务拆解", "周报台账", "跨部门协调", "排查步骤", "问题整改", "上报反馈",
            ]
        if role_kind == "mid":
            return [
                "高层统筹", "高层问责", "基层执行", "基层落实", "组织领导", "决策部署", "现场核验", "逐项排查",
                "总体目标", "资源调配", "督促检查", "责任落实", "问题整改", "上报反馈", "闭环",
            ]
        return [
            "高层统筹", "高层部署", "中层协调", "中层执行", "组织领导", "决策部署", "周报机制", "专班推进",
            "总体目标", "资源调配", "督促检查", "跨层级协同治理", "任务拆解", "跨部门协调", "台账机制",
        ]

    def _policy_focus(self) -> List[str]:
        policy = str(self.state.get("source_policy", "") or self.state.get("relayed_policy", "") or self.state.get("latest_policy", "") or "")
        lines = [line.strip(" *") for line in policy.splitlines() if line.strip()]
        picks = []
        for line in lines:
            if "目标" in line or "报告要求" in line or "执行要求" in line or "责任分工" in line:
                picks.append(line)
        return picks[:3]

    def _policy_prompt_excerpt(self, text: str) -> str:
        cleaned = self._clean_policy_text(text)
        if not cleaned:
            return ""
        lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
        picked: List[str] = []
        seen = set()
        for line in lines:
            normalized = line.strip(" *")
            kind = self._line_kind(normalized)
            summary = ""
            if kind == "goal":
                if "6 个月内" in normalized and "岗位稳定" in normalized:
                    summary = "目标：6个月内完成成本优化与岗位稳定"
                else:
                    _, body = self._split_policy_line(normalized)
                    summary = f"目标：{body[:24]}" if body else "目标：保持政策目标不变"
            elif kind == "scope":
                if "中层及以下" in normalized and ("暂不纳入" in normalized or "关键" in normalized):
                    summary = "范围：中层及以下，关键岗位原则上暂不纳入"
                else:
                    summary = "范围：保持原适用范围"
            elif kind == "standard":
                if "10%" in normalized and "阶段性下调" in normalized:
                    summary = "标准：10%阶段性下调"
                else:
                    summary = "标准：保持原调整标准"
            elif kind == "support":
                summary = "配套：同步说明稳岗安排、心理支持与申诉渠道"
            elif kind == "report":
                if "5 个工作日" in normalized or "5个工作日" in normalized:
                    summary = "报告：5个工作日内提交落实情况"
                else:
                    summary = "报告：保留落实情况报送要求"
            elif kind == "resource":
                summary = "资源：可申请沟通、人力和缓冲预算支持"
            elif kind == "accountability":
                if "不得跳级" in normalized:
                    summary = "责任：逐级传达，不得跳级通知"
                else:
                    summary = "责任：明确负责人对接与责任链条"
            elif kind == "invariant":
                summary = "硬约束：保留不可改写条款"
            elif kind == "title" and not picked:
                summary = normalized[:24]
            if summary and summary not in seen:
                picked.append(summary)
                seen.add(summary)
        if not picked:
            picked = ["按当前政策版本执行"]
        return "；".join(picked[:4])

    def _sanitize_message(self, message: str) -> str:
        sanitized = strip_thinking_tokens(str(message or "")).strip()
        sanitized = re.sub(r'(^|\n)\s*/(?:think|reasoning|analysis)\b.*?(?=\n|\Z)', '\\1', sanitized, flags=re.IGNORECASE | re.DOTALL)
        sanitized = re.sub(r'(?i)(?:^|(?<=\s))/(?:think|reasoning|analysis)\b[^\S\r\n]*$', '', sanitized, flags=re.MULTILINE)
        sanitized = re.sub(r'\s*/(?:think|reasoning|analysis)\b', '', sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r'<[^>]+>', '', sanitized)
        sanitized = re.sub(r'\n{3,}', '\n\n', sanitized)
        return sanitized.strip()

    def _cascade_tier_detail(self, tier: str) -> str:
        role_kind = self._tier_role_kind(tier)
        if role_kind == "top":
            return "补充：本层只补充高层统筹、资源批准和督办问责安排。"
        if role_kind == "mid":
            return "补充：本层只补充任务拆解、跨部门协调和周报台账安排。"
        return "补充：本层只补充逐项排查、现场核验、整改复查和上报反馈。"

    def _normalize_cascade_message(self, agent: Agent, tier: str, policy: str, message: str) -> str:
        normalized = self._sanitize_message(message)
        if not normalized:
            if self._cascade_mode() == "distortion_cascade":
                normalized = self._distort_message(agent, tier, policy)
            else:
                normalized = f"{policy}\n{self._cascade_suffix(tier)}"

        if not self._message_has_tier_drift(tier, normalized):
            return self._sanitize_message(normalized)

        detail = self._cascade_tier_detail(tier)
        if detail not in normalized:
            normalized = f"{normalized}\n{detail}".strip()

        if not self._message_has_tier_drift(tier, normalized):
            return self._sanitize_message(normalized)

        if self._cascade_mode() == "distortion_cascade":
            distorted = self._distort_message(agent, tier, policy)
            normalized = distorted or normalized
            if detail not in normalized:
                normalized = f"{normalized}\n{detail}".strip()
            return self._sanitize_message(normalized)

        return self._sanitize_message(f"{policy}\n{self._cascade_suffix(tier)}")

    def _clean_policy_text(self, text: str) -> str:
        cleaned = self._sanitize_message(text)
        lines = []
        for raw_line in cleaned.splitlines():
            line = raw_line.rstrip()
            line = re.sub(r'^\s*\*\s*\*\s*', '', line)
            line = re.sub(r'^\s*\*\s+(?=(?:标题|原文|传达要求|资源支持|责任分工|报告要求|执行要求|目标|不可改写条款))', '', line)
            line = re.sub(r'^\s*\*\s+(?=\d+\.)', '', line)
            line = re.sub(r'^\s*\*\s+(?=[“"])', '', line)
            line = re.sub(r'^\s{2,}\*\s+', '    * ', line)
            line = re.sub(r'\*\s*\*', '', line)
            lines.append(line)

        normalized = "\n".join(lines)
        normalized = re.sub(r'\n{3,}', '\n\n', normalized)
        normalized = re.sub(r'[ \t]+\n', '\n', normalized)
        return normalized.strip()

    def _distortion_anchor_limit(self, tier: str, strength: float) -> int:
        role_kind = self._tier_role_kind(tier)
        if strength <= 0.55:
            return 3 if role_kind == "top" else 4
        if strength < 0.75:
            return 3 if role_kind != "low" else 2
        return 2

    def _distortion_constraint_label(self, tier: str, strength: float) -> str:
        role_kind = self._tier_role_kind(tier)
        if strength <= 0.55:
            if role_kind == "top":
                return "下传时同步保留以下政策要点："
            if role_kind == "mid":
                return "继续下传时请同步保留以下硬约束："
            return "一线执行时至少同步保留以下要点："
        if role_kind == "top":
            return "本层筛选后保留以下关键口径："
        if role_kind == "mid":
            return "本层筛选后仅继续保留以下要求："
        return "当前仅继续保留以下最低要求："

    def _distortion_intro(self, tier: str, strength: float) -> str:
        role_kind = self._tier_role_kind(tier)
        if role_kind == "top":
            return "经本层统筹，现按本层判断向下传达：" if strength <= 0.55 else "经本层统筹，现压缩后向下传达："
        if role_kind == "mid":
            return "结合本层执行压力，现按本层理解继续传达：" if strength <= 0.55 else "结合本层执行压力，现筛选后继续传达："
        return "考虑一线执行条件，现按一线可执行口径转述：" if strength <= 0.55 else "考虑一线负担，现仅保留最低执行口径："

    def _build_analysis_message(self, tier: str) -> str:
        notice = str(self.state.get("latest_notice", "") or "").strip()
        role_kind = self._tier_role_kind(tier)
        if role_kind == "top":
            return (
                f"作为高层，我对“{notice}”的合理性判断如下。优点：该要求有利于统一传达学习会议精神，"
                "把政策目标、责任链条和督促检查机制一并明确，便于统筹推进和跟踪问效。"
                "缺点：如果只强调短期推进和问责，可能造成基层填表报数压力上升，资源保障与制度配套不足时容易出现形式化落实。"
                "风险：牵头部门不清、资源投放不足、考核口径不统一，会削弱执行效果。"
                "建议：由高层统一部署、压实责任、明确牵头负责单位和月度督办节奏，同时同步保障预算、人手和技术支持。"
            )
        if role_kind == "mid":
            return (
                f"作为中层，我对“{notice}”的合理性判断如下。优点：该要求便于分解任务、对标对表推进，"
                "可以通过专班推进、建立台账和周报机制，把跨部门协同事项落到具体节点。"
                "缺点：如果目标拆解不够细、验收口径不一致，容易出现部门之间重复报送或责任空转。"
                "风险：时间表过紧、协调链条过长、信息回流不及时，会导致执行偏差。"
                "建议：尽快细化举措，明确分工表、时间表、责任人和督办落实规则，形成清单化管理。"
            )
        return (
            f"作为基层执行人员，我对“{notice}”的合理性判断如下。优点：该要求有助于把一线工作标准说清楚，"
            "便于逐项排查、现场核验、问题整改和及时上报。"
            "缺点：如果配套模板过多、口径变化频繁，现场执行会增加重复登记和反复沟通成本。"
            "风险：责任到人不清、整改时限不实、复查复核缺位，会让闭环管理流于形式。"
            "建议：提供统一清单、简化报送字段、明确应改尽改和销号管理标准，让一线人员能按步骤落实。"
        )

    def _notice_expansion(self, tier: str) -> List[str]:
        notice = str(self.state.get("latest_notice", "") or "").strip()
        role_kind = self._tier_role_kind(tier)
        if self.state.get("notice_kind") == "analysis":
            if role_kind == "top":
                return [
                    f"从高层角度看，“{notice}”要真正落地，还需要把传达学习、统一部署、督促检查和跟踪问效放在同一责任链条中。",
                    "如果只强调结果、不同步资源和制度供给，基层可能出现被动应付，因此必须把预算、人员和技术支持一并明确。",
                    "在组织层面，应当通过压实责任和牵头负责机制，避免口号化传达，确保决策部署可以持续执行。",
                ]
            if role_kind == "mid":
                return [
                    f"从中层角度看，“{notice}”是否合理，关键在于能否转化为分解任务、清单化管理和定期调度。",
                    "若缺少明确验收标准和跨部门协调机制，执行中容易出现重复报送、节点失控和责任交叉。",
                    "因此需要专班推进、建立台账、周报调度和督办落实，才能把政策要求稳定传导到执行端。",
                ]
            return [
                f"从基层角度看，“{notice}”是否合理，要看现场核验、逐项排查和问题整改是否真正可操作。",
                "如果模板过多、报送链条过长，一线会把时间耗在整理材料上，而不是解决实际问题。",
                "因此应提供简明清单、明确责任到人、复查复核和销号管理规则，确保闭环落实。",
            ]
        if role_kind == "top":
            return [
                f"围绕“{notice}”，我会把阶段目标、预算安排、问责节点同步纳入班子议程，确保每项要求都有牵头负责人。",
                "我还会要求各单位按统一模板报送风险点、资源缺口与整改时限，并将结果纳入月度考核与干部履职评价。",
                "对推进缓慢或数据失真的情况，我会直接启动约谈和督办，确保政策要求落到组织责任链条上。",
            ]
        if role_kind == "mid":
            return [
                f"围绕“{notice}”，我会把任务逐项拆成部门动作、时间节点和验收口径，避免理解偏差。",
                "我会建立周报和问题台账，持续跟踪跨部门依赖、资源缺口与延期风险，并及时向上反馈。",
                "对于需要协同推进的事项，我会提前组织对口部门碰头，明确责任边界、交付物和复盘安排。",
            ]
        return [
            f"围绕“{notice}”，我会先按现场流程逐项核对执行情况，把发现的问题、证据和整改建议登记到清单里。",
            "我会在当天汇总核验结果，对异常情形立即上报，并跟进责任人、整改时限和复查结果。",
            "对群众反馈、现场偏差和重复性问题，我会保留过程记录，确保后续复查时能够逐项闭环。",
        ]

    def _enforce_min_chars(self, tier: str, message: str) -> str:
        normalized = str(message or "").strip()
        min_chars = self._extract_min_chars(str(self.state.get("latest_notice", "") or ""))
        if not min_chars:
            return normalized
        expansions = self._notice_expansion(tier)
        idx = 0
        while len(normalized) < min_chars:
            normalized = f"{normalized}\n{expansions[idx % len(expansions)]}".strip()
            idx += 1
        return normalized

    def _message_has_tier_drift(self, tier: str, message: str) -> bool:
        if any(word in message for word in self._cross_tier_words(tier)):
            return True
        return not any(word in message for word in self._tier_keywords(tier))

    def _message_matches_notice_kind(self, tier: str, message: str) -> bool:
        if self.state.get("notice_kind") != "analysis":
            return True
        return all(keyword in message for keyword in ["优点", "缺点", "建议"]) and any(
            keyword in message for keyword in self._analysis_structure_keywords(tier)
        )

    def _build_notice_message(self, tier: str) -> str:
        if self.state.get("notice_kind") == "analysis":
            return self._build_analysis_message(tier)
        notice = str(self.state.get("latest_notice", "") or "").strip()
        focus = self._policy_focus()
        role_kind = self._tier_role_kind(tier)
        if role_kind == "top":
            message = (
                f"作为高层，我对“{notice}”的执行方案如下：第一，我将把政策目标纳入本阶段总任务，"
                "以月度例会统一督办，并明确问责口径；第二，我将优先审批数据合规专项预算和人力补充，"
                "确保重点单位具备整改资源；第三，我会建立按月考核机制，要求各单位围绕关键指标提交结果说明。"
            )
        elif role_kind == "mid":
            message = (
                f"作为中层，我对“{notice}”的执行方案如下：第一，我将在48小时内把任务拆解到具体部门和责任人，"
                "形成分工表与时间表；第二，我将组织跨部门协调会，统一口径、收集资源缺口并建立周报台账；"
                "第三，我会对上汇总进度、对下跟踪节点，确保每项任务都有明确交付物和截止时间。"
            )
        else:
            message = (
                f"作为基层执行人员，我对“{notice}”的执行方案如下：第一，我将按清单逐项排查当前业务与流程，"
                "记录问题点、责任人和完成时限；第二，我会把现场核验结果当天汇总，并对异常情况在24小时内上报；"
                "第三，我将持续跟踪整改反馈，确保形成核验、上报、复查的闭环。"
            )
        if focus:
            message += "重点依据包括：" + "；".join(focus) + "。"
        return message

    def _normalize_notice_message(self, tier: str, message: str) -> str:
        normalized = self._sanitize_message(message)
        min_chars = self._extract_min_chars(str(self.state.get("latest_notice", "") or ""))
        if not normalized:
            normalized = self._build_notice_message(tier)

        if self._message_has_tier_drift(tier, normalized):
            normalized = self._build_notice_message(tier)

        if not self._message_matches_notice_kind(tier, normalized):
            normalized = self._build_notice_message(tier)

        if self.state.get("notice_kind") == "analysis" and min_chars and len(normalized) < min_chars:
            normalized = self._build_notice_message(tier)

        normalized = self._enforce_min_chars(tier, normalized)

        if self._message_has_tier_drift(tier, normalized):
            normalized = self._enforce_min_chars(tier, self._build_notice_message(tier))

        if not self._message_matches_notice_kind(tier, normalized):
            normalized = self._enforce_min_chars(tier, self._build_notice_message(tier))

        return normalized

    def _write_final_debug(self, agent: Agent, mode: str, original_payload: dict, final_payload: dict) -> None:
        try:
            with open(_scene_debug_file, "a", encoding="utf-8") as f:
                f.write(f"\n{'=' * 80}\n")
                f.write(f"[FINAL ACTION] {agent.name}\n")
                f.write(f"mode={mode} notice_kind={self.state.get('notice_kind', '')}\n")
                f.write(f"source_policy={self.state.get('source_policy', '')}\n")
                f.write(f"relayed_policy={self.state.get('relayed_policy', '')}\n")
                f.write("--- ORIGINAL PAYLOAD ---\n")
                f.write(f"{original_payload}\n")
                f.write("--- FINAL PAYLOAD ---\n")
                f.write(f"{final_payload}\n")
                f.write("--- FINAL MESSAGE ---\n")
                f.write(f"{final_payload.get('message', '')}\n")
                f.write("--- END FINAL ACTION ---\n")
        except Exception:
            return None

    def _cascade_suffix(self, tier: str) -> str:
        role_kind = self._tier_role_kind(tier)
        if role_kind == "top":
            return "态度：完全支持并按原文执行。\n补充：由我批准专项预算并建立月度问责机制。"
        if role_kind == "mid":
            return "态度：完全支持并按原文执行。\n补充：我将在48小时内拆解任务到各部门并建立周报台账。"
        return "态度：完全支持并按原文执行。\n补充：我将按排查清单逐项核验，并在发现异常后24小时内上报。"

    # ----- Description -----

    def get_behavior_guidelines(self):
        private_recipients = self._private_recipient_names()
        private_event = self._private_event_for(private_recipients[0]) if private_recipients else {}
        effective_mode = str(private_event.get("task_mode") or self.state.get("task_mode") or "notice")
        effective_notice_kind = str(private_event.get("notice_kind") or self.state.get("notice_kind") or "execution")

        if effective_mode == "notice":
            if effective_notice_kind == "analysis":
                return (
                    "When your tier is active: "
                    "(1) 直接回应最新系统公告，重点做政策解读、合理性评估、优点/缺点/风险/建议分析，"
                    "(2) 必须使用符合你层级职责的正式政务表述，"
                    "(3) 只讨论你这一层的判断，不替其他层级部署任务，不要机械复述旧政策，"
                    "(4) 如果公告里有字数、格式、重点要求，必须直接遵守。"
                    "输出必须包含 send_message 或 yield，禁止空响应或 None。"
                )
            return (
                "When your tier is active: "
                "(1) 直接回应最新系统公告或任务要求，给出你自己的分析/判断/执行方案，"
                "(2) 结合你的职位职责提供至少1条独特细节，"
                "(3) 只回答你这一层的工作，不要替其他层级部署，不要让别人去解读，不要重复发布指令，不要机械复述旧内容。"
                "(4) 如果系统公告里有字数、格式、重点要求，必须直接遵守。"
                "输出必须包含 send_message 或 yield，禁止空响应或 None。"
            )
        if self._cascade_mode() == "distortion_cascade":
            return (
                "When your tier is active: "
                "(1) 你需要把政策只传递给下一级，不得跳级；"
                "(2) 你可以根据本层利益、压力、风险和理解偏差，选择原样传达、选择性强调、弱化、重写、拖延，甚至不传达；"
                "(3) 如果决定不继续传达，可使用 yield 表示截留/搁置；"
                "(4) 你的表达必须体现本层的真实立场与激励，不必强行保留原文，但不能替更高或更低层发言。"
                f"当前参数：失真强度={self._distortion_strength():.2f}，利益冲突敏感度={self._conflict_sensitivity():.2f}，截留概率={self._block_probability():.2f}。"
                "输出必须包含 send_message 或 yield，禁止空响应或 None。"
            )
        return (
            "When your tier is active: "
            "(1) 逐字粘贴最新政策/公告全文（不要省略或改写），"
            "(2) 写明态度/疑虑/执行计划/资源需求，"
            "(3) 只把消息按照设定层级顺序传递给下一级，未轮到你时保持沉默。"
            "态度/计划必须结合你的职位和角色，至少提供1条与你职责相关的独特执行细节（不要与上一层或他人措辞相同）。不要代替其他层级发言。"
            "如收到新的系统公告/解读请求，优先围绕公告内容给出解读/行动，不要重复旧内容。"
            "输出必须包含 send_message 或 yield，禁止空响应或 None。"
        )

    def get_agent_status_prompt(self, agent: Agent) -> str:
        private_event = self._private_event_for(agent.name)
        notice = str(private_event.get("latest_notice") or self.state.get("latest_notice", "") or "").strip()
        source_policy = str(private_event.get("source_policy") or self.state.get("source_policy", "") or "").strip()
        relayed_policy = str(private_event.get("relayed_policy") or self.state.get("relayed_policy", "") or private_event.get("latest_policy") or self.state.get("latest_policy", "") or "").strip()
        parts = []
        mode = str(private_event.get("task_mode") or self.state.get("task_mode", "notice") or "notice")
        tier = self._tier_map.get(agent.name) or self._extract_tier(agent)
        role_kind = self._tier_role_kind(tier)
        if mode == "notice":
            notice_kind = str(private_event.get("notice_kind") or self.state.get("notice_kind") or "execution")
            if notice_kind == "analysis":
                parts.append("当前任务：直接回应最新系统公告，重点写合理性、优点、缺点、风险和建议，不要写成执行命令。")
            else:
                parts.append("当前任务：直接回应最新系统公告，不要转述他人的指令。")
            if role_kind == "top":
                parts.append("你只讨论高层判断：总体方向、组织领导、资源调配、督促检查。不要替中层和基层写任务清单。")
                parts.append("如果出现‘任务拆解’‘跨部门协调’‘现场核验’‘问题整改’等字样，视为越层。")
            elif role_kind == "mid":
                parts.append("你只讨论中层判断：任务分解、跨部门协调、台账机制、时间表。不要替高层做战略表态，也不要替基层写现场细节。")
                parts.append("禁止出现‘总体目标’‘资源调配’‘督促检查’等高层口径，也不要写‘现场核验’‘问题整改’等基层动作。")
            else:
                parts.append("你只讨论基层判断：排查步骤、现场核验、问题整改、上报反馈。不要继续向别人发指令，也不要概括全局部署。")
                parts.append("禁止出现‘总体目标’‘资源调配’‘督促检查’‘任务拆解’‘跨部门协调’等上层口径。")
        else:
            parts.append("当前任务：按层级传递最新政策，并补充与你职责相关的执行细节。")
            if self._cascade_mode() == "distortion_cascade":
                parts.append("当前为‘失真级联’模式：你可以忠实传达，也可以基于本层利益选择性转述、弱化、改写、拖延，或直接不传。")
                parts.append("如果你决定截留政策，请使用 yield；如果你决定传达，只能传给下一级。")
                parts.append(
                    f"本次参数：失真强度={self._distortion_strength():.2f}，利益冲突敏感度={self._conflict_sensitivity():.2f}，截留概率={self._block_probability():.2f}。"
                )
            if role_kind == "top":
                parts.append("只写高层统筹、资源批准、问责安排。")
            elif role_kind == "mid":
                parts.append("只写中层任务拆解、协同推进、节点跟踪。")
            else:
                parts.append("只写基层排查、上报、反馈闭环。")
        parts.append("禁止复述你上一条 assistant 回复；请给出新的、与你当前层级匹配的内容。")
        if notice:
            parts.append(f"最新系统公告：{notice}")
            min_chars = self._extract_min_chars(notice)
            if min_chars:
                parts.append(f"本次回复长度要求：不少于{min_chars}字。")
        if relayed_policy and relayed_policy != notice:
            parts.append(f"上一层传达版本摘要：{self._policy_prompt_excerpt(relayed_policy)}")
        if private_event and source_policy and source_policy != relayed_policy:
            parts.append(f"原始政策摘要：{self._policy_prompt_excerpt(source_policy)}")
        upstream_messages = list(private_event.get("upstream_messages") or [])
        if len(upstream_messages) > 1:
            senders = "、".join(str(item.get("sender") or "上层节点") for item in upstream_messages)
            parts.append(f"你同时收到来自 {senders} 的多个上层版本；请先综合这些版本，再形成一个统一的本层下传版本。")
        return "\n".join(parts)

    # ----- Actions -----

    def get_scene_actions(self, agent: Agent):
        return [SendMessageAction(), YieldAction()]

    def parse_and_handle_action(self, action_data, agent: Agent, simulator):
        payload = action_data
        original_payload = dict(action_data)
        raw_action = action_data.get("action")
        if type(raw_action) is dict:
            action_name = raw_action.get("name") or raw_action.get("action")
            merged = {k: v for k, v in raw_action.items() if k != "name"}
            for k, v in action_data.items():
                if k != "action":
                    merged[k] = v
            merged["action"] = action_name
            payload = merged
        action_name = payload.get("action")
        tier = self._tier_map.get(agent.name) or self._extract_tier(agent)
        private_event = self._private_event_for(agent.name)
        effective_task_mode = str(private_event.get("task_mode") or self.state.get("task_mode", "notice") or "notice")

        if effective_task_mode == "notice" and action_name == "send_message" and not self.should_skip_turn(agent, simulator):
            message = self._sanitize_message(payload.get("message", ""))
            if private_event:
                payload["message"] = message
            else:
                payload["message"] = self._normalize_notice_message(tier, message)

        if effective_task_mode == "cascade" and action_name == "send_message" and not self.should_skip_turn(agent, simulator):
            policy = str(private_event.get("relayed_policy") or private_event.get("latest_policy") or self.state.get("relayed_policy", "") or self.state.get("latest_policy", "") or "").strip()
            source_policy = str(private_event.get("source_policy") or self.state.get("source_policy", "") or policy).strip()
            message = self._sanitize_message(payload.get("message", ""))
            if not policy:
                raise ValueError("latest policy missing for cascade")

            if private_event:
                self.state["latest_notice"] = str(private_event.get("latest_notice") or self.state.get("latest_notice") or "")
                self.state["latest_policy"] = policy
                self.state["source_policy"] = source_policy
                self.state["relayed_policy"] = policy
                self.state["task_mode"] = "cascade"
                self.state["notice_kind"] = "execution"

            if self._cascade_mode() == "distortion_cascade":
                if self._should_block(agent, tier):
                    payload["action"] = "yield"
                    payload.pop("message", None)
                else:
                    distorted = self._distort_message(agent, tier, message)
                    payload["message"] = distorted or message
                self._emit_distortion_event(
                    simulator,
                    agent,
                    tier,
                    policy,
                    message,
                    str(payload.get("action") or ""),
                    str(payload.get("message") or ""),
                )
            else:
                def _norm(text: str) -> str:
                    return " ".join(text.split())

                policy_norm = _norm(policy)
                message_norm = _norm(message)
                invariants = re.findall(r"“([^”]+)”", policy)

                matches_policy = policy_norm and policy_norm in message_norm
                matches_invariants = bool(invariants) and all(inv in message for inv in invariants)
                head = policy_norm[:120]
                matches_head = head and head in message_norm

                if not matches_policy and not matches_invariants and not matches_head:
                    payload["message"] = f"{policy}\n{self._cascade_suffix(tier)}"
                elif not any(word in message for word in ["态度：", "补充："]):
                    payload["message"] = f"{message}\n{self._cascade_suffix(tier)}"
                elif self._message_has_tier_drift(tier, message.replace(policy, "", 1)):
                    payload["message"] = f"{policy}\n{self._cascade_suffix(tier)}"
                else:
                    payload["message"] = message

            if str(payload.get("action") or "") == "send_message":
                payload["message"] = self._normalize_cascade_message(
                    agent,
                    tier,
                    policy,
                    str(payload.get("message", "") or ""),
                )

            if str(payload.get("action") or "") == "send_message":
                self.state["latest_policy"] = str(payload.get("message") or policy)
                self.state["relayed_policy"] = str(payload.get("message") or policy)
                self.state["source_policy"] = source_policy
                self.state["task_mode"] = "cascade"
                self.state["notice_kind"] = "execution"

        if private_event:
            private_events = self.state.get("private_events") or {}
            private_events.pop(agent.name, None)
            self.state["private_events"] = private_events

            if effective_task_mode == "cascade":
                self.state["latest_notice"] = str(private_event.get("latest_notice") or "")
                self.state["latest_policy"] = str(payload.get("message") or private_event.get("relayed_policy") or private_event.get("latest_policy") or "")
                self.state["source_policy"] = source_policy
                self.state["relayed_policy"] = str(payload.get("message") or private_event.get("relayed_policy") or private_event.get("latest_policy") or "")
                self.state["task_mode"] = "cascade"
                self.state["notice_kind"] = "execution"
            elif not self._private_recipient_names():
                self.state["complete"] = bool(self.state.get("complete"))

        if str(payload.get("action") or action_name) == "send_message":
            payload["message"] = self._sanitize_message(payload.get("message", ""))
            self._write_final_debug(agent, effective_task_mode, original_payload, payload)

        success, result, summary, meta, _ = super().parse_and_handle_action(payload, agent, simulator)
        return success, result, summary, meta, True

    # ----- Delivery -----

    def deliver_message(self, event, sender: Agent, simulator):
        event.code = "scene_chat"
        event.params = {"sender": sender.name, "message": event.message}

        formatted = event.to_string(self.state.get("time"))
        sender.add_env_feedback(formatted)

        tier = self._tier_map.get(sender.name) or self._extract_tier(sender)
        self.state.setdefault("tier_transmitted", {t: False for t in self.tier_order})
        self.state["tier_transmitted"][tier] = True
        recipients: List[str] = []
        tier_idx = self.tier_order.index(tier) if tier in self.tier_order else 0

        if self.state.get("task_mode") == "notice":
            recipients = [a.name for a in simulator.agents.values() if a.name != sender.name]
        elif tier_idx < len(self.tier_order) - 1:
            recipients = self._downstream_targets(sender)
            self._queue_private_cascade_targets(
                recipients,
                sender,
                event.message,
                str(self.state.get("source_policy") or self.state.get("latest_policy") or event.message or ""),
            )
        elif tier_idx == len(self.tier_order) - 1:
            same_tier = [n for n in self._agents_by_tier.get(tier, []) if n != sender.name]
            social_connections = self._network_connections_for(sender.name)
            recipients = [n for n in same_tier if not social_connections or n in social_connections]
        else:
            recipients = [a.name for a in simulator.agents.values() if a.name != sender.name]

        for name in recipients:
            agent = simulator.agents.get(name)
            if agent:
                agent.add_env_feedback(formatted)

        simulator.emit_event_later(
            "system_broadcast",
            {
                "time": self.state.get("time"),
                "type": event.__class__.__name__,
                "sender": sender.name,
                "recipients": recipients,
                "text": event.to_string(),
                "code": event.code,
                "params": {"sender": sender.name, "message": event.message, "recipients": recipients},
            },
        )

    # ----- Turn control -----

    def should_skip_turn(self, agent: Agent, simulator) -> bool:
        if self.state.get("complete"):
            return True
        private_recipients = self._private_recipient_names()
        if private_recipients:
            private_tier = self.tier_order[self._private_active_tier_idx()]
            tier = self._tier_map.get(agent.name) or self._extract_tier(agent)
            return agent.name not in private_recipients or tier != private_tier
        tier = self._tier_map.get(agent.name) or self._extract_tier(agent)
        return tier != self._active_tier()

    def post_turn(self, agent: Agent, simulator) -> None:
        super().post_turn(agent, simulator)

        tier = self._tier_map.get(agent.name) or self._extract_tier(agent)
        active = self._active_tier()
        if tier != active:
            return

        seen = self.state.get("tier_seen", {})
        if tier not in seen:
            seen[tier] = []
        if agent.name not in seen[tier]:
            seen[tier].append(agent.name)

        expected_agents = self._active_targets_for_tier(tier) or self._agents_by_tier.get(tier, [])
        if expected_agents and all(name in seen[tier] for name in expected_agents):
            active_targets = self.state.get("active_tier_targets") or {}
            active_targets.pop(tier, None)
            self.state["active_tier_targets"] = active_targets
            transmitted = bool((self.state.get("tier_transmitted") or {}).get(tier, False))
            if self.state.get("task_mode") == "cascade" and self._cascade_mode() == "distortion_cascade" and not transmitted:
                self.state["current_tier_idx"] = len(self.tier_order)
                self.state["complete"] = True
                self.state["tier_seen"] = {t: [] for t in self.tier_order}
                self._normalize_active_tier()
                return
            next_idx = self.tier_order.index(tier) + 1
            if next_idx < len(self.tier_order):
                self.state["current_tier_idx"] = next_idx
                if (self.state.get("social_network") or {}) and not self._active_targets_for_tier(self.tier_order[next_idx]) and not self._private_recipient_names():
                    self.state["current_tier_idx"] = len(self.tier_order)
                    self.state["complete"] = True
            else:
                self.state["current_tier_idx"] = len(self.tier_order)
                self.state["complete"] = True
            self.state["tier_seen"] = {t: [] for t in self.tier_order}
            self._normalize_active_tier()

    def is_complete(self):
        return bool(self.state.get("complete"))

    # ----- Config -----

    def serialize_config(self) -> dict:
        return {
            "tier_order": list(self.tier_order),
            "cascade_mode": self._cascade_mode(),
            "distortion_strength": self._distortion_strength(),
            "conflict_sensitivity": self._conflict_sensitivity(),
            "block_probability": self._block_probability(),
        }

    @classmethod
    def deserialize_config(cls, config: dict) -> dict:
        params = config.get("parameters") or {}
        return {
            "tier_order": _parse_tier_order(config.get("tier_order") or params.get("tier_order")),
            "cascade_mode": str(config.get("cascade_mode") or params.get("cascade_mode") or "strict_cascade"),
            "distortion_strength": float(config.get("distortion_strength") or params.get("distortion_strength") or 0.6),
            "conflict_sensitivity": float(config.get("conflict_sensitivity") or params.get("conflict_sensitivity") or 0.5),
            "block_probability": float(config.get("block_probability") or params.get("block_probability") or 0.25),
        }