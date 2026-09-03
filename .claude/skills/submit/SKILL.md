---
name: submit
description: Push the current branch to the user's fork and open (or refresh) the pull request against JJFromTenex/claude-code-training. Use when the user says submit, ship it, open the PR, push my PR, or invokes /submit. Never merges.
---

# /submit

Get this branch onto the Build Battle board: push it to the user's fork, then open a pull request into the workshop repository. One command, no permission surprises.

Nobody has push access to `JJFromTenex/claude-code-training`. Everyone pushes to their own **fork** and opens the PR from there. That is the intended flow, not a workaround.

## 1. Preflight — stop and tell the user if any of these fail

- `gh auth status` must show a logged-in GitHub account. If not: `gh auth login`, then run `/submit` again.
- `git branch --show-current` must not be `main`. Submitting from `main` is always wrong; ask which ticket branch they meant.
- `git status --porcelain` must be empty. If there are uncommitted changes, say so and offer to commit them first (subject starts with the ticket id, e.g. `NWP-201: …`). Do not push a dirty tree silently.

## 2. Make sure `origin` is the user's fork

Run `git remote -v`.

- If `origin` points at `JJFromTenex/claude-code-training`, the user cloned the workshop repo directly. Run:
  `gh repo fork JJFromTenex/claude-code-training --remote=true`
  This creates the fork (if needed), renames the old `origin` to `upstream`, and adds the fork as `origin`. Confirm with `git remote -v`.
- If `origin` already points at `<their-login>/claude-code-training`, nothing to do.
- Record the fork owner: `gh api user --jq .login`.

## 3. Push

`git push -u origin <branch>`

If the pre-push hook refuses (red tests, failed check), **stop and show the user the hook output**. Do not bypass it with `--no-verify`. The hook is doing its job.

## 4. Open the pull request — or refresh it

Check for an existing PR from this branch:
`gh pr list --repo JJFromTenex/claude-code-training --head <login>:<branch> --state open --json number,url`

- **PR exists:** the push already updated it and the grader re-scores on every push. Print the PR URL and stop.
- **No PR yet:** build the description, then create it.
  - Title: `<TICKET-ID>: <what it does>` — take the ticket id from the branch name (`NWP-201-issue-cards` → `NWP-201`) and the summary from the ticket title in `docs/tickets/`.
  - Body: if a `northwind-pr` skill exists in `.claude/skills/`, follow it to write the description. Otherwise follow `/pr`. Write the body to a temp file.
  - `gh pr create --repo JJFromTenex/claude-code-training --base main --head <login>:<branch> --title "<title>" --body-file <file>`

## 5. Report

Print the PR URL and one line: the grader reads the PR within a couple of minutes and the leaderboard updates on every push, so run `/submit` again after each meaningful change.

## Rules

- Never merge, never close, never touch `main`.
- Never claim a verification step in the PR body that was not actually run.
- If `gh` is not installed: `brew install gh` (macOS) or https://cli.github.com, then `gh auth login`.
