# Public repository snapshot

Repository: https://github.com/HTanvir0011/sutro-workspace

This repository starts with a fresh source snapshot of the completed Sutro workflow redesign. Its initial commit author and committer are `Htanvir0011 <hossin23105101466@diu.edu.bd>`. Earlier Git history remains in the original repository; it is not rewritten or imported here. Git contributor statistics describe commits in this repository, not ownership of third-party components.

Included: all application, server, ingestion, training, notebook, test and tooling source; project documentation; handwritten demo packets; approved self-hosted fonts, PDF/ONNX runtimes and the model files required by the public build.

Kept local: raw/sample dataset folders, `data/samples/`, extracted corpora, dataset archives, machine-specific source registries, runtime catalogs, private uploads, generated `artifacts/` training histories/checkpoints, dependency installs and generated website builds. Historical duplicate model exports are omitted; the reviewed runtime copies remain under `assets/models/`.

Third-party license and attribution files are retained. See [third-party notices](../../THIRD_PARTY_NOTICES.md).

## Reproduce

```text
npm ci --ignore-scripts --omit=optional
npm test
npm run build
npm start
```

Use Node 22.13 or newer and open http://127.0.0.1:5173. Chrome must be installed for `npm run test:e2e`.

The static examples and manual case flow do not require private datasets. Full-data inventory/training commands require separately supplied local sources and hardware. Dataset availability, real-form model acceptance and qualified domain review remain open gates. Publishing source does not imply these gates have passed.

## Vercel hosting

Live site: [https://sutro-workspace.vercel.app](https://sutro-workspace.vercel.app). Vercel project: `tanvir-790c/sutro-workspace`.

The root `vercel.json` selects the static framework preset, runs `npm ci --ignore-scripts --omit=optional` followed by `npm run build`, and publishes only `dist/`. Existing `.html` links stay intact. Response headers match the local public server, including the OCR worker's WebAssembly policy.

`.vercelignore` excludes datasets, private/runtime folders, tests, documentation, training sources and generated files from CLI uploads. The build still enforces `config/public-files.json` and verifies reviewed large assets. Vercel project metadata remains local in the ignored `.vercel/` directory.

For a new project, import `HTanvir0011/sutro-workspace` into Vercel or sign in with `npx vercel login`, link this checkout to the intended project, and run `npx vercel --prod`. The static site supports the examples and browser-local case workflow; the loopback-only private research catalog is a separate local service.

The first production release was deployed through the authenticated Vercel CLI. Redeploy this linked checkout with `npx vercel --prod --scope tanvir-790c`. Automatic deployments on GitHub pushes require connecting the GitHub account in Vercel; that connection was not available at publication time.
