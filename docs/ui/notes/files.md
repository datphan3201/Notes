# Private Note attachments

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Uploads are attached to an authorized Note and stored privately through local, GCS or Supabase storage. The API returns an authenticated `/api/v1/files/{attachment_id}` URL, never a public object-storage URL. Access checks sharing permissions and the Note password gate before streaming.

The configured upload and account-storage limits are authoritative. Upload failures must not leave usable metadata; deleting files/Notes queues durable byte cleanup. Note image backgrounds reference authorized attachments. Offline shell caches do not cache API/media requests. Account avatars/backgrounds and report evidence use separate account-file endpoints.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `notes.files`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live Notes controls | [apps/web/src/components/preview/notes.tsx](../../../apps/web/src/components/preview/notes.tsx#L39) — `export default function NotesPreview({ text, taskId, resourceNoteId, onResourceClose }: { text: Text; taskId?: number; resourceNoteId?: string; onResourceClose?: () => void }) {` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L420) — `def upload_attachment(` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L469) — `def download(` |
| API / domain | [apps/api/planner/note_features.py](../../../apps/api/planner/note_features.py#L139) — `def remove_attachment(` |
| Related tests | [apps/api/tests/test_render_supabase.py](../../../apps/api/tests/test_render_supabase.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
