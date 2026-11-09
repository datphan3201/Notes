"""Regression fixtures for the actual dependency-free documentation commands."""

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "check.py"
spec = importlib.util.spec_from_file_location("planner_docs", SCRIPT)
docs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(docs)


class DocumentationChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="planner-docs-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write("tools/docs/check.py", SCRIPT.read_text())
        for name in ("README.md", "AGENTS.md", "CLAUDE.md", "CHANGELOG.md"):
            self.write(name, "# Fixture\n")
        self.write(
            "docs/ui/notes/README.md",
            "# Notes\n\n<!-- BEGIN GENERATED TRACE -->\n<!-- END GENERATED TRACE -->\n",
        )
        self.write("docs/reference/.keep", "")
        self.write("apps/web/src/app/page.tsx", "export default function Page() {}\n")
        # Executing application imports would fail; AST inspection must not execute them.
        self.write(
            "apps/api/planner/main.py",
            """from planner import accounts
raise RuntimeError("Never execute application code")
app.include_router(accounts.router)
@app.get("/health")
def health(): pass
""",
        )
        self.write(
            "apps/api/planner/accounts.py",
            """router = APIRouter(prefix="/api/v1/auth")
@router.post("/login")
def login(): pass
""",
        )
        self.write(
            "apps/api/planner/worker_api.py",
            """@app.post("/internal/drain")
def drain(): pass
""",
        )
        self.write("apps/api/tests/test_notes.py", "def test_notes(): pass\n")
        self.registry = {
            "pages": [
                {
                    "id": "notes",
                    "doc": "docs/ui/notes/README.md",
                    "title": "Notes",
                    "routes": ["/"],
                    "sources": [
                        {
                            "path": "apps/web/src/app/page.tsx",
                            "symbol": "export default function Page()",
                            "role": "UI",
                        }
                    ],
                    "tests": ["apps/api/tests/test_notes.py"],
                }
            ],
            "browser": [
                {
                    "route": "/",
                    "source": "apps/web/src/app/page.tsx",
                    "doc": "docs/ui/notes/README.md",
                }
            ],
        }
        self.save_registry()

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return path

    def save_registry(self):
        self.write("docs/traceability.json", json.dumps(self.registry))

    def run_check(self, *args):
        return subprocess.run(
            [sys.executable, str(self.root / "tools/docs/check.py"), *args],
            capture_output=True,
            text=True,
            check=False,
        )

    def generate(self):
        result = self.run_check("--write")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_real_commands_generate_idempotently_without_importing_application(self):
        self.generate()
        before = (self.root / "docs/reference/routes.csv").read_bytes()
        result = self.run_check()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.generate()
        self.assertEqual(before, (self.root / "docs/reference/routes.csv").read_bytes())
        routes = (self.root / "docs/reference/routes.md").read_text()
        self.assertIn("/api/v1/auth/login", routes)
        self.assertIn("/internal/drain", routes)
        self.assertIn("3 declared API/worker routes", result.stdout)

    def test_new_mounted_router_is_inventoried_and_stale_output_fails(self):
        self.generate()
        main = self.root / "apps/api/planner/main.py"
        main.write_text(
            main.read_text()
            + "\nfrom planner.extra import router as extra_router\napp.include_router(extra_router)\n"
        )
        self.write(
            "apps/api/planner/extra.py",
            'router = APIRouter(prefix="/extra")\n@router.get("/new")\ndef new(): pass\n',
        )
        result = self.run_check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("generated content is stale", result.stderr)
        self.generate()
        self.assertIn(
            "/extra/new", (self.root / "docs/reference/routes.md").read_text()
        )

    def test_line_shift_requires_regeneration(self):
        self.generate()
        path = self.root / "apps/web/src/app/page.tsx"
        path.write_text("\n" + path.read_text())
        self.assertNotEqual(self.run_check().returncode, 0)
        self.generate()
        self.assertEqual(self.run_check().returncode, 0)

    def test_missing_or_ambiguous_symbol_fails(self):
        for content in (
            "export default function Other() {}\n",
            "export default function Page() {}\nexport default function Page() {}\n",
        ):
            with self.subTest(content=content):
                self.write("apps/web/src/app/page.tsx", content)
                result = self.run_check("--write")
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("expected one", result.stderr)

    def test_missing_test_target_fails(self):
        (self.root / "apps/api/tests/test_notes.py").unlink()
        self.assertIn("Missing test", self.run_check("--write").stderr)

    def test_new_ui_document_requires_registry_owner(self):
        self.write("docs/ui/tasks/README.md", "# Tasks\n")
        self.assertIn("UI ownership mismatch", self.run_check("--write").stderr)

    def test_new_page_file_requires_documentation_owner(self):
        self.write(
            "apps/web/src/app/tasks/page.tsx", "export default function Tasks() {}\n"
        )
        self.assertIn(
            "Browser page ownership mismatch", self.run_check("--write").stderr
        )

    def test_duplicate_feature_id_and_browser_owner_fail(self):
        self.registry["pages"].append(self.registry["pages"][0].copy())
        self.save_registry()
        self.assertIn("Duplicate page", self.run_check("--write").stderr)
        self.registry["pages"].pop()
        self.registry["browser"].append(self.registry["browser"][0].copy())
        self.save_registry()
        self.assertIn("Duplicate browser", self.run_check("--write").stderr)

    def test_wrong_browser_pattern_fails(self):
        self.registry["browser"][0]["route"] = "/invented"
        self.save_registry()
        self.assertIn("Browser pattern mismatch", self.run_check("--write").stderr)

    def test_duplicate_public_route_is_rejected_but_worker_is_separate(self):
        self.write(
            "apps/api/planner/accounts.py",
            '@router.get("/health")\ndef other(): pass\n',
        )
        self.assertIn("Duplicate API", self.run_check("--write").stderr)
        self.write(
            "apps/api/planner/accounts.py",
            '@router.get("/different")\ndef other(): pass\n',
        )
        self.write(
            "apps/api/planner/worker_api.py",
            '@app.get("/health")\ndef health(): pass\n',
        )
        self.generate()

    def test_missing_file_and_anchor_links_fail_real_command(self):
        self.generate()
        self.write(
            "README.md",
            "# Fixture\n[bad](docs/missing.md)\n[anchor](docs/ui/notes/README.md#absent)\n",
        )
        result = self.run_check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing docs/missing.md", result.stderr)
        self.assertIn("missing anchor", result.stderr)

    def test_valid_local_heading_and_line_links_and_fenced_examples(self):
        self.generate()
        self.write(
            "README.md",
            "# Fixture\n[ok](docs/ui/notes/README.md#notes)\n[source](apps/web/src/app/page.tsx#L1)\n```md\n[example](not-a-real-file.md)\n```\n[external](https://example.test/unavailable)\n",
        )
        self.assertEqual(self.run_check().returncode, 0)

    def test_out_of_bounds_source_line_and_reference_definition_fail(self):
        path = self.write(
            "README.md",
            "# Fixture\n[bad](apps/web/src/app/page.tsx#L99)\n[ref]: docs/missing.md\n",
        )
        with patch.object(docs, "ROOT", self.root):
            errors = docs.check_links([path])
        self.assertTrue(any("invalid line" in error for error in errors))
        self.assertTrue(any("missing docs/missing.md" in error for error in errors))

    def test_duplicate_heading_anchor_suffix_and_fenced_heading(self):
        found = docs.anchors("# A\n# A\n```\n# Fake\n```\n")
        self.assertEqual(found, {"a", "a-1"})

    def test_missing_or_repeated_trace_block_fails(self):
        self.write("docs/ui/notes/README.md", "# Notes\n")
        self.assertIn("expected one trace block", self.run_check("--write").stderr)

    def test_issue_summary_gap_and_duplicate_acceptance_ids_fail(self):
        self.generate()
        self.write(
            "docs/issues.md",
            """# Issues
Next unused ID: **ISSUE-003**
| ID | Issue |
| --- | --- |
| [ISSUE-001](#issue-001--one) | One |

| [ISSUE-002](#issue-002--two) | Two |
## ISSUE-001 — One
## ISSUE-002 — Two
""",
        )
        self.write(
            "docs/testing/manual-checklist.md",
            "# Plan\n- [ ] P01 — First\n- [ ] P01 — Repeated\n",
        )
        result = self.run_check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("contiguous summary table disagree", result.stderr)
        self.assertIn("duplicate acceptance case IDs", result.stderr)

    def test_issue_id_counter_must_exceed_existing_ids(self):
        self.generate()
        path = self.write(
            "docs/issues.md",
            """# Issues
Next unused ID: **ISSUE-001**
| ID | Issue |
| --- | --- |
| [ISSUE-001](#issue-001--one) | One |
## ISSUE-001 — One
""",
        )
        self.assertIn("next unused issue ID", self.run_check().stderr)
        path.write_text(
            path.read_text().replace("ID: **ISSUE-001**", "ID: **ISSUE-002**")
        )
        self.assertEqual(self.run_check().returncode, 0)


if __name__ == "__main__":
    unittest.main()
