from __future__ import annotations

import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class RuleBasedFallbackModel:
    id: str = "rule-based-fallback"
    provider: str = "rules"


def get_model(*, allow_rule_fallback: bool = False):
    if os.getenv("ANTHROPIC_API_KEY"):
        from agno.models.anthropic import Claude

        return Claude(id="claude-haiku-5-5", thinking={"type": "disabled"})

    if os.getenv("GROQ_API_KEY"):
        from agno.models.groq import Groq

        return Groq(id="openai/gpt-oss-120b")

    if allow_rule_fallback:
        return RuleBasedFallbackModel()

    raise RuntimeError(
        "Defina ANTHROPIC_API_KEY ou GROQ_API_KEY no arquivo .env para usar um LLM."
    )