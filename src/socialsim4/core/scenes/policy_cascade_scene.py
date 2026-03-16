from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from socialsim4.core.actions.base_actions import SendMessageAction, YieldAction
from socialsim4.core.agent import Agent
from socialsim4.core.agent.parsing import strip_thinking_tokens
from socialsim4.core.scene import Scene


TIER_ORDER = ["top", "mid", "low"]
POLICY_MARKERS = ["原文", "不可改写条款", "报告要求", "执行要求", "目标："]
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


def _extract_tier(agent: Agent) -> str:
    tier = str(agent.properties.get("tier", "")).strip().lower() if hasattr(agent, "properties") else ""
    if tier in TIER_ORDER:
        return tier

    text = " ".join([
        str(getattr(agent, "role_prompt", "")),
        str(getattr(agent, "user_profile", "")),
    ]).lower()
    match = re.search(r"政治职位层级[:：]\s*(top|mid|low)", text)
    if match:
        return match.group(1)

    return "mid"


class PolicyCascadeScene(Scene):
    """Strict top→mid→low cascade, single action per tier, downstream-only delivery."""

    TYPE = "policy_cascade_scene"

    def __init__(self, name: str, initial_event: str):
        super().__init__(name, initial_event)
        self.state["current_tier_idx"] = 0
        self.state["tier_seen"] = {t: [] for t in TIER_ORDER}
        self.state["latest_policy"] = ""
        self.state["latest_notice"] = str(initial_event or "")
        self.state["task_mode"] = "notice"
        self.state["notice_kind"] = "execution"
        self.state["complete"] = False
        self._tier_map: Dict[str, str] = {}
        self._agents_by_tier: Dict[str, List[str]] = {t: [] for t in TIER_ORDER}

    # ----- Lifecycle -----

    def set_simulator(self, simulator):
        self.simulator = simulator
        self._rebuild_tiers()
        self._normalize_active_tier()

    def reset_for_run(self):
        self.state["current_tier_idx"] = 0
        self.state["complete"] = False
        self.state["tier_seen"] = {t: [] for t in TIER_ORDER}
        self._normalize_active_tier()

    def on_event(self, sim, event_type: str, data):
        if event_type in {"environment", "broadcast"}:
            self.state["current_tier_idx"] = 0
            self.state["tier_seen"] = {t: [] for t in TIER_ORDER}
            desc = data.get("description") or data.get("content") or data.get("message") or ""
            cleaned_desc = self._clean_policy_text(str(desc))
            self.state["latest_notice"] = cleaned_desc
            if self._is_policy_announcement(cleaned_desc):
                self.state["latest_policy"] = cleaned_desc
                self.state["task_mode"] = "cascade"
                self.state["notice_kind"] = "execution"
            else:
                self.state["task_mode"] = "notice"
                self.state["notice_kind"] = self._detect_notice_kind(cleaned_desc)
            self.state["complete"] = False
            self._rebuild_tiers()
            self._normalize_active_tier()
        return None

    # ----- Tier helpers -----

    def _rebuild_tiers(self) -> None:
        self._tier_map = {}
        names = list(self.simulator.agents.keys())
        for name, agent in self.simulator.agents.items():
            self._tier_map[name] = _extract_tier(agent)

        present = {t for t in self._tier_map.values() if t in TIER_ORDER}
        if len(present) < len(TIER_ORDER) and names:
            for idx, name in enumerate(names):
                tier = self._tier_map.get(name)
                if tier not in TIER_ORDER:
                    forced = TIER_ORDER[min(idx, len(TIER_ORDER) - 1)]
                    self._tier_map[name] = forced
                    present.add(forced)

        self._agents_by_tier = {t: [] for t in TIER_ORDER}
        for name, tier in self._tier_map.items():
            if tier in TIER_ORDER:
                self._agents_by_tier[tier].append(name)

    def _normalize_active_tier(self) -> None:
        idx = int(self.state.get("current_tier_idx", 0))
        while idx < len(TIER_ORDER):
            tier = TIER_ORDER[idx]
            if self._agents_by_tier.get(tier):
                break
            idx += 1
        self.state["current_tier_idx"] = min(idx, len(TIER_ORDER) - 1)

    def _active_tier(self) -> str:
        self._normalize_active_tier()
        idx = int(self.state.get("current_tier_idx", 0))
        return TIER_ORDER[min(max(idx, 0), len(TIER_ORDER) - 1)]

    def _downstream_targets(self, agent: Agent) -> List[str]:
        tier = self._tier_map.get(agent.name) or _extract_tier(agent)
        idx = TIER_ORDER.index(tier) if tier in TIER_ORDER else 0
        if idx + 1 >= len(TIER_ORDER):
            return []
        next_tier = TIER_ORDER[idx + 1]
        return self._agents_by_tier.get(next_tier, [])

    def _is_policy_announcement(self, text: str) -> bool:
        return any(marker in text for marker in POLICY_MARKERS)

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
        if tier == "top":
            return [
                "传达学习", "会议精神", "统筹推进", "统一部署", "压实责任", "狠抓落实",
                "督促检查", "跟踪问效", "问责机制", "组织领导", "决策部署", "牵头负责",
            ]
        if tier == "mid":
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
        if tier == "top":
            return ["统筹", "资源", "考核", "问责", "部署", "督办", "压实责任", "跟踪问效"] + self._gov_meeting_terms(tier)
        if tier == "mid":
            return ["拆解", "协调", "时间表", "周报", "台账", "分解任务", "协同推进", "定期调度"] + self._gov_meeting_terms(tier)
        return ["排查", "上报", "反馈", "核验", "整改", "闭环", "复查", "销号"] + self._gov_meeting_terms(tier)

    def _cross_tier_words(self, tier: str) -> List[str]:
        if tier == "top":
            return ["基层执行", "基层落实", "中层协调", "中层执行", "现场核验", "逐项排查", "复查复核", "销号管理"]
        if tier == "mid":
            return ["高层统筹", "高层问责", "基层执行", "基层落实", "组织领导", "决策部署", "现场核验", "逐项排查"]
        return ["高层统筹", "高层部署", "中层协调", "中层执行", "组织领导", "决策部署", "周报机制", "专班推进"]

    def _policy_focus(self) -> List[str]:
        policy = str(self.state.get("latest_policy", "") or "")
        lines = [line.strip(" *") for line in policy.splitlines() if line.strip()]
        picks = []
        for line in lines:
            if "目标" in line or "报告要求" in line or "执行要求" in line or "责任分工" in line:
                picks.append(line)
        return picks[:3]

    def _sanitize_message(self, message: str) -> str:
        sanitized = strip_thinking_tokens(str(message or "")).strip()
        sanitized = re.sub(r'(^|\n)\s*/(?:think|reasoning|analysis)\b.*?(?=\n|\Z)', '\\1', sanitized, flags=re.IGNORECASE | re.DOTALL)
        sanitized = re.sub(r'<[^>]+>', '', sanitized)
        sanitized = re.sub(r'\n{3,}', '\n\n', sanitized)
        return sanitized.strip()

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

    def _build_analysis_message(self, tier: str) -> str:
        notice = str(self.state.get("latest_notice", "") or "").strip()
        if tier == "top":
            return (
                f"作为高层，我对“{notice}”的合理性判断如下。优点：该要求有利于统一传达学习会议精神，"
                "把政策目标、责任链条和督促检查机制一并明确，便于统筹推进和跟踪问效。"
                "缺点：如果只强调短期推进和问责，可能造成基层填表报数压力上升，资源保障与制度配套不足时容易出现形式化落实。"
                "风险：牵头部门不清、资源投放不足、考核口径不统一，会削弱执行效果。"
                "建议：由高层统一部署、压实责任、明确牵头负责单位和月度督办节奏，同时同步保障预算、人手和技术支持。"
            )
        if tier == "mid":
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
        if self.state.get("notice_kind") == "analysis":
            if tier == "top":
                return [
                    f"从高层角度看，“{notice}”要真正落地，还需要把传达学习、统一部署、督促检查和跟踪问效放在同一责任链条中。",
                    "如果只强调结果、不同步资源和制度供给，基层可能出现被动应付，因此必须把预算、人员和技术支持一并明确。",
                    "在组织层面，应当通过压实责任和牵头负责机制，避免口号化传达，确保决策部署可以持续执行。",
                ]
            if tier == "mid":
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
        if tier == "top":
            return [
                f"围绕“{notice}”，我会把阶段目标、预算安排、问责节点同步纳入班子议程，确保每项要求都有牵头负责人。",
                "我还会要求各单位按统一模板报送风险点、资源缺口与整改时限，并将结果纳入月度考核与干部履职评价。",
                "对推进缓慢或数据失真的情况，我会直接启动约谈和督办，确保政策要求落到组织责任链条上。",
            ]
        if tier == "mid":
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
        if tier == "top":
            message = (
                f"作为高层，我对“{notice}”的执行方案如下：第一，我将把政策目标纳入本阶段总任务，"
                "以月度例会统一督办，并明确问责口径；第二，我将优先审批数据合规专项预算和人力补充，"
                "确保重点单位具备整改资源；第三，我会建立按月考核机制，要求各单位围绕关键指标提交结果说明。"
            )
        elif tier == "mid":
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
        if tier == "top":
            return "态度：完全支持并按原文执行。\n补充：由我批准专项预算并建立月度问责机制。"
        if tier == "mid":
            return "态度：完全支持并按原文执行。\n补充：我将在48小时内拆解任务到各部门并建立周报台账。"
        return "态度：完全支持并按原文执行。\n补充：我将按排查清单逐项核验，并在发现异常后24小时内上报。"

    # ----- Description -----

    def get_behavior_guidelines(self):
        if self.state.get("task_mode") == "notice":
            if self.state.get("notice_kind") == "analysis":
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
        return (
            "When your tier is active: "
            "(1) 逐字粘贴最新政策/公告全文（不要省略或改写），"
            "(2) 写明态度/疑虑/执行计划/资源需求，"
            "(3) 只把消息传递给下一级（top→mid，mid→low），未轮到你时保持沉默。"
            "态度/计划必须结合你的职位和角色，至少提供1条与你职责相关的独特执行细节（不要与上一层或他人措辞相同）。不要代替其他层级发言。"
            "如收到新的系统公告/解读请求，优先围绕公告内容给出解读/行动，不要重复旧内容。"
            "输出必须包含 send_message 或 yield，禁止空响应或 None。"
        )

    def get_agent_status_prompt(self, agent: Agent) -> str:
        notice = str(self.state.get("latest_notice", "") or "").strip()
        policy = str(self.state.get("latest_policy", "") or "").strip()
        parts = []
        mode = str(self.state.get("task_mode", "notice") or "notice")
        tier = self._tier_map.get(agent.name) or _extract_tier(agent)
        if mode == "notice":
            if self.state.get("notice_kind") == "analysis":
                parts.append("当前任务：直接回应最新系统公告，重点写合理性、优点、缺点、风险和建议，不要写成执行命令。")
            else:
                parts.append("当前任务：直接回应最新系统公告，不要转述他人的指令。")
            if tier == "top":
                parts.append("你只讨论高层判断：总体方向、组织领导、资源调配、督促检查。不要替中层和基层写任务清单。")
            elif tier == "mid":
                parts.append("你只讨论中层判断：任务分解、跨部门协调、台账机制、时间表。不要替高层做战略表态，也不要替基层写现场细节。")
            else:
                parts.append("你只讨论基层判断：排查步骤、现场核验、问题整改、上报反馈。不要继续向别人发指令，也不要概括全局部署。")
        else:
            parts.append("当前任务：按层级传递最新政策，并补充与你职责相关的执行细节。")
            if tier == "top":
                parts.append("高层补充应聚焦统筹、问责、资源批准，不要替中层和基层写执行动作。")
            elif tier == "mid":
                parts.append("中层补充应聚焦拆解任务、协调单位、跟踪节点，不要复制高层统筹口径。")
            else:
                parts.append("基层补充应聚焦具体执行动作、问题上报、反馈闭环，不要重复上级整段原话。")
        parts.append("禁止复述你上一条 assistant 回复；请给出新的、与你当前层级匹配的内容。")
        if notice:
            parts.append(f"最新系统公告：{notice}")
            min_chars = self._extract_min_chars(notice)
            if min_chars:
                parts.append(f"本次回复长度要求：不少于{min_chars}字。")
        if policy and policy != notice:
            parts.append(f"最新政策：{policy}")
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
        tier = self._tier_map.get(agent.name) or _extract_tier(agent)

        if self.state.get("task_mode") == "notice" and action_name == "send_message" and not self.should_skip_turn(agent, simulator):
            message = self._sanitize_message(payload.get("message", ""))
            payload["message"] = self._normalize_notice_message(tier, message)

        if self.state.get("task_mode") == "cascade" and action_name == "send_message" and not self.should_skip_turn(agent, simulator):
            policy = str(self.state.get("latest_policy", "") or "").strip()
            message = self._sanitize_message(payload.get("message", ""))
            if not policy:
                raise ValueError("latest policy missing for cascade")

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

        if action_name == "send_message":
            self._write_final_debug(agent, str(self.state.get("task_mode", "")), original_payload, payload)

        success, result, summary, meta, _ = super().parse_and_handle_action(payload, agent, simulator)
        return success, result, summary, meta, True

    # ----- Delivery -----

    def deliver_message(self, event, sender: Agent, simulator):
        event.code = "scene_chat"
        event.params = {"sender": sender.name, "message": event.message}

        formatted = event.to_string(self.state.get("time"))
        sender.add_env_feedback(formatted)

        tier = self._tier_map.get(sender.name) or _extract_tier(sender)
        recipients: List[str] = []

        if self.state.get("task_mode") == "notice":
            recipients = [a.name for a in simulator.agents.values() if a.name != sender.name]
        elif tier in {"top", "mid"}:
            recipients = self._downstream_targets(sender)
            if not recipients:
                raise ValueError("downstream targets missing for cascade")
        elif tier == "low":
            recipients = [n for n in self._agents_by_tier.get(tier, []) if n != sender.name]
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
        tier = self._tier_map.get(agent.name) or _extract_tier(agent)
        return tier != self._active_tier()

    def post_turn(self, agent: Agent, simulator) -> None:
        super().post_turn(agent, simulator)

        tier = self._tier_map.get(agent.name) or _extract_tier(agent)
        active = self._active_tier()
        if tier != active:
            return

        seen = self.state.get("tier_seen", {})
        if tier not in seen:
            seen[tier] = []
        if agent.name not in seen[tier]:
            seen[tier].append(agent.name)

        tier_agents = self._agents_by_tier.get(tier, [])
        if tier_agents and all(name in seen[tier] for name in tier_agents):
            next_idx = TIER_ORDER.index(tier) + 1
            if next_idx < len(TIER_ORDER):
                self.state["current_tier_idx"] = next_idx
            else:
                self.state["current_tier_idx"] = len(TIER_ORDER)
                self.state["complete"] = True
            self.state["tier_seen"] = {t: [] for t in TIER_ORDER}
            self._normalize_active_tier()

    def is_complete(self):
        return bool(self.state.get("complete"))

    # ----- Config -----

    def serialize_config(self) -> dict:
        return {}

    @classmethod
    def deserialize_config(cls, config: dict) -> dict:
        return {}