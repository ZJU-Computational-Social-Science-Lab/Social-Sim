from typing import Dict, List

from socialsim4.core.action import Action
from socialsim4.core.event import PublicEvent


class CallLandlordAction(Action):
    NAME = "call_landlord"
    DESC = "During bidding (call stage), call the landlord."
    INSTRUCTION = """
- To call the landlord (bidding):
<Action name=\"call_landlord\" />
"""

    def handle(self, action_data, agent, simulator, scene):
        if (
            scene.state.get("phase") != "bidding"
            or scene.state.get("bidding_stage") != "call"
        ):
            agent.add_env_feedback("You can only call during the call stage.")
            return False, {"error": "wrong_stage"}, f"{agent.name} call_landlord failed"
        idx = scene.state.get("bid_turn_index")
        scene.state["landlord_candidate"] = agent.name
        scene.state["bidding_stage"] = "rob"

        # Initialize ROB stage trackers
        players: List[str] = list(scene.state.get("players"))
        rob_eligible = [p for p in players if p != agent.name]
        scene.state["rob_eligible"] = rob_eligible
        scene.state["rob_acted"] = {p: False for p in rob_eligible}
        scene.state["bid_turn_index"] = (idx + 1) % len(players)

        simulator.broadcast(PublicEvent(f"{agent.name} called the landlord."))
        return True, {"called": agent.name}, f"{agent.name} called landlord", {}, True


class RobLandlordAction(Action):
    NAME = "rob_landlord"
    DESC = "During bidding (rob stage), rob the landlord. Doubles score multiplier."
    INSTRUCTION = """
- To rob the landlord (after someone has called):
<Action name=\"rob_landlord\" />
"""

    def handle(self, action_data, agent, simulator, scene):
        if (
            scene.state.get("phase") != "bidding"
            or scene.state.get("bidding_stage") != "rob"
        ):
            agent.add_env_feedback("You can only rob during the rob stage.")
            return False, {"error": "wrong_stage"}, f"{agent.name} rob_landlord failed"

        rob_acted: Dict[str, bool] = dict(scene.state.get("rob_acted"))
        if rob_acted[agent.name]:
            agent.add_env_feedback("You already acted in rob stage.")
            return (
                False,
                {"error": "already_acted"},
                f"{agent.name} rob_landlord failed",
            )

        # Apply rob: candidate changes, multiplier doubles
        scene.state["landlord_candidate"] = agent.name
        scene.state["score_multiplier"] = (
            int(scene.state.get("score_multiplier", 1)) * 2
        )
        rob_acted[agent.name] = True
        scene.state["rob_acted"] = rob_acted

        simulator.broadcast(
            PublicEvent(f"{agent.name} robbed the landlord. Multiplier x2.")
        )

        # If all eligible have acted (rob or pass), finalize landlord
        if all(rob_acted.values()):
            scene._finalize_landlord(simulator)
        return True, {"robbed": agent.name}, f"{agent.name} robbed landlord", {}, True


class PassAction(Action):
    NAME = "pass"
    DESC = "Pass in the current context (bidding: no-call/no-rob; playing: skip)."
    INSTRUCTION = """
- To pass (bidding: decline; playing: skip):
<Action name=\"pass\" />
"""

    def handle(self, action_data, agent, simulator, scene):
        phase = scene.state.get("phase")
        if phase == "bidding":
            stage = scene.state.get("bidding_stage")
            if stage == "call":
                scene._advance_call_pass(simulator)
                simulator.broadcast(PublicEvent(f"{agent.name} did not call."))
                return True, {"pass": True}, f"{agent.name} passed call", {}, True
            elif stage == "rob":
                rob_acted: Dict[str, bool] = dict(scene.state.get("rob_acted"))
                if rob_acted[agent.name]:
                    agent.add_env_feedback("You already acted in rob stage.")
                    return (
                        False,
                        {"error": "already_acted"},
                        f"{agent.name} pass failed",
                    )
                rob_acted[agent.name] = True
                scene.state["rob_acted"] = rob_acted
                simulator.broadcast(PublicEvent(f"{agent.name} did not rob."))
                if all(rob_acted.values()):
                    scene._finalize_landlord(simulator)
                return True, {"pass": True}, f"{agent.name} passed rob", {}, True
            else:
                agent.add_env_feedback("Unknown bidding stage.")
                return False, {"error": "bad_stage"}, f"{agent.name} pass failed", {}, False

        if phase == "playing":
            # Only current player may pass; cannot pass if starting a new trick
            lead = scene.state.get("leading_combo")
            if lead is None:
                agent.add_env_feedback("You must lead; cannot pass.")
                return False, {"error": "cannot_pass_lead"}, f"{agent.name} pass failed"

            simulator.broadcast(PublicEvent(f"{agent.name} passed."))
            scene._on_player_pass(simulator)
            return True, {"pass": True}, f"{agent.name} passed", {}, True

        agent.add_env_feedback("You cannot pass right now.")
        return False, {"error": "bad_phase"}, f"{agent.name} pass failed", {}, False


