# Releasing Recall

Commits to `main` don't reach students. Only a published GitHub release does: the
launcher on each student's computer checks the latest release when Recall starts.

## Cutting a release

1. Merge your changes to `main`. Bump `"version"` in `package.json` in the same PR
   (optional, but it keeps `npm run dev` showing the right number).
2. On GitHub: **Releases → Draft a new release**. Create a tag like `v0.3.0` on `main`,
   click **Generate release notes**, then **Publish release**.
3. The **Release** workflow (Actions tab) builds Recall on macOS (Apple silicon and
   Intel), Windows and Linux, starts each build once to check it runs, then attaches
   to the release:
   - `recall-<version>-<platform>-<arch>.tar.gz`: one bundle per platform
   - `manifest.json`: the version, download URLs and checksums the launcher reads
   - `install.sh` / `install.ps1`
4. Wait for the workflow to go green (about 10 minutes). Students get the update the
   next time they open Recall.

The version comes from the tag, so `v0.3.0` produces `0.3.0` builds even if
`package.json` says something else.

## Testing a release first

Tick **Set as a pre-release** when publishing. The workflow still builds and attaches
everything, but pre-releases are never "latest", so students' launchers ignore them.
To install one yourself, pass its tag to the installer (see the README).
When you're happy, edit the release and untick pre-release.

## If the workflow failed

Fix the problem on `main`, then rerun it for the same tag from **Actions → Release →
Run workflow** with the tag (e.g. `v0.3.0`). Assets are replaced, not duplicated.
If the fix needs new code, publish a new patch version instead (`v0.3.1`), since the
tag points at the old commit.

## Rules that keep students' data safe

- **Database changes go in `MIGRATIONS` in `src/lib/db.ts`, appended at the end.**
  Never edit, reorder or remove one that has shipped: students' databases have already
  run it. The database is backed up automatically before migrations run.
- **Never require a Node major the bundles weren't built with.** The Node version comes
  from `.node-version`; the launcher downloads whatever Node a release was built with.
- Building locally: `npm run build && npm run package` writes the bundle for your own
  platform to `dist/`.
