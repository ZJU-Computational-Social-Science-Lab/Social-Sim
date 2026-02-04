from socialsim4.core.action import Action
from socialsim4.core.action_controller import ActionConstraints
from socialsim4.core.event import MessageEvent, PublicEvent


class StartVotingAction(Action, ActionConstraints):
    NAME = "start_voting"
    DESC = "Host starts a voting round with a title."
    INSTRUCTION = """- To start voting with a title:
<Action name=\"start_voting\"><title>[short subject]</title></Action>
"""

    # VALIDATION: Declared right here with the action!
    ALLOWED_ROLES = {"Host"}

    @staticmethod
    def state_guard(scene_state):
        return not scene_state.get("voting_started", False)

    STATE_GUARD = state_guard
    STATE_ERROR = "Cannot start voting: a vote is already in progress"

    @staticmethod
    def validate_params(action_data):
        title = action_data.get("title", "").strip()
        return len(title) > 0

    PARAMETER_VALIDATOR = validate_params

    def handle(self, action_data, agent, simulator, scene):
        # Pure execution logic - validation already done!
        title = action_data["title"].strip()
        scene.state["voting_started"] = True
        scene.state["vote_title"] = title
        scene.state["votes"] = {}
        scene.state["voting_completed_announced"] = False

        simulator.broadcast(
            PublicEvent(
                f"The Host has initiated the voting round: {title}. Please cast your votes now."
            )
        )
        agent.add_env_feedback(f"Voting started: {title}")
        result = {"title": title}
        summary = f"{agent.name} started the voting: {title}"
        return True, result, summary, {}, True


class VotingStatusAction(Action):
    NAME = "voting_status"
    DESC = "Show current voting progress: counts and pending voters."
    INSTRUCTION = """- To check voting status:
<Action name=\"voting_status\" />
"""

    def handle(self, action_data, agent, simulator, scene):
        started = scene.state.get("voting_started", False)
        votes = scene.state.get("votes", {})
        num_members = sum(1 for a in simulator.agents.values() if a.name != "Host")
        if not started:
            agent.add_env_feedback("Voting has not started.")
            result = {"started": False, "members": num_members}
            summary = "Voting not started"
            return True, result, summary, {}, False

        yes = sum(v == "yes" for v in votes.values())
        no = sum(v == "no" for v in votes.values())
        abstain = sum(v == "abstain" for v in votes.values())
        pending_names = [
            name
            for name in simulator.agents.keys()
            if name != "Host" and name not in votes
        ]
        pending = len(pending_names)
        lines = [
            f"Voting status on: {scene.state.get('vote_title', '(untitled)')}:",
            f"- Members: {num_members}",
            f"- Yes: {yes}, No: {no}, Abstain: {abstain}",
            f"- Pending: {pending}"
            + (f" ({', '.join(pending_names)})" if pending_names else ""),
        ]
        agent.add_env_feedback("\n".join(lines))
        result = {
            "started": True,
            "members": num_members,
            "yes": yes,
            "no": no,
            "abstain": abstain,
            "pending": pending,
            "pending_names": pending_names,
            "title": scene.state.get("vote_title"),
        }
        summary = f"Voting status on '{scene.state.get('vote_title')}': yes {yes}, no {no}, abstain {abstain}, pending {pending}"
        return True, result, summary, {}, False


# Removed: GetRoundsAction — no round concept


