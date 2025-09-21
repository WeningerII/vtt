# TruffleHog Remediation Playbook

This document outlines how to triage and remediate TruffleHog findings that originate from the scheduled security workflow. The goal is to ensure verified secrets are rotated promptly while reducing noise from environment templates and infrastructure manifests that intentionally contain placeholder values.

## 1. Pull the Latest Scan Results

1. Open the **Security Scanning** workflow run that failed or reported findings.
2. Download the TruffleHog step logs (or artifact when available).
3. Record the commit(s) and file paths associated with each finding.
4. Classify each finding:
   - **Verified secret** – the TruffleHog validator successfully authenticated with the provider. Treat as a live secret.
   - **Unverified/placeholder** – often in example `.env` files or sealed secrets templates. Consider allowlisting instead of rotation if the value is not sensitive.

> Tip: You can replicate the scan locally with Docker when needed:
>
> ```bash
> docker run --rm -v "$PWD:/repo" ghcr.io/trufflesecurity/trufflehog:latest \
>   filesystem --only-verified --fail "file:///repo"
> ```
>
> (Requires network access to download the image the first time.)

## 2. Rotate Real Secrets Immediately

For each verified secret:

1. Locate the credential owner (GitHub token, OAuth client, database password, etc.).
2. Revoke the exposed secret in the upstream system.
3. Generate a replacement credential.
4. Update the secret in the provider (e.g., GitHub Actions Secrets, Vault, Kubernetes sealed secret source).
5. Remove the plaintext value from Git history if it was committed (use `git filter-repo` or the GitHub UI Secret Scanning remediation tools).
6. Trigger a fresh security workflow run to confirm the secret is no longer detected.

Keep a short audit trail in `docs/security/rotation-log.md` (create if absent) noting the date, secret name, rotation owner, and verification run link.

## 3. Handle False Positives with an Allowlist

When TruffleHog repeatedly flags placeholder values:

1. Add the file path to `.trufflehogignore` (create at repo root if it does not exist) with a short comment describing why it is safe. Example:
   ```
   # Placeholder credentials committed intentionally for local development templates
   .env.example
   .env.production
   infra/k8s/base/sealed-secrets.yaml
   ```
2. For dynamic ignore cases, use the `--exclude-paths` option in the workflow (`extra_args`).
3. Re-run the **Security Scanning** workflow to ensure the allowlist behaves as expected.

Avoid suppressing entire directories that may contain real secrets—keep the ignore list as narrow as possible.

## 4. Future Enhancements

- Store a `trufflehog-baseline.json` generated from a clean scan to automatically ignore known-safe strings.
- Add Slack/Teams alerting for verified hits so the on-call engineer is paged immediately.
- Consider running TruffleHog on pull requests (with `--since-commit`) to catch issues before they merge.

## 5. Reference

- GitHub Action definition: `.github/workflows/security.yml`
- Runbook owner: Security & DevOps
- Review cadence: monthly or after any failed security workflow run
