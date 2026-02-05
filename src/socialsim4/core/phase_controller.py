"""
Phase management and system facilitation for council scenes.

Based on Agent Kernel's controller pattern: the system manages conversation flow
through explicit phases without requiring a dedicated "host" agent.
"""

from enum import Enum
from typing import Tuple, Optional, Dict, Any, List


class CouncilPhase(Enum):
    """Council meeting phases."""
    DISCUSSION = "discussion"
    VOTING = "voting"
    CONCLUDED = "concluded"


class SystemFacilitator:
    """
    Non-agent facilitator that manages council flow.

    Based on Agent Kernel's controller pattern (Section 3.2): the Kernel
    does not participate in the conversation directly but manages its flow.
    """

    def __init__(self, scene, simulator=None):
        self.scene = scene
        self.simulator = simulator
        self.phase = CouncilPhase.DISCUSSION
        self.turn_count = 0
        self.last_facilitation_turn = 0
        self.conversation_history: List[Dict[str, Any]] = []

        # Configuration
        self.min_turns_before_vote = 3  # Minimum discussion turns before voting
        self.stalemate_threshold = 6    # Turns without new content to detect stalemate

    def set_simulator(self, simulator):
        """Set simulator reference after initialization."""
        self.simulator = simulator

    def record_turn(self, agent_name: str, action_name: str, content: str = ""):
        """
        Record a turn for facilitation analysis.

        Args:
            agent_name: Name of the agent who acted
            action_name: Type of action taken
            content: Content of the action (message, etc.)
        """
        self.turn_count += 1
        self.conversation_history.append({
            "turn": self.turn_count,
            "agent": agent_name,
            "action": action_name,
            "content": content[:500],  # Truncate for memory
        })

    def should_suggest_voting(self) -> Tuple[bool, str]:
        """
        Analyze if the council should move to voting phase.

        Returns:
            (should_suggest, reason): Tuple of decision and explanation
        """
        if self.phase != CouncilPhase.DISCUSSION:
            return False, f"Already in {self.phase.value} phase"

        if self.turn_count < self.min_turns_before_vote:
            return False, f"Need at least {self.min_turns_before_vote} discussion turns"

        # Check if voting is already in progress via scene state
        if self.scene.state.get("voting_started", False):
            return False, "Voting already started"

        # Use LLM to evaluate if discussion has reached natural conclusion
        return self._llm_evaluate_vote_readiness()

    def should_conclude_meeting(self) -> Tuple[bool, str]:
        """
        Analyze if the meeting should conclude.

        Returns:
            (should_conclude, reason): Tuple of decision and explanation
        """
        if self.phase == CouncilPhase.CONCLUDED:
            return True, "Meeting already concluded"

        # Check if voting completed and results announced
        past_votes = self.scene.state.get("past_votes", [])
        if past_votes and not self.scene.state.get("voting_started", False):
            # Has completed votes, could be ready to conclude
            if self.turn_count > 10:
                return True, "Voting completed and discussion exhausted"

        # Check for stalemate (no meaningful progress)
        if self._detect_stalemate():
            return True, "Discussion has reached stalemate with no new progress"

        return False, "Meeting should continue"

    def transition_to_voting(self, title: str = "the current proposal"):
        """
        Transition the council to voting phase.

        Args:
            title: Title of the vote (for context)
        """
        if self.phase != CouncilPhase.DISCUSSION:
            return

        self.phase = CouncilPhase.VOTING
        self.scene.state["voting_started"] = True
        self.scene.state["vote_title"] = title
        self.scene.state["votes"] = {}
        self.scene.state["voting_completed_announced"] = False
        self.last_facilitation_turn = self.turn_count

        # Announce transition
        if self.simulator:
            from socialsim4.core.event import PublicEvent
            self.simulator.broadcast(
                PublicEvent(
                    f"[System] The council moves to voting on: {title}. "
                    f"Please cast your votes now."
                )
            )

    def conclude_meeting(self):
        """Conclude the council meeting."""
        self.phase = CouncilPhase.CONCLUDED
        self.scene.complete = True
        self.last_facilitation_turn = self.turn_count

        if self.simulator:
            from socialsim4.core.event import PublicEvent
            self.simulator.broadcast(
                PublicEvent("[System] The council session is adjourned.")
            )

    def get_phase(self) -> CouncilPhase:
        """Get current phase."""
        return self.phase

    def is_action_allowed(self, action_name: str) -> Tuple[bool, Optional[str]]:
        """
        Check if an action is allowed in the current phase.

        Args:
            action_name: Name of the action being attempted

        Returns:
            (allowed, error_message): Tuple of permission status and error if not allowed
        """
        # Actions that can be used in any phase
        phaseless_actions = {"send_message", "yield", "voting_status", "request_brief"}

        if action_name in phaseless_actions:
            return True, None

        # Phase-specific validation
        if action_name == "start_voting":
            if self.phase != CouncilPhase.DISCUSSION:
                return False, f"Cannot start voting: currently in {self.phase.value} phase"
            if self.scene.state.get("voting_started", False):
                return False, "Cannot start voting: a vote is already in progress"
            return True, None

        if action_name == "vote":
            if not self.scene.state.get("voting_started", False):
                return False, "Cannot vote: voting has not started yet"
            return True, None

        if action_name == "finish_meeting":
            if self.scene.state.get("voting_started", False):
                return False, "Cannot finish meeting: voting is still in progress"
            return True, None

        # Unknown actions are allowed by default
        return True, None

    def _llm_evaluate_vote_readiness(self) -> Tuple[bool, str]:
        """
        Use LLM to evaluate if the council is ready for voting.

        Returns:
            (should_vote, reason): Tuple of decision and explanation
        """
        # Build conversation summary
        recent_history = self.conversation_history[-10:] if self.conversation_history else []

        if not recent_history:
            return False, "Insufficient discussion"

        conversation_summary = "\n".join([
            f"- {h['agent']}: {h['action']}" + (f" - {h['content'][:100]}..." if h['content'] else "")
            for h in recent_history
        ])

        # Get the scene's topic for context
        vote_title = self.scene.state.get("vote_title", "the proposal")

        # Build evaluation prompt
        system_prompt = (
            "You are a council facilitator evaluating whether discussion is ready for a vote. "
            "Consider: Have key viewpoints been expressed? Is there diminishing return in further discussion? "
            "Respond with 'YES: reason' or 'NO: reason'."
        )

        user_prompt = f"""Council Discussion Summary:

Topic: {vote_title}

Turns so far: {self.turn_count}

Recent activity:
{conversation_summary}

Should voting be initiated now? Consider:
1. Have multiple viewpoints been expressed?
2. Has there been some back-and-forth?
3. Is further discussion unlikely to change minds?

Respond with 'YES: [brief reason]' or 'NO: [brief reason]'."""

        # Call LLM
        try:
            if self.simulator and self.simulator.clients:
                # Get the first agent's LLM client for the facilitation call
                # (The facilitator doesn't have its own agent, so we borrow)
                for agent in self.simulator.agents.values():
                    response = agent.call_llm(
                        self.simulator.clients,
                        [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    )
                    if response:
                        response = response.strip().upper()
                        if response.startswith("YES:"):
                            return True, response[4:].strip()
                        elif response.startswith("YES"):
                            return True, "Discussion appears ready for voting"
                        elif response.startswith("NO:"):
                            return False, response[4:].strip()
                        else:
                            return False, "Discussion should continue"
                    break
        except Exception as e:
            # Fallback to rule-based if LLM fails
            if self.turn_count >= self.min_turns_before_vote * 2:
                return True, "Discussion has been extensive"

        # Fallback: require more turns
        return False, f"More discussion needed (at least {self.min_turns_before_vote} turns)"

    def _detect_stalemate(self) -> bool:
        """
        Detect if the discussion has reached a stalemate.

        Returns:
            True if stalemate detected, False otherwise
        """
        if self.turn_count < self.stalemate_threshold:
            return False

        # Simple heuristic: if all recent turns are just voting or yield
        # without substantive messages, consider it stale
        recent = self.conversation_history[-self.stalemate_threshold:]
        substantive_actions = {"send_message", "start_voting", "request_brief"}
        substantive_count = sum(1 for h in recent if h["action"] in substantive_actions)

        return substantive_count < 2  # Less than 2 substantive actions in threshold turns

    def get_facilitation_message(self) -> Optional[str]:
        """
        Get a facilitation message if appropriate.

        Returns:
            Facilitation message or None
        """
        should_suggest, reason = self.should_suggest_voting()
        if should_suggest:
            self.last_facilitation_turn = self.turn_count
            return f"[Facilitator] {reason}. Any agent may initiate voting with start_voting."

        should_conclude, reason = self.should_conclude_meeting()
        if should_conclude:
            self.last_facilitation_turn = self.turn_count
            return f"[Facilitator] {reason}. Use finish_meeting to adjourn."

        return None

    def get_status_prompt(self) -> str:
        """
        Get a status prompt for display to agents.

        Returns:
            Status description string
        """
        phase_desc = {
            CouncilPhase.DISCUSSION: "Discussion Phase - Debate the proposal",
            CouncilPhase.VOTING: "Voting Phase - Cast your votes",
            CouncilPhase.CONCLUDED: "Meeting Adjourned",
        }

        status = f"Phase: {phase_desc.get(self.phase, self.phase.value)}"

        if self.phase == CouncilPhase.VOTING:
            title = self.scene.state.get("vote_title", "the proposal")
            votes = self.scene.state.get("votes", {})
            status += f"\nVoting on: {title}\nVotes cast: {len(votes)}"

        return status
