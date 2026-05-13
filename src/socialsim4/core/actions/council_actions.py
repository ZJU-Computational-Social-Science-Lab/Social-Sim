"""
Council-specific actions with phase-based validation.

Uses the SystemFacilitator for permission checks instead of role-based restrictions.
Any agent can initiate facilitation actions when in the appropriate phase.
"""

from socialsim4.core.action import Action
from socialsim4.core.action_controller import ActionConstraints
from socialsim4.core.event import MessageEvent, PublicEvent
from socialsim4.i18n import T

_FACILITATOR = "facilitator"


class StartVotingAction(Action, ActionConstraints):
    NAME = T("prompts.actions.start_voting.name", locale=None)
    DESC = T("prompts.actions.start_voting.desc", locale=None)
    INSTRUCTION = T("prompts.actions.start_voting.instruction", locale=None)

    @staticmethod
    def state_guard(scene_state):
        return not scene_state.get("voting_started", False)

    STATE_GUARD = state_guard
    STATE_ERROR = T("prompts.actions.start_voting.state_error", locale=None)

    @staticmethod
    def validate_params(action_data):
        title = action_data.get("title", "").strip()
        return len(title) > 0

    PARAMETER_VALIDATOR = validate_params

    def handle(self, action_data, agent, simulator, scene):
        title = action_data["title"].strip()
        scene.state["voting_started"] = True
        scene.state["vote_title"] = title
        scene.state["votes"] = {}
        scene.state["voting_completed_announced"] = False

        # Update facilitator phase if present
        _fac = getattr(scene, _FACILITATOR, None)
        if _fac is not None:
            _fac.phase = _fac.phase.__class__.VOTING
            _fac.last_facilitation_turn = _fac.turn_count

        simulator.broadcast(
            PublicEvent(
                T("prompts.actions.start_voting.event_voting_started", locale=getattr(agent, 'language', None), agent_name=agent.name, title=title)
            )
        )
        agent.add_env_feedback(T("prompts.actions.start_voting.feedback_voting_started", locale=getattr(agent, 'language', None), title=title))
        result = {"title": title}
        summary = T("prompts.actions.start_voting.summary_voting_started", locale=getattr(agent, 'language', None), agent_name=agent.name, title=title)
        return True, result, summary, {}, True


