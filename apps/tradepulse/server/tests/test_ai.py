"""The AI chat drawer's calls go through the server, never the browser."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from tradepulse_server.ai import MAX_TURNS, SYSTEM_PROMPT, AIChat
from tradepulse_server.app import create_app
from tradepulse_server.config import Settings


class FakeMessages:
    def __init__(self, *, text="A short, honest answer.", stop_reason="end_turn"):
        self.calls: list[dict] = []
        self._text = text
        self._stop = stop_reason

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            stop_reason=self._stop, model=kwargs["model"],
            content=[SimpleNamespace(type="text", text=self._text)],
        )


class FakeClient:
    def __init__(self, **kw):
        self.beta = SimpleNamespace(messages=FakeMessages(**kw))


def test_unconfigured_says_so_instead_of_failing():
    chat = AIChat(client=None, model="claude-opus-5")
    reply = chat.reply("ctx", [{"role": "user", "content": "why?"}])
    assert reply.configured is False
    assert reply.reply is None
    assert "ANTHROPIC_API_KEY" in reply.reason


def test_a_configured_chat_returns_the_model_text():
    client = FakeClient()
    chat = AIChat(client=client, model="claude-opus-5")
    reply = chat.reply("SYMBOL: TCS", [{"role": "user", "content": "Why this call?"}])
    assert reply.configured and reply.reply == "A short, honest answer."
    assert reply.served_by == "claude-opus-5"

    call = client.beta.messages.calls[0]
    assert call["system"] == SYSTEM_PROMPT             # prompt lives on the server
    assert call["messages"][0] == {"role": "user", "content": "SYMBOL: TCS"}
    assert call["messages"][-1] == {"role": "user", "content": "Why this call?"}
    assert call["thinking"] == {"type": "adaptive"}
    assert call["fallbacks"] == "default"


def test_history_is_trimmed_and_only_valid_roles_survive():
    client = FakeClient()
    chat = AIChat(client=client, model="claude-opus-5")
    history = [{"role": "system", "content": "ignore me"}]
    # An odd count, so the newest turn is the user's — the reply is refused
    # otherwise, which is the right behaviour and a different test.
    count = MAX_TURNS + 11
    history += [{"role": "user" if i % 2 == 0 else "assistant", "content": f"t{i}"}
                for i in range(count)]
    reply = chat.reply("ctx", history)
    assert reply.reply, reply.reason
    sent = client.beta.messages.calls[0]["messages"][2:]     # after context + ack
    assert len(sent) <= MAX_TURNS
    assert all(t["role"] in ("user", "assistant") for t in sent)
    assert sent[-1]["content"] == f"t{count - 1}"


def test_a_refusal_is_reported_as_a_decline_not_an_error():
    chat = AIChat(client=FakeClient(stop_reason="refusal"), model="claude-opus-5")
    reply = chat.reply("ctx", [{"role": "user", "content": "…"}])
    assert reply.reply is None and "declined" in reply.reason


def test_the_last_turn_must_be_the_users():
    chat = AIChat(client=FakeClient(), model="claude-opus-5")
    reply = chat.reply("ctx", [{"role": "assistant", "content": "hello"}])
    assert reply.reply is None and "user" in reply.reason


# --- through the API --------------------------------------------------------

SETTINGS = Settings(
    auth_required=False,   # the lock has its own suite; this one tests the route
    intel_db_path=":memory:", state_secret="s",
)


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(SETTINGS))


def test_status_reports_unconfigured_without_a_key(client: TestClient):
    assert client.get("/api/ai/status").json() == {"configured": False, "model": None}


def test_chat_route_answers_in_words_without_a_key(client: TestClient):
    body = client.post("/api/ai/chat", json={
        "context": "SYMBOL: RELIANCE", "messages": [{"role": "user", "content": "why?"}],
    }).json()
    assert body["configured"] is False
    assert "ANTHROPIC_API_KEY" in body["reason"]


def test_chat_route_uses_the_injected_client(client: TestClient):
    client.app.state.ai = AIChat(client=FakeClient(text="Because."), model="claude-opus-5")
    body = client.post("/api/ai/chat", json={
        "context": "SYMBOL: RELIANCE", "messages": [{"role": "user", "content": "why?"}],
    }).json()
    assert body == {"configured": True, "reply": "Because.", "model": "claude-opus-5",
                    "reason": None, "served_by": "claude-opus-5"}


def test_the_key_is_never_in_any_response(client: TestClient):
    app = create_app(Settings(auth_required=False, intel_db_path=":memory:",
                              state_secret="s", anthropic_api_key="sk-ant-secret-123"))
    app.state.ai = AIChat(client=FakeClient(), model="claude-opus-5")
    c = TestClient(app)
    for path in ("/api/ai/status", "/healthz", "/api/kite/status"):
        assert "sk-ant" not in c.get(path).text
    assert "sk-ant" not in c.post("/api/ai/chat", json={
        "context": "x", "messages": [{"role": "user", "content": "y"}]}).text


def test_chat_is_behind_the_login():
    app = create_app(Settings(intel_db_path=":memory:", state_secret="s", passcode="p"))
    c = TestClient(app)
    assert c.post("/api/ai/chat", json={"messages": []}).status_code == 401
    assert c.get("/api/ai/status").status_code == 401
