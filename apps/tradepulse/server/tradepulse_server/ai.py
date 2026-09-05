"""The AI chat drawer's model calls, made here rather than in the browser.

The first version of the drawer called Anthropic's API straight from the
page. With no key that fails; with a key the key would ship in the bundle to
everyone who loads it. Neither is a product. The call now goes through this
module: the key is read from the environment on the server, the system prompt
lives here, and the browser sends only the conversation.

With no key configured the drawer is told so, in words, rather than handed a
500 — an unconfigured feature must read as unconfigured, not broken.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Protocol

logger = logging.getLogger("tradepulse.ai")

MAX_TURNS = 24            # history the drawer may send; older turns are dropped
MAX_CHARS_PER_TURN = 4000
MAX_OUTPUT_TOKENS = 4096  # a few paragraphs; the drawer is a chat, not a report

SYSTEM_PROMPT = """You are an embedded market analyst inside TradePulse, a portfolio decision-support app for an Indian retail investor. The user may hold a diversified book across Indian equities, US equities, mutual funds, crypto and digital metals through several brokers.

Your job on this screen:
- Explain the reasoning behind a specific trading signal or opportunity in plain terms
- Discuss what current market/macro conditions are influencing it (Fed path, crude, RBI, USD/INR, sector rotation, geopolitics)
- Think through future scenarios: "if X prevails, then Y is likely; here's what to watch and what precautions to take"
- Always frame invalidation triggers — "this thesis breaks if..."
- Reference the three axes explicitly: Technical (chart), Fundamental (business), Macro (news/policy/rates)
- Stay SEBI-compliant: decision-support, never direct investment advice

Response style:
- Concise, structured, real numbers where relevant
- 2-4 short paragraphs typically, use lists only if necessary
- Speak with warmth but professional
- Acknowledge uncertainty honestly; don't overclaim
- If the question is unclear, ask one clarifying question"""

ACK = ("Got the context. Ask me anything about this call — the reasoning, "
       "current conditions affecting it, or future scenarios to watch.")

NOT_CONFIGURED = (
    "The AI chat is not configured on this server. Set ANTHROPIC_API_KEY on the "
    "backend to enable it. Nothing else on this screen depends on it."
)


class ModelClient(Protocol):
    """The slice of the Anthropic client this module uses; tests fake it."""

    class beta:  # noqa: N801 - mirrors the SDK's namespace shape
        class messages:  # noqa: N801
            @staticmethod
            def create(**kwargs: Any) -> Any: ...


@dataclass
class ChatReply:
    configured: bool
    reply: str | None
    model: str | None = None
    reason: str | None = None
    served_by: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {"configured": self.configured, "reply": self.reply, "model": self.model,
                "reason": self.reason, "served_by": self.served_by}


def build_client(api_key: str) -> ModelClient | None:
    """The real SDK client, or None when there is nothing to build it with."""
    if not api_key:
        return None
    import anthropic  # imported lazily so an unconfigured server never needs it at startup

    return anthropic.Anthropic(api_key=api_key)


class AIChat:
    def __init__(self, client: ModelClient | None, model: str):
        self.client = client
        self.model = model

    @property
    def configured(self) -> bool:
        return self.client is not None

    def status(self) -> dict[str, Any]:
        return {"configured": self.configured, "model": self.model if self.configured else None}

    def reply(self, context: str, history: list[dict[str, str]]) -> ChatReply:
        if self.client is None:
            return ChatReply(configured=False, reply=None, reason=NOT_CONFIGURED)

        turns = _sanitise(history)
        if not turns or turns[-1]["role"] != "user":
            return ChatReply(configured=True, reply=None, model=self.model,
                             reason="The last message must be from the user.")

        messages = [
            {"role": "user", "content": context[:MAX_CHARS_PER_TURN * 3] or "(no context)"},
            {"role": "assistant", "content": ACK},
            *turns,
        ]
        response = self.client.beta.messages.create(
            model=self.model,
            max_tokens=MAX_OUTPUT_TOKENS,
            system=SYSTEM_PROMPT,
            messages=messages,
            thinking={"type": "adaptive"},
            output_config={"effort": "medium"},
            # A policy decline re-runs on a fallback model inside the same
            # call, so the drawer gets an answer rather than a blank.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )

        if getattr(response, "stop_reason", None) == "refusal":
            return ChatReply(configured=True, reply=None, model=self.model,
                             reason="The model declined to answer this one.")

        text = "\n".join(
            block.text for block in getattr(response, "content", [])
            if getattr(block, "type", None) == "text"
        ).strip()
        return ChatReply(
            configured=True,
            reply=text or "I couldn't generate a response — try rephrasing?",
            model=self.model,
            served_by=getattr(response, "model", None),
        )


def _sanitise(history: list[dict[str, str]]) -> list[dict[str, str]]:
    """Only the roles the API accepts, trimmed, newest turns kept."""
    clean: list[dict[str, str]] = []
    for turn in history[-MAX_TURNS:]:
        role = str(turn.get("role", ""))
        content = str(turn.get("content", "")).strip()
        if role not in ("user", "assistant") or not content:
            continue
        clean.append({"role": role, "content": content[:MAX_CHARS_PER_TURN]})
    return clean
