from typing import Optional

from socialsim4.core.action import Action
from socialsim4.core.event import PublicEvent


def _is_alive(scene, name: str) -> bool:
    return name in scene.state.get("alive", [])


def _role_of(scene, name: str) -> Optional[str]:
    return scene.state.get("roles", {}).get(name)


class VoteLynchAction(Action):
    NAME = "vote_lynch"
    DESC = "During the day, vote to lynch a player. One vote per day."
    INSTRUCTION = """- To vote to lynch someone during the day:
<Action name=\"vote_lynch\"><target>[player_name]</target></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "day_voting":
            agent.add_env_feedback("You can only vote during the voting phase.")
            return (
                False,
                {"error": "wrong_phase"},
                f"{agent.name} failed to vote: {action_data}",
                {},
                False,
            )
        if not _is_alive(scene, agent.name):
            agent.add_env_feedback("You are dead and cannot act.")
            return (
                False,
                {"error": "dead"},
                f"{agent.name} failed to vote: {action_data}",
                {},
                False,
            )
        target = action_data.get("target")
        if not target or not _is_alive(scene, target):
            agent.add_env_feedback("Provide a living 'target' to vote.")
            return (
                False,
                {"error": "invalid_target"},
                f"{agent.name} failed to vote: {action_data}",
                {},
                False,
            )

        votes = scene.state.setdefault("lynch_votes", {})
        votes[agent.name] = target
        tally = sum(1 for v, t in votes.items() if t == target and _is_alive(scene, v))
        simulator.broadcast(PublicEvent(f"{agent.name} voted to lynch {target}."))
        result = {"target": target, "tally": tally}
        summary = f"{agent.name} voted to lynch {target}"
        return True, result, summary, {}, True


class NightKillAction(Action):
    NAME = "night_kill"
    DESC = "At night, werewolves vote on a victim to kill."
    INSTRUCTION = """- Werewolves: to vote a night kill target (at night only):
<Action name=\"night_kill\"><target>[player_name]</target></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "night":
            agent.add_env_feedback("Night kill can only be cast at night.")
            return False, {"error": "wrong_phase"}, f"{agent.name} night_kill failed", {}, False
        if (not _is_alive(scene, agent.name)) or _role_of(
            scene, agent.name
        ) != "werewolf":
            agent.add_env_feedback("Only living werewolves can vote a night kill.")
            return (
                False,
                {"error": "not_werewolf_or_dead"},
                f"{agent.name} night_kill failed",
                {},
                False,
            )
        if scene.state.get("day_count", 0) == 0:
            agent.add_env_feedback(
                "First night has no kills; discuss with fellow wolves."
            )
            return False, {"error": "first_night"}, f"{agent.name} night_kill failed", {}, False
        target = action_data.get("target")
        if (
            (not target)
            or (not _is_alive(scene, target))
            or _role_of(scene, target) == "werewolf"
        ):
            agent.add_env_feedback("Provide a living non-werewolf 'target'.")
            return False, {"error": "invalid_target"}, f"{agent.name} night_kill failed", {}, False

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
            PublicEvent(f"{agent.name} voted night kill to {target}.", prefix="Event"),
            receivers=receivers,
        )
        # Tally only werewolf votes
        tally = sum(
            1
            for v, t in votes.items()
            if t == target and _is_alive(scene, v) and _role_of(scene, v) == "werewolf"
        )
        result = {"target": target, "tally": tally}
        summary = f"{agent.name} voted night kill: {target}"
        return True, result, summary, {}, True


class InspectAction(Action):
    NAME = "inspect"
    DESC = "At night, seer inspects a player and learns if they are a werewolf."
    INSTRUCTION = """- Seer: to inspect a player at night:
<Action name=\"inspect\"><target>[player_name]</target></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "night":
            agent.add_env_feedback("You can only inspect at night.")
            return False, {"error": "wrong_phase"}, f"{agent.name} inspect failed", {}, False
        if not _is_alive(scene, agent.name) or _role_of(scene, agent.name) != "seer":
            agent.add_env_feedback("Only a living Seer can inspect.")
            return False, {"error": "not_seer_or_dead"}, f"{agent.name} inspect failed", {}, False
        target = action_data.get("target")
        if not target or not _is_alive(scene, target):
            agent.add_env_feedback("Provide a living 'target' to inspect.")
            return False, {"error": "invalid_target"}, f"{agent.name} inspect failed", {}, False

        is_wolf = _role_of(scene, target) == "werewolf"
        agent.add_env_feedback(
            f"Inspection result: {target} is {'a werewolf' if is_wolf else 'not a werewolf'}."
        )
        # Inform moderators privately
        simulator.broadcast(
            PublicEvent(
                f"{agent.name} inspected {target} ({'werewolf' if is_wolf else 'not'})",
                prefix="Event",
            ),
            receivers=scene.moderator_names,
        )
        result = {"target": target, "is_werewolf": is_wolf}
        summary = (
            f"{agent.name} inspected {target} ({'werewolf' if is_wolf else 'not'})"
        )
        return True, result, summary, {}, True


class WitchSaveAction(Action):
    NAME = "witch_save"
    DESC = "At night, witch may save the intended victim once per game."
    INSTRUCTION = """- Witch: to save tonight's victim (once per game):
