# Project Context and Agent Instructions

## Source of Truth

- Assignment: `503073-FinalProject-V1.docx` in the repository root.
- Course: **503073 – Web Programming & Applications**, Final Project, Semester I/2026–2027.
- Product: a personal note management web application with accounts, attachments, labels, password protection, sharing, real-time collaboration, and AI assistance.
- This file summarizes project context and implementation constraints. Consult the original assignment when details are ambiguous; it remains authoritative.
- The assignment requires strict compliance with red-highlighted content and warns that deviations, modifications, or additional features can disqualify the submission. Do not add unrelated features.
- At the time this file was created, the root contained the assignment document and its download metadata; no application implementation or build configuration was present.

## Technology Stack

The user has selected these core technologies:

| Area | Technology | Status |
| --- | --- | --- |
| Backend | PHP 8.5 with Laravel 13 | PHP user-selected; framework/runtime selected in the R1 plan |
| Browser behavior | JavaScript modules with Alpine.js 3 | JavaScript user-selected; also required for later offline capabilities |
| Page structure | HTML rendered by Blade | HTML user-selected; rendering approach selected in the R1 plan |
| Styling and responsive layouts | Custom CSS, locally bundled Noto Sans, Vite 8 | CSS user-selected; tooling selected in the R1 plan |
| Real-time collaborative editing | WebSocket | Required by the assignment |
| Offline access | PWA principles, service worker, caching, and a JavaScript-accessible local database | Required by the assignment; specific local database not selected |
| Persistent server storage | MySQL 8.4 | MySQL user-selected; version selected in the R1 plan |
| AI summaries and question answering | Large Language Model (LLM) integration | Required; provider and model not yet selected |
| Email | Account activation, password recovery, and sharing notifications | Integration/provider not yet selected |
| Account password storage | bcrypt | Explicit assignment requirement |
| Team source control | Shared GitHub repository | Required for teamwork evidence |
| Delivery | Docker Compose planned for a later phase | User-selected; not part of the immediate setup |

Bootstrap, React, and Laravel are explicitly permitted examples in the assignment, not mandatory dependencies. The R1 plan now selects Laravel; Bootstrap and React are not selected. XAMPP remains only a local-hosting example. Selected technologies are not evidence of installation: PHP, Composer, and MySQL were absent during planning, and no application has been scaffolded yet. See [PLAN.md](PLAN.md) for the frozen implementation decisions and setup sequence.

## Current Delivery Priorities

- The immediate goal is a preliminary, usable product for the project owner's personal use. Full assignment compliance remains a later milestone.
- The user allowed free framework selection within PHP, JavaScript, HTML, and CSS. The detailed R1 plan selects Laravel 13 with Blade/Alpine and custom CSS; implementation should follow that choice.
- Use MySQL for persistent server storage.
- Plan for Docker Compose later; do not make it a prerequisite for the initial implementation.
- Defer external-service selection and integration, including hosted AI and email services, for now. Record dependent assignment features as deferred, not completed or removed.
- Do not block planning on deadlines, team size, or staffing; the user has explicitly excluded these concerns from the current planning scope.
- The first-release feature set and acceptance criteria are now specified in [PLAN.md](PLAN.md) and [docs/plan/01-scope.md](docs/plan/01-scope.md). R1 includes personal note workflows, account settings, and private attachments; protection/sharing/collaboration, email, PWA, AI, Compose, and deployment remain later phases.
- The following sections retain the complete assignment requirements for future implementation and grading; they are not a claim that every feature is required in the initial release.

## Supporting Agent Skills

The following skills were installed locally in `/home/thanhdat/.codex/skills/` at the user's request. They are development aids, not application dependencies, and are not bundled with this repository.

| Skill | Project use | Source |
| --- | --- | --- |
| `product-manager-toolkit` | Requirements analysis, PRD, first-release scope, and feature prioritization | `alirezarezvani/claude-skills`, `product-team/skills/product-manager-toolkit` |
| `senior-architect` | Architecture decisions, module boundaries, data flows, and diagrams | `alirezarezvani/claude-skills`, `engineering-team/skills/senior-architect` |
| `ux-researcher-designer` | User journeys, interaction design, and usability validation | `alirezarezvani/claude-skills`, `product-team/skills/ux-researcher-designer` |
| `frontend-design` | Visual direction, typography, layout, responsive UI, and visual review | `anthropics/skills`, `skills/frontend-design` |
| `playwright` | Browser-driven interaction checks and screenshots | `openai/skills`, `skills/.curated/playwright` |

