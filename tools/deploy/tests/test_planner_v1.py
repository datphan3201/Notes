"""Deployment command contracts; never invoke a server, cloud CLI or live database."""

import argparse
import importlib.util
import io
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "planner_deploy", Path(__file__).parents[1] / "planner_v1.py"
)
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class DeploymentRoutes(unittest.TestCase):
    def test_render_backend_plan_keeps_api_origin_without_starting_funnel(self):
        output = io.StringIO()
        with redirect_stdout(output), patch.object(deploy.subprocess, "run") as run:
            deploy.main([
                "vercel", "--backend", "https://planner-api.onrender.com",
                "--origin", "https://planner.vercel.app",
            ])
        run.assert_not_called()
        self.assertIn("API_ORIGIN=https://planner-api.onrender.com", output.getvalue())
        self.assertIn("render-vercel-supabase.md", output.getvalue())
        self.assertNotIn("funnel --vercel-origin", output.getvalue())

    def test_plan_does_not_execute_and_matches_funnel_backend_contract(self):
        with patch.object(deploy.subprocess, "run") as run:
            deploy.main(["funnel", "--vercel-origin", "https://planner.vercel.app"])
            deploy.main(
                [
                    "vercel",
                    "--backend",
                    "https://planner.example.ts.net",
                    "--origin",
                    "https://planner.vercel.app",
                ]
            )
            run.assert_not_called()

    def test_execution_uses_argument_arrays_and_forwards_only_public_origin(self):
        with (
            patch.object(deploy.subprocess, "run") as run,
            patch.object(deploy.shutil, "which", return_value="/usr/bin/vercel"),
        ):
            deploy.main(
                [
                    "vercel",
                    "--backend",
                    "https://planner.example.ts.net",
                    "--origin",
                    "https://planner.vercel.app",
                    "--execute",
                ]
            )
            args, kwargs = run.call_args
            self.assertEqual(
                args[0][-4:],
                [
                    "--build-env",
                    "API_ORIGIN=https://planner.example.ts.net",
                    "--env",
                    "API_ORIGIN=https://planner.example.ts.net",
                ],
            )
            self.assertNotIn("shell", kwargs)
        args = argparse.Namespace(route="funnel", vercel_origin="https://planner.vercel.app")
        _, env = deploy.command_for(args)
        self.assertEqual(env, {"PLANNER_PRIMARY_WEB_ORIGIN": "https://planner.vercel.app"})

    def test_unsafe_origins_and_proxy_loops_are_rejected(self):
        for value in [
            "http://example.com",
            "https://*.vercel.app",
            "https://user:secret@example.com",
            "https://example.com/path",
            "https://example.com?x=y",
        ]:
            with self.subTest(value=value), self.assertRaises(argparse.ArgumentTypeError):
                deploy.https_origin(value)
        args = argparse.Namespace(
            route="vercel", backend="https://same.example", origin="https://same.example"
        )
        with self.assertRaisesRegex(ValueError, "loop"):
            deploy.command_for(args)


if __name__ == "__main__":
    unittest.main()
