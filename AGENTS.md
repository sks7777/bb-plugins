

# Repository guide

This is a multi-plugin workspace for BB. Keep every independently installable
plugin under `plugins/<id>` with its own manifest, source, tests, SDK types, and
README.

## Conventions

- Treat the root as orchestration only; it must not contain a BB plugin
  package manifest. Keep `.bb/plugins.json` aligned with the installable
  directories under `plugins/`.
- Use `bb plugin new <id> --app` when a new plugin needs a frontend, then move
  the scaffold under `plugins/<id>` and add it to the root README catalog.
- Keep plugin IDs, package names, CLI commands, realtime channels, persisted
  keys, tests, and docs aligned during a rename.
- Keep app UI components vendored inside the owning plugin so packages remain
  independent.
- Do not commit generated `dist/` or `node_modules/` directories.
- Store shared screenshots and repository media under `docs/media/`.
- Use the exact `@get-bb/plugin-sdk` version shipped by the pinned `bb-app`
  release in each plugin's `devDependencies`; do not restore vendored SDK
  declarations or SDK path aliases.

## Verification

Run all plugin checks from the workspace root:

```sh
npm install
npm run check
```

Plugin build/type scripts must clear `BB_CLI` before invoking the workspace's
`bb` binary. Agent sessions set that variable to the running application; using
it here would repin `@get-bb/plugin-sdk` from whichever BB build is currently
open instead of the version pinned by the lockfile.

Before handing off a new plugin, install its local path in BB and verify its
human UI and CLI surface:

```sh
bb plugin install ./plugins/<id>
bb plugin reload <id>
```