class VotingStatusAction(Action):
    NAME = T("prompts.actions.voting_status.name", locale=None)
    DESC = T("prompts.actions.voting_status.desc", locale=None)
    INSTRUCTION = T("prompts.actions.voting_status.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        started = scene.state.get("voting_started", False)
        votes = scene.state.get("votes", {})

        # Count non-facilitator agents (any agent that's not the system)
        # In the new system, all agents can vote
        all_agents = list(simulator.agents.keys())
        # Exclude agents who have already voted from the pending count
        num_members = len(all_agents)

        if not started:
            agent.add_env_feedback(T("prompts.actions.voting_status.feedback_not_started", locale=getattr(agent, 'language', None)))
            result = {"started": False, "members": num_members}
            summary = T("prompts.actions.voting_status.summary_not_started", locale=getattr(agent, 'language', None))
            return True, result, summary, {}, False

        yes = sum(v == "yes" for v in votes.values())
        no = sum(v == "no" for v in votes.values())
        abstain = sum(v == "abstain" for v in votes.values())
        pending_names = [
            name for name in all_agents if name not in votes
        ]
        pending = len(pending_names)
        lines = [
            T("prompts.actions.voting_status.feedback_status_header", locale=getattr(agent, 'language', None), title=scene.state.get('vote_title', '(untitled)')),
            T("prompts.actions.voting_status.feedback_participants", locale=getattr(agent, 'language', None), count=num_members),
            T("prompts.actions.voting_status.feedback_tally", locale=getattr(agent, 'language', None), yes=yes, no=no, abstain=abstain),
            T("prompts.actions.voting_status.feedback_pending", locale=getattr(agent, 'language', None), pending=pending, names=', '.join(pending_names))
            if pending_names else
            T("prompts.actions.voting_status.feedback_pending_no_names", locale=getattr(agent, 'language', None), pending=pending),
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
        summary = T("prompts.actions.voting_status.summary_status", locale=getattr(agent, 'language', None), title=scene.state.get('vote_title'), yes=yes, no=no, abstain=abstain, pending=pending)
        return True, result, summary, {}, False


class RequestBriefAction(Action, ActionConstraints):
    NAME = T("prompts.actions.request_brief.name", locale=None)
    DESC = T("prompts.actions.request_brief.desc", locale=None)
    INSTRUCTION = T("prompts.actions.request_brief.instruction", locale=None)

    @staticmethod
    def validate_params(action_data):
        desc = action_data.get("desc", "").strip()
        return len(desc) > 0

    PARAMETER_VALIDATOR = validate_params

    def handle(self, action_data, agent, simulator, scene):
        desc = action_data["desc"]

        # Prepare a concise LLM prompt for a short, actionable briefing
        system_prompt = T("prompts.actions.request_brief.llm_system_prompt", locale=getattr(agent, 'language', None))
        user_prompt = T("prompts.actions.request_brief.llm_user_prompt", locale=getattr(agent, 'language', None), desc=desc)

        # Try using the configured LLM
        material = agent.call_llm(
            simulator.clients,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        used_fallback = False
        if not material or not material.strip():
            # Fallback: short list of prompts to guide discussion
            material = "\n".join([
                T("prompts.actions.request_brief.fallback_item_scope", locale=getattr(agent, 'language', None), desc=desc),
                T("prompts.actions.request_brief.fallback_item_fact", locale=getattr(agent, 'language', None)),
                T("prompts.actions.request_brief.fallback_item_example", locale=getattr(agent, 'language', None)),
                T("prompts.actions.request_brief.fallback_item_stakeholders", locale=getattr(agent, 'language', None)),
                T("prompts.actions.request_brief.fallback_item_cost", locale=getattr(agent, 'language', None)),
                T("prompts.actions.request_brief.fallback_item_risk", locale=getattr(agent, 'language', None)),
                T("prompts.actions.request_brief.fallback_item_question", locale=getattr(agent, 'language', None)),
            ])
            used_fallback = True

        content = T("prompts.actions.request_brief.feedback_brief", locale=getattr(agent, 'language', None), desc=desc, material=material.strip())
        agent.add_env_feedback(content)
        result = {
            "desc": desc,
            "material": material.strip(),
            "source": ("fallback" if used_fallback else "llm"),
        }
        summary = T("prompts.actions.request_brief.summary_requested", locale=getattr(agent, 'language', None), agent_name=agent.name, desc=desc)
        return True, result, summary, {}, False


class VoteAction(Action, ActionConstraints):
    NAME = T("prompts.actions.vote.name", locale=None)
    DESC = T("prompts.actions.vote.desc", locale=None)
    INSTRUCTION = T("prompts.actions.vote.instruction", locale=None)

    @staticmethod
    def state_guard(scene_state):
        return scene_state.get("voting_started", False)

    STATE_GUARD = state_guard
    STATE_ERROR = T("prompts.actions.vote.state_error", locale=None)

    @staticmethod
    def validate_params(action_data):
        return action_data.get("vote") in ["yes", "no", "abstain"]

    PARAMETER_VALIDATOR = validate_params

    def handle(self, action_data, agent, simulator, scene):
        _loc = getattr(agent, 'language', None)
        if agent.name in scene.state.get("votes", {}):
            error = T("prompts.actions.vote.error_already_voted", locale=_loc)
            agent.add_env_feedback(error)
            return False, {"error": error}, T("prompts.actions.vote.summary_vote_failed", locale=_loc, agent_name=agent.name), {}, False

        vote = action_data.get("vote")
        scene.state.setdefault("votes", {})[agent.name] = vote
        comment = action_data.get("comment", "")
        title = scene.state.get("vote_title", "the draft")
        vote_message = T("prompts.actions.vote.message_vote_with_comment", locale=_loc, vote=vote, title=title, comment=comment) if comment else T("prompts.actions.vote.message_vote", locale=_loc, vote=vote, title=title)
        event = MessageEvent(agent.name, vote_message)
        scene.deliver_message(event, agent, simulator)

        result = {"vote": vote, "comment": comment}
        summary = T("prompts.actions.vote.summary_voted", locale=_loc, agent_name=agent.name, vote=vote)

        # Auto-conclude when all members have voted
        all_agents = list(simulator.agents.keys())
        num_members = len(all_agents)
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
            _concluded_msg = T("prompts.actions.vote.event_concluded_passed", locale=_loc, title=title, yes=yes, no=no, abstain=abstain) if result_text == "passed" else T("prompts.actions.vote.event_concluded_failed", locale=_loc, title=title, yes=yes, no=no, abstain=abstain)
            simulator.broadcast(
                PublicEvent(
                    _concluded_msg
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

            # Update facilitator phase if present
            _fac2 = getattr(scene, _FACILITATOR, None)
            if _fac2 is not None:
                _fac2.phase = _fac2.phase.__class__.DISCUSSION

        return True, result, summary, {}, True


class FinishMeetingAction(Action, ActionConstraints):
    NAME = T("prompts.actions.finish_meeting.name", locale=None)
    DESC = T("prompts.actions.finish_meeting.desc", locale=None)
    INSTRUCTION = T("prompts.actions.finish_meeting.instruction", locale=None)

    @staticmethod
    def state_guard(scene_state):
        return not scene_state.get("voting_started", False)

    STATE_GUARD = state_guard
    STATE_ERROR = T("prompts.actions.finish_meeting.state_error", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        _loc = getattr(agent, 'language', None)
        scene.complete = True

        # Update facilitator phase if present
        _fac3 = getattr(scene, _FACILITATOR, None)
        if _fac3 is not None:
            _fac3.phase = _fac3.phase.__class__.CONCLUDED

        simulator.broadcast(PublicEvent(T("prompts.actions.finish_meeting.event_adjourned", locale=_loc, agent_name=agent.name)))
        agent.add_env_feedback(T("prompts.actions.finish_meeting.feedback_finished", locale=_loc))
        return True, {}, T("prompts.actions.finish_meeting.summary_finished", locale=_loc, agent_name=agent.name), {}, True
