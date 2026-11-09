---
paths:
  - 'apps/web/**'
---

# Browser source and interaction boundaries

Use [feature maps](../../docs/README.md), [interaction invariants](../../docs/architecture/interactions.md) and [style ownership](../../docs/ui/shared/shell.md#style-file-ownership). Follow `apps/web/AGENTS.md` and the relevant installed Next.js guide before implementation.

Live workspace routes use authenticated state even when view components live under `components/preview/`; explicit preview routes use synthetic providers. Preserve main Notes explicit Save/conflicts, explicit-save planning/Review drafts, account-scoped offline recovery, keyboard/focus/responsive behavior and exact confirmed assistant Apply. The API remains the authority; a rendered client shell is not authorization. CI/launcher use npm and package-lock.json.
