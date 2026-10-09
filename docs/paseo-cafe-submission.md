# paseo.cafe submission

Everything needed to list this plugin on [paseo.cafe](https://paseo.cafe). The registry is
community-run and derives the listing from this repository plus the published npm package, so the
only hand-written file is the tiny registry entry (a copy is in
[`registry-entry.json`](./registry-entry.json)).

## Registry answers

| Field            | Value                                            |
| ---------------- | ------------------------------------------------ |
| Registry id      | `beads-board` (matches `paseo-plugin.json` `id`)  |
| GitHub repository| `jmkelly/paseo-beads-board`                       |
| Plugin subpath   | *(blank — the plugin is the repository root)*     |
| npm package      | `paseo-beads-board`                              |
| Release channel  | stable semver, pre-1.0 — `0.1.1` (`0.x`)        |
| Categories       | `productivity`                                   |
| Platforms        | *(blank — not platform-restricted)*              |
| Caveats          | the six lines in `registry-entry.json`           |

If you publish under a different repository or npm name, change them in `package.json`
(`repository`, `homepage`, `bugs`), in `README.md`, and in this file before submitting.

## Pre-submission checklist

| Requirement                                                                     | Status                                                                                                    |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Repository is public on GitHub                                                    | ✅ `jmkelly/paseo-beads-board`                                                                           |
| `paseo-plugin.json` id matches the registry filename                              | ✅ `beads-board`                                                                                            |
| `package.json` has a released semantic version (not `0.0.0`)                      | ✅ `0.1.1` — published to npm under the `latest` dist-tag                                                  |
| npm package is public, with the same plugin id and version as the GitHub source   | ✅ `paseo-beads-board@0.1.1` on the `latest` dist-tag                                                        |
| README has an Install section (pulled into the listing verbatim)                  | ✅ `## Install`                                                                                             |
| README has a Limitations section (pulled into the listing)                        | ✅ `## Limitations`                                                                                         |
| LICENSE file                                                                     | ✅ MIT                                                                                                     |
| `images/` folder with screenshots                                                 | ✅ four PNGs in `images/`                                                                                  |
| Demo video                                                                       | ⬜ optional — a YouTube/Loom link in the README is auto-embedded                                            |
| `pnpm test` and `pnpm run typecheck` scripts                                        | ✅ both, and both pass                                                                                      |
| Registry security scan (static) passes                                            | ✅ verified locally with paseo-cafe's `scripts/plugin-security/static-scan.ts` against both the repo tree and the packed tarball — zero findings |

## Publish steps

Bump the version before publishing. The plugin is pre-1.0, so `patch` is a safe upgrade and
`minor` may still contain breaking changes:

```bash
# from the repository root
pnpm install
pnpm run typecheck
pnpm test
pnpm version patch          # 0.1.0 -> 0.1.1, for fixes
pnpm version minor          # 0.1.0 -> 0.2.0, for features or breaking changes
pnpm pack --dry-run     # confirm the tarball holds paseo-plugin.json, index.*, client/, server/, shared/
pnpm publish --access public
```

Publish with the default `latest` dist-tag. The paseo.cafe catalog binds a plugin's npm identity to
whatever `latest` resolves to and requires it to equal `package.json.version`, so a release
published only under `--tag next` would leave the listing with no npm release (the catalog treats
`next` as a *preview* shown next to an existing stable release, not as the plugin's version). Users
who do not want to track `latest` can pin:

```bash
paseo plugin install npm:paseo-beads-board@0.1.0
```

Verify the published manifest carries the same plugin id and version as the source:

```bash
pnpm view paseo-beads-board version
pnpm view paseo-beads-board dist.tarball
```

## Submit

Open the prefilled issue (same field values as the table above, caveats pre-filled):

<https://github.com/paseo-cafe/paseo-cafe/issues/new?template=plugin-submission.yml&title=Add+plugin%3A+beads-board&registry-id=beads-board&repo=jmkelly%2Fpaseo-beads-board&package=paseo-beads-board&categories=productivity&caveats=Requires+the+beads+%60bd%60+CLI+on+the+daemon+host%3B+set+PASEO_BEADS_BD_BIN+if+it+is+not+on+PATH.%0AServer+code+runs+%60bd%60+as+the+daemon+user+and+can+modify+any+beads+database+that+user+can+reach.%0APre-1.0+release%3A+versions+are+0.x%2C+so+a+minor+bump+may+contain+breaking+changes.%0ANo+drag+and+drop%3A+move+beads+with+the+status+buttons+in+the+bead+detail+sheet.%0ABoard+only%3B+beads-web%27s+GitOps%2C+PR%2C+memory%2C+and+worktree+panels+are+not+included.%0ABoards+load+at+most+5000+beads+per+project%2C+and+long+bead+text+is+fetched+on+demand.>

Or use the form at <https://paseo.cafe/submit> and paste the same values. Tick both confirmation
boxes. The bot then opens the registry pull request, checks the repo/manifest id and the security
scan, and your listing is generated on merge.

The manual fallback, if the issue form cannot express the change: copy
[`registry-entry.json`](./registry-entry.json) to `registry/beads-board.json` in a branch of
<https://github.com/paseo-cafe/paseo-cafe> and open a pull request.

## After the listing is live

The catalog treats `package.json.version` as this plugin's update identity, so every user-visible
change needs a version bump and a `pnpm publish` — a new npm release is what the six-hour scans pick
up (downloads, publish date). Push the matching commit to GitHub too, since Paseo 0.8 installs from
the repository. While the plugin is pre-1.0, `pnpm version patch` / `pnpm version minor` keeps both
in step.

## What the catalog reads from this repository

- Name — the validated plugin id (`beads-board`).
- Description — `package.json.description`.
- Author and license — `package.json.author` / `LICENSE`.
- Version — `package.json.version` (must equal the published npm version).
- Install and limitations notes — the `## Install` and `## Limitations` sections of `README.md`.
- Health badges — manifest id validity, README/LICENSE presence, `pnpm test`, `pnpm run typecheck`,
  and recency.
- Screenshots — files in `images/`. Videos — YouTube/Loom links in the README.
- Security attestation — the default-branch commit scanned by the registry.

One thing to leave alone: `paseo-plugin.json` must keep only `id`, `requirements`, and (optionally)
`build`. A `description` key there is accepted by Paseo 0.9+ but the registry's static scan rejects
it for a plugin that still declares `requirements.paseo: ">=0.8.0"`, so the one-line description
lives in `package.json` instead.
