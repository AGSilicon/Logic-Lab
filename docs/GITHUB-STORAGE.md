# GitHub sign-in and student storage

GitHub storage is optional. Local autosave and JSON import/export continue to work without sign-in or while GitHub is unavailable.

## What is saved

When a student chooses **Save**, LogicLab writes the current project JSON to `logiclab-projects/<project-id>.logiclab.json` in the selected private repository. The save creates a commit in that repository. LogicLab does not record every editor action or send usage analytics to GitHub.

Students must create a private repository and install the LogicLab GitHub App with access to that repository only. The app lists only private repositories owned by the signed-in student and available through that app installation. Each student can later revoke the app from GitHub settings.

## Create the GitHub App

Create a GitHub App owned by `AGSilicon`, with these settings:

- Homepage URL: the production Cloudflare Pages origin, such as `https://logiclab.pages.dev`.
- Callback URL: `<production-pages-origin>/api/auth/callback`.
- Repository permissions: **Contents: Read and write**, **Metadata: Read-only**.
- Installation target: student personal accounts; students select only their private LogicLab repository.
- User authorization callback URL: the same `<production-pages-origin>/api/auth/callback`.

Do not request organization administration, repository administration, or unrelated account permissions. Students create their private repository themselves, then install the app on that repository.

## Configure Cloudflare Pages

Create a Cloudflare Pages project connected to this repository. Use the repository root, build command `npm run build`, and output directory `dist`. Pages detects the `functions/` directory and deploys its API routes with the site so browser requests and the encrypted session cookie stay same-origin.

In **Settings → Variables and Secrets**, configure these values for the production environment:

| Name | Type | Value |
| --- | --- | --- |
| `APP_ORIGIN` | Variable | Exact production Pages origin, with no path, for example `https://logiclab.pages.dev` |
| `GITHUB_APP_CLIENT_ID` | Variable | Client ID from the GitHub App settings |
| `GITHUB_APP_SLUG` | Variable | GitHub App URL slug |
| `GITHUB_APP_CLIENT_SECRET` | Secret | Client secret from the GitHub App settings |
| `SESSION_ENCRYPTION_KEY` | Secret | Base64 encoding of 32 cryptographically random bytes |

Generate a session key in PowerShell with:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Never put the client secret or session key in Git, a `.env` committed to Git, or frontend variables prefixed with `VITE_`. Cloudflare Pages Functions must receive them as server-side variables/secrets. Redeploy after adding or changing the values.

After deployment, test the full flow with a separate student account: sign in, create a private repository, install the GitHub App with access to only that repository, connect it in LogicLab, save a project, and verify the JSON file and commit in the repository.

## Session and activity behavior

The Worker exchanges the OAuth code server-side. It encrypts the GitHub user access token into an `HttpOnly`, `Secure`, `SameSite=Lax` cookie using `SESSION_ENCRYPTION_KEY`. Frontend JavaScript never receives the token. The session lasts up to eight hours; students can sign in again after it expires.

Only explicit project saves create commits. Sign-in does not make a student follow `@AGSilicon`; the **Follow @AGSilicon** link is optional and requires the student to choose it on GitHub.
