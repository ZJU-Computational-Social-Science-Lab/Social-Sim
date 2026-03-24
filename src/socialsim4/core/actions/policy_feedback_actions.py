from socialsim4.core.action import Action


class ReportUpwardAction(Action):
    NAME = "report_upward"
    DESC = "Privately report execution difficulty to a direct superior."
    REPROMPT_PARAM = "message"
    REPROMPT_SCENE_TYPES = {"policy_cascade_scene"}
    REPROMPT_TASK_MODES = {"follow_up", "follow_up_thread"}
    INSTRUCTION = """- report_upward: Report execution difficulty to a direct superior
  <Action name=\"report_upward\"><target>Name</target><message>Your difficulty report</message></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        return scene.handle_policy_special_action(self.NAME, action_data, agent, simulator)


class EscalateComplaintAction(Action):
    NAME = "escalate_complaint"
    DESC = "Escalate a complaint or risk report to a higher-level superior."
    REPROMPT_PARAM = "message"
    REPROMPT_SCENE_TYPES = {"policy_cascade_scene"}
    REPROMPT_TASK_MODES = {"follow_up", "follow_up_thread"}
    INSTRUCTION = """- escalate_complaint: Escalate a complaint to a higher-level superior
  <Action name=\"escalate_complaint\"><target>Name</target><message>Your escalation report</message></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        return scene.handle_policy_special_action(self.NAME, action_data, agent, simulator)


class ConsultPeerAction(Action):
    NAME = "consult_peer"
    DESC = "Privately consult or coordinate with a connected peer on the same tier."
    REPROMPT_PARAM = "message"
    REPROMPT_SCENE_TYPES = {"policy_cascade_scene"}
    REPROMPT_TASK_MODES = {"follow_up", "follow_up_thread"}
    INSTRUCTION = """- consult_peer: Privately consult a connected peer on the same tier
  <Action name=\"consult_peer\"><target>Name</target><message>Your consultation message</message></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        return scene.handle_policy_special_action(self.NAME, action_data, agent, simulator)


class NotifySubordinateAction(Action):
    NAME = "notify_subordinate"
    DESC = "Privately notify a directly connected subordinate."
    REPROMPT_PARAM = "message"
    REPROMPT_SCENE_TYPES = {"policy_cascade_scene"}
    REPROMPT_TASK_MODES = {"follow_up", "follow_up_thread"}
    INSTRUCTION = """- notify_subordinate: Privately notify a directly connected subordinate
  <Action name=\"notify_subordinate\"><target>Name</target><message>Your notification</message></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        return scene.handle_policy_special_action(self.NAME, action_data, agent, simulator)


class AnnouncePolicyAdjustmentAction(Action):
    NAME = "announce_policy_adjustment"
    DESC = "Issue a new policy adjustment announcement that reopens cascade transmission."
    REPROMPT_PARAM = "message"
    REPROMPT_SCENE_TYPES = {"policy_cascade_scene"}
    REPROMPT_TASK_MODES = {"follow_up", "follow_up_thread"}
    INSTRUCTION = """- announce_policy_adjustment: Issue a policy adjustment announcement
  <Action name=\"announce_policy_adjustment\"><message>Your adjustment announcement</message></Action>
"""

    def handle(self, action_data, agent, simulator, scene):
        return scene.handle_policy_special_action(self.NAME, action_data, agent, simulator)
