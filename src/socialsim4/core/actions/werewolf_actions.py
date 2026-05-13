from typing import Optional

from socialsim4.core.action import Action
from socialsim4.core.event import PublicEvent
from socialsim4.i18n import T


def _is_alive(scene, name: str) -> bool:
    return name in scene.state.get("alive", [])


def _role_of(scene, name: str) -> Optional[str]:
    return scene.state.get("roles", {}).get(name)


class VoteLynchAction(Action):
    NAME = T("prompts.actions.vote_lynch.name", locale=None)
    DESC = T("prompts.actions.vote_lynch.desc", locale=None)
    INSTRUCTION = T("prompts.actions.vote_lynch.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "day_voting":
            agent.add_env_feedback(T("prompts.actions.vote_lynch.error_wrong_stage", locale=getattr(agent, 'language', None)))
            return (
                False,
                {"error": "wrong_phase"},
                T("prompts.actions.vote_lynch.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name, action_data=str(action_data)),
                {},
                False,
            )
        if not _is_alive(scene, agent.name):
            agent.add_env_feedback(T("prompts.actions.vote_lynch.error_dead", locale=getattr(agent, 'language', None)))
            return (
                False,
                {"error": "dead"},
                T("prompts.actions.vote_lynch.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name, action_data=str(action_data)),
                {},
                False,
            )
        target = action_data.get("target")
        if not target or not _is_alive(scene, target):
            agent.add_env_feedback(T("prompts.actions.vote_lynch.error_invalid_target", locale=getattr(agent, 'language', None)))
            return (
                False,
                {"error": "invalid_target"},
                T("prompts.actions.vote_lynch.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name, action_data=str(action_data)),
                {},
                False,
            )

        votes = scene.state.setdefault("lynch_votes", {})
        votes[agent.name] = target
        tally = sum(1 for v, t in votes.items() if t == target and _is_alive(scene, v))
        simulator.broadcast(PublicEvent(T("prompts.actions.vote_lynch.event_voted", locale=getattr(agent, 'language', None), agent_name=agent.name, target=target)))
        result = {"target": target, "tally": tally}
        summary = T("prompts.actions.vote_lynch.summary_voted", locale=getattr(agent, 'language', None), agent_name=agent.name, target=target)
        return True, result, summary, {}, True


class NightKillAction(Action):
    NAME = T("prompts.actions.night_kill.name", locale=None)
    DESC = T("prompts.actions.night_kill.desc", locale=None)
    INSTRUCTION = T("prompts.actions.night_kill.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "night":
            agent.add_env_feedback(T("prompts.actions.night_kill.error_wrong_phase", locale=getattr(agent, 'language', None)))
            return False, {"error": "wrong_phase"}, T("prompts.actions.night_kill.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False
        if (not _is_alive(scene, agent.name)) or _role_of(
            scene, agent.name
        ) != "werewolf":
            agent.add_env_feedback(T("prompts.actions.night_kill.error_not_werewolf", locale=getattr(agent, 'language', None)))
            return (
                False,
                {"error": "not_werewolf_or_dead"},
                T("prompts.actions.night_kill.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name),
                {},
                False,
            )
        if scene.state.get("day_count", 0) == 0:
            agent.add_env_feedback(
                T("prompts.actions.night_kill.error_first_night", locale=getattr(agent, 'language', None))
            )
            return False, {"error": "first_night"}, T("prompts.actions.night_kill.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False
        target = action_data.get("target")
        if (
            (not target)
            or (not _is_alive(scene, target))
            or _role_of(scene, target) == "werewolf"
        ):
            agent.add_env_feedback(T("prompts.actions.night_kill.error_invalid_target", locale=getattr(agent, 'language', None)))
            return False, {"error": "invalid_target"}, T("prompts.actions.night_kill.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False

        votes = scene.state.setdefault("night_kill_votes", {})
        votes[agent.name] = target
        # Private confirmation
        # agent.add_env_feedback(f"Night kill vote recorded: {target}.")
        wolves = [
            name
            for name in scene.state.get("roles")
            if _role_of(scene, name) == "werewolf"
        ]
        receivers = wolves + scene.moderator_names
        simulator.broadcast(
            PublicEvent(T("prompts.actions.night_kill.event_voted", locale=getattr(agent, 'language', None), agent_name=agent.name, target=target), prefix="Event"),
            receivers=receivers,
        )
        # Tally only werewolf votes
        tally = sum(
            1
            for v, t in votes.items()
            if t == target and _is_alive(scene, v) and _role_of(scene, v) == "werewolf"
        )
        result = {"target": target, "tally": tally}
        summary = T("prompts.actions.night_kill.summary_voted", locale=getattr(agent, 'language', None), agent_name=agent.name, target=target)
        return True, result, summary, {}, True


class InspectAction(Action):
    NAME = T("prompts.actions.inspect.name", locale=None)
    DESC = T("prompts.actions.inspect.desc", locale=None)
    INSTRUCTION = T("prompts.actions.inspect.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "night":
            agent.add_env_feedback(T("prompts.actions.inspect.error_wrong_phase", locale=getattr(agent, 'language', None)))
            return False, {"error": "wrong_phase"}, T("prompts.actions.inspect.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False
        if not _is_alive(scene, agent.name) or _role_of(scene, agent.name) != "seer":
            agent.add_env_feedback(T("prompts.actions.inspect.error_not_seer", locale=getattr(agent, 'language', None)))
            return False, {"error": "not_seer_or_dead"}, T("prompts.actions.inspect.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False
        target = action_data.get("target")
        if not target or not _is_alive(scene, target):
            agent.add_env_feedback(T("prompts.actions.inspect.error_invalid_target", locale=getattr(agent, 'language', None)))
            return False, {"error": "invalid_target"}, T("prompts.actions.inspect.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False

        is_wolf = _role_of(scene, target) == "werewolf"
        result_text = (
            T("prompts.actions.inspect.result_werewolf", locale=getattr(agent, 'language', None))
            if is_wolf
            else T("prompts.actions.inspect.result_not_werewolf", locale=getattr(agent, 'language', None))
        )
        agent.add_env_feedback(
            T("prompts.actions.inspect.feedback_result", locale=getattr(agent, 'language', None), target=target, result=result_text)
        )
        # Inform moderators privately
        _event_text = T("prompts.actions.inspect.event_inspected_werewolf", locale=getattr(agent, 'language', None), agent_name=agent.name, target=target) if is_wolf else T("prompts.actions.inspect.event_inspected_not_werewolf", locale=getattr(agent, 'language', None), agent_name=agent.name, target=target)
        simulator.broadcast(
            PublicEvent(
                _event_text,
                prefix="Event",
            ),
            receivers=scene.moderator_names,
        )
        result = {"target": target, "is_werewolf": is_wolf}
        summary = T("prompts.actions.inspect.summary_inspected_werewolf", locale=getattr(agent, 'language', None), agent_name=agent.name, target=target) if is_wolf else T("prompts.actions.inspect.summary_inspected_not_werewolf", locale=getattr(agent, 'language', None), agent_name=agent.name, target=target)
        return True, result, summary, {}, True


class WitchSaveAction(Action):
    NAME = T("prompts.actions.witch_save.name", locale=None)
    DESC = T("prompts.actions.witch_save.desc", locale=None)
    INSTRUCTION = T("prompts.actions.witch_save.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "night":
            agent.add_env_feedback(T("prompts.actions.witch_save.error_wrong_phase", locale=getattr(agent, 'language', None)))
            return False, {"error": "wrong_phase"}, T("prompts.actions.witch_save.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False
        if not _is_alive(scene, agent.name) or _role_of(scene, agent.name) != "witch":
            agent.add_env_feedback(T("prompts.actions.witch_save.error_not_witch", locale=getattr(agent, 'language', None)))
            return (
                False,
                {"error": "not_witch_or_dead"},
                T("prompts.actions.witch_save.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name),
                {},
                False,
            )

        uses = scene.state.setdefault("witch_uses", {}).setdefault(
            agent.name, {"heals_left": 1, "poisons_left": 1}
        )
        if uses.get("heals_left", 0) <= 0:
            agent.add_env_feedback(T("prompts.actions.witch_save.error_no_heal_left", locale=getattr(agent, 'language', None)))
            return False, {"error": "no_heal_left"}, T("prompts.actions.witch_save.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False

        scene.state["witch_saved"] = True
        uses["heals_left"] = uses.get("heals_left", 0) - 1
        agent.add_env_feedback(T("prompts.actions.witch_save.feedback_prepared", locale=getattr(agent, 'language', None)))
        # Inform moderators privately
        simulator.broadcast(
            PublicEvent(T("prompts.actions.witch_save.event_prepared", locale=getattr(agent, 'language', None), agent_name=agent.name), prefix="Event"),
            receivers=scene.moderator_names,
        )
        result = {"saved": True}
        summary = T("prompts.actions.witch_save.summary_saved", locale=getattr(agent, 'language', None), agent_name=agent.name)
        return True, result, summary, {}, True


class WitchPoisonAction(Action):
    NAME = T("prompts.actions.witch_poison.name", locale=None)
    DESC = T("prompts.actions.witch_poison.desc", locale=None)
    INSTRUCTION = T("prompts.actions.witch_poison.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "night":
            agent.add_env_feedback(T("prompts.actions.witch_poison.error_wrong_phase", locale=getattr(agent, 'language', None)))
            return False, {"error": "wrong_phase"}, T("prompts.actions.witch_poison.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False
        if not _is_alive(scene, agent.name) or _role_of(scene, agent.name) != "witch":
            agent.add_env_feedback(T("prompts.actions.witch_poison.error_not_witch", locale=getattr(agent, 'language', None)))
            return (
                False,
                {"error": "not_witch_or_dead"},
                T("prompts.actions.witch_poison.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name),
                {},
                False,
            )
        target = action_data.get("target")
        if not target or not _is_alive(scene, target) or target == agent.name:
            agent.add_env_feedback(T("prompts.actions.witch_poison.error_invalid_target", locale=getattr(agent, 'language', None)))
            return (
                False,
                {"error": "invalid_target"},
                T("prompts.actions.witch_poison.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name),
                {},
                False,
            )

        uses = scene.state.setdefault("witch_uses", {}).setdefault(
            agent.name, {"heals_left": 1, "poisons_left": 1}
        )
        if uses.get("poisons_left", 0) <= 0:
            agent.add_env_feedback(T("prompts.actions.witch_poison.error_no_poison_left", locale=getattr(agent, 'language', None)))
            return (
                False,
                {"error": "no_poison_left"},
                T("prompts.actions.witch_poison.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name),
                {},
                False,
            )

        scene.state.setdefault("witch_actions", {}).setdefault(agent.name, {})[
            "poison_target"
        ] = target
        uses["poisons_left"] = uses.get("poisons_left", 0) - 1
        agent.add_env_feedback(T("prompts.actions.witch_poison.feedback_prepared", locale=getattr(agent, 'language', None), target=target))
        # Inform moderators privately
        simulator.broadcast(
            PublicEvent(
                T("prompts.actions.witch_poison.event_prepared", locale=getattr(agent, 'language', None), agent_name=agent.name, target=target), prefix="Event"
            ),
            receivers=scene.moderator_names,
        )
        result = {"target": target}
        summary = T("prompts.actions.witch_poison.summary_poisoned", locale=getattr(agent, 'language', None), agent_name=agent.name, target=target)
        return True, result, summary, {}, True


class OpenVotingAction(Action):
    NAME = T("prompts.actions.open_voting.name", locale=None)
    DESC = T("prompts.actions.open_voting.desc", locale=None)
    INSTRUCTION = T("prompts.actions.open_voting.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        name = agent.name
        if not scene.is_moderator(name):
            agent.add_env_feedback(T("prompts.actions.open_voting.error_not_moderator", locale=getattr(agent, 'language', None)))
            return False, {"error": "not_moderator"}, T("prompts.actions.open_voting.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False
        if scene.state.get("phase") != "day_discussion":
            agent.add_env_feedback(T("prompts.actions.open_voting.error_wrong_phase", locale=getattr(agent, 'language', None)))
            return False, {"error": "wrong_phase"}, T("prompts.actions.open_voting.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False
        scene.state["phase"] = "day_voting"
        scene.state["lynch_votes"] = {}
        simulator.broadcast(PublicEvent(T("prompts.actions.open_voting.event_opened", locale=getattr(agent, 'language', None))))
        result = {"opened": True}
        summary = T("prompts.actions.open_voting.summary_opened", locale=getattr(agent, 'language', None), agent_name=agent.name)
        return True, result, summary, {}, True


class CloseVotingAction(Action):
    NAME = T("prompts.actions.close_voting.name", locale=None)
    DESC = T("prompts.actions.close_voting.desc", locale=None)
    INSTRUCTION = T("prompts.actions.close_voting.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        name = agent.name
        if not scene.is_moderator(name):
            agent.add_env_feedback(T("prompts.actions.close_voting.error_not_moderator", locale=getattr(agent, 'language', None)))
            return (
                False,
                {"error": "not_moderator"},
                T("prompts.actions.close_voting.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name),
                {},
                False,
            )
        if scene.state.get("phase") != "day_voting":
            agent.add_env_feedback(T("prompts.actions.close_voting.error_wrong_phase", locale=getattr(agent, 'language', None)))
            return False, {"error": "wrong_phase"}, T("prompts.actions.close_voting.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False
        scene._resolve_lynch(simulator, prefer_plurality=True)
        scene.state["lynch_votes"] = {}
        scene.state["phase"] = "night"
        if scene._check_win():
            winner = scene.state.get("winner")
            simulator.broadcast(PublicEvent(T("prompts.actions.close_voting.event_game_over", locale=getattr(agent, 'language', None), winner=winner)))
        result = {"closed": True}
        summary = T("prompts.actions.close_voting.summary_closed", locale=getattr(agent, 'language', None), agent_name=agent.name)
        return True, result, summary, {}, True
