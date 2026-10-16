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
