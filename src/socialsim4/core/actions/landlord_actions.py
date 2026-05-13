from typing import Dict, List

from socialsim4.core.action import Action
from socialsim4.core.event import PublicEvent
from socialsim4.i18n import T


class CallLandlordAction(Action):
    NAME = T("prompts.actions.call_landlord.name", locale=None)
    DESC = T("prompts.actions.call_landlord.desc", locale=None)
    INSTRUCTION = T("prompts.actions.call_landlord.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        if (
            scene.state.get("phase") != "bidding"
            or scene.state.get("bidding_stage") != "call"
        ):
            agent.add_env_feedback(T("prompts.actions.call_landlord.error_wrong_stage", locale=getattr(agent, 'language', None)))
            return False, {"error": "wrong_stage"}, T("prompts.actions.call_landlord.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name)
        idx = scene.state.get("bid_turn_index")
        scene.state["landlord_candidate"] = agent.name
        scene.state["bidding_stage"] = "rob"

        # Initialize ROB stage trackers
        players: List[str] = list(scene.state.get("players"))
        rob_eligible = [p for p in players if p != agent.name]
        scene.state["rob_eligible"] = rob_eligible
        scene.state["rob_acted"] = {p: False for p in rob_eligible}
        scene.state["bid_turn_index"] = (idx + 1) % len(players)

        simulator.broadcast(PublicEvent(T("prompts.actions.call_landlord.event_called", locale=getattr(agent, 'language', None), agent_name=agent.name)))
        return True, {"called": agent.name}, T("prompts.actions.call_landlord.summary_called", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, True


class RobLandlordAction(Action):
    NAME = T("prompts.actions.rob_landlord.name", locale=None)
    DESC = T("prompts.actions.rob_landlord.desc", locale=None)
    INSTRUCTION = T("prompts.actions.rob_landlord.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        if (
            scene.state.get("phase") != "bidding"
            or scene.state.get("bidding_stage") != "rob"
        ):
            agent.add_env_feedback(T("prompts.actions.rob_landlord.error_wrong_stage", locale=getattr(agent, 'language', None)))
            return False, {"error": "wrong_stage"}, T("prompts.actions.rob_landlord.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name)

        rob_acted: Dict[str, bool] = dict(scene.state.get("rob_acted"))
        if rob_acted[agent.name]:
            agent.add_env_feedback(T("prompts.actions.rob_landlord.error_already_acted", locale=getattr(agent, 'language', None)))
            return (
                False,
                {"error": "already_acted"},
                T("prompts.actions.rob_landlord.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name),
            )

        # Apply rob: candidate changes, multiplier doubles
        scene.state["landlord_candidate"] = agent.name
        scene.state["score_multiplier"] = (
            int(scene.state.get("score_multiplier", 1)) * 2
        )
        rob_acted[agent.name] = True
        scene.state["rob_acted"] = rob_acted

        simulator.broadcast(
            PublicEvent(T("prompts.actions.rob_landlord.event_robbed", locale=getattr(agent, 'language', None), agent_name=agent.name))
        )

        # If all eligible have acted (rob or pass), finalize landlord
        if all(rob_acted.values()):
            scene._finalize_landlord(simulator)
        return True, {"robbed": agent.name}, T("prompts.actions.rob_landlord.summary_robbed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, True


class PassAction(Action):
    NAME = T("prompts.actions.pass.name", locale=None)
    DESC = T("prompts.actions.pass.desc", locale=None)
    INSTRUCTION = T("prompts.actions.pass.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        phase = scene.state.get("phase")
        if phase == "bidding":
            stage = scene.state.get("bidding_stage")
            if stage == "call":
                scene._advance_call_pass(simulator)
                simulator.broadcast(PublicEvent(T("prompts.actions.pass.event_not_called", locale=getattr(agent, 'language', None), agent_name=agent.name)))
                return True, {"pass": True}, T("prompts.actions.pass.summary_passed_call", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, True
            elif stage == "rob":
                rob_acted: Dict[str, bool] = dict(scene.state.get("rob_acted"))
                if rob_acted[agent.name]:
                    agent.add_env_feedback(T("prompts.actions.pass.error_already_acted_rob", locale=getattr(agent, 'language', None)))
                    return (
                        False,
                        {"error": "already_acted"},
                        T("prompts.actions.pass.summary_pass_failed", locale=getattr(agent, 'language', None), agent_name=agent.name),
                    )
                rob_acted[agent.name] = True
                scene.state["rob_acted"] = rob_acted
                simulator.broadcast(PublicEvent(T("prompts.actions.pass.event_not_robbed", locale=getattr(agent, 'language', None), agent_name=agent.name)))
                if all(rob_acted.values()):
                    scene._finalize_landlord(simulator)
                return True, {"pass": True}, T("prompts.actions.pass.summary_passed_rob", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, True
            else:
                agent.add_env_feedback(T("prompts.actions.pass.error_bad_stage", locale=getattr(agent, 'language', None)))
                return False, {"error": "bad_stage"}, T("prompts.actions.pass.summary_pass_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False

        if phase == "playing":
            # Only current player may pass; cannot pass if starting a new trick
            lead = scene.state.get("leading_combo")
            if lead is None:
                agent.add_env_feedback(T("prompts.actions.pass.error_cannot_pass_lead", locale=getattr(agent, 'language', None)))
                return False, {"error": "cannot_pass_lead"}, T("prompts.actions.pass.summary_pass_failed", locale=getattr(agent, 'language', None), agent_name=agent.name)

            simulator.broadcast(PublicEvent(T("prompts.actions.pass.event_passed", locale=getattr(agent, 'language', None), agent_name=agent.name)))
            scene._on_player_pass(simulator)
            return True, {"pass": True}, T("prompts.actions.pass.summary_passed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, True

        agent.add_env_feedback(T("prompts.actions.pass.error_bad_phase", locale=getattr(agent, 'language', None)))
        return False, {"error": "bad_phase"}, T("prompts.actions.pass.summary_pass_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False


class PlayCardsAction(Action):
    NAME = T("prompts.actions.play_cards.name", locale=None)
    DESC = T("prompts.actions.play_cards.desc", locale=None)
    INSTRUCTION = T("prompts.actions.play_cards.instruction", locale=None)

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
            agent.add_env_feedback(T("prompts.actions.play_cards.error_wrong_phase", locale=getattr(agent, 'language', None)))
            remaining_str = " ".join(_hand_tokens(agent.name))
            attempt_str = " ".join(attempted) if attempted else "(none)"
            summary = T("prompts.actions.play_cards.summary_wrong_phase", locale=getattr(agent, 'language', None), agent_name=agent.name, attempt=attempt_str, remaining=remaining_str)
            return False, {"error": "wrong_phase"}, summary, {}, False
        if not cards_str or not cards_str.strip():
            agent.add_env_feedback(T("prompts.actions.play_cards.error_missing_cards", locale=getattr(agent, 'language', None)))
            remaining_str = " ".join(_hand_tokens(agent.name))
            summary = T("prompts.actions.play_cards.summary_missing_cards", locale=getattr(agent, 'language', None), agent_name=agent.name, remaining=remaining_str)
            return False, {"error": "missing_cards"}, summary, {}, False

        tokens = scene._parse_cards_str(cards_str)
        attempted = list(tokens)
        if not scene._has_cards(agent.name, tokens):
            agent.add_env_feedback(T("prompts.actions.play_cards.error_not_in_hand", locale=getattr(agent, 'language', None)))
            remaining_str = " ".join(_hand_tokens(agent.name))
            attempt_str = " ".join(attempted)
            summary = T("prompts.actions.play_cards.summary_not_in_hand", locale=getattr(agent, 'language', None), agent_name=agent.name, attempt=attempt_str, remaining=remaining_str)
            return False, {"error": "not_in_hand"}, summary, {}, False

        combo = scene._evaluate_combo(tokens)
        if combo is None:
            agent.add_env_feedback(T("prompts.actions.play_cards.error_invalid_combo", locale=getattr(agent, 'language', None)))
            remaining_str = " ".join(_hand_tokens(agent.name))
            attempt_str = " ".join(attempted)
            summary = T("prompts.actions.play_cards.summary_invalid_combo", locale=getattr(agent, 'language', None), agent_name=agent.name, attempt=attempt_str, remaining=remaining_str)
            return False, {"error": "invalid_combo"}, summary, {}, False

        lead = scene.state.get("leading_combo")
        if lead is not None and not scene._can_beat(combo, lead):
            agent.add_env_feedback(T("prompts.actions.play_cards.error_not_beating", locale=getattr(agent, 'language', None)))
            remaining_str = " ".join(_hand_tokens(agent.name))
            attempt_str = " ".join(attempted)
            summary = T("prompts.actions.play_cards.summary_not_beating", locale=getattr(agent, 'language', None), agent_name=agent.name, attempt=attempt_str, remaining=remaining_str)
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

        simulator.broadcast(PublicEvent(T("prompts.actions.play_cards.event_played", locale=getattr(agent, 'language', None), agent_name=agent.name, cards=cards_str, combo_type=combo['type'])))

        # Win check
        if scene._hand_size(agent.name) == 0:
            scene._on_player_won(agent.name, simulator)
            remaining_str = " ".join(_hand_tokens(agent.name)) or "(empty)"
            attempt_str = " ".join(attempted)
            summary = T("prompts.actions.play_cards.summary_win", locale=getattr(agent, 'language', None), agent_name=agent.name, attempt=attempt_str, combo_type=combo['type'], remaining=remaining_str)
            return True, {"played": tokens, "win": True}, summary, {}, True

        # Advance turn on successful play
        scene._advance_turn()
        remaining_str = " ".join(_hand_tokens(agent.name))
        attempt_str = " ".join(attempted)
        summary = T("prompts.actions.play_cards.summary_played", locale=getattr(agent, 'language', None), agent_name=agent.name, attempt=attempt_str, combo_type=combo['type'], remaining=remaining_str)
        return True, {"played": tokens}, summary, {}, True


class DoubleAction(Action):
    NAME = T("prompts.actions.double.name", locale=None)
    DESC = T("prompts.actions.double.desc", locale=None)
    INSTRUCTION = T("prompts.actions.double.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "doubling":
            agent.add_env_feedback(T("prompts.actions.double.error_wrong_phase", locale=getattr(agent, 'language', None)))
            return False, {"error": "wrong_phase"}, T("prompts.actions.double.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False
        acted = dict(scene.state.get("doubling_acted"))
        if acted.get(agent.name, False):
            agent.add_env_feedback(T("prompts.actions.double.error_already_acted", locale=getattr(agent, 'language', None)))
            return False, {"error": "already_acted"}, T("prompts.actions.double.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False

        scene.state["score_multiplier"] = (
            int(scene.state.get("score_multiplier", 1)) * 2
        )
        acted[agent.name] = True
        scene.state["doubling_acted"] = acted
        simulator.broadcast(PublicEvent(T("prompts.actions.double.event_doubled", locale=getattr(agent, 'language', None), agent_name=agent.name)))
        scene._advance_doubling(simulator)
        return True, {"double": True}, T("prompts.actions.double.summary_doubled", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, True


class NoDoubleAction(Action):
    NAME = T("prompts.actions.no_double.name", locale=None)
    DESC = T("prompts.actions.no_double.desc", locale=None)
    INSTRUCTION = T("prompts.actions.no_double.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "doubling":
            agent.add_env_feedback(T("prompts.actions.no_double.error_wrong_phase", locale=getattr(agent, 'language', None)))
            return False, {"error": "wrong_phase"}, T("prompts.actions.no_double.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False
        acted = dict(scene.state.get("doubling_acted"))
        if acted.get(agent.name, False):
            agent.add_env_feedback(T("prompts.actions.no_double.error_already_acted", locale=getattr(agent, 'language', None)))
            return False, {"error": "already_acted"}, T("prompts.actions.no_double.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False

        acted[agent.name] = True
        scene.state["doubling_acted"] = acted
        simulator.broadcast(PublicEvent(T("prompts.actions.no_double.event_declined", locale=getattr(agent, 'language', None), agent_name=agent.name)))
        scene._advance_doubling(simulator)
        return True, {"double": False}, T("prompts.actions.no_double.summary_declined", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, True
