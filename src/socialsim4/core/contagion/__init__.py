"""
Contagion framework for agent-based disease and information spread.

This module provides the core types and utilities for modeling contagion
dynamics in agent-based simulations. It supports both disease modeling
(SIR/SEIR models) and information diffusion (gossip, rumors).

The framework is designed to work with the existing GridScene infrastructure
and maintains agent isolation - agents infer states from behavior, not direct
observation.

Key Components:
- ContagionState: Enum defining agent infection states (S, E, I, R)
- StateTransition: Dataclass for defining contagion rules
- check_probability: Utility for probabilistic state transitions

Usage:
    from socialsim4.core.contagion import ContagionState, StateTransition

    # Define a transition rule
    rule = StateTransition(
        from_state=ContagionState.SUSCEPTIBLE,
        to_state=ContagionState.INFECTED,
        trigger_type="proximity",
        probability=0.3
    )
"""
from .states import ContagionState
from .rules import StateTransition, check_probability

__all__ = ["ContagionState", "StateTransition", "check_probability"]