class RequestBriefAction(Action):
    NAME = "request_brief"
    DESC = (
        "Host: fetch a concise, neutral brief via LLM when debate stalls, facts are missing, "
        "or members request data; provide a clear 'desc' (topic + focus)."
    )
    INSTRUCTION = """
- To request a brief (host only):
<Action name=\"request_brief\"><desc>[topic + focus]</desc></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        # Only the host can fetch briefs
        if getattr(agent, "name", "") != "Host":
            error = "Only the Host can use request_brief."
            agent.add_env_feedback(error)
            return (
                False,
                {"error": error},
                f"{agent.name} request_brief failed",
                {},
                False,
            )

        desc = action_data["desc"]

        # Prepare a concise LLM prompt for a short, actionable briefing
        system_prompt = (
            "You are a policy analyst assisting a legislative council debate. "
            "Generate a neutral, factual, concise briefing to unblock discussion. "
            "Output plain text only (no JSON, no role tags)."
        )
        user_prompt = (
            "Provide 5–7 crisp bullets with concrete facts, examples, or precedents. "
            "Include numbers if helpful and clearly label estimates. Keep under ~180 words.\n"
            f"Need: {desc}\n"
        )

        # Try using the configured LLM
        material = agent.call_llm(
            simulator.clients,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        # Assume LLM returns a string in this prototype

        used_fallback = False
        if not material.strip():
            # Fallback: short list of prompts to guide discussion
            material = (
                f"- Scope: {desc}\n"
                "- Key fact/definition\n"
                "- Comparable example (outcome)\n"
                "- Stakeholders: who benefits / pays\n"
                "- Rough cost or impact (estimate)\n"
                "- Top risk and mitigation\n"
                "- Open question for the chamber"
            )
            used_fallback = True

        content = f"Brief (private) on '{desc}':\n{material.strip()}"
        # Deliver privately to host and record the event (private)
        agent.add_env_feedback(content)
        # Add a concise transcript note (non-world log)
        # No logging inside action handlers; central logging can use the returned summary/result
        result = {
            "desc": desc,
            "material": material.strip(),
            "source": ("fallback" if used_fallback else "llm"),
        }
        summary = f"{agent.name} requested a brief: {desc}"
        return True, result, summary, {}, False


class VoteAction(Action, ActionConstraints):
    NAME = "vote"
    DESC = "Member casts a vote with optional comment."
    INSTRUCTION = """- To vote (only after voting has started):
<Action name=\"vote\"><vote>yes|no|abstain</vote><comment>[optional]</comment></Action>
"""

    # VALIDATION: Declared here!
    ALLOWED_ROLES = {"*"}  # '*' = any non-Host agent

    @staticmethod
    def state_guard(scene_state):
        return scene_state.get("voting_started", False)

    STATE_GUARD = state_guard
    STATE_ERROR = "Cannot vote: voting has not started yet"

    @staticmethod
    def validate_params(action_data):
        return action_data.get("vote") in ["yes", "no", "abstain"]

    PARAMETER_VALIDATOR = validate_params

    def handle(self, action_data, agent, simulator, scene):
        # Pure execution logic
        if agent.name in scene.state.get("votes", {}):
            error = "You have already voted."
            agent.add_env_feedback(error)
            return False, {"error": error}, f"{agent.name} vote failed", {}, False

        vote = action_data.get("vote")
        scene.state.setdefault("votes", {})[agent.name] = vote
        comment = action_data.get("comment", "")
        title = scene.state.get("vote_title", "the draft")
        vote_message = f"I vote {vote} on '{title}'."
        if comment:
            vote_message += f" Comment: {comment}"
        event = MessageEvent(agent.name, vote_message)
        scene.deliver_message(event, agent, simulator)

        result = {"vote": vote, "comment": comment}
        summary = f"{agent.name} voted {vote}"

        # Auto-conclude when all non-host members have voted
        num_members = sum(1 for a in simulator.agents.values() if a.name != "Host")
        votes = scene.state.get("votes", {})
        if (
            scene.state.get("voting_started", False)
            and num_members > 0
            and len(votes) >= num_members
            and not scene.state.get("voting_completed_announced", False)
        ):
            yes = sum(v == "yes" for v in votes.values())
            no = sum(v == "no" for v in votes.values())
            abstain = sum(v == "abstain" for v in votes.values())
            result_text = "passed" if yes > num_members / 2 else "failed"
            simulator.broadcast(
                PublicEvent(
                    f"Voting on '{title}' has concluded. It {result_text} with {yes} yes, {no} no, and {abstain} abstain."
                )
            )
            # Archive result and reset voting state; do NOT end the scene
            past = scene.state.get("past_votes") or []
            past.append({"title": title, "yes": yes, "no": no, "abstain": abstain})
            scene.state["past_votes"] = past
            scene.state["voting_started"] = False
            scene.state["voting_completed_announced"] = True
            scene.state["votes"] = {}
            scene.state["vote_title"] = ""
        return True, result, summary, {}, True


class FinishMeetingAction(Action):
    NAME = "finish_meeting"
    DESC = "Host finishes the council meeting and ends the scene."
    INSTRUCTION = """- To finish the council meeting (host only):
<Action name=\"finish_meeting\" />
"""

    def handle(self, action_data, agent, simulator, scene):
        scene.complete = True
        simulator.broadcast(PublicEvent("The council session is adjourned."))
        agent.add_env_feedback("Meeting finished.")
        return True, {}, f"{agent.name} finished the meeting", {}, True
