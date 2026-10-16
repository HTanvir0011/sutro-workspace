# P01 — security/storage boundary

Outcome: explicit public packaging; canonical streamed loopback serving; private directories excluded; no auto-publication; strict packet boundary and DOM text rendering; same-origin launch session; self-hosted fonts/runtime and a restrictive CSP. The only WASM compilation exception is on the OCR worker entry response. HTTP remains local and no HTTPS/HSTS claim is made.

Changed: `scripts/build.js`, `scripts/serve.js`, `scripts/check-release.js`, the preflight-only former publishing script, `server/http.js`, `.gitignore`, `config/public-files.json`, validation/DOM modules and page controllers. Large inference/WASM files require exact reviewed hashes and load on explicit OCR use. Training files and restricted scans are absent from dist.

Verification: security tests pass, including Windows junction, drive/ADS/separator traversal, malformed encoding, methods, Host/Origin and local session rejection. Browser XSS labels remain inert. Actual Chrome worker/WASM parity with Python CPU passed for digit 32 and line widths 64/128/320, max absolute difference below 1e-4; see `model-runtime-parity.json`. No broad unsafe-inline or unsafe-eval. Public build is generated independently of docs. No code invokes publication.

Limits: historical tracked training/model artifacts remain unchanged and are excluded from dist; history/staging cleanup is a separate owner scope before any future publication. Full gateway abuse matrix and final dependency review are P12 checks. Parity is not OCR task accuracy or model promotion. Next: P02 contract/storage acceptance.