- The three community skills were installed from revision `19392f7a08264ed00486a251f5b2098321771f94`; `frontend-design` from `41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f`. Playwright was installed from the curated repository's current `main`.
- Read the applicable skill instructions before using them. Apply only workflows relevant to the current task.
- User decisions and the assignment's constraints take precedence over generic skill examples. Retain PHP and MySQL; do not adopt alternative stacks, enterprise infrastructure, staffing exercises, or marketing features merely because a skill mentions them.
- The architecture skill's listed stack coverage and dependency-analysis tools do not explicitly cover PHP/Composer. Use its general design guidance and verify PHP-specific decisions against appropriate documentation.
- Base UX decisions on the user's stated needs. Do not invent interviews, research results, personas presented as real, or usability-test outcomes.
- Python helper scripts must follow the inherited explicit-environment workflow. A local tooling environment was created at `/home/thanhdat/code/venvs/codex-skill-tools-py312`; it is not an application dependency.

## Required Application Behavior

### Accounts

- Require authentication to access the application. Redirect unauthenticated visitors to login; provide the public entry points necessary for registration, activation, and password recovery.
- After login, show the user's personal homepage and notes. Implement logout.
- Registration must ask for **only email address, display name, and password entered twice for confirmation**.
- Store account passwords as **bcrypt hashes**, never plaintext.
- Automatically log the user in after successful registration and send an activation link by email.
- Unverified users must retain **all application functionality**. Show a prominent unverified-account notice until the activation link is used, then remove it.
- Provide profile viewing and editing for display name and avatar. Validate avatar uploads and show a default avatar when none is provided.
- Changing an account password requires the current password and the new password entered twice. Handle the authentication session securely after success.
- Provide preferences for note font size, note colors, and light/dark theme.
- Recover passwords through an emailed link or emailed OTP. Validate the link or OTP before allowing a new password. After a reset, require manual login.

### Basic Notes

- Display notes in **grid view by default**, with a list-view option.
- On initial creation, **title and content are the only mandatory user-input fields**. System metadata and later actions such as labels, attachments, pinning, protection, and sharing are permitted.
- Use **the same interface for creating and editing** notes; do not create separate screens for these operations.
- Automatically save note content without requiring a Save button.
- Always obtain confirmation through a dialog before deleting a note.
- Support one or multiple image, video, and file attachments. The attachment interface is an implementation choice.
- Sort ordinary notes newest first by either creation time or last modification time. Select one approach consistently.
- Show pinned notes first, ordering multiple pinned notes by pin time. The document does not specify ascending versus descending pin-time order.
- Search both note titles and contents as the user types. Do not require a Search button; a short debounce such as 300 ms is allowed.
- Allow users to list, create, rename, and delete labels.
- Allow zero, one, or multiple labels per note and filtering by selected labels.
- Deleting a label must not delete associated notes. Renaming a label must update its displayed name everywhere it is associated.
- Show recognizable pinned, shared, and password-protected status icons in **both grid and list views**.

### Password-Protected Notes

- Support a separate password per note, independent of passwords on other notes.
- Prompt for the note password before allowing any action on a protected note, including viewing, editing, or deleting it.
- Allow protection to be enabled, the note password to be changed, and protection to be disabled.
- Follow the assignment's better-implementation guidance: confirm new note passwords by entering them twice; require the current password before changing or disabling protection.

### Sharing and Collaboration

- Share with one or multiple recipients through their registered email addresses. Validate that each recipient is registered.
- Support read-only and edit permissions.
- Let the owner review recipients, their email addresses, and permissions, and modify or revoke access at any time.
- Provide a dedicated section for notes shared with the current user. Show access level, who shared each note, and the sharing timestamp.
- Notify recipients by email; at minimum, provide a prominent in-account notification on their next login, as described in the assignment's implementation guidance.
- For notes shared with edit permission, use **WebSocket technology** so multiple users can edit simultaneously and see each other's changes in real time.

