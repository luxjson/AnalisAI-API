# Production Readiness Review

Review baseline: branch `fix/production-readiness-2026-10-18`, based on the repository's main branch at the time the review branches were created.

## Automated checks added

- Node unit tests.
- Static JavaScript syntax validation.
- Local import resolution.
- API route-to-controller export checks.
- Repository helper-to-SQL-method checks.
- OpenAPI path coverage against registered API routes.
- Migration numbering and deployment configuration checks.
- npm dependency audit and CodeQL static analysis.
- Exact-version approval of the Argon2 native install script and runtime smoke tests that load Argon2 and import the API route composition without connecting to production.
- Weekly Dependabot proposals for npm and GitHub Actions dependencies.

## Confirmed changes in this branch

- Render now builds from the repository root rather than a nonexistent `api/` directory.
- The OpenAPI document covers the registered API routes.
- A migration validates existing data constraints through the existing deployment migration runner. It is not run manually by this review.
- Backup status reports whether automatic scheduling is enabled and whether Neon snapshot configuration is present.

## Risks still requiring operational validation

1. **Backups and disaster recovery:** automatic scheduling is disabled in the current Render configuration. A JSON fallback is stored in the same database and does not protect against loss of that database. Configure an independent backup/snapshot path and run a restore drill before claiming disaster-recovery readiness.
2. **Student privacy and AI providers:** teacher AI requests can include names and educational data from multiple students, competency records, task data, observations, and feedback. Confirm the institution's legal basis, provider terms/retention controls, regional handling, access policy, and data minimization. The privacy notice must match the deployed implementation and the controller's identity/contact.
3. **Migration preconditions:** the constraint-validation migration can fail if existing rows violate a constraint. Review its result in a staging copy and obtain a verified backup before production rollout.
4. **Integration coverage:** the automated checks do not replace end-to-end flows against a staging database: login/logout, CSRF rejection, role isolation, file upload/download authorization, AI grade confirmation, password reset approval, spreadsheet import/export, migration from the previous schema, and restore recovery.
5. **GitHub rules:** workflow files create status checks, but repository branch protection / rulesets must be configured in GitHub settings if merges should be blocked until these checks pass.

## Review conclusion

These checks improve repeatability and catch structural regressions, but they do not by themselves certify the live service as production-ready. Review and resolve the operational risks above before the final production sign-off.
