# /settings/reports — Report a user

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Any signed-in user can report another person's behaviour to the system administrators. The person is named by email; the reporter gets the same answer whether or not that email has an account, so the form cannot reveal who is registered. Evidence images are re-encoded to JPEG (metadata such as GPS removed), stored in private storage under `reports/` and served only to administrators, who review the report in [Administration](../admin/README.md). `files:prune` keeps every referenced evidence image; images of reports deleted with the reporter's account become orphans and are pruned.

<!-- BEGIN GENERATED TRACE -->
<!-- END GENERATED TRACE -->
