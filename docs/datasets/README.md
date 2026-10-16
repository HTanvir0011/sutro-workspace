# Full dataset location

Place the full approximately 15 GB dataset inside **`docs/datasets/full/`**.
Extract its original folders there without renaming files or changing the source
structure. Existing sample folders do not need to be deleted.

```text
docs/
  dataset_1_land_ocr/       # Existing local sample
  dataset_2_numta_digits/   # Existing local sample
  datasets/
    full/                  # Full corpus; keep original folders inside
```

Obtain the dataset files separately from the project owner. Raw sample folders,
full datasets and local ZIP archives are excluded from GitHub delivery. Keep
them and generated private runtime data outside public website build output.

Configure actual source roots during the inventory/indexing phase described in
`docs/PROFESSIONAL_REDESIGN_IMPLEMENTATION_PLAN.md`; the current website does
not automatically scan this directory. Preserve original dataset cards,
manifests and source hashes with the local data.
