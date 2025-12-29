class Action:
    NAME = "base_action"
    INSTRUCTION = ""
    DESC = ""

    def handle(self, action_data, agent, simulator, scene):
        """
        Execute the action.

        Return a 5-tuple:
        (success: bool, result: dict, summary: str, meta: dict, pass_control: bool)
        - success: did the action execute successfully
        - result: minimal machine-readable outcome
        - summary: one-line human-readable summary for transcripts
        - meta: optional extra info (scene-specific). Use {} if unused.
        - pass_control: whether to pass control to the next agent immediately
        """
        raise NotImplementedError
