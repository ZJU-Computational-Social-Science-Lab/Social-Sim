from socialsim4.backend.api.routes.experiment_templates import _convert_action_to_dict
from socialsim4.backend.schemas.experiment import ActionParameter, ActionType, ExperimentAction


def test_convert_action_to_dict_preserves_parameter_schema():
    action = ExperimentAction(
        action_type=ActionType.CUSTOM,
        name="Invest",
        description="Invest some amount",
        custom_action_name="invest",
        parameters=[
            ActionParameter(
                name="amount",
                type="integer",
                description="How much to invest",
                required=True,
                default=None,
            )
        ],
    )

    result = _convert_action_to_dict(action)

    assert result == {
        "name": "invest",
        "description": "Invest some amount",
        "parameters": [
            {
                "name": "amount",
                "type": "integer",
                "description": "How much to invest",
                "required": True,
                "default": None,
            }
        ],
    }
