#!/usr/bin/env python3
"""Check local documentation and generate source indexes without importing the app."""

import argparse
import ast
import csv
import io
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
METHODS = {"get", "head", "post", "put", "patch", "delete", "options"}


def link(source, target, line=None):
    relative = os.path.relpath(ROOT / target, (ROOT / source).parent)
    return f"[{target}]({relative}" + (f"#L{line}" if line else "") + ")"


def locate(ref):
    path = ROOT / ref["path"]
    content = path.read_text()
    symbol = ref["symbol"]
    matches = [i for i, line in enumerate(content.splitlines(), 1) if symbol in line]
    if len(matches) != 1:
        raise ValueError(
            f"{ref['path']}: expected one {symbol!r}, found {len(matches)}"
        )
    return matches[0]


def api_routes():
    # These are the modules mounted by main.py and the separate private worker app.
    main = ast.parse((ROOT / "apps/api/planner/main.py").read_text())
    imports = {}
    for node in main.body:
        if isinstance(node, ast.ImportFrom) and node.module:
            for name in node.names:
                if name.name == "router":
                    imports[name.asname or name.name] = node.module.split(".")[-1]
                elif node.module == "planner":
                    imports[name.asname or name.name] = name.name
    modules = {"main", "worker_api"}
    for node in ast.walk(main):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "include_router"
        ):
            arg = node.args[0]
            key = arg.id if isinstance(arg, ast.Name) else arg.value.id
            modules.add(imports[key])
    rows = []
    for module in sorted(modules):
        path = f"apps/api/planner/{module}.py"
        tree = ast.parse((ROOT / path).read_text())
        prefix = ""
        for node in tree.body:
            if (
                isinstance(node, ast.Assign)
                and isinstance(node.value, ast.Call)
                and isinstance(node.value.func, ast.Name)
                and node.value.func.id == "APIRouter"
            ):
                prefix = next(
                    (
                        ast.literal_eval(k.value)
                        for k in node.value.keywords
                        if k.arg == "prefix"
                    ),
                    "",
                )
        for node in tree.body:
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for decorator in node.decorator_list:
                if not isinstance(decorator, ast.Call) or not isinstance(
                    decorator.func, ast.Attribute
                ):
                    continue
                if (
                    decorator.func.attr not in METHODS
                    or not isinstance(decorator.func.value, ast.Name)
                    or decorator.func.value.id not in {"app", "router"}
                ):
                    continue
                route = prefix + ast.literal_eval(decorator.args[0])
                rows.append(
                    {
                        "surface": "worker" if module == "worker_api" else "api",
                        "method": decorator.func.attr.upper(),
                        "route": route,
                        "source": path,
                        "line": node.lineno,
                        "handler": node.name,
                    }
                )
    keys = [(r["surface"], r["method"], r["route"]) for r in rows]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate API method/path on the same surface")
    return sorted(rows, key=lambda r: (r["surface"], r["route"], r["method"]))


