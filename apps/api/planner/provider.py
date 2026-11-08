"""Small OpenAI-compatible protocol adapter; no provider credential reaches the browser."""

import json
import time
from collections.abc import Callable

import httpx

from planner.config import settings


def tools():
    from planner.assistant_tools import catalogue

    return catalogue()


class CompatibleProvider:
    def __init__(self):
        config = settings()
        self.config = config
        if not config.ai_api_key.get_secret_value() or not config.ai_model:
            raise RuntimeError("AI_NOT_CONFIGURED")

    def client(self):
        return httpx.Client(
            base_url=self.config.ai_base_url.rstrip("/") + "/",
            headers={"Authorization": "Bearer " + self.config.ai_api_key.get_secret_value()},
            timeout=httpx.Timeout(60, connect=10),
        )

    def embed(self, texts: list[str]):
        if not self.config.embedding_model:
            return [None] * len(texts)
        with self.client() as client:
            result = client.post(
                "embeddings",
                json={
                    "model": self.config.embedding_model,
                    "input": texts,
                    "dimensions": self.config.embedding_dimensions,
                },
            )
            result.raise_for_status()
            rows = result.json()["data"]
            # Gemini's compatible endpoint returns input-ordered entries without indexes.
            if all("index" in row for row in rows):
                rows = sorted(rows, key=lambda row: row["index"])
            if len(rows) != len(texts) or any(len(row["embedding"]) != 1536 for row in rows):
                raise ValueError("EMBEDDING_DIMENSION_MISMATCH")
            return [row["embedding"] for row in rows]

    def stream(self, messages: list[dict], on_text: Callable[[str], None]):
        deadline = time.monotonic() + 120
        answer, calls, usage = "", {}, {"prompt_tokens": 0, "completion_tokens": 0}
        with (
            self.client() as client,
            client.stream(
                "POST",
                "chat/completions",
                json={
                    "model": self.config.ai_model,
                    "messages": messages,
                    "tools": tools(),
                    "stream": True,
                    "stream_options": {"include_usage": True},
                    "max_completion_tokens": 6000,
                },
            ) as response,
        ):
            response.raise_for_status()
            for line in response.iter_lines():
                if time.monotonic() > deadline:
                    raise TimeoutError("PROVIDER_STREAM_DEADLINE")
                if not line.startswith("data: ") or line == "data: [DONE]":
                    continue
                event = json.loads(line[6:])
                if event.get("usage"):
                    usage = event["usage"]
                if not event.get("choices"):
                    continue
                delta = event["choices"][0].get("delta", {})
                if delta.get("content"):
                    text = delta["content"]
                    answer += text
                    if len(answer) > 20_000:
                        raise ValueError("OUTPUT_LIMIT")
                    on_text(text)
                for call in delta.get("tool_calls", []):
                    index = call.get("index")
                    if index is None:
                        index = next(
                            (
                                key
                                for key, value in calls.items()
                                if call.get("id") and value["id"] == call["id"]
                            ),
                            None,
                        )
                        if index is None:
                            index = len(calls) if call.get("id") else max(calls, default=0)
                    entry = calls.setdefault(
                        index,
                        {"id": "", "type": "function", "function": {"name": "", "arguments": ""}},
                    )
                    if call.get("id"):
                        entry["id"] = call["id"]
                    if call.get("extra_content"):
                        entry["extra_content"] = call["extra_content"]
                    function = call.get("function", {})
                    entry["function"]["name"] += function.get("name", "")
                    entry["function"]["arguments"] += function.get("arguments", "")
                    if len(entry["function"]["arguments"]) > 20_000 or len(calls) > 8:
                        raise ValueError("TOOL_LIMIT")
        return {
            "role": "assistant",
            "content": answer or None,
            **({"tool_calls": list(calls.values())} if calls else {}),
        }, usage
