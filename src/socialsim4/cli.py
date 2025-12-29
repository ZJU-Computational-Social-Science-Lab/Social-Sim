"""Command-line interface for the SocialSim4 project."""

from __future__ import annotations

import argparse
import os
from typing import Iterable

from socialsim4.core.llm import create_llm_client
from socialsim4.core.llm_config import LLMConfig
from socialsim4.scenarios import SCENES, console_logger


def serve_backend(host: str, port: int, reload: bool) -> None:
    import uvicorn

    uvicorn.run(
        "socialsim4.backend.main:app",
        host=host,
        port=port,
        reload=reload,
    )


def build_llm_clients(args: argparse.Namespace) -> dict[str, object]:
    dialect = (args.dialect or os.getenv("LLM_DIALECT") or "").strip().lower()
    if not dialect:
        raise SystemExit("LLM dialect is required. Use --dialect or set LLM_DIALECT.")
    if dialect not in {"openai", "gemini", "mock"}:
        raise SystemExit(f"Unsupported LLM dialect: {dialect}")

    api_key = args.api_key or os.getenv("LLM_API_KEY")
    if dialect != "mock" and not api_key:
        raise SystemExit("API key is required for real LLM usage. Provide --api-key or set LLM_API_KEY.")

    model_defaults = {
        "openai": "gpt-4o-mini",
        "gemini": "gemini-2.0-flash-exp",
        "mock": "mock",
    }
    model = args.model or os.getenv("LLM_MODEL") or model_defaults[dialect]

    def _float(option: str, env: str, default: float) -> float:
        value = getattr(args, option)
        if value is not None:
            return value
        env_val = os.getenv(env)
        return float(env_val) if env_val is not None else default

    def _int(option: str, env: str, default: int) -> int:
        value = getattr(args, option)
        if value is not None:
            return value
        env_val = os.getenv(env)
        return int(env_val) if env_val is not None else default

    config = LLMConfig(
        dialect=dialect,
        api_key=api_key or "",
        model=model,
        base_url=args.base_url or os.getenv("LLM_BASE_URL"),
        temperature=_float("temperature", "LLM_TEMPERATURE", 0.7),
        top_p=_float("top_p", "LLM_TOP_P", 1.0),
        frequency_penalty=_float("frequency_penalty", "LLM_FREQUENCY_PENALTY", 0.0),
        presence_penalty=_float("presence_penalty", "LLM_PRESENCE_PENALTY", 0.0),
        max_tokens=_int("max_tokens", "LLM_MAX_TOKENS", 1024),
    )

    client = create_llm_client(config)
    return {"chat": client, "default": client}


def run_scenario(args: argparse.Namespace) -> None:
    spec = SCENES.get(args.scene)
    if spec is None:
        choices = ", ".join(sorted(SCENES.keys()))
        raise SystemExit(f"Unknown scene '{args.scene}'. Available options: {choices}")

    clients = build_llm_clients(args)
    simulator = spec.builder(clients, console_logger)
    max_turns = args.turns or spec.default_turns
    simulator.run(max_turns=max_turns)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="socialsim4", description="SocialSim4 command-line interface")
    subparsers = parser.add_subparsers(dest="command")

    serve_parser = subparsers.add_parser("serve", help="Start the FastAPI backend server")
    serve_parser.add_argument("--host", default="0.0.0.0", help="Host interface to bind (default: 0.0.0.0)")
    serve_parser.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    serve_parser.add_argument("--reload", action="store_true", help="Enable autoreload (development only)")

    scene_choices = sorted(SCENES.keys())
    sim_parser = subparsers.add_parser("run-sim", help="Run a scripted simulation scenario")
    sim_parser.add_argument("--scene", choices=scene_choices, default="simple_chat_scene", help="Scenario to execute")
    sim_parser.add_argument("--turns", type=int, help="Maximum turns to execute (defaults per scene)")
    sim_parser.add_argument("--dialect", choices=["openai", "gemini", "mock"], help="LLM dialect to use")
    sim_parser.add_argument("--api-key", help="API key for the selected LLM provider")
    sim_parser.add_argument("--model", help="Model name to use")
    sim_parser.add_argument("--base-url", help="Optional custom API base URL")
    sim_parser.add_argument("--temperature", type=float, help="Sampling temperature")
    sim_parser.add_argument("--top-p", type=float, help="Top-p nucleus sampling parameter")
    sim_parser.add_argument("--frequency-penalty", type=float, help="Frequency penalty")
    sim_parser.add_argument("--presence-penalty", type=float, help="Presence penalty")
    sim_parser.add_argument("--max-tokens", type=int, help="Maximum tokens per response")

    return parser


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)

    if args.command == "serve":
        serve_backend(args.host, args.port, args.reload)
        return 0
    if args.command == "run-sim":
        run_scenario(args)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
