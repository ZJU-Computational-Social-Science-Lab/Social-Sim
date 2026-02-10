"""
Mock LLM provider for offline testing and development.

Contains:
    - _MockModel: Deterministic local stub for testing
    - action_to_xml: Convert action dict to XML format

The mock provider produces valid Thoughts/Plan/Action responses without
requiring actual LLM API calls. It uses simple heuristics to determine
appropriate actions based on scene detection from the system prompt.

Supported scenes:
- Council/Voting: Host greeting and member responses
- Map/Village: Look around and send messages
- Werewolf: Role-specific actions (werewolf, seer, witch, villager)
- Landlord (Dou Di Zhu): Bidding, doubling, and playing cards
- Chat: Simple message sending with continuation detection
"""

import re


class _MockModel:
    """
    Deterministic local stub for offline testing.

    Produces valid Thoughts/Plan/Action and optional Plan Update, with
    simple heuristics based on scene detection from the system prompt.

    The mock tracks agent calls to provide deterministic yet varied
    responses across multiple invocations.
    """

    def __init__(self):
        self.agent_calls = {}

    def chat(self, messages):
        """
        Generate mock LLM response based on scene and agent state.

        Args:
            messages: List of message dicts with role/content

        Returns:
            Formatted response with Thoughts, Plan, Action, and Plan Update blocks
        """
        # Extract system content (single string)
        sys_text = next((m["content"] for m in messages if m["role"] == "system"), "")

        # Identify agent name
        m = re.search(r"You are\s+([^\n\.]+)", sys_text)
        agent_name = m.group(1).strip() if m else "Agent"
        self.agent_calls[agent_name] = self.agent_calls.get(agent_name, 0) + 1
        call_n = self.agent_calls[agent_name]

        sys_lower = sys_text.lower()

        # Pick scene by keywords in system prompt
        if "grid-based virtual village" in sys_lower:
            scene = "map"
        elif "vote" in sys_lower or "voting" in sys_lower:
            scene = "council"
        elif "you are living in a virtual village" in sys_lower:
            scene = "village"
        else:
            # Detect scenes by keyword
            if "werewolf" in sys_lower:
                scene = "werewolf"
            elif (
                "dou dizhu" in sys_lower
                or "landlord" in sys_lower
                or "landlord_scene" in sys_lower
            ):
                scene = "landlord"
            else:
                scene = "chat"

        if scene == "council":
            thought, plan, action, plan_update = self._council_response(agent_name, call_n)
        elif scene == "map":
            thought, plan, action, plan_update = self._map_response(call_n)
        elif scene == "village":
            thought, plan, action, plan_update = self._village_response(call_n)
        elif scene == "werewolf":
            thought, plan, action, plan_update = self._werewolf_response(sys_lower, call_n)
        elif scene == "landlord":
            return self._landlord_response(agent_name, call_n, messages, sys_lower)
        else:  # simple chat
            thought, plan, action, plan_update = self._chat_response(agent_name, call_n, messages)

        # Compose full response with XML Action
        return (
            f"--- Thoughts ---\n{thought}\n\n"
            f"--- Plan ---\n{plan}\n\n"
            f"--- Action ---\n{action_to_xml(action)}\n\n"
            f"--- Plan Update ---\n{plan_update}\n"
        )

    def _council_response(self, agent_name: str, call_n: int) -> tuple:
        """Generate response for council/voting scene."""
        if agent_name.lower() == "host":
            if call_n == 1:
                action = {"action": "send_message", "message": "Good morning, council."}
                thought = "Open the session briefly."
                plan = "1. Greet. [CURRENT]"
            else:
                action = {"action": "yield"}
                thought = "Yield the floor for members to respond."
                plan = "1. Yield. [CURRENT]"
        else:
            if call_n == 1:
                action = {"action": "send_message", "message": "I support moving forward."}
                thought = "Make a brief opening remark."
                plan = "1. Remark. [CURRENT]"
            else:
                action = {"action": "yield"}
                thought = "No further comment now."
                plan = "1. Yield. [CURRENT]"
        plan_update = "no change"
        return thought, plan, action, plan_update

    def _map_response(self, call_n: int) -> tuple:
        """Generate response for map scene."""
        if call_n == 1:
            action = {"action": "look_around"}
            thought = "Scout surroundings before moving."
            plan = "1. Look around. [CURRENT]"
        else:
            action = {"action": "yield"}
            thought = "Pause to let others act."
            plan = "1. Yield. [CURRENT]"
        plan_update = "no change"
        return thought, plan, action, plan_update

    def _village_response(self, call_n: int) -> tuple:
        """Generate response for village scene."""
        if call_n == 1:
            action = {"action": "send_message", "message": "Good morning everyone!"}
            thought = "Greet others in the village."
            plan = "1. Greet. [CURRENT]"
        else:
            action = {"action": "yield"}
            thought = "No need to say more now."
            plan = "1. Yield. [CURRENT]"
        plan_update = "no change"
        return thought, plan, action, plan_update

    def _werewolf_response(self, sys_lower: str, call_n: int) -> tuple:
        """Generate response for werewolf scene based on role."""
        # Heuristic role detection from system profile
        role = "villager"
        if "you are the seer" in sys_lower or "you are seer" in sys_lower:
            role = "seer"
        elif "you are the witch" in sys_lower or "you are witch" in sys_lower:
            role = "witch"
        elif "you are a werewolf" in sys_lower or "you are werewolf" in sys_lower:
            role = "werewolf"

        # Use fixed names from demo to make actions meaningful
        default_targets = ["Pia", "Taro", "Elena", "Bram", "Ronan", "Mira"]

        def pick_other(exclude):
            for n in default_targets:
                if n != exclude:
                    return n
            return "Pia"

        if call_n == 1:
            if role == "werewolf":
                action = {"action": "night_kill", "target": "Pia"}
                thought = "Coordinate a night kill discreetly."
                plan = "1. Night kill. [CURRENT]"
            elif role == "seer":
                action = {"action": "inspect", "target": "Ronan"}
                thought = "Inspect a likely suspect."
                plan = "1. Inspect. [CURRENT]"
            elif role == "witch":
                action = {"action": "witch_save"}
                thought = "Prepare to save tonight's victim."
                plan = "1. Save. [CURRENT]"
            else:  # villager
                action = {"action": "yield"}
                thought = "Nothing to do at night."
                plan = "1. Wait. [CURRENT]"
        else:
            # Daytime: cast a vote
            target = "Ronan" if role != "werewolf" else "Elena"
            action = {"action": "vote_lynch", "target": target}
            thought = "Participate in the day vote."
            plan = "1. Vote. [CURRENT]"

        plan_update = "no change"
        return thought, plan, action, plan_update

    def _chat_response(self, agent_name: str, call_n: int, messages: list) -> tuple:
        """Generate response for simple chat scene."""
        # One sentence per turn: if this is an intra-turn continuation, yield
        last_user = None
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user = (m.get("content") or "").strip()
                break
        is_continuation = (last_user == "Continue.")
        if is_continuation:
            action = {"action": "yield"}
            thought = "Already spoke this turn; yield."
            plan = "1. Yield. [CURRENT]"
        else:
            # Speak exactly once per turn
            idx = self.agent_calls.get(agent_name, 1)
            action = {
                "action": "send_message",
                "message": f"[{idx}] Hello from {agent_name}.",
            }
            thought = "Say one line this turn."
            plan = "1. Speak once. [CURRENT]"
        plan_update = "no change"
        return thought, plan, action, plan_update

    def _landlord_response(self, agent_name: str, call_n: int, messages: list, sys_lower: str) -> str:
        """
        Generate response for landlord (Dou Di Zhu) scene.

        This is a complex scene-specific response handler that parses
        the game state and returns appropriate actions.
        """
        # Parse latest status to infer phase and current actor
        status = None
        for m in reversed(messages):
            if (
                m.get("role") == "user"
                and isinstance(m.get("content"), str)
                and "Status:" in m.get("content")
            ):
                status = m["content"]
                break
        phase = ""
        if status:
            mm = re.search(r"Phase:\s*([a-zA-Z_]+)", status)
            if mm:
                phase = mm.group(1).strip()
        # Default conservative policy
        act = {"action": "yield"}
        if phase == "bidding":
            # First time: try to call, otherwise pass
            if self.agent_calls[agent_name] == 1:
                act = {"action": "call_landlord"}
            else:
                act = {"action": "pass"}
            thought = "Decide whether to call landlord."
            plan = "1. Act in bidding. [CURRENT]"
        elif phase == "doubling":
            act = {"action": "no_double"}
            thought = "Decline doubling."
            plan = "1. Consider doubling. [CURRENT]"
        elif phase == "playing":
            # Try to play the smallest single from the explicit Hand tokens in status
            smallest = None
            if status:
                hm = re.search(r"Hand:\s*([\w\s]+)", status)
                if hm:
                    toks = [
                        t
                        for t in hm.group(1).strip().split()
                        if t and t != "(empty)"
                    ]
                    order = [
                        "3", "4", "5", "6", "7", "8", "9", "10",
                        "J", "Q", "K", "A", "2", "SJ", "BJ",
                    ]
                    for r in order:
                        if r in toks:
                            smallest = r
                            break
            if smallest is None:
                act = {"action": "yield"}
                thought = "No cards to play."
                plan = "1. Yield. [CURRENT]"
            else:
                act = {"action": "play_cards", "cards": smallest}
                thought = "Try a small single."
                plan = "1. Play a small single. [CURRENT]"
        else:
            thought = "Wait."
            plan = "1. Yield. [CURRENT]"

        # Render response
        inner = ""
        if act["action"] == "play_cards":
            inner = f"<cards>{act['cards']}</cards>"
        xml = (
            f'<Action name="{act["action"]}">{inner}</Action>'
            if inner
            else f'<Action name="{act["action"]}" />'
        )
        plan_update = "no change"
        return (
            f"--- Thoughts ---\n{thought}\n\n"
            f"--- Plan ---\n{plan}\n\n"
            f"--- Action ---\n{xml}\n\n"
            f"--- Plan Update ---\n{plan_update}"
        )


def action_to_xml(a: dict) -> str:
    """
    Convert action dict to XML format.

    Args:
        a: Action dict with 'action'/'name' key and optional parameters

    Returns:
        XML-formatted action string
    """
    name = a.get("action") or a.get("name") or "yield"
    params = [k for k in a.keys() if k not in ("action", "name")]
    if not params:
        return f'<Action name="{name}" />'
    parts = "".join([f"<{k}>{a[k]}</{k}>" for k in params])
    return f'<Action name="{name}">{parts}</Action>'