### AI Features

- **AI Summary:** generate a concise summary of one note through an LLM, preserving its meaning and key information. Allow regeneration.
- **AI Question & Answer:** accept natural-language questions, retrieve relevant note contents, and generate a synthesized answer grounded in those notes. Keyword matching alone is insufficient.
- Display references to the notes used in each answer, with links that open those notes directly.
- The assignment does not mandate a particular AI vendor, model, vector database, or retrieval framework.

### UI, Responsive Design, and Offline Access

- Aim for a polished, consistent interface with intuitive navigation, useful feedback, appropriate empty/loading/error states, and accessibility support. A merely basic interface earns no UI/UX points.
- Optimize layouts for smartphones, tablets, and desktop screens, including usable touch targets and navigation, without significant overflow.
- Implement JavaScript-based PWA offline capabilities with effective caching, a service worker, and local database storage integrated with the online database.
- Users must be able to access the application and view note content offline. Synchronize data when connectivity returns.
- The document does not explicitly require offline editing; do not present it as a confirmed requirement.

## Implementation Quality and Boundaries

The assignment considers a feature complete only when it behaves as specified, handles errors, avoids critical security vulnerabilities, and follows appropriate industry practices. Apply the following engineering guidance within that scope:

- Enforce ownership, sharing permissions, and note protection on the server, including attachment access, WebSocket operations, and AI retrieval.
- Prevent protected or unauthorized note content from leaking through previews, search, AI responses, or offline caches.
- Validate input and uploaded files, use parameterized database queries, escape rendered content, and protect authenticated state-changing requests against CSRF.
- Keep passwords, API keys, email credentials, and other secrets out of source control. Document required configuration without including real credentials.
- Implement secure sessions and time-limited, single-use activation/recovery credentials.
- Handle autosave failures, concurrent edits, reconnects, and synchronization conflicts deliberately so note changes are not silently lost.
- Verify meaningful behavior and failure cases, especially authorization, account recovery, protection, collaboration, and offline synchronization. Do not mark a feature complete based solely on the presence of its UI.
- Keep changes focused on the specified application. Do not introduce unrelated modules or product features.

The detailed R1 plan now fixes the framework, schema, API, UI, autosave conflict handling, task order, and verification gates. Deployment and external-service choices remain deferred. Read [PLAN.md](PLAN.md) before implementing and update [docs/implementation-status.md](docs/implementation-status.md) as actual work is verified.

## Running and Deployment

- Prefer public deployment of the application and all supporting services, including the database. Keep the deployment operational throughout grading.
- The deployment rubric's full-credit description includes HTTPS, performance optimization, scalability, and high uptime.
- If public deployment is infeasible, Docker Compose is the assignment's alternative. Follow the instructor's template and instructions when provided; no such template is currently present.
- If neither public deployment nor Docker Compose is used, the project can still be evaluated, but clear local setup instructions are essential.
- Use relative application URLs rather than hardcoded hostnames or ports. Serve the application at the web root, not a project-name subdirectory. The assignment explicitly emphasizes these constraints for local submissions.
- If XAMPP is used, the assignment calls for serving the project directly from `htdocs`, rather than `htdocs/final_project`.
- Document actual installation, configuration, database setup, application startup, and supporting-service startup commands once they exist.
- Include reproducible instructions in the required submission README, especially when libraries or frameworks introduce setup steps.

## Grading Checklist

The rubric has **32 criteria totaling 10 points**. Each criterion must be demonstrated in the video to count as implemented.

| Category | Points | Criteria |
| --- | --- | --- |
| Account management | 2.0 | 1. Registration; 2. Activation; 3. Login/logout; 4. Password reset; 5. View profile/avatar; 6. Edit profile/avatar; 7. Change password; 8. Preferences. Each is worth 0.25. |
| Simple note management | 3.5 | 9. List view; 10. Grid view; 11. Create; 12. Update; 13. Delete; 14. Autosave; 15. Image/video attachments; 16. File attachments; 17. Pinning; 18. Status icons; 19. Search; 20. Label management; 21. Attach labels; 22. Label filtering. Each is worth 0.25. |
| Advanced note management | 2.5 | 23. Enable/disable note passwords; 24. Password enforcement/change; 25. Share/receive notes; 26. Real-time collaboration: 0.5 each. 27. AI Summary; 28. AI Q&A: 0.25 each. |
| Other requirements | 2.0 | 29. UI/UX; 30. Responsive design; 31. Offline capabilities; 32. Online deployment. Each is worth 0.5. |

