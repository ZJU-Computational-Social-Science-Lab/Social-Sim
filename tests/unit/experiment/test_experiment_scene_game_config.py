from socialsim4.core.experiment.config import ExperimentConfig
from socialsim4.core.experiment.scene import ExperimentScene


def test_public_goods_game_config_uses_registry_semantics():
    config = ExperimentConfig(
        scenario_id="public_goods",
        agents=[{"name": "Alice"}],
        actions=[{"name": "Contribute", "description": "Contribute some tokens to the pool"}],
        parameters={
            "initial_amount": 20,
            "multiplier": 1.5,
        },
    )

    scene = ExperimentScene(config)
    game_config = scene._create_game_config()

    assert game_config.actions == ["contribute"]
    assert game_config.action_descriptions == {
        "contribute": "Contribute some tokens to the pool"
    }
    assert game_config.payoff_type == "pool"
    assert game_config.grouping_mode == "group"
    assert game_config.payoff_config == {
        "multiplier": 1.5,
        "initial_tokens": 20,
    }


def test_coordination_game_config_carries_feedback_goal():
    config = ExperimentConfig(
        scenario_id="coordination_game",
        agents=[{"name": "Alice"}],
        actions=[],
        parameters={
            "choices": "red, blue",
            "goal": "differ",
        },
    )

    scene = ExperimentScene(config)
    game_config = scene._create_game_config()

    assert game_config.actions == ["red", "blue"]
    assert game_config.payoff_type == "feedback"
    assert game_config.grouping_mode == "neighbor"
    assert game_config.payoff_config == {
        "goal": "differ",
    }


def test_echo_chamber_game_config_uses_default_category_actions():
    config = ExperimentConfig(
        scenario_id="echo_chamber",
        agents=[{"name": "Alice"}],
        actions=[],
        parameters={
            "connection_homogeneity": 0.7,
            "opinion_distribution": "balanced",
        },
    )

    scene = ExperimentScene(config)
    game_config = scene._create_game_config()

    assert game_config.actions == [
        "express_opinion",
        "reinforce_ingroup",
        "share_content",
        "disengage",
    ]
    assert game_config.action_descriptions == {
        "express_opinion": "Share your current viewpoint on the topic",
        "reinforce_ingroup": "Engage with and amplify similar viewpoints",
        "share_content": "Share information reinforcing your position",
        "disengage": "Withdraw from engagement with opposing views",
    }
    assert game_config.grouping_mode == "neighbor"
    assert game_config.payoff_type == "none"


def test_custom_game_config_preserves_action_parameter_schema():
    config = ExperimentConfig(
        scenario_id="custom",
        agents=[{"name": "Alice"}],
        actions=[
            {
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
        ],
    )

    scene = ExperimentScene(config)
    game_config = scene._create_game_config()

    assert game_config.actions == ["invest"]
    assert game_config.action_schemas == {
        "invest": {
            "schema": {
                "amount": {
                    "type": "integer",
                    "description": "How much to invest",
                }
            },
            "mode": "json",
        }
    }
