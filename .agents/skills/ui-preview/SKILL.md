---
name: ui-preview
description: Show UI work as screenshots of the running dev app. Use whenever a request adds, changes, or mocks up UI (pages, components, styles, copy), and when filing an issue or PR that involves UI. Covers starting the dev server, logging in, capturing phone and desktop screenshots, and showing them in chat, on issues, and on PRs.
---

# UI Preview

Show the real app, not a description of it. Every screenshot comes from the dev server and its development database. Never use production.

## When to show screenshots

- **In chat:** whenever you change, add, or mock up UI. Show the result before you finish or ask for approval. When you change existing UI, show before and after.
- **On issues:** when an issue is about UI that exists, attach screenshots of the current state.
- **On PRs:** when a PR changes UI, put before and after screenshots in the description.

## 1. Find the dev server

Read `PORT` from `.env`. Never use `6996`; that port is production.

```bash
curl -s -o /dev/null -w '%{http_code}\n' "localhost:$(grep '^PORT=' .env | cut -d= -f2)"
```

If nothing answers, start `bun run dev` in the background and wait for `Hosted at` in its output. It uses this checkout's `data/db.sqlite` and hot-reloads code changes.

## 2. Choose the view

- **User:** `--login guest` (the default) only shows the login page. Use `--login admin` for the dev admin (`admin@chugmania.dev`), or `--login email:password` for another user. To see the member view, create a test user as admin in the app with a known password, and reuse it.
- **Routes:** `/`, `/sessions`, `/sessions/<id>`, `/sessions/<id>/tournament/groups/<groupId>`, `/tracks`, `/tracks/<id>`, `/users`, `/users/<id>`, `/chugs`, `/admin`. Find ids in the dev database without changing it:

  ```bash
  bun -e "import { Database } from 'bun:sqlite'; console.table(new Database('data/db.sqlite', { readonly: true }).query('select id, name, date from sessions order by date desc limit 10').all())"
  ```

- **State:** when the data doesn't show the case you need (an empty list, a long name, a tournament in progress), create or edit records through the app or the dev database, as `AGENTS.md` allows. Remove records you only added for the screenshot.
- **Mockups:** build the UI in the real components. Before the backend exists, hard-code sample data in the component, take the screenshots, and remove the sample data when the real data path is built.

## 3. Capture

```bash
bun run screenshot <route>... [--login admin] [--wait <text>] [--viewport] [--size phone|desktop] [--theme light] [--out <dir>]
```

- It takes each route at phone (390×844) and desktop (1280×800) size and prints the file paths.
- `--wait <text>` waits until that text is visible. Use it for content that loads late.
- `--viewport` captures only the first screen instead of the whole page. Use it for long pages.
- Capture **before** you edit the code (`--out .screenshots/before`), then **after** (`--out .screenshots/after`). The dev server reloads your changes.
- Open every image yourself before you show it. Check both sizes for overflow, clipped text, and spacing.

## 4. Show

**Chat:** embed the images with their absolute paths, before and after side by side:

```markdown
![After, phone](/abs/path/.screenshots/after/sessions--phone.png)
```

**Issues and PRs:** add `--publish <label>`. The script uploads the images to the `screenshots` branch and prints Markdown to paste. It also saves that Markdown as `comment.md` in the output folder.

```bash
bun run screenshot /sessions --login admin --publish pr-123-before --out .screenshots/before
bun run screenshot /sessions --login admin --publish pr-123-after --out .screenshots/after
```

- PR: add a **Screenshots** section to the description with **Before** and **After**, or post the Markdown with `gh pr comment <number> --body-file .screenshots/after/comment.md`.
- Issue: add the Markdown to the issue body, or comment with `gh issue comment <number> --body-file <dir>/comment.md`. Before the issue exists, use a label such as `issue-sessions-layout`.

## Privacy

The repository is public, so published screenshots are public too. The development database contains people's names.

- `--publish` always replaces user names, short names, and emails with placeholders such as `Spiller 7`. Use `--anonymize` to do the same for local screenshots.
- Before you publish, open each image and check that no real names, emails, or other personal data remain. Anonymizing only covers user fields, so session names, comments, and descriptions stay as they are.
- Never publish `/admin` or a user's edit form.
