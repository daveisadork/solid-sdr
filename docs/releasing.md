# Releasing

## Creating a release

1. Ensure you are on `main` with a clean working tree.

2. Tag the commit with a semver version:
   ```sh
   git tag v1.2.3
   git push origin v1.2.3
   ```

3. Run the release:
   ```sh
   pnpm release
   ```

GoReleaser builds all targets, creates archives, generates `checksums.txt`,
and (once CI is configured) uploads everything to GitHub Releases.

## Local snapshot build (no tag required)

```sh
pnpm release:build
```

Produces the same artifacts in `dist/` without publishing anything. Useful
for testing the build pipeline.

> **If a build fails partway through**, the temporary web assets at
> `apps/bridge/internal/static/web/` may be left behind. Remove them manually
> before retrying:
> ```sh
> rm -rf apps/bridge/internal/static/web
> ```

## Adding CI with GitHub Actions

When ready to automate releases, see the
[GoReleaser GitHub Actions guide](https://goreleaser.com/ci/actions/).

The `pnpm release` script is already CI-ready. A GitHub Actions workflow only
needs to call it with a `GITHUB_TOKEN` environment variable set.