def generated(registry):
    pages = registry["pages"]
    ids = [p["id"] for p in pages]
    docs = [p["doc"] for p in pages]
    if len(ids) != len(set(ids)) or len(docs) != len(set(docs)):
        raise ValueError("Duplicate page id or documentation owner")
    ui_docs = {str(p.relative_to(ROOT)) for p in (ROOT / "docs/ui").rglob("*.md")}
    if ui_docs != set(docs):
        raise ValueError(f"UI ownership mismatch: {ui_docs.symmetric_difference(docs)}")
    browser = registry["browser"]
    actual = {
        str(p.relative_to(ROOT)) for p in (ROOT / "apps/web/src/app").rglob("page.tsx")
    }
    owned = {b["source"] for b in browser}
    if actual != owned:
        raise ValueError(
            f"Browser page ownership mismatch: {actual.symmetric_difference(owned)}"
        )
    if len(owned) != len(browser):
        raise ValueError("Duplicate browser page owner")
    for entry in browser:
        relative = Path(entry["source"]).relative_to("apps/web/src/app")
        expected = "/" + "/".join(relative.parts[:-1])
        if entry["route"] != expected:
            raise ValueError(
                f"Browser pattern mismatch for {entry['source']}: {expected}"
            )
    outputs = {}
    component_rows, source_rows = [], {}
    for page in pages:
        doc = page["doc"]
        content = (ROOT / doc).read_text()
        begin, end = "<!-- BEGIN GENERATED TRACE -->", "<!-- END GENERATED TRACE -->"
        if content.count(begin) != 1 or content.count(end) != 1:
            raise ValueError(f"{doc}: expected one trace block")
        block = "\n\n## Source and verification map\n\n"
        block += f"Trace ID: `{page['id']}`. Test references identify coverage to inspect; they are not execution results.\n\n"
        block += "| Role | Current source |\n| --- | --- |\n"
        for ref in page["sources"]:
            line = locate(ref)
            block += f"| {ref['role']} | {link(doc, ref['path'], line)} — `{ref['symbol']}` |\n"
            source_rows.setdefault(ref["path"], []).append(doc)
        for path in page["tests"]:
            if not (ROOT / path).is_file():
                raise ValueError(f"Missing test {path}")
            block += f"| Related tests | {link(doc, path)} |\n"
            source_rows.setdefault(path, []).append(doc)
        outputs[doc] = (
            content.split(begin)[0] + begin + block + "\n" + end + content.split(end)[1]
        )
        component_rows.append(
            f"| `{page['id']}` | [{page['title']}]({os.path.relpath(ROOT / doc, ROOT / 'docs/reference')}) | {'; '.join('`' + r + '`' for r in page['routes'])} |"
        )
    outputs["docs/reference/components.md"] = (
        "# Component lookup\n\nGenerated from [traceability.json](../traceability.json). One owner per current feature document; source maps distinguish UI, services and related tests.\n\n| Trace ID | Feature | Browser surface |\n| --- | --- | --- |\n"
        + "\n".join(component_rows)
        + "\n"
    )
    outputs["docs/reference/source-index.md"] = (
        "# Source lookup\n\nGenerated from [traceability.json](../traceability.json). These are direct registered consumers, not an exhaustive transitive dependency graph.\n\n| Source | Feature documentation |\n| --- | --- |\n"
        + "\n".join(
            f"| {link('docs/reference/source-index.md', path)} | "
            + ", ".join(
                f"[{Path(doc).parent.name}/{Path(doc).stem}]({os.path.relpath(ROOT / doc, ROOT / 'docs/reference')})"
                for doc in sorted(set(owners))
            )
            + " |"
            for path, owners in sorted(source_rows.items())
        )
        + "\n"
    )
    routes = api_routes()
    route_doc = "docs/reference/routes.md"
    text = "# Route inventory\n\nGenerated by `python3 tools/docs/check.py --write` without application imports, credentials or database access.\n\n## Browser pages\n\nThese are Next.js page-file patterns. Dynamic handlers restrict accepted sections/actions; inspect the linked handler. Authentication and object access are enforced by subsequent API requests. Preview routes use synthetic data.\n\n| Pattern | Page source | Documentation |\n| --- | --- | --- |\n"
    for b in browser:
        if not (ROOT / b["doc"]).is_file():
            raise ValueError(f"Missing browser documentation {b['doc']}")
        text += f"| `{b['route']}` | {link(route_doc, b['source'])} | {link(route_doc, b['doc'])} |\n"
    text += "\n## API and private worker\n\nPaths are declared patterns; `{kind}` accepts only the eight models listed in `planning.MODELS`. Worker paths belong to `planner.worker_api:app`, which is separate from the Render public API. Authorization/body requirements must be read at the handler and its dependencies; this list does not imply anonymous access.\n\nFastAPI also supplies `/openapi.json` and `/redoc`; `/docs` is disabled in production. Those framework routes are configured by the FastAPI constructor and are outside the decorator table. Next.js supplies `/manifest.webmanifest` and `/icon.svg`, and serves public assets.\n\n| Surface | Method | Path | Handler |\n| --- | --- | --- | --- |\n"
    csv_buffer = io.StringIO(newline="")
    writer = csv.writer(csv_buffer, lineterminator="\n")
    writer.writerow(
        ["surface", "method", "path", "source", "handler", "result", "notes"]
    )
    for b in browser:
        writer.writerow(["browser", "GET", b["route"], b["source"], "", "", ""])
    for r in routes:
        text += f"| {r['surface']} | {r['method']} | `{r['route']}` | {link(route_doc, r['source'], r['line'])} — `{r['handler']}` |\n"
        writer.writerow(
            [r["surface"], r["method"], r["route"], r["source"], r["handler"], "", ""]
        )
    outputs[route_doc] = text
    outputs["docs/reference/routes.csv"] = csv_buffer.getvalue()
    return outputs