<Action name=\"witch_save\" />
"""

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "night":
            agent.add_env_feedback("You can only use save at night.")
            return False, {"error": "wrong_phase"}, f"{agent.name} witch_save failed", {}, False
        if not _is_alive(scene, agent.name) or _role_of(scene, agent.name) != "witch":
            agent.add_env_feedback("Only a living Witch can save.")
            return (
                False,
                {"error": "not_witch_or_dead"},
                f"{agent.name} witch_save failed",
                {},
                False,
            )

        uses = scene.state.setdefault("witch_uses", {}).setdefault(
            agent.name, {"heals_left": 1, "poisons_left": 1}
        )
        if uses.get("heals_left", 0) <= 0:
            agent.add_env_feedback("You have already used your save potion.")
            return False, {"error": "no_heal_left"}, f"{agent.name} witch_save failed", {}, False

        scene.state["witch_saved"] = True
        uses["heals_left"] = uses.get("heals_left", 0) - 1
        agent.add_env_feedback("You prepare the save potion for tonight's victim.")
        # Inform moderators privately
        simulator.broadcast(
            PublicEvent(f"{agent.name} prepared a save potion.", prefix="Event"),
            receivers=scene.moderator_names,
        )
        result = {"saved": True}
        summary = f"{agent.name} used witch save"
        return True, result, summary, {}, True


class WitchPoisonAction(Action):
    NAME = "witch_poison"
    DESC = "At night, witch may poison one player once per game."
    INSTRUCTION = """- Witch: to poison a player at night (once per game):
<Action name=\"witch_poison\"><target>[player_name]</target></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        if scene.state.get("phase") != "night":
            agent.add_env_feedback("You can only poison at night.")
            return False, {"error": "wrong_phase"}, f"{agent.name} witch_poison failed", {}, False
        if not _is_alive(scene, agent.name) or _role_of(scene, agent.name) != "witch":
            agent.add_env_feedback("Only a living Witch can poison.")
            return (
                False,
                {"error": "not_witch_or_dead"},
                f"{agent.name} witch_poison failed",
                {},
                False,
            )
        target = action_data.get("target")
        if not target or not _is_alive(scene, target) or target == agent.name:
            agent.add_env_feedback("Provide a living 'target' other than yourself.")
            return (
                False,
                {"error": "invalid_target"},
                f"{agent.name} witch_poison failed",
                {},
                False,
            )

        uses = scene.state.setdefault("witch_uses", {}).setdefault(
            agent.name, {"heals_left": 1, "poisons_left": 1}
        )
        if uses.get("poisons_left", 0) <= 0:
            agent.add_env_feedback("You have already used your poison potion.")
            return (
                False,
                {"error": "no_poison_left"},
                f"{agent.name} witch_poison failed",
                {},
                False,
            )

        scene.state.setdefault("witch_actions", {}).setdefault(agent.name, {})[
            "poison_target"
        ] = target
        uses["poisons_left"] = uses.get("poisons_left", 0) - 1
        agent.add_env_feedback(f"You prepared a poison targeting {target}.")
        # Inform moderators privately
        simulator.broadcast(
            PublicEvent(
                f"{agent.name} prepared a poison targeting {target}.", prefix="Event"
            ),
            receivers=scene.moderator_names,
        )
        result = {"target": target}
        summary = f"{agent.name} prepared poison for {target}"
        return True, result, summary, {}, True


class OpenVotingAction(Action):
    NAME = "open_voting"
    DESC = "Moderator should use this action to open voting after discussion."
    INSTRUCTION = """- Moderator: open voting after discussion:
<Action name=\"open_voting\" />
"""

    def handle(self, action_data, agent, simulator, scene):
        name = agent.name
        if not scene.is_moderator(name):
            agent.add_env_feedback("Only the moderator can open voting.")
            return False, {"error": "not_moderator"}, f"{agent.name} open_voting failed", {}, False
        if scene.state.get("phase") != "day_discussion":
            agent.add_env_feedback("Open voting only during discussion phase.")
            return False, {"error": "wrong_phase"}, f"{agent.name} open_voting failed", {}, False
        scene.state["phase"] = "day_voting"
        scene.state["lynch_votes"] = {}
        simulator.broadcast(PublicEvent("Voting is now open."))
        result = {"opened": True}
        summary = f"{agent.name} opened voting"
        return True, result, summary, {}, True


class CloseVotingAction(Action):
    NAME = "close_voting"
    DESC = "Moderator closes voting, resolves lynch, ends the day."
    INSTRUCTION = """- Moderator: close voting and end the day:
<Action name=\"close_voting\" />
"""

    def handle(self, action_data, agent, simulator, scene):
        name = agent.name
        if not scene.is_moderator(name):
            agent.add_env_feedback("Only the moderator can close voting.")
            return (
                False,
                {"error": "not_moderator"},
                f"{agent.name} close_voting failed",
                {},
                False,
            )
        if scene.state.get("phase") != "day_voting":
            agent.add_env_feedback("Close voting only during voting phase.")
            return False, {"error": "wrong_phase"}, f"{agent.name} close_voting failed", {}, False
        scene._resolve_lynch(simulator, prefer_plurality=True)
        scene.state["lynch_votes"] = {}
        scene.state["phase"] = "night"
        if scene._check_win():
            winner = scene.state.get("winner")
            simulator.broadcast(PublicEvent(f"Game over: {winner} win."))
        result = {"closed": True}
        summary = f"{agent.name} closed voting"
        return True, result, summary, {}, True
