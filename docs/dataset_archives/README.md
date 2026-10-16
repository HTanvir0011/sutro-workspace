# Local dataset archives

The supplied sample datasets and the future approximately 15 GB full corpus
are kept locally. Dataset archives and raw dataset folders are not included in
this GitHub delivery. This directory contains documentation and dataset cards;
there are no downloadable sample ZIPs or Git LFS dataset pointers on `main`.

## Dataset locations

| Dataset | Local location |
|---|---|
| Existing land/OCR sample | `docs/dataset_1_land_ocr/sutro-dataset/` |
| Existing Numta sample | `docs/dataset_2_numta_digits/numta_short/` |
| Future approximately 15 GB corpus | `docs/datasets/full/` |

Preserve original filenames and internal folders. Existing samples do not need
to be deleted. Obtain dataset files separately from the project owner and
follow [the full dataset setup instructions](../datasets/README.md).
Local ZIP files and their packaging manifests/checksums are ignored by Git.
The reports in `docs/outputs/` describe historical local packaging, not files
available for download from this repository.

## Integration and privacy

Adding files does not automatically enable dataset-backed features. Follow
`docs/PROFESSIONAL_REDESIGN_IMPLEMENTATION_PLAN.md` to inspect actual sources,
register their paths, build indexes and implement the planned data API.
Keep raw records, archives and generated private runtime data outside public
website build output.

Read `LAND_OCR_DATASET_CARD.md`, `NUMTA_DATASET_CARD.md` and the original source
cards before using or redistributing data. Their original attribution,
licensing, privacy restrictions and evaluation caveats continue to apply.