def anchors(content):
    content = re.sub(r"```.*?```", "", content, flags=re.DOTALL)
    found, counts = set(), {}
    for heading in re.findall(r"^#{1,6}\s+(.+?)\s*#*\s*$", content, re.MULTILINE):
        slug = re.sub(r"[^\w\- ]", "", heading.replace("`", "").lower()).replace(
            " ", "-"
        )
        count = counts.get(slug, 0)
        counts[slug] = count + 1
        found.add(slug + (f"-{count}" if count else ""))
    found.update(re.findall(r'(?:id|name)=["\']([^"\']+)["\']', content))
    return found


def check_links(paths):
    errors = []
    for source in paths:
        content = source.read_text()
        # Literal links in examples inside code fences are not navigation.
        content = re.sub(r"```.*?```", "", content, flags=re.DOTALL)
        targets = re.findall(r"\]\(([^\n]*?)\)", content)
        targets += re.findall(r"^\[[^\]]+\]:\s*(\S+)", content, re.MULTILINE)
        for raw in targets:
            target = raw.strip().split(' "')[0].strip("<>")
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc or target.startswith("/"):
                continue
            path = (
                (source.parent / unquote(parsed.path)).resolve()
                if parsed.path
                else source
            )
            if not path.exists():
                errors.append(f"{source.relative_to(ROOT)}: missing {target}")
                continue
            fragment = unquote(parsed.fragment)
            if (
                fragment
                and path.suffix == ".md"
                and fragment not in anchors(path.read_text())
            ):
                errors.append(f"{source.relative_to(ROOT)}: missing anchor {target}")
            elif (
                fragment
                and path.is_file()
                and re.fullmatch(r"L\d+(?:-L\d+)?", fragment)
            ):
                line = int(fragment[1:].split("-")[0])
                if line < 1 or line > len(path.read_text().splitlines()):
                    errors.append(f"{source.relative_to(ROOT)}: invalid line {target}")
    return errors


def check_issue_and_case_ids():
    errors = []
    issue_file = ROOT / "docs/issues.md"
    if issue_file.exists():
        content = issue_file.read_text()
        headings = re.findall(r"^## ISSUE-(\d+) —", content, re.MULTILINE)
        table = re.search(r"^\| ID \|.*(?:\n\|.*)+", content, re.MULTILINE)
        listed = re.findall(r"\[ISSUE-(\d+)\]", table.group() if table else "")
        if len(headings) != len(set(headings)) or sorted(headings) != sorted(listed):
            errors.append(
                "docs/issues.md: issue headings and contiguous summary table disagree"
            )
        next_id = re.search(r"Next unused ID: \*\*ISSUE-(\d+)\*\*", content)
        if headings and (not next_id or int(next_id[1]) <= max(map(int, headings))):
            errors.append(
                "docs/issues.md: next unused issue ID must exceed every current ID"
            )
    checklist = ROOT / "docs/testing/manual-checklist.md"
    if checklist.exists():
        ids = re.findall(
            r"^- \[[ xX]\] ([A-Z]+\d+) —", checklist.read_text(), re.MULTILINE
        )
        if len(ids) != len(set(ids)):
            errors.append(
                "docs/testing/manual-checklist.md: duplicate acceptance case IDs"
            )
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--write",
        action="store_true",
        help="Refresh generated trace blocks and indexes",
    )
    args = parser.parse_args()
    try:
        registry = json.loads((ROOT / "docs/traceability.json").read_text())
        outputs = generated(registry)
        errors = []
        for name, content in outputs.items():
            path = ROOT / name
            if args.write:
                path.write_text(content)
            elif not path.exists() or path.read_text() != content:
                errors.append(f"{name}: generated content is stale (run --write)")
        paths = sorted((ROOT / "docs").rglob("*.md"))
        paths += [
            ROOT / name
            for name in ("README.md", "AGENTS.md", "CLAUDE.md", "CHANGELOG.md")
        ]
        paths += sorted((ROOT / ".ai").rglob("*.md"))
        paths += sorted((ROOT / ".agents").rglob("*.md"))
        paths += sorted((ROOT / ".claude").rglob("*.md"))
        paths += list((ROOT / "apps").rglob("AGENTS.md"))
        paths += sorted((ROOT / "apps/web/src").rglob("*.md"))
        errors.extend(check_links(paths))
        errors.extend(check_issue_and_case_ids())
    except (ValueError, KeyError, OSError, SyntaxError) as exc:
        print(f"Documentation error: {exc}", file=sys.stderr)
        return 1
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(
        f"Documentation checks passed: {len(paths)} Markdown files, {len(registry['pages'])} feature owners, {len(api_routes())} declared API/worker routes."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
