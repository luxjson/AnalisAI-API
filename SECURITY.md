# Security Policy

## Supported version

Security reports should target the latest code on the default branch and any currently deployed release.

## Reporting a vulnerability

Please do not publish exploitable details, student data, credentials, session cookies, database URLs, or AI-provider keys in a public issue or pull request. Use GitHub's **Report a vulnerability** feature for this repository when available, or contact the repository owner privately through a verified channel.

Include the affected commit or release, impact, reproduction steps that do not use real student data, and any suggested mitigation. Allow time for triage before public disclosure.

## Sensitive educational data

This application can process personal and educational information about students, including minors. Security testing must use synthetic data or a specifically authorized environment. Do not export production records into issue trackers, CI logs, or external AI services for debugging.

## Current operational cautions

- Automated backups are controlled by `BACKUP_ENABLED`; verify the actual runtime configuration rather than assuming the scheduler is active.
- A JSON backup stored in the same PostgreSQL database is not an independent disaster-recovery copy.
- Configure and test an external recovery path, including a documented restore test, before relying on backups for production recovery.
- Do not apply migrations manually to production outside the documented migration workflow.
