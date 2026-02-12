"""
Output evaluation logic for LLM prompt testing.

Provides functions to evaluate LLM outputs against success criteria:
- XML format validation
- Action correctness checking
- Role alignment evaluation
- Error/hallucination detection
"""

import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from .agents import AgentProfile
from .scenarios import ScenarioConfig

logger = logging.getLogger(__name__)


@dataclass
class EvaluationResult:
    """Result of evaluating an LLM output."""

    xml_valid: bool
    action_correct: bool
    role_aligned: bool
    no_errors: bool
    overall_score: int  # 0-4 (count of passing criteria)
    parsed_action: Optional[str] = None
    parsed_thoughts: Optional[str] = None
    parsed_plan: Optional[str] = None
    failure_reasons: List[str] = field(default_factory=list)
    error_message: str = ""

    @property
    def is_perfect(self) -> bool:
        """Check if all criteria passed."""
        return self.overall_score == 4

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "xml_valid": self.xml_valid,
            "action_correct": self.action_correct,
            "role_aligned": self.role_aligned,
            "no_errors": self.no_errors,
            "overall_score": self.overall_score,
            "parsed_action": self.parsed_action,
            "parsed_thoughts": self.parsed_thoughts,
            "parsed_plan": self.parsed_plan,
            "failure_reasons": self.failure_reasons,
            "error_message": self.error_message,
        }


# ============================================================================
# XML Format Validation
# ============================================================================

EXPECTED_XML_SECTIONS = [
    ("--- Thoughts ---", "Thoughts"),
    ("---- Plan ---", "Plan"),
    ("---- Action ---", "Action"),
]


