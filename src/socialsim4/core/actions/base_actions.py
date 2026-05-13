"""
Base action classes for core simulation interactions.

Provides the fundamental action types that agents can perform: speaking,
sending messages, yielding turns, and talking to specific nearby agents.
These actions are used across most scene types.

Contains: SpeakAction, SendMessageAction, YieldAction, TalkToAction.
"""

from socialsim4.core.action import Action
from socialsim4.core.event import MessageEvent, SpeakEvent, TalkToEvent
from socialsim4.i18n import T


class SpeakAction(Action):
    NAME = T("prompts.actions.speak.name", locale=None)
    DESC = T("prompts.actions.speak.desc", locale=None)
    REPROMPT_PARAM = "message"
    INSTRUCTION = T("prompts.actions.speak.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        message = action_data.get("message")
        if message:
            event = SpeakEvent(agent.name, message)
            scene.deliver_message(event, agent, simulator)
            result = {"message": message}
            summary = T("prompts.actions.speak.summary_spoke", locale=getattr(agent, 'language', None), agent_name=agent.name, message=message)
            return True, result, summary, {}, False
        error = T("prompts.actions.speak.error_missing_message", locale=getattr(agent, 'language', None))
        agent.add_env_feedback(error)
        return False, {"error": error}, T("prompts.actions.speak.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False


class SendMessageAction(Action):
    NAME = T("prompts.actions.send_message.name", locale=None)
    DESC = T("prompts.actions.send_message.desc", locale=None)
    REPROMPT_PARAM = "message"
    INSTRUCTION = T("prompts.actions.send_message.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        message = action_data.get("message")
        if message:
            event = MessageEvent(agent.name, message)
            scene.deliver_message(event, agent, simulator)
            result = {"message": message}
            summary = T("prompts.actions.send_message.summary_sent", locale=getattr(agent, 'language', None), agent_name=agent.name, message=message)
            return True, result, summary, {}, False
        error = T("prompts.actions.send_message.error_missing_message", locale=getattr(agent, 'language', None))
        agent.add_env_feedback(error)
        return False, {"error": error}, T("prompts.actions.send_message.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False


class YieldAction(Action):
    NAME = T("prompts.actions.yield.name", locale=None)
    DESC = T("prompts.actions.yield.desc", locale=None)
    INSTRUCTION = T("prompts.actions.yield.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        result = {}
        summary = T("prompts.actions.yield.summary_yielded", locale=getattr(agent, 'language', None), agent_name=agent.name)
        return True, result, summary, {}, True


class TalkToAction(Action):
    NAME = T("prompts.actions.talk_to.name", locale=None)
    DESC = T("prompts.actions.talk_to.desc", locale=None)
    INSTRUCTION = T("prompts.actions.talk_to.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        to_name = action_data.get("target") or action_data.get("to")
        message = action_data.get("message")
        if not to_name or not message:
            error = T("prompts.actions.talk_to.error_missing_params", locale=getattr(agent, 'language', None))
            agent.add_env_feedback(error)
            return False, {"error": error}, T("prompts.actions.talk_to.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False

        target = simulator.agents.get(to_name)
        if not target:
            error = T("prompts.actions.talk_to.error_no_such_person", locale=getattr(agent, 'language', None), target_name=to_name)
            agent.add_env_feedback(error)
            return False, {"error": error}, T("prompts.actions.talk_to.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name), {}, False

        # Range check for scenes with spatial chat
        sxy = agent.properties.get("map_xy")
        txy = target.properties.get("map_xy")
        dist = abs(sxy[0] - txy[0]) + abs(sxy[1] - txy[1])
        in_range = dist <= scene.chat_range

        if not in_range:
            error = T("prompts.actions.talk_to.error_too_far", locale=getattr(agent, 'language', None), target_name=to_name)
            agent.add_env_feedback(error)
            return False, {"error": error}, T("prompts.actions.talk_to.summary_failed", locale=getattr(agent, 'language', None), agent_name=agent.name)

        event = TalkToEvent(agent.name, to_name, message)
        # Sender always sees their own speech
        agent.add_env_feedback(event.to_string(scene.state.get("time")))
        # Deliver only to the target
        target.add_env_feedback(event.to_string(scene.state.get("time")))
        result = {"to": to_name, "message": message}
        summary = T("prompts.actions.talk_to.summary_talked", locale=getattr(agent, 'language', None), agent_name=agent.name, target_name=to_name, message=message)
        return True, result, summary, {}, False
