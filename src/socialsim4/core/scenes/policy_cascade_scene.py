"""
Policy cascade scene for simulating hierarchical policy transmission.

Models the distortion of policies as they flow through organizational tiers
(top -> mid -> low), with agents potentially modifying content based on
their tier position, pressure, and self-interest.

Contains: PolicyCascadeScene class, tier management, distortion logic
"""

from __future__ import annotations

import re
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from socialsim4.core.actions.base_actions import SendMessageAction, YieldAction
from socialsim4.core.actions.policy_feedback_actions import (
    AnnouncePolicyAdjustmentAction,
    ConsultPeerAction,
    EscalateComplaintAction,
    NotifySubordinateAction,
    ReportUpwardAction,
)
from socialsim4.core.agent import Agent
from socialsim4.core.agent.parsing import strip_thinking_tokens
from socialsim4.core.event import PublicEvent
from socialsim4.core.scene import Scene
from socialsim4.i18n import T


DEFAULT_TIER_ORDER = ["top", "mid", "low"]


def _get_locale_list(key: str, locale: str = "zh") -> List[str]:
    """Get a list from locale file for the given key.

    The T() function returns values from locale JSON. For list values,
    it returns the key itself (not the list), so we access the locale
    file directly for list markers.

    Args:
        key: Translation key (e.g., 'prompts.policy_cascade.markers.policy')
        locale: Language code ('en' or 'zh')

    Returns:
        List of marker strings, or empty list if not found
    """
    # Import locally to avoid circular imports at module level
    import json
    from pathlib import Path

    # Path: policy_cascade_scene.py is in core/scenes/, locales are in socialsim4/locales/
    # So we need to go up 2 levels: scenes -> core -> socialsim4
    locale_file = Path(__file__).parent.parent.parent / "locales" / f"{locale}.json"

    if not locale_file.exists():
        # Fallback to Chinese markers if locale file missing
        if locale != "zh":
            return _get_locale_list(key, "zh")
        return []

    try:
        with open(locale_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Navigate nested keys
        keys = key.split(".")
        value = data
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
                if value is None:
                    break
            else:
                value = None
                break

        if isinstance(value, list):
            return value
        # Fallback to Chinese if not found in current locale
        if locale != "zh":
            return _get_locale_list(key, "zh")
        return []
    except (json.JSONDecodeError, IOError):
        if locale != "zh":
            return _get_locale_list(key, "zh")
        return []


# Module-level marker caches (populated lazily)
_MARKER_CACHE: Dict[str, Dict[str, List[str]]] = {}


def _get_policy_markers(locale: str = "zh") -> List[str]:
    """Get policy markers from locale file."""
    cache_key = f"policy_markers:{locale}"
    if cache_key in _MARKER_CACHE:
        return _MARKER_CACHE[cache_key]
    markers = _get_locale_list("prompts.policy_cascade.markers.policy", locale)
    _MARKER_CACHE[cache_key] = markers
    return markers


def _get_line_type_markers(line_type: str, locale: str = "zh") -> List[str]:
    """Get line type markers from locale file."""
    cache_key = f"line_type:{line_type}:{locale}"
    if cache_key in _MARKER_CACHE:
        return _MARKER_CACHE[cache_key]
    markers = _get_locale_list(f"prompts.policy_cascade.markers.line_types.{line_type}", locale)
    _MARKER_CACHE[cache_key] = markers
    return markers


def _get_agent_signal_markers(signal_type: str, locale: str = "zh") -> List[str]:
    """Get agent signal markers from locale file."""
    cache_key = f"agent_signal:{signal_type}:{locale}"
    if cache_key in _MARKER_CACHE:
        return _MARKER_CACHE[cache_key]
    markers = _get_locale_list(f"prompts.policy_cascade.markers.agent_signals.{signal_type}", locale)
    _MARKER_CACHE[cache_key] = markers
    return markers


def _get_notice_analysis_markers(locale: str = "zh") -> List[str]:
    """Get notice analysis markers from locale file."""
    cache_key = f"notice_analysis:{locale}"
    if cache_key in _MARKER_CACHE:
        return _MARKER_CACHE[cache_key]
    markers = _get_locale_list("prompts.policy_cascade.markers.notice_analysis", locale)
    _MARKER_CACHE[cache_key] = markers
    return markers


def _get_notice_execution_markers(locale: str = "zh") -> List[str]:
    """Get notice execution markers from locale file."""
    cache_key = f"notice_execution:{locale}"
    if cache_key in _MARKER_CACHE:
        return _MARKER_CACHE[cache_key]
    markers = _get_locale_list("prompts.policy_cascade.markers.notice_execution", locale)
    _MARKER_CACHE[cache_key] = markers
    return markers


def _get_all_line_type_markers(locale: str = "zh") -> Dict[str, List[str]]:
    """Get all line type markers as a dictionary."""
    return {
        "goal": _get_line_type_markers("goal", locale),
        "scope": _get_line_type_markers("scope", locale),
        "standard": _get_line_type_markers("standard", locale),
        "support": _get_line_type_markers("support", locale),
        "execution": _get_line_type_markers("execution", locale),
        "report": _get_line_type_markers("report", locale),
        "resource": _get_line_type_markers("resource", locale),
        "accountability": _get_line_type_markers("accountability", locale),
        "invariant": _get_line_type_markers("invariant", locale),
    }


def _get_all_agent_signal_markers(locale: str = "zh") -> Dict[str, List[str]]:
    """Get all agent signal markers as a dictionary."""
    return {
        "burden": _get_agent_signal_markers("burden", locale),
        "autonomy": _get_agent_signal_markers("autonomy", locale),
        "control": _get_agent_signal_markers("control", locale),
        "resource": _get_agent_signal_markers("resource", locale),
        "stability": _get_agent_signal_markers("stability", locale),
    }
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
        self.state["policy_version"] = 0
        self.state["processed_policy_version"] = -1
        self.state["conversation_threads"] = {}
        self.state["thread_inboxes"] = {}
        self.state["thread_counter"] = 0
        self.state["persistent_conditions"] = {}
        self.state["pending_follow_up_conditions"] = {}
        self.state["follow_up_thread_seeds"] = []
        self.state["informal_network"] = {}
        self.state["branch_interpretations"] = {}
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
        self.state.setdefault("policy_version", 0)
        self.state.setdefault("processed_policy_version", -1)
        self.state.setdefault("conversation_threads", {})
        self.state.setdefault("thread_inboxes", {})
        self.state.setdefault("thread_counter", 0)
        self.state.setdefault("persistent_conditions", {})
        self.state.setdefault("pending_follow_up_conditions", {})
        self.state.setdefault("follow_up_thread_seeds", [])
        self.state.setdefault("informal_network", {})
        self.state.setdefault("branch_interpretations", {})
        self._agents_by_tier = {tier: [] for tier in self.tier_order}

    # ----- Locale -----

    def _get_locale(self) -> str:
        """Get the preferred locale for this scene.

        Checks agents for language preference, defaults to Chinese for
        backward compatibility with existing policy text processing.
        """
        if hasattr(self, "simulator") and self.simulator:
            for agent in self.simulator.agents.values():
                if hasattr(agent, "language") and agent.language:
                    return "zh" if agent.language.startswith("zh") else "en"
        return "zh"

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
        self._apply_pending_follow_up_conditions()
        self._materialize_seeded_threads()
        if self._follow_up_has_pending_threads():
            self.state["task_mode"] = "follow_up"
        elif self._policy_follow_up_ready() and not self._private_recipient_names():
            self.state["task_mode"] = "follow_up"
        if self._private_recipient_names():
            self.state["current_tier_idx"] = self._private_active_tier_idx()
        else:
            self.state["current_tier_idx"] = 0
        self._normalize_active_tier()

    def on_event(self, sim, event_type: str, data):
        if event_type in {"environment", "broadcast"}:
            if self._apply_persistent_condition_event(sim, event_type, data):
                return None

            # If this incoming event is explicitly marked as notice_only,
            # treat it as a notice: update latest_notice/notice_kind and
            # emit a lightweight notice event for analytics, but do NOT
            # reset cascade state or start a new cascade.
            if bool(data.get("notice_only")):
                desc = data.get("description") or data.get("content") or data.get("message") or ""
                cleaned_desc = self._clean_policy_text(str(desc))
                self.state["latest_notice"] = cleaned_desc
                self.state["notice_kind"] = self._detect_notice_kind(cleaned_desc)
                sim.emit_event(
                    "environment_notice_received",
                    {
                        "event_type": event_type,
                        "content": cleaned_desc,
                        "mode": self._cascade_mode(),
                    },
                )
                return None

            # Otherwise, this is a full event that restarts the cascade.
            self.state["current_tier_idx"] = 0
            self.state["tier_seen"] = {t: [] for t in self.tier_order}
            self.state["tier_transmitted"] = {t: False for t in self.tier_order}
            self.state["private_events"] = {}
            self.state["active_tier_targets"] = {}
            self.state["conversation_threads"] = {}
            self.state["thread_inboxes"] = {}
            self.state["branch_interpretations"] = {}
            desc = data.get("description") or data.get("content") or data.get("message") or ""
            cleaned_desc = self._clean_policy_text(str(desc))
            self.state["latest_notice"] = cleaned_desc
            enters_cascade = self._should_enter_cascade(cleaned_desc, event_type)
            if enters_cascade:
                self.state["policy_version"] = int(self.state.get("policy_version", 0) or 0) + 1
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

        if self._apply_persistent_condition_event(sim, event_type, data):
            return None

        # If this private event is marked notice_only, deliver as a private
        # notice without restarting the cascade state. This keeps follow-up
        # interventions scoped to notice semantics.
        if bool(data.get("notice_only")):
            desc = data.get("description") or data.get("content") or data.get("message") or ""
            cleaned_desc = self._clean_policy_text(str(desc))
            # store latest notice but do not reset tiers or start cascade
            self.state["latest_notice"] = cleaned_desc
            self.state["notice_kind"] = self._detect_notice_kind(cleaned_desc)
            sim.emit_event(
                "environment_private_notice_received",
                {
                    "event_type": event_type,
                    "content": cleaned_desc,
                    "recipients": recipients,
                },
            )
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
        self.state["conversation_threads"] = {}
        self.state["thread_inboxes"] = {}
        self.state["branch_interpretations"] = {}
        self._rebuild_tiers()

        recipient_tiers = [self._tier_map.get(name) for name in recipients if self._tier_map.get(name)]
        if recipient_tiers:
            first_tier = min(self.tier_order.index(tier) for tier in recipient_tiers)
            self.state["current_tier_idx"] = first_tier
        else:
            self.state["current_tier_idx"] = 0
        if enters_cascade:
            self.state["policy_version"] = int(self.state.get("policy_version", 0) or 0) + 1
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
        """Calculate agent signal scores using locale-aware markers."""
        text = self._agent_signal_text(agent)
        locale = self._get_locale()
        markers = _get_all_agent_signal_markers(locale)
        return {
            key: self._keyword_score(text, keywords)
            for key, keywords in markers.items()
        }

    def _policy_signal_profile(self) -> Dict[str, float]:
        """Calculate policy signal scores using locale-aware markers."""
        text = "\n".join([
            str(self.state.get("source_policy", "") or ""),
            str(self.state.get("relayed_policy", "") or ""),
            str(self.state.get("latest_notice", "") or ""),
        ])
        locale = self._get_locale()
        markers = _get_all_line_type_markers(locale)
        profile = {
            key: self._keyword_score(text, keywords)
            for key, keywords in markers.items()
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
        resource_shortage = self._condition_value("resource_shortage")
        assessment_cycle = self._condition_value("assessment_cycle")
        public_opinion_pressure = self._condition_value("public_opinion_pressure")
        inspection_pressure = self._condition_value("inspection_pressure")
        profile["burden"] = self._clamp01(profile["burden"] + resource_shortage * 0.25 + assessment_cycle * 0.1)
        profile["resource_gap"] = self._clamp01(profile["resource_gap"] + resource_shortage * 0.45)
        profile["accountability"] = self._clamp01(profile["accountability"] + inspection_pressure * 0.35 + assessment_cycle * 0.15)
        profile["report"] = self._clamp01(profile["report"] + assessment_cycle * 0.3 + inspection_pressure * 0.1)
        profile["goal"] = self._clamp01(profile["goal"] + public_opinion_pressure * 0.1)
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
        """Generate distortion reason using locale-aware strings."""
        locale = self._get_locale()
        agent_profile = self._agent_signal_profile(agent)
        policy_profile = self._policy_signal_profile()
        scored = [
            (T("prompts.policy_cascade.distortion.reasons.grassroots_burden", locale=locale), policy_profile["burden"] * (0.35 + agent_profile["burden"] * 0.35)),
            (T("prompts.policy_cascade.distortion.reasons.resource_gap", locale=locale), policy_profile["resource_gap"] * (0.2 + agent_profile["resource"] * 0.3)),
            (T("prompts.policy_cascade.distortion.reasons.accountability_pressure", locale=locale), policy_profile["accountability"] * (0.15 + agent_profile["autonomy"] * 0.2)),
            (T("prompts.policy_cascade.distortion.reasons.reporting_chain", locale=locale), policy_profile["report"] * (0.1 + agent_profile["burden"] * 0.15)),
        ]
        top_reasons = [label for label, score in sorted(scored, key=lambda item: item[1], reverse=True)[:2] if score > 0.08]
        if not top_reasons:
            top_reasons = [T("prompts.policy_cascade.distortion.default_reason", locale=locale)]

        role_kind = self._tier_role_kind(tier)
        role_note = T(f"prompts.policy_cascade.distortion.role_notes.{role_kind}", locale=locale)

        separator = "；" if locale == "zh" else "; "
        return separator.join(top_reasons + [role_note])

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
        """Classify line type using locale-aware markers."""
        locale = self._get_locale()
        markers = _get_all_line_type_markers(locale)
        policy_markers = _get_policy_markers(locale)

        normalized = re.sub(r'^\s*(?:\d+[\.、]\s*)?', '', str(line or '').strip())

        # Check for meta marker (original text indicator)
        meta_markers = [m for m in policy_markers if ":" in m or "原文" in m or "Original" in m]
        if any(m in normalized for m in meta_markers) or normalized == "原文：" or normalized == "Original Text:":
            return "meta"

        # Title detection uses Chinese patterns for now (policy documents are Chinese)
        if ("通知" in normalized or "公告" in normalized) and (
            normalized.startswith("关于")
            or "关于" in normalized
            or normalized.startswith("「")
            or normalized.startswith("【")
        ):
            return "title"
        header, _ = self._split_policy_line(normalized)
        if header:
            for kind, kind_markers in markers.items():
                if any(marker in header for marker in kind_markers):
                    return kind
        for kind, kind_markers in markers.items():
            if any(marker in normalized for marker in kind_markers):
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
        """Soften policy text based on distortion strength.

        Note: Replacement rules only apply for Chinese text, as these are
        Chinese-specific policy softening patterns. English policy text
        uses different patterns and is returned unchanged.
        """
        softened = str(body or "").strip()

        # Only apply Chinese text replacements for Chinese locale
        locale = self._get_locale()
        if locale != "zh":
            return softened

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
        semantic_conflict += self._condition_value("resource_shortage") * 0.12
        semantic_conflict += self._condition_value("assessment_cycle") * 0.08
        semantic_conflict += self._condition_value("inspection_pressure") * 0.1
        semantic_conflict += self._condition_value("public_opinion_pressure") * 0.06
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

    def _persistent_conditions(self) -> dict:
        conditions = self.state.get("persistent_conditions") or {}
        return conditions if type(conditions) is dict else {}

    def _pending_follow_up_conditions(self) -> dict:
        conditions = self.state.get("pending_follow_up_conditions") or {}
        return conditions if type(conditions) is dict else {}

    def _apply_pending_follow_up_conditions(self) -> None:
        pending = self._pending_follow_up_conditions()
        if not pending:
            return
        merged = dict(self._persistent_conditions())
        for key, value in pending.items():
            merged[key] = self._clamp01(float(value))
        self.state["persistent_conditions"] = merged
        self.state["pending_follow_up_conditions"] = {}

    def _follow_up_thread_seeds(self) -> List[dict]:
        seeds = self.state.get("follow_up_thread_seeds") or []
        return seeds if type(seeds) is list else []

    def _materialize_seeded_threads(self) -> None:
        seeds = list(self._follow_up_thread_seeds())
        if not seeds:
            return
        self.state["follow_up_thread_seeds"] = []
        self.state["task_mode"] = "follow_up"
        for seed in seeds:
            sender_name = str(seed.get("sender") or "").strip()
            recipient_name = str(seed.get("recipient") or "").strip()
            kind = str(seed.get("kind") or "peer_consult").strip() or "peer_consult"
            message = self._sanitize_message(str(seed.get("message") or ""))
            metadata = dict(seed.get("metadata") or {})
            notice = str(seed.get("notice") or "").strip()
            if notice:
                self.state["latest_notice"] = notice
            sender = self.simulator.agents[sender_name]
            self._open_thread(kind, sender, recipient_name, message, self.simulator, metadata)

    def _condition_value(self, *keys: str) -> float:
        conditions = self._persistent_conditions()
        for key in keys:
            if key in conditions:
                return self._clamp01(float(conditions.get(key) or 0.0))
        return 0.0

    def _parse_persistent_condition_payload(self, raw_text: str) -> dict:
        text = str(raw_text or "").strip()
        if not text:
            return {}
        cleaned = text.replace("；", ",").replace("\n", ",")
        pairs = [part.strip() for part in re.split(r"[,，]+", cleaned) if part.strip()]
        result = {}
        aliases = {
            "resource_shortage": "resource_shortage",
            "长期资源短缺": "resource_shortage",
            "assessment_cycle": "assessment_cycle",
            "考核周期": "assessment_cycle",
            "public_opinion_pressure": "public_opinion_pressure",
            "舆论高压": "public_opinion_pressure",
            "inspection_pressure": "inspection_pressure",
            "监察强化": "inspection_pressure",
        }
        for pair in pairs:
            if ":" in pair:
                key, value = pair.split(":", 1)
            elif "=" in pair:
                key, value = pair.split("=", 1)
            else:
                continue
            normalized = aliases.get(key.strip(), key.strip())
            result[normalized] = self._clamp01(float(value.strip()))
        return result

    def _apply_persistent_condition_event(self, sim, event_type: str, data: dict) -> bool:
        if event_type != "environment":
            return False
        env_type = str(data.get("event_type") or "").strip().lower()
        if env_type not in {"persistent_condition", "institutional_condition", "system_condition"}:
            return False
        updates = self._parse_persistent_condition_payload(str(data.get("description") or ""))
        if not updates:
            return True
        merged = dict(self._persistent_conditions())
        for key, value in updates.items():
            merged[key] = self._clamp01(value)
        self.state["persistent_conditions"] = merged
        sim.emit_event(
            "persistent_conditions_updated",
            {
                "conditions": merged,
                "source": env_type,
            },
        )
        return True

    def _formal_network(self) -> dict:
        social_network = self.state.get("social_network") or {}
        return social_network if type(social_network) is dict else {}

    def _informal_network(self) -> dict:
        informal_network = self.state.get("informal_network") or {}
        return informal_network if type(informal_network) is dict else {}

    def _reverse_connections_for(self, agent_name: str) -> List[str]:
        result = []
        for sender, targets in self._formal_network().items():
            if type(targets) is not list:
                continue
            if agent_name in targets and sender in self.simulator.agents:
                result.append(sender)
        return result

    def _peer_targets(self, agent: Agent) -> List[str]:
        tier = self._tier_map.get(agent.name) or self._extract_tier(agent)
        same_tier = [name for name in self._agents_by_tier.get(tier, []) if name != agent.name]
        connected = []
        informal = self._informal_network().get(agent.name) or []
        formal = self._formal_network().get(agent.name) or []
        for name in same_tier:
            if name in informal or name in formal:
                connected.append(name)
        if connected:
            return connected
        return same_tier

    def _upstream_targets(self, agent: Agent, skip_levels: int = 1) -> List[str]:
        tier = self._tier_map.get(agent.name) or self._extract_tier(agent)
        idx = self.tier_order.index(tier) if tier in self.tier_order else 0
        target_idx = idx - skip_levels
        if target_idx < 0:
            return []
        target_tier = self.tier_order[target_idx]
        reverse = self._reverse_connections_for(agent.name)
        candidates = [name for name in reverse if (self._tier_map.get(name) or self._extract_tier(self.simulator.agents[name])) == target_tier]
        if candidates:
            return candidates
        return list(self._agents_by_tier.get(target_tier, []))

    def _notify_targets(self, agent: Agent) -> List[str]:
        tier = self._tier_map.get(agent.name) or self._extract_tier(agent)
        idx = self.tier_order.index(tier) if tier in self.tier_order else 0
        if idx + 1 >= len(self.tier_order):
            return []
        next_tier = self.tier_order[idx + 1]
        direct = self._network_connections_for(agent.name)
        candidates = [name for name in direct if (self._tier_map.get(name) or self._extract_tier(self.simulator.agents[name])) == next_tier]
        if candidates:
            return candidates
        return list(self._agents_by_tier.get(next_tier, []))

    def _branch_descendants(self, sender: Agent) -> List[str]:
        seen = set()
        queue = list(self._network_connections_for(sender.name) or [])
        while queue:
            name = queue.pop(0)
            if name in seen:
                continue
            seen.add(name)
            queue.extend(self._network_connections_for(name))
        return [name for name in seen if name in self.simulator.agents]

    def _policy_follow_up_ready(self) -> bool:
        latest_policy = str(self.state.get("latest_policy") or "").strip()
        if not latest_policy:
            return False
        policy_version = int(self.state.get("policy_version", 0) or 0)
        processed = int(self.state.get("processed_policy_version", -1) or -1)
        return policy_version <= processed

    def _follow_up_has_pending_threads(self) -> bool:
        if self._private_recipient_names():
            return any(
                str((self._private_event_for(name).get("task_mode") or "")) == "follow_up_thread"
                for name in self._private_recipient_names()
            )
        inboxes = self.state.get("thread_inboxes") or {}
        return any(list(items or []) for items in inboxes.values())

    def _next_thread_id(self) -> str:
        current = int(self.state.get("thread_counter", 0) or 0) + 1
        self.state["thread_counter"] = current
        return f"thread-{current}"

    def _thread_store(self) -> dict:
        threads = self.state.get("conversation_threads") or {}
        if type(threads) is not dict:
            threads = {}
        self.state["conversation_threads"] = threads
        return threads

    def _thread_for_id(self, thread_id: str) -> dict:
        return dict((self._thread_store().get(thread_id) or {}))

    def _replace_thread(self, thread_id: str, thread: dict) -> None:
        threads = self._thread_store()
        threads[thread_id] = thread
        self.state["conversation_threads"] = threads

    def _thread_issue_candidates(self, agent: Agent, tier: str) -> List[str]:
        policy_profile = self._policy_signal_profile()
        issues = []
        if policy_profile["burden"] >= 0.45:
            issues.append("执行成本过高")
        if policy_profile["resource_gap"] >= 0.35 or self._condition_value("resource_shortage") >= 0.35:
            issues.append("资源不足")
        if self._conflict_pressure(agent, tier) >= 0.55:
            issues.append("目标冲突")
        if self._condition_value("public_opinion_pressure") >= 0.4:
            issues.append("群体反弹")
        if self._condition_value("assessment_cycle") >= 0.45 or policy_profile["report"] >= 0.45:
            issues.append("无法按时完成")
        return issues[:3]

    def _branch_interpretations(self) -> dict:
        interpretations = self.state.get("branch_interpretations") or {}
        if type(interpretations) is not dict:
            interpretations = {}
        self.state["branch_interpretations"] = interpretations
        return interpretations

    def _record_branch_interpretation(self, agent: Agent, tier: str, message: str, mode: str) -> None:
        if not str(message or "").strip():
            return
        interpretations = self._branch_interpretations()
        interpretations[agent.name] = {
            "agent": agent.name,
            "tier": tier,
            "message": str(message),
            "mode": mode,
            "policy_version": int(self.state.get("policy_version", 0) or 0),
            "turn": int(getattr(self.simulator, "turns", 0) or 0),
        }
        self.state["branch_interpretations"] = interpretations

    def _competing_interpretations_for(self, agent: Agent) -> List[dict]:
        current_version = int(self.state.get("policy_version", 0) or 0)
        candidates = []
        seen = set()
        for name in self._reverse_connections_for(agent.name) + self._peer_targets(agent):
            if name in seen:
                continue
            seen.add(name)
            item = dict((self._branch_interpretations().get(name) or {}))
            if not item:
                continue
            if int(item.get("policy_version", -1) or -1) != current_version:
                continue
            candidates.append(item)
        return candidates

    def _queue_thread_event(self, recipient: str, thread: dict, reply_target: str, notice: str = "") -> None:
        private_events = self.state.get("private_events") or {}
        inboxes = self.state.get("thread_inboxes") or {}
        payload = {
            "task_mode": "follow_up_thread",
            "latest_notice": str(self.state.get("latest_notice") or notice or ""),
            "latest_policy": str(self.state.get("latest_policy") or ""),
            "source_policy": str(self.state.get("source_policy") or ""),
            "relayed_policy": str(self.state.get("relayed_policy") or self.state.get("latest_policy") or ""),
            "notice_kind": "execution",
            "thread_id": thread["id"],
            "thread_kind": thread["kind"],
            "thread_sender": thread.get("last_sender") or thread.get("sender"),
            "reply_target": reply_target,
            "thread_message": thread.get("last_message") or thread.get("message") or "",
            "thread_status": thread.get("status") or "open",
            "conversation_history": list(thread.get("history") or []),
            "thread_root_sender": thread.get("root_sender") or thread.get("sender"),
            "thread_notice": notice,
        }
        existing = private_events.get(recipient) or {}
        if existing:
            queued = list(inboxes.get(recipient) or [])
            queued.append(thread["id"])
            inboxes[recipient] = queued
        else:
            private_events[recipient] = payload
        self.state["private_events"] = private_events
        self.state["thread_inboxes"] = inboxes

    def _activate_next_thread(self, recipient: str) -> None:
        private_events = self.state.get("private_events") or {}
        if private_events.get(recipient):
            return
        inboxes = self.state.get("thread_inboxes") or {}
        queued = list(inboxes.get(recipient) or [])
        if not queued:
            return
        thread_id = queued.pop(0)
        inboxes[recipient] = queued
        self.state["thread_inboxes"] = inboxes
        thread = self._thread_for_id(thread_id)
        if not thread:
            return
        reply_target = str(thread.get("last_sender") or thread.get("sender") or "")
        self._queue_thread_event(recipient, thread, reply_target)

    def _consume_thread_event(self, recipient: str) -> None:
        private_events = self.state.get("private_events") or {}
        private_events.pop(recipient, None)
        self.state["private_events"] = private_events
        self._activate_next_thread(recipient)

    def _open_thread(self, kind: str, sender: Agent, recipient: str, message: str, simulator, metadata: dict | None = None) -> dict:
        thread_id = self._next_thread_id()
        history = [
            {
                "sender": sender.name,
                "recipient": recipient,
                "message": message,
                "kind": kind,
                "turn": int(simulator.turns),
            }
        ]
        thread = {
            "id": thread_id,
            "kind": kind,
            "sender": sender.name,
            "root_sender": sender.name,
            "root_recipient": recipient,
            "last_sender": sender.name,
            "last_recipient": recipient,
            "last_message": message,
            "status": "open",
            "created_turn": int(simulator.turns),
            "history": history,
            "metadata": metadata or {},
        }
        self._replace_thread(thread_id, thread)
        self._queue_thread_event(recipient, thread, sender.name)
        simulator.emit_event(
            "policy_thread_opened",
            {
                "thread_id": thread_id,
                "kind": kind,
                "sender": sender.name,
                "recipient": recipient,
                "message": message,
                "metadata": metadata or {},
            },
        )
        return thread

    def _reply_to_thread(self, thread: dict, agent: Agent, message: str, simulator) -> None:
        reply_target = str(thread.get("last_sender") or thread.get("sender") or "")
        history = list(thread.get("history") or [])
        history.append(
            {
                "sender": agent.name,
                "recipient": reply_target,
                "message": message,
                "kind": "reply",
                "turn": int(simulator.turns),
            }
        )
        thread["history"] = history
        thread["last_sender"] = agent.name
        thread["last_recipient"] = reply_target
        thread["last_message"] = message
        thread["status"] = "responded"
        self._replace_thread(thread["id"], thread)
        self._queue_thread_event(reply_target, thread, agent.name)
        simulator.emit_event(
            "policy_thread_reply",
            {
                "thread_id": thread["id"],
                "kind": thread.get("kind"),
                "sender": agent.name,
                "recipient": reply_target,
                "message": message,
            },
        )

    def _ignore_thread(self, thread: dict, agent: Agent, simulator) -> None:
        thread["status"] = "ignored"
        self._replace_thread(thread["id"], thread)
        last_sender = str(thread.get("last_sender") or thread.get("sender") or "")
        notice = f"{agent.name} 暂未处理你发起的会话。"
        if last_sender and last_sender != agent.name:
            thread["last_sender"] = agent.name
            thread["last_recipient"] = last_sender
            thread["last_message"] = notice
            self._replace_thread(thread["id"], thread)
            self._queue_thread_event(last_sender, thread, agent.name, notice=notice)
        simulator.emit_event(
            "policy_thread_ignored",
            {
                "thread_id": thread["id"],
                "kind": thread.get("kind"),
                "agent": agent.name,
                "notice": notice,
            },
        )

    def _follow_up_visible_targets(self, agent_name: str) -> List[str]:
        visible = []
        for name in self._network_connections_for(agent_name):
            if name not in visible:
                visible.append(name)
        for name in self._reverse_connections_for(agent_name):
            if name not in visible:
                visible.append(name)
        for name in (self._informal_network().get(agent_name) or []):
            if name in self.simulator.agents and name != agent_name and name not in visible:
                visible.append(name)
        if visible:
            return visible
        return [name for name in self.simulator.agents.keys() if name != agent_name]

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
        """Detect if notice is analysis or execution type based on locale-aware markers."""
        if not text:
            return "execution"

        locale = self._get_locale()
        analysis_markers = _get_notice_analysis_markers(locale)
        execution_markers = _get_notice_execution_markers(locale)

        analysis_score = sum(1 for m in analysis_markers if m in text)
        execution_score = sum(1 for m in execution_markers if m in text)

        if analysis_score > execution_score:
            return "analysis"
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

    def _agent_led_distortion(self, agent: Agent, tier: str, policy: str, draft: str) -> str:
        normalized = self._sanitize_message(draft)
        if not normalized:
            return self._distort_message(agent, tier, policy)

        policy_norm = " ".join(str(policy or "").split())
        draft_norm = " ".join(normalized.split())
        if draft_norm == policy_norm:
            return self._distort_message(agent, tier, policy)

        strength = self._distortion_strength()
        pressure = self._conflict_pressure(agent, tier)
        if self._message_has_tier_drift(tier, normalized):
            detail = self._cascade_tier_detail(tier)
            if detail not in normalized:
                normalized = f"{normalized}\n{detail}".strip()

        if strength >= 0.45 and pressure >= 0.5:
            issues = self._thread_issue_candidates(agent, tier)
            if issues:
                issue_line = "本层当前最担心：" + "、".join(issues) + "。"
                if issue_line not in normalized:
                    normalized = f"{normalized}\n{issue_line}".strip()

        if strength >= 0.65 and not any(marker in normalized for marker in ["暂缓", "分批", "优先", "内部掌握", "条件具备后"]):
            normalized = f"{normalized}\n后续其余部分视资源与反馈情况分批推进。".strip()

        return self._sanitize_message(normalized)

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
        if effective_mode == "follow_up_thread":
            return (
                "When your tier is active: "
                "(1) 你正在处理一条私有会话或反馈线程；"
                "(2) 你可以使用 send_message 私下回复当前来件，也可以用 yield 暂时回避；"
                "(3) 你也可以进一步 report_upward、escalate_complaint、consult_peer 或 notify_subordinate，把当前问题继续上传、协商或转办；"
                "(4) 如果你认为必须调整既有政策口径，可使用 announce_policy_adjustment 发布新的政策调整并重新开启下传。"
            )
        if effective_mode == "follow_up":
            return (
                "When your tier is active: "
                "(1) 当前没有新的广播政策，你可以围绕既有政策的执行困难、资源缺口、口径冲突和群体反弹展开后续互动；"
                "(2) 基层可以向直属上级 report_upward，也可以在必要时 escalate_complaint 越级反映；"
                "(3) 同层可通过 consult_peer 进行私下协商与口径统一；"
                "(4) 上级可用 notify_subordinate 私下回访或转办，也可用 announce_policy_adjustment 重新发布政策调整。"
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
        issue_candidates = self._thread_issue_candidates(agent, tier)
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
        elif mode == "cascade":
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
        elif mode == "follow_up_thread":
            thread_kind = str(private_event.get("thread_kind") or "thread")
            thread_sender = str(private_event.get("thread_sender") or "")
            thread_message = str(private_event.get("thread_message") or "")
            reply_target = str(private_event.get("reply_target") or thread_sender)
            thread_notice = str(private_event.get("thread_notice") or "")
            parts.append("当前任务：处理一条私有反馈/协商线程。你可以 send_message 私下回复，也可以 yield 暂时回避。")
            if thread_notice:
                parts.append(f"线程状态提示：{thread_notice}")
            parts.append(f"会话类型：{thread_kind}；当前来件人：{thread_sender or '未知'}；默认回复对象：{reply_target or '未知'}。")
            if thread_message:
                parts.append(f"当前来件内容：{thread_message}")
            if thread_kind in {"upward_feedback", "escalation"}:
                parts.append("你也可以把该问题继续上报、转办、私下协调，或发布新的政策调整。")
        else:
            parts.append("当前没有新的广播政策，进入后续反馈与协商阶段。")
            if issue_candidates:
                parts.append(f"当前最可能出现的执行问题：{'、'.join(issue_candidates)}。")
            direct_up = self._upstream_targets(agent, 1)
            skip_up = self._upstream_targets(agent, 2)
            peers = self._peer_targets(agent)
            down = self._notify_targets(agent)
            if direct_up:
                parts.append(f"你可向直属上级反馈：{'、'.join(direct_up)}。")
            if skip_up:
                parts.append(f"若直属上级不处理，你可越级反映：{'、'.join(skip_up)}。")
            if peers:
                parts.append(f"你可与同层连接对象私下协商：{'、'.join(peers)}。")
            if down:
                parts.append(f"你也可私下通知下级或转办：{'、'.join(down)}。")
            if role_kind != "low":
                parts.append("若你认为必须修正现有口径，可直接发布新的政策调整并重新开启级联。")
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
        conditions = self._persistent_conditions()
        if conditions:
            rendered = "、".join(f"{key}={value:.2f}" for key, value in conditions.items())
            parts.append(f"当前持续制度条件：{rendered}。")
        competing = self._competing_interpretations_for(agent)
        if competing:
            summary = "；".join(
                f"{item.get('agent')}({item.get('tier')})：{self._policy_prompt_excerpt(str(item.get('message') or ''))}"
                for item in competing[:3]
            )
            parts.append(f"当前存在可竞争的解释口径：{summary}。请判断你要靠拢、折中还是反驳这些口径。")
        upstream_messages = list(private_event.get("upstream_messages") or [])
        if len(upstream_messages) > 1:
            senders = "、".join(str(item.get("sender") or "上层节点") for item in upstream_messages)
            parts.append(f"你同时收到来自 {senders} 的多个上层版本；请先综合这些版本，再形成一个统一的本层下传版本。")
        return "\n".join(parts)

    # ----- Actions -----

    def get_scene_actions(self, agent: Agent):
        return [
            SendMessageAction(),
            YieldAction(),
            ReportUpwardAction(),
            EscalateComplaintAction(),
            ConsultPeerAction(),
            NotifySubordinateAction(),
            AnnouncePolicyAdjustmentAction(),
        ]

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
        thread = self._thread_for_id(str(private_event.get("thread_id") or "")) if effective_task_mode == "follow_up_thread" else {}
        special_actions = {
            "report_upward",
            "escalate_complaint",
            "consult_peer",
            "notify_subordinate",
            "announce_policy_adjustment",
        }

        if effective_task_mode == "follow_up_thread":
            if action_name == "send_message" and not self.should_skip_turn(agent, simulator):
                message = self._sanitize_message(payload.get("message", ""))
                self._reply_to_thread(thread, agent, message, simulator)
                self._consume_thread_event(agent.name)
                self._write_final_debug(agent, effective_task_mode, original_payload, {"action": "send_message", "message": message})
                return True, {"message": message}, f"{agent.name} 私下回复了线程", {}, True
            if action_name == "yield" and not self.should_skip_turn(agent, simulator):
                self._ignore_thread(thread, agent, simulator)
                self._consume_thread_event(agent.name)
                return True, {}, f"{agent.name} 暂未处理线程", {}, True
            if action_name in special_actions and not self.should_skip_turn(agent, simulator):
                success, result, summary, meta, pass_control = self.handle_policy_special_action(action_name, payload, agent, simulator)
                self._consume_thread_event(agent.name)
                return success, result, summary, meta, pass_control

        if action_name in special_actions and not self.should_skip_turn(agent, simulator):
            return self.handle_policy_special_action(action_name, payload, agent, simulator)

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
                    distorted = self._agent_led_distortion(agent, tier, policy, message)
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

        if private_event and effective_task_mode != "follow_up_thread":
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
            self._record_branch_interpretation(agent, tier, payload["message"], effective_task_mode)
            self._write_final_debug(agent, effective_task_mode, original_payload, payload)

        success, result, summary, meta, _ = super().parse_and_handle_action(payload, agent, simulator)
        return success, result, summary, meta, True

    def handle_policy_special_action(self, action_name: str, action_data: dict, agent: Agent, simulator):
        target = str(action_data.get("target") or action_data.get("to") or "").strip()
        message = self._sanitize_message(str(action_data.get("message") or ""))
        tier = self._tier_map.get(agent.name) or self._extract_tier(agent)
        current_thread_event = self._private_event_for(agent.name)
        current_thread = self._thread_for_id(str(current_thread_event.get("thread_id") or "")) if current_thread_event else {}

        if action_name == "announce_policy_adjustment":
            if tier == self.tier_order[-1]:
                error = "基层不能直接发布新的政策调整。"
                agent.add_env_feedback(error)
                return False, {"error": error}, error, {}, True
            if not message:
                error = "Missing message."
                agent.add_env_feedback(error)
                return False, {"error": error}, error, {}, True
            text = f"【政策调整】{message}"
            if tier == self.tier_order[0]:
                simulator.broadcast(PublicEvent(text, prefix="Policy Update"))
                recipients = [name for name in simulator.agents.keys() if name != agent.name]
            else:
                recipients = self._branch_descendants(agent)
                simulator.broadcast(PublicEvent(text, prefix="Policy Update"), receivers=recipients)
            simulator.emit_event(
                "policy_adjustment_issued",
                {
                    "sender": agent.name,
                    "tier": tier,
                    "message": text,
                    "recipients": recipients,
                },
            )
            self._write_final_debug(agent, "follow_up", action_data, {"action": action_name, "message": text})
            return True, {"message": text, "recipients": recipients}, f"{agent.name} 发布了新的政策调整", {}, True

        if not target:
            error = "Provide 'target'."
            agent.add_env_feedback(error)
            return False, {"error": error}, error, {}, True
        if target not in simulator.agents:
            error = f"No such person: {target}."
            agent.add_env_feedback(error)
            return False, {"error": error}, error, {}, True
        if not message:
            error = "Missing message."
            agent.add_env_feedback(error)
            return False, {"error": error}, error, {}, True

        if action_name == "report_upward":
            allowed = self._upstream_targets(agent, 1)
            if target not in allowed:
                error = f"{target} 不是你的直属上级反馈对象。"
                agent.add_env_feedback(error)
                return False, {"error": error}, error, {}, True
            metadata = {
                "tier": tier,
                "issues": self._thread_issue_candidates(agent, tier),
                "source_thread": current_thread.get("id") if current_thread else "",
            }
            thread = self._open_thread("upward_feedback", agent, target, message, simulator, metadata)
            if current_thread:
                current_thread["status"] = "forwarded"
                self._replace_thread(current_thread["id"], current_thread)
            self._write_final_debug(agent, "follow_up", action_data, {"action": action_name, "target": target, "message": message})
            return True, {"thread_id": thread["id"], "target": target, "message": message}, f"{agent.name} 向 {target} 反馈了执行困难", {}, True

        if action_name == "escalate_complaint":
            allowed = self._upstream_targets(agent, 2)
            if target not in allowed:
                error = f"{target} 不是可用的越级反馈对象。"
                agent.add_env_feedback(error)
                return False, {"error": error}, error, {}, True
            metadata = {
                "tier": tier,
                "issues": self._thread_issue_candidates(agent, tier),
                "source_thread": current_thread.get("id") if current_thread else "",
                "escalated": True,
            }
            thread = self._open_thread("escalation", agent, target, message, simulator, metadata)
            if current_thread:
                current_thread["status"] = "escalated"
                self._replace_thread(current_thread["id"], current_thread)
            self._write_final_debug(agent, "follow_up", action_data, {"action": action_name, "target": target, "message": message})
            return True, {"thread_id": thread["id"], "target": target, "message": message}, f"{agent.name} 向 {target} 发起了越级投诉", {}, True

        if action_name == "consult_peer":
            allowed = self._peer_targets(agent)
            if target not in allowed:
                error = f"{target} 不是可用的同层协商对象。"
                agent.add_env_feedback(error)
                return False, {"error": error}, error, {}, True
            metadata = {
                "tier": tier,
                "issues": self._thread_issue_candidates(agent, tier),
                "source_thread": current_thread.get("id") if current_thread else "",
                "informal": True,
            }
            thread = self._open_thread("peer_consult", agent, target, message, simulator, metadata)
            self._write_final_debug(agent, "follow_up", action_data, {"action": action_name, "target": target, "message": message})
            return True, {"thread_id": thread["id"], "target": target, "message": message}, f"{agent.name} 与 {target} 发起了同层协商", {}, True

        if action_name == "notify_subordinate":
            allowed = self._notify_targets(agent)
            if target not in allowed:
                error = f"{target} 不是可用的下级通知对象。"
                agent.add_env_feedback(error)
                return False, {"error": error}, error, {}, True
            metadata = {
                "tier": tier,
                "source_thread": current_thread.get("id") if current_thread else "",
                "notified_by": agent.name,
            }
            thread = self._open_thread("subordinate_notice", agent, target, message, simulator, metadata)
            if current_thread:
                current_thread["status"] = "redirected"
                self._replace_thread(current_thread["id"], current_thread)
            self._write_final_debug(agent, "follow_up", action_data, {"action": action_name, "target": target, "message": message})
            return True, {"thread_id": thread["id"], "target": target, "message": message}, f"{agent.name} 私下通知了 {target}", {}, True

        error = f"Unknown special action: {action_name}"
        agent.add_env_feedback(error)
        return False, {"error": error}, error, {}, True

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
        elif self.state.get("task_mode") == "follow_up":
            recipients = self._follow_up_visible_targets(sender.name)
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
        mode = str(self.state.get("task_mode") or "notice")
        if mode == "follow_up":
            private_event = self._private_event_for(agent.name)
            private_recipients = self._private_recipient_names()
            if private_recipients:
                return not private_event
            return False
        private_recipients = self._private_recipient_names()
        if private_recipients:
            private_tier = self.tier_order[self._private_active_tier_idx()]
            tier = self._tier_map.get(agent.name) or self._extract_tier(agent)
            return agent.name not in private_recipients or tier != private_tier
        tier = self._tier_map.get(agent.name) or self._extract_tier(agent)
        return tier != self._active_tier()

    def post_turn(self, agent: Agent, simulator) -> None:
        super().post_turn(agent, simulator)

        if str(self.state.get("task_mode") or "") == "follow_up":
            self._activate_next_thread(agent.name)
            return

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
                self.state["processed_policy_version"] = int(self.state.get("policy_version", 0) or 0)
                self.state["tier_seen"] = {t: [] for t in self.tier_order}
                self._normalize_active_tier()
                return
            next_idx = self.tier_order.index(tier) + 1
            if next_idx < len(self.tier_order):
                self.state["current_tier_idx"] = next_idx
                if (self.state.get("social_network") or {}) and not self._active_targets_for_tier(self.tier_order[next_idx]) and not self._private_recipient_names():
                    self.state["current_tier_idx"] = len(self.tier_order)
                    self.state["complete"] = True
                    self.state["processed_policy_version"] = int(self.state.get("policy_version", 0) or 0)
            else:
                self.state["current_tier_idx"] = len(self.tier_order)
                self.state["complete"] = True
                self.state["processed_policy_version"] = int(self.state.get("policy_version", 0) or 0)
            self.state["tier_seen"] = {t: [] for t in self.tier_order}
            self._normalize_active_tier()

    def is_complete(self):
        if str(self.state.get("task_mode") or "") == "follow_up":
            return False
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