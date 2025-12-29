"""Utility script to launch predefined SocialSim4 scenarios."""

from __future__ import annotations

import argparse
from typing import Callable, Dict

from socialsim4.scenarios.basic import SCENES, console_logger, make_clients_from_env


def run_scene(name: str, *, turns: int | None = None) -> None:
    spec = SCENES.get(name)
    if spec is None:
        choices = ", ".join(sorted(SCENES))
        raise SystemExit(f"Unknown scene '{name}'. Available: {choices}")

    clients = make_clients_from_env()
    simulator = spec.builder(clients, console_logger)
    simulator.run(max_turns=turns or spec.default_turns)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run basic SocialSim4 scenarios")
    parser.add_argument(
        "scene",
        choices=sorted(SCENES.keys()),
        help="Scenario name to execute",
    )
    parser.add_argument("--turns", type=int, help="Override maximum turns")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    run_scene(args.scene, turns=args.turns)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
