# How changes get made

Every change to Groundswell, big or small, follows the same path from idea to live site. The point is that nothing reaches real people until it has been tested and you've tried it yourself.

```
  Issue  ──►  Branch  ──►  Pull request  ──►  Checks + preview  ──►  Merge  ──►  Live
  (what       (a separate   (the change,      (automatic tests,     (you click    (Vercel
  and why)    copy of the   ready to look     a private test copy   the button)   deploys main)
              code)         at)               of the site)
```

## 1. Everything starts as an issue

An **issue** is a to-do card on GitHub: [github.com/hahnsolo/groundswell/issues](https://github.com/hahnsolo/groundswell/issues). Click **New issue** and pick a form:

- **Something's broken**: a bug. It asks for the page, what you did, what you expected, what happened, and the device.
- **New feature or change**: a user story. It asks who it's for (one of the four people in [Who Groundswell is for](personas.md)), the story ("As Maya, I want…, so that…"), **acceptance criteria**, **test criteria**, and has the **definition of done** checklist built in.

Each issue gets labels:

| Label | Meaning |
|---|---|
| `bug` | Something that used to work, or should, doesn't |
| `feature` | Something new |
| `chore` | Behind-the-scenes upkeep: updates, clean-up |
| `docs` | Only the handbook changes |
| `security` | Anything about accounts, privacy or abuse |
| `P1` | Needed before launch, or the site is broken |
| `P2` | Soon after launch, or broken with a workaround |
| `P3` | Someday, or cosmetic |

## 2. The board

The **Groundswell** project board (the Projects tab on GitHub) shows every issue in a column:

**Backlog** (ideas, not ready) → **Ready** (clear enough to build) → **In progress** → **In review** (a pull request is open) → **Done** (live)

An issue moves to **Ready** only once its acceptance criteria are clear and any open questions are answered. That's the moment to argue about what it should do, before any code exists.

## 3. A branch and a pull request per issue

Work on an issue happens on its own **branch**, a separate copy of the code named after the issue (for example `42-who-came-list`). When it's ready, it becomes a **pull request** (PR): a page on GitHub showing exactly what changed, which says `Closes #42` so the issue closes itself when the PR is merged.

Every PR has the **Done checklist** from [the PR template](../.github/pull_request_template.md). Nothing gets merged with unticked boxes, unless the box doesn't apply and says why.

## 4. Checks and preview

Two things happen automatically on every PR:

- **Checks** (GitHub Actions, free for public projects): the unit tests, the typecheck (catches code that doesn't fit together) and lint (catches common mistakes). They show as a green ✓ or red ✗ on the PR. A red ✗ blocks merging.
- **Preview** (Vercel): a private copy of the site with the change in it, at its own address. Vercel posts the link on the PR. Click around and try the acceptance criteria yourself. Previews use the Neon **`preview`** database branch, never the live one, so testing there can't touch real people's data.

Some checks run on the PC instead, because they need a browser and demo data:

```bash
npm run db:seed        # fresh demo data in the dev database
npm run e2e:data       # adds very long names, titles and links, and a busy neighbourhood
npm run dev            # the site on http://localhost:3000 (leave it running)
npm run e2e:sweep      # every page × phone/tablet/computer × light/dark; must report 0 findings
npm run e2e:flows      # clicks through events, chat, signatures, leaving, deleting an account
```

The sweep saves screenshots in `tests/e2e/output/sweep/` (a `sheet-*.png` per page shows all six views at once). The flows change the demo data, so run `npm run db:seed` again before running them twice. The browser checks use Edge; set `E2E_BROWSER=chrome` to use Chrome instead.

## 5. Merge, then check the live site

When the checks are green and the preview looks right, click **Merge** on the PR. Vercel then deploys `main` to the live site within a couple of minutes, running any database changes first. Open the live site and check the change once more. Then the issue moves to **Done** on its own.

`main` is protected: nobody, including us, can push straight to it. Everything goes through a PR.

## Keeping up to date

**Dependabot** opens a PR once a week when the packages Groundswell is built on have updates (grouped into one PR), and straight away for security fixes. Treat them like any other PR: checks green, glance at the preview, merge.

## Where the tests live

| What | Where | Runs |
|---|---|---|
| Unit tests: the rules (who can chat, when content is purged, how momentum is worked out…) | `tests/*.test.ts` | Every PR, automatically |
| Click-through checks of the main journeys | `tests/e2e/flows.mjs` | On the PC, before merging |
| Visual sweep: overflow and hard-to-read text | `tests/e2e/sweep.mjs` | On the PC, when pages or styles change |