Docker Compose enables reproducible local evaluation; do not assume it automatically earns the online-deployment points.

## Teamwork and Academic Requirements

- Use a shared GitHub repository with **at least four consecutive active calendar weeks**, each running Monday through Sunday, during the official project period.
- **Every member must make at least two meaningful commits in each of those weeks.** Work from other weeks or other members cannot compensate for missing commits.
- Each meaningful commit must reflect the member's own coherent contribution, use their own GitHub identity, have a descriptive message, be pushed, and remain in the submitted history.
- Empty, merge-only, trivial, artificial, unnecessarily fragmented, copied, generated-artifact, or other-member-authored contributions do not satisfy the requirement. Documentation counts only when substantial and project-relevant.
- Missing any required commit or providing incomplete/unverifiable evidence results in a **0.5-point team deduction**, with no partial credit.
- To claim compliance, submit source cloned from GitHub with the hidden `.git` directory and full relevant history preserved, including after ZIP compression. GitHub Download ZIP is insufficient.
- Include GitHub Insights contributor-activity screenshot(s) identifying the repository, all contributors, and the required weeks. Include the repository URL in the rubric or README. Give the instructor read access through grading if the repository is private.
- Teams that do not meet the teamwork requirement may omit the GitHub evidence and accept the deduction.
- Every member must attend the individual oral examination and explain the requirements, architecture, implementation decisions, and their own contribution, including modifying relevant code when asked.
- Respect course rules on generative AI and assessed work. The assignment allows individual deductions for prohibited AI use, insufficient contribution, or inability to explain the work; it does not define all permitted AI uses.
- Do not share code between groups or obtain project source code from the internet. The assignment warns that matching or online-sourced code, even in part, can result in zero for all affected members. Libraries/frameworks remain explicitly permitted.
- The Essay is separate from the Final Project; every member must participate in both.

## Submission Requirements

Prepare the following in `id1_fullname1_id2_fullname2/` and submit a ZIP with the same name through **e-learning only**, using one team representative:

1. **Instructor-provided rubric workbook:** self-assess all 32 criteria and include the public application URL and required grading credentials. The document inconsistently spells this `Rubric.xlxs`, `Rubric.xlsx`, and `rubric.xlsx`; retain the instructor-provided filename rather than inventing a workbook.
2. **`source/`:** all application source and relevant database files. If using Docker Compose, include all required modules, the Compose configuration, and tested run instructions. Remove unnecessary content while preserving `.git` and relevant history when claiming teamwork compliance.
3. **`demo.mp4`:** minimum 1080p with clear audio and participation from all members. Briefly explain technologies and architecture, then demonstrate implemented criteria sequentially according to the 32-item rubric. Undemonstrated criteria count as unimplemented. If the video is too large, upload it to YouTube and include the link.
4. **`Readme.txt`:** build/run/use instructions, required configuration, application URL and applicable server login details, repository URL, and credentials for grading accounts with preloaded data. The coding section also refers to `readme.txt`; follow the final submission template's naming.
5. **`Screenshot.png` or the required Insights screenshot set:** GitHub contributor evidence when claiming the teamwork requirement. Other screenshots, including commit-log screenshots, are not accepted substitutes.

Critical consequences recorded in the assignment:

- Missing source code, demo video, or rubric workbook: **0 for the entire team**.
- Submitting an unrelated project: **0 for the entire team**.
- Late submission: **1 point per day**; even one second late counts as the first day.
- Complex setup without specific build/run instructions: **2-point deduction**.
- Failure to clean unnecessary project files: **0.5-point deduction**.
- Missing grading information, incorrect naming, or missing required content: **1-point deduction**.

Instructor contact for assignment clarification: `maivanmanh@tdtu.edu.vn`. No exact deadline, team roster, project-period dates, repository URL, or instructor Docker template is supplied in the current document; do not invent them.
