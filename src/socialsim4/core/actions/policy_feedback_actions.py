from socialsim4.core.action import Action
from socialsim4.i18n import T


class ReportUpwardAction(Action):
    NAME = T("prompts.actions.report_upward.name", locale=None)
    DESC = T("prompts.actions.report_upward.desc", locale=None)
    REPROMPT_PARAM = "message"
    REPROMPT_SCENE_TYPES = {"policy_cascade_scene"}
    REPROMPT_TASK_MODES = {"follow_up", "follow_up_thread"}
    INSTRUCTION = T("prompts.actions.report_upward.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        return scene.handle_policy_special_action(self.NAME, action_data, agent, simulator)


class EscalateComplaintAction(Action):
    NAME = T("prompts.actions.escalate_complaint.name", locale=None)
    DESC = T("prompts.actions.escalate_complaint.desc", locale=None)
    REPROMPT_PARAM = "message"
    REPROMPT_SCENE_TYPES = {"policy_cascade_scene"}
    REPROMPT_TASK_MODES = {"follow_up", "follow_up_thread"}
    INSTRUCTION = T("prompts.actions.escalate_complaint.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        return scene.handle_policy_special_action(self.NAME, action_data, agent, simulator)


class ConsultPeerAction(Action):
    NAME = T("prompts.actions.consult_peer.name", locale=None)
    DESC = T("prompts.actions.consult_peer.desc", locale=None)
    REPROMPT_PARAM = "message"
    REPROMPT_SCENE_TYPES = {"policy_cascade_scene"}
    REPROMPT_TASK_MODES = {"follow_up", "follow_up_thread"}
    INSTRUCTION = T("prompts.actions.consult_peer.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        return scene.handle_policy_special_action(self.NAME, action_data, agent, simulator)


class NotifySubordinateAction(Action):
    NAME = T("prompts.actions.notify_subordinate.name", locale=None)
    DESC = T("prompts.actions.notify_subordinate.desc", locale=None)
    REPROMPT_PARAM = "message"
    REPROMPT_SCENE_TYPES = {"policy_cascade_scene"}
    REPROMPT_TASK_MODES = {"follow_up", "follow_up_thread"}
    INSTRUCTION = T("prompts.actions.notify_subordinate.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        return scene.handle_policy_special_action(self.NAME, action_data, agent, simulator)


class AnnouncePolicyAdjustmentAction(Action):
    NAME = T("prompts.actions.announce_policy_adjustment.name", locale=None)
    DESC = T("prompts.actions.announce_policy_adjustment.desc", locale=None)
    REPROMPT_PARAM = "message"
    REPROMPT_SCENE_TYPES = {"policy_cascade_scene"}
    REPROMPT_TASK_MODES = {"follow_up", "follow_up_thread"}
    INSTRUCTION = T("prompts.actions.announce_policy_adjustment.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        return scene.handle_policy_special_action(self.NAME, action_data, agent, simulator)