class PlayCardsAction(Action):
    NAME = "play_cards"
    DESC = "Play cards (strict tokens). Must beat current leading combo unless leading."
    INSTRUCTION = """
- To play cards (tokens separated by single spaces):
<Action name=\"play_cards\"><cards>3 3 3</cards></Action>
Available tokens: 3 4 5 6 7 8 9 10 J Q K A 2 SJ BJ
"""

    def handle(self, action_data, agent, simulator, scene):
        # Helpers
        def _hand_tokens(name: str) -> List[str]:
            h = scene.state.get("hands", {}).get(name, {})
            order = ["3","4","5","6","7","8","9","10","J","Q","K","A","2","SJ","BJ"]
            toks: List[str] = []
            for r in order:
                c = h.get(r, 0)
                if c:
                    toks.extend([r] * c)
            return toks

        cards_str = action_data.get("cards")
        attempted = [t for t in (cards_str or "").strip().split() if t]

        if scene.state.get("phase") != "playing":
            agent.add_env_feedback("You can only play during the playing phase.")
            remaining_str = " ".join(_hand_tokens(agent.name))
            attempt_str = " ".join(attempted) if attempted else "(none)"
            summary = f"{agent.name} tried: {attempt_str} -> wrong_phase | remaining: {remaining_str}"
            return False, {"error": "wrong_phase"}, summary, {}, False
        if not cards_str or not cards_str.strip():
            agent.add_env_feedback("Provide cards to play.")
            remaining_str = " ".join(_hand_tokens(agent.name))
            summary = f"{agent.name} tried: (none) -> missing_cards | remaining: {remaining_str}"
            return False, {"error": "missing_cards"}, summary, {}, False

        tokens = scene._parse_cards_str(cards_str)
        attempted = list(tokens)
        if not scene._has_cards(agent.name, tokens):
            agent.add_env_feedback("You don't have those cards.")
            remaining_str = " ".join(_hand_tokens(agent.name))
            attempt_str = " ".join(attempted)
            summary = f"{agent.name} tried: {attempt_str} -> not_in_hand | remaining: {remaining_str}"
            return False, {"error": "not_in_hand"}, summary, {}, False

        combo = scene._evaluate_combo(tokens)
        if combo is None:
            agent.add_env_feedback("Invalid combination.")
            remaining_str = " ".join(_hand_tokens(agent.name))
            attempt_str = " ".join(attempted)
            summary = f"{agent.name} tried: {attempt_str} -> invalid_combo | remaining: {remaining_str}"
            return False, {"error": "invalid_combo"}, summary, {}, False

        lead = scene.state.get("leading_combo")
        if lead is not None and not scene._can_beat(combo, lead):
            agent.add_env_feedback("Your play does not beat the current lead.")
            remaining_str = " ".join(_hand_tokens(agent.name))
            attempt_str = " ".join(attempted)
            summary = f"{agent.name} tried: {attempt_str} -> not_beating | remaining: {remaining_str}"
            return False, {"error": "not_beating"}, summary, {}, False

        # Accept play
        scene._remove_cards(agent.name, tokens)
        scene.state["leading_combo"] = {**combo, "owner": agent.name}
        scene.state["passes_since_play"] = 0

        # Bomb/Rocket multiplier
        if combo["type"] in ("bomb", "rocket"):
            scene.state["score_multiplier"] = (
                int(scene.state.get("score_multiplier", 1)) * 2
            )

        simulator.broadcast(PublicEvent(f"{agent.name} played: {cards_str} ({combo['type']})."))

        # Win check
        if scene._hand_size(agent.name) == 0:
            scene._on_player_won(agent.name, simulator)
            remaining_str = " ".join(_hand_tokens(agent.name)) or "(empty)"
            attempt_str = " ".join(attempted)
            summary = f"{agent.name} played: {attempt_str} ({combo['type']}), remaining: {remaining_str} [WIN]"
            return True, {"played": tokens, "win": True}, summary, {}, True

        # Advance turn on successful play
        scene._advance_turn()
        remaining_str = " ".join(_hand_tokens(agent.name))
        attempt_str = " ".join(attempted)
        summary = f"{agent.name} played: {attempt_str} ({combo['type']}), remaining: {remaining_str}"
        return True, {"played": tokens}, summary, {}, True


class DoubleAction(Action):
    NAME = "double"
    DESC = "During doubling stage, choose to double and multiply the global multiplier by 2."
    INSTRUCTION = """
- To double during the doubling stage:
<Action name=\"double\" />
"""

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "doubling":
            agent.add_env_feedback("You can only double during the doubling stage.")
            return False, {"error": "wrong_phase"}, f"{agent.name} double failed", {}, False
        acted = dict(scene.state.get("doubling_acted"))
        if acted.get(agent.name, False):
            agent.add_env_feedback("You already acted in doubling stage.")
            return False, {"error": "already_acted"}, f"{agent.name} double failed", {}, False

        scene.state["score_multiplier"] = (
            int(scene.state.get("score_multiplier", 1)) * 2
        )
        acted[agent.name] = True
        scene.state["doubling_acted"] = acted
        simulator.broadcast(PublicEvent(f"{agent.name} doubled. Multiplier x2."))
        scene._advance_doubling(simulator)
        return True, {"double": True}, f"{agent.name} doubled", {}, True


class NoDoubleAction(Action):
    NAME = "no_double"
    DESC = "During doubling stage, explicitly decline doubling."
    INSTRUCTION = """
- To decline doubling during the doubling stage:
<Action name=\"no_double\" />
"""

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "doubling":
            agent.add_env_feedback("You can only act during the doubling stage.")
            return False, {"error": "wrong_phase"}, f"{agent.name} no_double failed", {}, False
        acted = dict(scene.state.get("doubling_acted"))
        if acted.get(agent.name, False):
            agent.add_env_feedback("You already acted in doubling stage.")
            return False, {"error": "already_acted"}, f"{agent.name} no_double failed", {}, False

        acted[agent.name] = True
        scene.state["doubling_acted"] = acted
        simulator.broadcast(PublicEvent(f"{agent.name} declined to double."))
        scene._advance_doubling(simulator)
        return True, {"double": False}, f"{agent.name} declined doubling", {}, True
