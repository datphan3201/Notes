# /help — User guide

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

The user guide is written for every user, not for developers: what Planner is for, how its parts relate (Area → Goal → Milestone → Task, habits, notes, calendar, reviews, teamwork, archive and privacy promises), each use case as numbered steps with a real screenshot, and frequently asked questions. It is a signed-in page in the application layout, reached from Settings › User guide and from **Open the full guide** in the tour behind the **?** button. The text is written separately for each interface language ([guide-en.php](../../../frontend/src/views/help/guide-en.php), [guide-vi.php](../../../frontend/src/views/help/guide-vi.php)) rather than translated string by string, so each reads naturally; both have the same sections and screenshots.

## Screenshots

Screenshots are real pages of two demo accounts, one per language, kept in `backend/public/guide/<language>/<name>.webp` and shared by the guide and the tour. To refresh them after a visible change:

1. `php tools/guide/seed-demo.php <passwords-file>` creates `guide.vi@example.test` and `guide.en@example.test` (with helpers `guide.lan@` and `guide.sam@` for sharing and Teamwork) in the configured database, with dates relative to today, and writes their random passwords to the given file. It refuses to run twice; `@example.test` accounts have email off.
2. Serve that database (for example `php -S` from `backend/public`) and run `PLAYWRIGHT=<path to playwright> node tools/guide/capture.mjs <base-url> <passwords-file> <out-dir>`. It signs in as each demo account and captures every shot listed in the script at 1280×800 (phones at 390×844). The AI shots need a configured provider.
3. `php tools/guide/publish.php <out-dir>` converts them to WebP and removes screenshots no longer produced.

A shot referenced by the guide or the tour but not published fails `FullFeedbackHttpTest` and `walkthrough-content.test.js`.

<!-- BEGIN GENERATED TRACE -->

### User guide page per language

**Trace ID:** `help.guide`

A signed-in article with a sticky table of contents: overview and purpose, getting started, the screen, how the parts fit together (a table of what each item is, where it lives and its rules, plus what Planner promises), one section per use case with numbered steps and screenshots, administration and frequently asked questions. The account language picks guide-vi or guide-en; screenshots come from /guide/<language>/ and open full size. Below 900px the contents stack above the article and wide tables scroll inside their section.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-guide-page](../../../frontend/src/views/help/index.php#L23)<br>[guide-vi.php · id="lien-ket"](../../../frontend/src/views/help/guide-vi.php#L85)<br>[guide-en.php · id="how-it-fits"](../../../frontend/src/views/help/guide-en.php#L85)<br>[app.php · &#91;'User guide', '/help'](../../../frontend/src/views/layouts/app.php#L22) |
| CSS | [help.css · /* User guide (/help)](../../../frontend/src/css/help.css#L1) |
| Controller / service / domain | [AccountController.php · public function helpPage(](../../../backend/src/Http/Controller/AccountController.php#L189) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_user_guide_is_written_per_language_and_every_screenshot_exists(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L373) |
| HTTP | `GET /help` (`help.index`) → [AccountController::helpPage](../../../backend/src/Http/Controller/AccountController.php#L189) |

### Demo accounts and screenshot pipeline

**Trace ID:** `help.screenshots`

seed-demo.php builds the Vietnamese and English demo accounts through the ordinary services (with helper accounts for sharing and Teamwork) and refuses to run twice; capture.mjs signs in with Playwright and captures each listed shot per language; publish.php converts them to WebP under backend/public/guide and removes stale ones. Tests fail when the guide or the tour references a screenshot that was not published.

| Layer | Entry point |
| --- | --- |
| Browser logic | [capture.mjs · export const SHOTS](../../../tools/guide/capture.mjs#L102) |
| Controller / service / domain | [seed-demo.php · $account = function](../../../tools/guide/seed-demo.php#L54)<br>[publish.php · imagewebp(](../../../tools/guide/publish.php#L27) |
| Relevant tests (not a pass claim) | [walkthrough-content.test.js · test('every tour step is written in both languages](../../../frontend/tests/js/walkthrough-content.test.js#L9)<br>[FullFeedbackHttpTest.php · public function test_user_guide_is_written_per_language_and_every_screenshot_exists(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L373) |

<!-- END GENERATED TRACE -->
