---
paths:
  - '{app/**,bootstrap/**,config/**,database/**,public/**,routes/**,storage/**,tests/**}'
---

# App

## Keep Laravel concerns in the backend workspace
Laravel HTTP behavior, authentication, persistence, private files, public document root, and PHPUnit tests stay under backend/. config/view.php intentionally loads the sibling ../frontend/src/views directory so the deployment remains same-origin.
