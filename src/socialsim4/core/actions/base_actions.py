from socialsim4.core.action import Action
from socialsim4.core.event import MessageEvent, SpeakEvent, TalkToEvent


class SpeakAction(Action):
    NAME = "speak"
    DESC = "Say something."
    INSTRUCTION = """- To speak:
<Action name=\"speak\"><message>[your_message]</message></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        message = action_data.get("message")
        if message:
            event = SpeakEvent(agent.name, message)
            scene.deliver_message(event, agent, simulator)
            result = {"message": message}
            summary = f"{agent.name} said: {message}"
            return True, result, summary, {}, False
        error = "Missing message."
        agent.add_env_feedback(error)
        return False, {"error": error}, f"{agent.name} failed to speak", {}, False


class SendMessageAction(Action):
    NAME = "send_message"
    DESC = "Post a message to all participants."
    INSTRUCTION = """- To send a message:
<Action name=\"send_message\"><message>[your_message]</message></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        message = action_data.get("message")
        if message:
            event = MessageEvent(agent.name, message)
            scene.deliver_message(event, agent, simulator)
            result = {"message": message}
            summary = f"{agent.name}: {message}"
            return True, result, summary, {}, False
        error = "Missing message."
        agent.add_env_feedback(error)
        return False, {"error": error}, f"{agent.name} failed to post", {}, False


class YieldAction(Action):
    NAME = "yield"
    DESC = "Yield the floor and end your turn."
    INSTRUCTION = """- To yield the floor:
<Action name=\"yield\" />
"""

    def handle(self, action_data, agent, simulator, scene):
        result = {}
        summary = f"{agent.name} yielded the floor"
        return True, result, summary, {}, True


class TalkToAction(Action):
    NAME = "talk_to"
    DESC = "Say something to a nearby person by name."
    INSTRUCTION = """- To talk to someone nearby (by name):
<Action name=\"talk_to\"><to>[recipient_name]</to><message>[your_message]</message></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        to_name = action_data.get("to")
        message = action_data.get("message")
        if not to_name or not message:
            error = "Provide 'to' (name) and 'message'."
            agent.add_env_feedback(error)
            return False, {"error": error}, f"{agent.name} failed to talk", {}, False

        target = simulator.agents.get(to_name)
        if not target:
            error = f"No such person: {to_name}."
            agent.add_env_feedback(error)
            return False, {"error": error}, f"{agent.name} failed to talk", {}, False

        # Range check for scenes with spatial chat
        sxy = agent.properties.get("map_xy")
        txy = target.properties.get("map_xy")
        dist = abs(sxy[0] - txy[0]) + abs(sxy[1] - txy[1])
        in_range = dist <= scene.chat_range

        if not in_range:
            error = f"{to_name} is too far to talk to."
            agent.add_env_feedback(error)
            return False, {"error": error}, f"{agent.name} failed to talk"

        event = TalkToEvent(agent.name, to_name, message)
        # Sender always sees their own speech
        agent.add_env_feedback(event.to_string(scene.state.get("time")))
        # Deliver only to the target
        target.add_env_feedback(event.to_string(scene.state.get("time")))
        result = {"to": to_name, "message": message}
        summary = f"{agent.name} to {to_name}: {message}"
        return True, result, summary, {}, False
