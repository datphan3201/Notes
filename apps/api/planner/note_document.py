"""Validate the supported rich Note schema and derive its searchable text."""

import json
import re
from urllib.parse import urlsplit

BLOCKS = {"paragraph", "heading", "bulletList", "orderedList", "taskList", "blockquote", "codeBlock"}
INLINE = {"text", "hardBreak"}
MARKS = {"bold", "italic", "strike", "highlight", "code", "link"}


def document_text(document: dict) -> str:
    if len(json.dumps(document, ensure_ascii=False)) > 500_000:
        raise ValueError("Note formatting is too large")
    count = 0

    def visit(node, depth=0):
        nonlocal count
        count += 1
        if depth > 32 or count > 10000 or not isinstance(node, dict):
            raise ValueError("Invalid Note document structure")
        if set(node) - {"type", "attrs", "content", "text", "marks"}:
            raise ValueError("Unsupported Note document fields")
        kind = node.get("type")
        if kind not in BLOCKS | INLINE | {"doc", "listItem", "taskItem"}:
            raise ValueError("Unsupported Note document node")
        attrs = node.get("attrs", {})
        if not isinstance(attrs, dict):
            raise ValueError("Invalid Note attributes")
        allowed = {
            "paragraph": {"indent"}, "heading": {"indent", "level"},
            "orderedList": {"start", "type"}, "taskItem": {"checked"},
            "codeBlock": {"language"},
        }.get(kind, set())
        if set(attrs) - allowed:
            raise ValueError("Unsupported Note attributes")
        indent = attrs.get("indent", 0)
        if type(indent) is not int or not 0 <= indent <= 8:
            raise ValueError("Invalid Note indentation")
        if kind == "heading" and (type(attrs.get("level")) is not int or attrs["level"] not in (1, 2, 3)):
            raise ValueError("Choose heading level 1, 2 or 3")
        if kind == "taskItem" and type(attrs.get("checked")) is not bool:
            raise ValueError("Invalid Note checkbox")
        if kind == "orderedList":
            start = attrs.get("start", 1)
            if type(start) is not int or not 1 <= start <= 10000 or attrs.get("type") not in (None, "1"):
                raise ValueError("Invalid numbered list")
        if kind == "codeBlock" and attrs.get("language") is not None and not (isinstance(attrs["language"], str) and re.fullmatch(r"[A-Za-z0-9_+#.\-]{0,40}", attrs["language"])):
            raise ValueError("Unsupported code language")
        marks = node.get("marks", [])
        if not isinstance(marks, list) or len(marks) > 6 or (marks and kind != "text"):
            raise ValueError("Invalid Note text formatting")
        for mark in marks:
            if not isinstance(mark, dict) or set(mark) - {"type", "attrs"} or mark.get("type") not in MARKS:
                raise ValueError("Unsupported Note text formatting")
            attributes = mark.get("attrs", {})
            if not isinstance(attributes, dict):
                raise ValueError("Invalid Note mark attributes")
            if mark["type"] == "link":
                if set(attributes) - {"href", "target", "rel", "class"}:
                    raise ValueError("Unsupported link attributes")
                href = attributes.get("href", "")
                if not isinstance(href, str) or len(href) > 2048 or urlsplit(href).scheme.lower() not in ("http", "https", "mailto"):
                    raise ValueError("Use an http, https or mailto link")
                if attributes.get("target") not in (None, "_blank", "_self") or attributes.get("class") is not None:
                    raise ValueError("Invalid link attributes")
                if attributes.get("rel") not in (None, "noopener noreferrer nofollow", "noopener noreferrer"):
                    raise ValueError("Invalid link relationship")
            elif attributes:
                raise ValueError("Unsupported formatting attributes")
        children = node.get("content", [])
        if not isinstance(children, list):
            raise ValueError("Invalid Note content")
        if kind == "text":
            if children or not isinstance(node.get("text"), str) or not node["text"]:
                raise ValueError("Invalid Note text")
            return node["text"]
        if "text" in node:
            raise ValueError("Only text nodes contain text")
        if kind == "hardBreak":
            if children:
                raise ValueError("Invalid Note line break")
            return "\n"
        permitted = INLINE if kind in ("paragraph", "heading") else {"text"} if kind == "codeBlock" else {"listItem"} if kind in ("bulletList", "orderedList") else {"taskItem"} if kind == "taskList" else BLOCKS
        if any(not isinstance(child, dict) or child.get("type") not in permitted for child in children):
            raise ValueError("Invalid Note block nesting")
        if kind in ("listItem", "taskItem") and (not children or children[0].get("type") != "paragraph"):
            raise ValueError("List items start with a paragraph")
        parts = [visit(child, depth + 1) for child in children]
        result = ("" if kind in ("paragraph", "heading", "codeBlock") else "\n").join(parts)
        if kind == "taskItem":
            result = ("- [x] " if attrs["checked"] else "- [ ] ") + result
        return "\t" * indent + result

    if not isinstance(document, dict) or document.get("type") != "doc":
        raise ValueError("Note document must be a document")
    result = visit(document)
    if len(result) > 100_000:
        raise ValueError("Note text exceeds 100000 characters")
    return result