def check_xml_format(output: str) -> Tuple[bool, str]:
    """
    Check if output matches expected XML format.

    Expected format:
    --- Thoughts ---
    [thought content]

    ---- Plan ---
    [plan content]

    ---- Action ---
    <Action name="...">
      [params]
    </Action>

    Args:
        output: The LLM output to check

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not output or not output.strip():
        return False, "Empty output"

    failures = []

    # Check for each expected section
    for marker, section_name in EXPECTED_XML_SECTIONS:
        if marker not in output:
            failures.append(f"Missing '{section_name}' section (expected marker: '{marker}')")

    # Check Action is XML-like
    if "---- Action ---" in output:
        action_section = output.split("---- Action ---")[-1].strip()
        if not action_section:
            failures.append("Action section is empty")
        elif not ("<Action" in action_section or "<action" in action_section.lower()):
            failures.append("Action section doesn't contain XML action element")

    is_valid = len(failures) == 0
    error_msg = "; ".join(failures) if failures else ""

    return is_valid, error_msg


def parse_xml_sections(output: str) -> Dict[str, str]:
    """
    Parse the expected sections from the output.

    Returns:
        Dict with keys: thoughts, plan, action
    """
    result = {"thoughts": None, "plan": None, "action": None}

    try:
        # Split on section markers
        parts = output.split("---")

        for part in parts:
            part = part.strip()
            if "Thoughts ---" in part or part.startswith("Thoughts"):
                result["thoughts"] = part.replace("Thoughts ---", "").strip()
            elif "Plan ---" in part or part.startswith("Plan"):
                result["plan"] = part.replace("Plan ---", "").strip()
            elif "Action ---" in part or part.startswith("Action"):
                result["action"] = part.replace("Action ---", "").strip()

    except Exception as e:
        logger.warning(f"Error parsing XML sections: {e}")

    return result


def extract_action_name(action_section: str) -> Optional[str]:
    """Extract action name from action XML."""
    if not action_section:
        return None

    try:
        # Try to parse as XML
        # Remove any XML declarations if present
        action_section = action_section.strip()
        if "<?xml" in action_section:
            action_section = action_section.split("?>", 1)[-1]

        # Find the action element
        match = re.search(r'<Action\s+name\s*=\s*"([^"]+)"', action_section, re.IGNORECASE)
        if match:
            return match.group(1)

        # Try alternative formats
        match = re.search(r'<Action[^>]*name="([^"]+)"', action_section, re.IGNORECASE)
        if match:
            return match.group(1)

        match = re.search(r'<(\w+)', action_section)
        if match:
            return match.group(1)

    except Exception as e:
        logger.warning(f"Error extracting action name: {e}")

    return None


# ============================================================================
# Action Correctness Checking
# ============================================================================

def check_action_correct(
    output: str,
    scenario: ScenarioConfig,
) -> Tuple[bool, str, Optional[str]]:
    """
    Check if the action taken is correct for the scenario.

    Args:
        output: The LLM output
        scenario: The scenario configuration

    Returns:
        Tuple of (is_correct, reason, parsed_action)
    """
    # First, check if XML is valid enough to extract action
    is_valid, _ = check_xml_format(output)
    if not is_valid:
        return False, "Cannot check action - XML format invalid", None

    # Parse sections
    sections = parse_xml_sections(output)
    action_section = sections.get("action", "")

    if not action_section:
        return False, "No action found in output", None

    # Extract action name
    action_name = extract_action_name(action_section)

    if not action_name:
        return False, "Could not extract action name from XML", None

    # Get valid actions for scenario
    valid_actions = [a.name for a in scenario.actions]

    if not valid_actions:
        # No actions defined, any action is acceptable
        return True, f"Action '{action_name}' taken (no specific actions defined)", action_name

    # Check if action is valid
    # Allow partial matches (e.g., "effort_1" matches "effort_1")
    is_valid = any(
        action_name.lower() == va.lower()
        or action_name.lower() in va.lower()
        or va.lower() in action_name.lower()
        for va in valid_actions
    )

    if is_valid:
        return True, f"Valid action '{action_name}'", action_name
    else:
        return (
            False,
            f"Invalid action '{action_name}'. Valid options: {valid_actions}",
            action_name,
        )


# ============================================================================
# Role Alignment Evaluation
# ============================================================================

def check_role_alignment(
    output: str,
    agent: AgentProfile,
    scenario: ScenarioConfig,
) -> Tuple[bool, List[str]]:
    """
    Check if the output aligns with the agent's role and personality.

    This is a heuristic check - we look for keywords and tone consistency.

    Args:
        output: The LLM output
        agent: The agent profile
        scenario: The scenario configuration

    Returns:
        Tuple of (is_aligned, failure_reasons)
    """
    failures = []
    output_lower = output.lower()

    # Check if output mentions agent's name or role
    # This is a basic check - real evaluation would be more sophisticated

    # Check for personality traits in output
    personality_keywords = {
        "decisive": ["decide", "choose", "will", "must"],
        "critical": ["question", "why", "however", "but", "concern"],
        "cooperative": ["agree", "support", "together", "we", "us"],
        "logical": ["because", "therefore", "analyze", "data", "evidence"],
        "diplomatic": ["understand", "respect", "compromise", "middle"],
        "practical": ["do", "work", "need", "real", "actual"],
        "vigilant": ["watch", "check", "ensure", "protect", "careful"],
    }

    # Get personality keywords
    agent_personality = agent.personality.lower()
    found_personality_keywords = 0

    for trait, keywords in personality_keywords.items():
        if trait in agent_personality:
            if any(kw in output_lower for kw in keywords):
                found_personality_keywords += 1

    # Basic check: if the output is empty or too short, fail
    if len(output.strip()) < 20:
        failures.append("Output too short to assess role alignment")

    # If the output mentions contradictory stances, note it
    # (This is a simple heuristic)
    if "i don't know" in output_lower and "decisive" in agent_personality:
        failures.append("Agent claims indecision despite being decisive")

    is_aligned = len(failures) == 0
    return is_aligned, failures


# ============================================================================
# Error and Hallucination Detection
# ============================================================================

def check_errors_and_hallucinations(
    output: str,
    scenario: ScenarioConfig,
    agent: AgentProfile,
) -> Tuple[bool, str]:
    """
    Check for errors and hallucinations in the output.

    Args:
        output: The LLM output
        scenario: The scenario configuration
        agent: The agent profile

    Returns:
        Tuple of (no_errors, error_message)
    """
    output_lower = output.lower()

    # Check for common error indicators
    error_patterns = [
        ("i cannot", "Agent refuses to act"),
        ("i'm unable", "Agent indicates inability"),
        ("as an ai", "AI self-reference detected"),
        ("language model", "AI self-reference detected"),
        ("i don't have access", "Agent indicates limitation"),
        ("i apologize but", "Agent apologizes for inability"),
        ("<error>", "Error tag in output"),
        ("could not parse", "Parse error mentioned"),
        ("invalid input", "Invalid input mentioned"),
    ]

    for pattern, description in error_patterns:
        if pattern in output_lower:
            return False, f"Potential issue: {description}"

    # Check for action parameter errors
    sections = parse_xml_sections(output)
    action_section = sections.get("action", "")

    if action_section:
        # Check for malformed XML
        try:
            # Basic check - are tags balanced?
            open_tags = len(re.findall(r'<(\w+)', action_section))
            close_tags = len(re.findall(r'</(\w+)>', action_section))
            if open_tags > 0 and open_tags != close_tags:
                return False, "Unbalanced XML tags in action"
        except Exception:
            pass

    return True, ""


# ============================================================================
# Main Evaluation Function
# ============================================================================

def evaluate_output(
    output: str,
    scenario: ScenarioConfig,
    agent: AgentProfile,
) -> EvaluationResult:
    """
    Evaluate an LLM output against all success criteria.

    Args:
        output: The LLM output to evaluate
        scenario: The scenario that was tested
        agent: The agent profile that was used

    Returns:
        EvaluationResult with all evaluation details
    """
    result = EvaluationResult(
        xml_valid=False,
        action_correct=False,
        role_aligned=False,
        no_errors=False,
        overall_score=0,
    )

    # 1. Check XML format
    is_valid, xml_error = check_xml_format(output)
    result.xml_valid = is_valid
    if not is_valid:
        result.failure_reasons.append(f"XML format: {xml_error}")
    else:
        result.overall_score += 1

    # Parse sections for further checks
    sections = parse_xml_sections(output)
    result.parsed_thoughts = sections.get("thoughts")
    result.parsed_plan = sections.get("plan")

    # 2. Check action correctness
    action_correct, action_reason, action_name = check_action_correct(output, scenario)
    result.action_correct = action_correct
    result.parsed_action = action_name
    if not action_correct:
        result.failure_reasons.append(f"Action: {action_reason}")
    else:
        result.overall_score += 1

    # 3. Check role alignment
    role_aligned, role_failures = check_role_alignment(output, agent, scenario)
    result.role_aligned = role_aligned
    if not role_aligned:
        result.failure_reasons.extend([f"Role: {f}" for f in role_failures])
    else:
        result.overall_score += 1

    # 4. Check for errors/hallucinations
    no_errors, error_msg = check_errors_and_hallucinations(output, scenario, agent)
    result.no_errors = no_errors
    result.error_message = error_msg
    if not no_errors:
        result.failure_reasons.append(f"Errors: {error_msg}")
    else:
        result.overall_score += 1

    return result


# ============================================================================
# Batch Evaluation
# ============================================================================

@dataclass
class BatchEvaluationSummary:
    """Summary of evaluating multiple outputs."""

    total_evaluations: int = 0
    perfect_count: int = 0
    xml_valid_count: int = 0
    action_correct_count: int = 0
    role_aligned_count: int = 0
    no_errors_count: int = 0
    average_score: float = 0.0

    @property
    def pass_rate(self) -> float:
        """Percentage of perfect outputs."""
        if self.total_evaluations == 0:
            return 0.0
        return (self.perfect_count / self.total_evaluations) * 100


def evaluate_batch(
    outputs: List[str],
    scenario: ScenarioConfig,
    agent: AgentProfile,
) -> List[EvaluationResult]:
    """
    Evaluate multiple outputs.

    Args:
        outputs: List of LLM outputs
        scenario: The scenario that was tested
        agent: The agent profile that was used

    Returns:
        List of EvaluationResult objects
    """
    results = []
    for output in outputs:
        result = evaluate_output(output, scenario, agent)
        results.append(result)

    return results


def summarize_batch(results: List[EvaluationResult]) -> BatchEvaluationSummary:
    """Create a summary of batch evaluation results."""
    summary = BatchEvaluationSummary(
        total_evaluations=len(results),
    )

    for result in results:
        if result.is_perfect:
            summary.perfect_count += 1
        if result.xml_valid:
            summary.xml_valid_count += 1
        if result.action_correct:
            summary.action_correct_count += 1
        if result.role_aligned:
            summary.role_aligned_count += 1
        if result.no_errors:
            summary.no_errors_count += 1

    if results:
        summary.average_score = sum(r.overall_score for r in results) / len(results)

    return summary
