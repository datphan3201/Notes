import json

import httpx
import pytest
from pydantic import SecretStr

from planner.config import settings
from planner.provider import CompatibleProvider


@pytest.mark.parametrize("indexed", [False, True], ids=["gemini-ordered", "openai-indexed"])
def test_embedding_adapter_preserves_input_order_with_both_response_formats(monkeypatch, indexed):
    config = settings()
    monkeypatch.setattr(config, "ai_api_key", SecretStr("synthetic-provider-key"))
    monkeypatch.setattr(config, "ai_model", "synthetic-chat")
    monkeypatch.setattr(config, "embedding_model", "synthetic-embedding")
    first, second = [1.0] + [0.0] * 1535, [0.0, 1.0] + [0.0] * 1534
    rows = [{"embedding": first}, {"embedding": second}]
    if indexed:
        rows = [{"index": 1, "embedding": second}, {"index": 0, "embedding": first}]

    def respond(request):
        payload = json.loads(request.content)
        assert payload["input"] == ["first", "second"]
        assert payload["dimensions"] == 1536
        return httpx.Response(200, json={"data": rows})

    provider = CompatibleProvider()
    monkeypatch.setattr(
        provider,
        "client",
        lambda: httpx.Client(
            base_url="https://synthetic-provider.invalid/", transport=httpx.MockTransport(respond)
        ),
    )
    assert provider.embed(["first", "second"]) == [first, second]


def test_streamed_tool_calls_preserve_provider_metadata_for_the_next_round(monkeypatch):
    config = settings()
    monkeypatch.setattr(config, "ai_api_key", SecretStr("synthetic-provider-key"))
    monkeypatch.setattr(config, "ai_model", "synthetic-chat")
    signature = {"google": {"thought_signature": "synthetic-signature"}}

    def respond(request):
        payload = json.loads(request.content)
        if len(payload["messages"]) == 1:
            events = [
                {
                    "choices": [
                        {
                            "delta": {
                                "tool_calls": [
                                    {
                                        "id": "call1",
                                        "type": "function",
                                        "function": {"name": "list_areas", "arguments": "{"},
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    "choices": [
                        {
                            "delta": {
                                "tool_calls": [
                                    {"function": {"arguments": "}"}, "extra_content": signature}
                                ]
                            },
                            "finish_reason": "stop",
                        }
                    ]
                },
            ]
        else:
            assert payload["messages"][1]["tool_calls"][0]["extra_content"] == signature
            events = [{"choices": [{"delta": {"content": "Ready for the next tool"}}]}]
        return httpx.Response(
            200,
            text="".join("data: " + json.dumps(event) + "\n\n" for event in events)
            + "data: [DONE]\n\n",
        )

    provider = CompatibleProvider()
    monkeypatch.setattr(
        provider,
        "client",
        lambda: httpx.Client(
            base_url="https://synthetic-provider.invalid/", transport=httpx.MockTransport(respond)
        ),
    )
    messages = [{"role": "user", "content": "Use tools"}]
    reply, _ = provider.stream(messages, lambda text: None)
    assert reply["tool_calls"][0]["function"]["arguments"] == "{}"
    messages.extend([reply, {"role": "tool", "tool_call_id": "call1", "content": "[]"}])
    result, _ = provider.stream(messages, lambda text: None)
    assert result["content"] == "Ready for the next tool"


def test_parallel_gemini_calls_without_indexes_do_not_merge_function_names(monkeypatch):
    monkeypatch.setattr(settings(), "ai_api_key", SecretStr("synthetic-provider-key"))
    monkeypatch.setattr(settings(), "ai_model", "synthetic-chat")
    events = [
        {
            "choices": [
                {
                    "delta": {
                        "tool_calls": [
                            {"id": identifier, "function": {"name": name, "arguments": "{}"}}
                        ]
                    }
                }
            ]
        }
        for identifier, name in [("first", "list_areas"), ("second", "search_goals")]
    ]
    provider = CompatibleProvider()
    monkeypatch.setattr(
        provider,
        "client",
        lambda: httpx.Client(
            base_url="https://synthetic.invalid/",
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200, text="".join("data: " + json.dumps(event) + "\n\n" for event in events)
                )
            ),
        ),
    )
    result, _ = provider.stream([{"role": "user", "content": "Read context"}], lambda chunk: None)
    assert [call["function"]["name"] for call in result["tool_calls"]] == [
        "list_areas",
        "search_goals",
    ]
