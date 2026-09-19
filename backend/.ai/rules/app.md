---
paths:
  - '{app/**,bootstrap/**,config/**,database/**,public/**,routes/**,storage/**,tests/**}'
  - '{app/**,bootstrap/**,config/**,database/**,public/**,routes/**,resources/**,tests/**}'
---

# Framework-free application

Laravel has been retired. Application behavior lives under `backend/src`, routes under `backend/routes`, migrations under `backend/database/plain-migrations`, and tests under `backend/tests/Plain`. Use the application-owned router, HTTP types, services, PDO repositories, session handler, and migration runner. Do not recreate framework helpers or compatibility shims.
