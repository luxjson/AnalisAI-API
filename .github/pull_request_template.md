## What changed

Describe the purpose and user-visible impact.

## Verification

- [ ] Automated tests cover the changed behavior and important regressions.
- [ ] `npm test`, repository-integrity checks, syntax checks, and dependency audit pass.
- [ ] Authorization, CSRF, input validation, and error handling were reviewed for affected routes.
- [ ] Database migrations are backward-aware and do not perform unverified data repair.
- [ ] No credentials, real student data, or sensitive values are committed or logged.
- [ ] API documentation is updated for public route or payload changes.
- [ ] Backup and restore impact was considered where data or schema changes are involved.

## Deployment and recovery

Call out required environment variables, migration steps, rollback risks, and any external provider or privacy impact.
