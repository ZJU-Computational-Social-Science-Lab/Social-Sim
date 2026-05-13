from socialsim4.core.action import Action
from socialsim4.i18n import T


class ScheduleOrderAction(Action):
    NAME = T("prompts.actions.schedule_order.name", locale=None)
    DESC = T("prompts.actions.schedule_order.desc", locale=None)
    INSTRUCTION = T("prompts.actions.schedule_order.instruction", locale=None)

    def handle(self, action_data, agent, simulator, scene):
        locale = getattr(agent, 'language', None)
        if simulator.ordering.is_queue_empty() is False:
            agent.add_env_feedback(T("prompts.actions.schedule_order.error_schedule_not_empty", locale=locale))
            return False, {}, T("prompts.actions.schedule_order.summary_failed", locale=locale), {}, False
        raw = action_data["order"]
        s = raw.strip()
        names = [x.strip() for x in s.split(",")]

        # No robustness: do not validate membership; let simulator handle unknowns.
        # Just push the list exactly as given into the ordering queue.
        simulator.ordering.add_to_queue(names)

        agent.add_env_feedback(T("prompts.actions.schedule_order.feedback_scheduled", locale=locale, names=", ".join(names)))
        return True, {"scheduled": names}, T("prompts.actions.schedule_order.summary_scheduled", locale=locale, agent_name=agent.name, names=",".join(names)), {}, False
