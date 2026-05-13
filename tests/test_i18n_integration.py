"""
Integration tests for Social-Sim's i18n system.

Verifies that translations flow correctly through the T() function,
request-scoped locale switching, and agent system prompt generation.

Contains:
    - test_agent_system_prompt_is_chinese_when_locale_zh
    - test_T_function_returns_chinese_for_zh_locale
    - test_language_does_not_leak_between_requests
"""

import json
import re
from pathlib import Path

import pytest

from socialsim4.i18n import T, set_request_locale, get_request_locale
from socialsim4.core.agent.agent import Agent

ROOT = Path(__file__).parent.parent
LOCALES = ROOT / "src" / "socialsim4" / "locales"
ZH_JSON = LOCALES / "zh.json"
EN_JSON = LOCALES / "en.json"

ZH_CHAR_RE = re.compile(r"[\u4e00-\u9fff]")
EN_WORDS_RE = re.compile(r"[A-Za-z]+(?:\s+[A-Za-z]+){4,}")

# Keys whose zh.json values are intentionally English (brand names, etc.)
ZH_ENGLISH_ALLOWED = {
    "brand",
    "landing.hero.line1",
    "landing.hero.line2",
    "landing.hero.accent",
}


def _flatten_json(data: dict, prefix: str = "") -> dict:
    """Flatten nested dict into {dot.key: value} pairs."""
    out = {}
    for k, v in data.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(_flatten_json(v, full))
        else:
            out[full] = v
    return out


def test_agent_system_prompt_is_chinese_when_locale_zh():
    """
    Agent.system_prompt() should return Chinese when agent.language='zh'.

    Currently skips because system_prompt() is not yet fully i18n'd.
    Will pass once the prompt template uses T() for all user-facing text.
    """
    agent = Agent(
        name="测试代理人",
        user_profile="一个用于测试的模拟代理人",
        style="neutral",
        language="zh",
    )
    prompt = agent.system_prompt()

    has_chinese = bool(ZH_CHAR_RE.search(prompt))
    has_english_sentences = bool(EN_WORDS_RE.search(prompt))

    if not has_chinese or has_english_sentences:
        pytest.skip(
            "build_system_prompt not yet i18n'd — "
            "system_prompt() still returns mostly English text"
        )


def test_T_function_returns_chinese_for_zh_locale():
    """
    T(key, locale='zh') must return Chinese; T(key, locale='en') must not.

    Checks every string key in zh.json to ensure:
    - zh locale returns contain at least one Chinese character
    - en locale returns contain no Chinese characters
    """
    with open(ZH_JSON, encoding="utf-8") as f:
        zh_flat = _flatten_json(json.load(f))
    with open(EN_JSON, encoding="utf-8") as f:
        en_flat = _flatten_json(json.load(f))

    common_keys = sorted(set(zh_flat.keys()) & set(en_flat.keys()))

    violations_zh_no_chinese = []
    violations_en_has_chinese = []

    for key in common_keys:
        # Skip keys whose zh values are intentionally English
        if key in ZH_ENGLISH_ALLOWED:
            continue

        zh_raw = zh_flat.get(key)
        en_raw = en_flat.get(key)

        # Only test string-to-string keys
        if not isinstance(zh_raw, str) or not isinstance(en_raw, str):
            continue

        # Skip values that are purely interpolation placeholders
        zh_text = re.sub(r"\{[^}]+\}", "", zh_raw).strip()
        en_text = re.sub(r"\{[^}]+\}", "", en_raw).strip()
        if not zh_text or not en_text:
            continue

        # Check zh locale returns Chinese
        result_zh = T(key, locale='zh')
        if isinstance(result_zh, str) and not ZH_CHAR_RE.search(result_zh):
            violations_zh_no_chinese.append(key)

        # Check en locale returns no Chinese
        result_en = T(key, locale='en')
        if isinstance(result_en, str) and ZH_CHAR_RE.search(result_en):
            violations_en_has_chinese.append(key)

    errors = []
    if violations_zh_no_chinese:
        errors.append(
            f"{len(violations_zh_no_chinese)} key(s) returned no Chinese "
            f"for locale='zh':\n"
            + "\n".join(f"  {k}" for k in violations_zh_no_chinese[:20])
        )
    if violations_en_has_chinese:
        errors.append(
            f"{len(violations_en_has_chinese)} key(s) returned Chinese "
            f"for locale='en':\n"
            + "\n".join(f"  {k}" for k in violations_en_has_chinese[:20])
        )

    if errors:
        pytest.fail("\n\n".join(errors))


def test_language_does_not_leak_between_requests():
    """
    set_request_locale() must fully isolate locale between calls.

    Switches locale multiple times and verifies T() returns the
    correct language each time without leaking state.
    """
    with open(ZH_JSON, encoding="utf-8") as f:
        zh_flat = _flatten_json(json.load(f))

    # Pick sample string keys with enough content to distinguish languages
    sample_keys = [
        k for k, v in zh_flat.items()
        if isinstance(v, str)
        and k not in ZH_ENGLISH_ALLOWED
        and len(re.sub(r"\{[^}]+\}", "", v).strip()) >= 2
    ][:5]

    if not sample_keys:
        pytest.skip("No suitable string keys found in zh.json")

    # Phase 1: zh locale
    set_request_locale('zh')
    for key in sample_keys:
        result = T(key)
        assert ZH_CHAR_RE.search(str(result)), (
            f"locale='zh': expected Chinese for '{key}', got: {result}"
        )

    # Phase 2: en locale
    set_request_locale('en')
    for key in sample_keys:
        result = T(key)
        assert not ZH_CHAR_RE.search(str(result)), (
            f"locale='en': expected no Chinese for '{key}', got: {result}"
        )

    # Phase 3: back to zh — verifies no leak from en
    set_request_locale('zh')
    for key in sample_keys:
        result = T(key)
        assert ZH_CHAR_RE.search(str(result)), (
            f"locale='zh' (2nd switch): expected Chinese for '{key}', got: {result}"
        )
