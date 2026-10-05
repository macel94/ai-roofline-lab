# Reproducible build and CI pins

The deploy workflow avoids floating dependency/action selectors:

- **Node:** `24.19.0` in `.nvmrc`, `package.json` engines, and `actions/setup-node`.
- **npm:** `11.17.0` in `packageManager`/engines; it is also the npm bundled with official Node `24.19.0`. CI asserts both exact versions. `.npmrc` enforces engines and exact future saves.
- **JavaScript packages:** exact direct versions in `package.json`; npm lockfile v3 holds all 64 transitive/direct entries with exact versions, registry tarball URLs and integrity hashes. CI uses `npm ci`, not a dependency-resolving install.
- **Actions:** every `uses:` dependency is pinned to a verified full 40-character upstream commit SHA. Comments record the release tag checked against the GitHub API. `checkout` does not persist its token into subsequent build/test steps.
- **Browser/test OS:** Microsoft Playwright image `v1.63.0-noble`, resolved to immutable Linux/amd64 image digest `sha256:bc6ab0d6d44ff4826e4cb8c1e6d801e185bfc42bb0753f8e2a30efc70db054c7`. It includes Playwright 1.63.0's browsers and system dependencies; the image's version matches locked `@playwright/test` 1.63.0. CI avoids downloading browsers or installing mutable apt packages.
- **Host runner:** `ubuntu-24.04`, rather than `ubuntu-latest`; the build/test job itself executes inside the digest-pinned container.

Sources checked: [Node.js release index](https://nodejs.org/dist/index.json) reports npm 11.17.0 for Node 24.19.0; [GitHub's security-hardening guidance](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions) states full-length action SHAs are the immutable action reference; [setup-node documentation](https://github.com/actions/setup-node/blob/v7.0.0/README.md) documents exact versions and package-lock based caching; [Playwright Docker docs](https://playwright.dev/docs/docker) state the images contain browsers/system dependencies and warn that image/package versions must match. The MCR `v1.63.0-noble` OCI manifest was fetched and its amd64 child digest checked before pinning.

## Limits

This makes dependency resolution and the build/test container reproducible, not bit-for-bit identical across every publication. GitHub-hosted runner service/virtualization, GitHub Actions runtime orchestration, GitHub Pages, network availability and remote image/registry availability remain external services. The host runner label is release-pinned but GitHub updates its runner image. The Node distribution and browser image are identified by exact version/digest, npm package tarballs are integrity-verified from the lockfile, and OS/browser files inside the CI container are immutable by digest. No lockfile update, action update, Node update or image update occurs automatically; update them deliberately, verify upstream releases, regenerate the lock with the pinned npm, and rerun clean-install/build/E2E checks.

## Local clean verification

```sh
nvm use                 # reads .nvmrc
node --version          # v24.19.0
npm --version           # 11.17.0
npm ci
npx playwright install chromium
npm run test:e2e
```

CI uses the preinstalled browser/system libraries from the pinned image and invokes the local Playwright executable. The lock and image pin suite are checked by the same E2E run; the workflow asserts exact toolchain versions before `npm ci`.
