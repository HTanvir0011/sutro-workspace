> Historical local packaging report. Dataset files and ZIP archives are not included in the GitHub delivery. Counts and checksums below describe the original local packages.

# Land Tech: two datasets under 2 GB each

| Dataset | ZIP size (GB) | Extracted size (GB) | Contents |
|---|---:|---:|---|
| dataset_1_land_ocr.zip | 1.607 | 1.731 | Complete prepared Sutro land/OCR bundle |
| dataset_2_numta_digits.zip | 1.984 | 1.969 | Original NumtaDB images and labels, with augmented test folders omitted |

The cap is 2,000,000,000 bytes for each ZIP and for its extracted contents. No padding was added.
These are complementary packages by task, not two training/test splits.

Dataset 1 retains all 5,794 khatian pages, 2,000 lands, 107,475 OCR crops, 20,000 reasoning cases,
30,000 number crops, 653 resized deed scans, packed OCR arrays, 72,045 processed digits, notebooks and tools.
Extract it and read sutro-dataset/DATASET_CARD.md for attribution, existing data restrictions and usage.

Dataset 2 retains all 72,045 original labelled Numta training images, five label CSVs,
and non-augmented/corrected test folders. testing-auga and testing-augc (4,274 images) are omitted.
Read numta_short/DATASET_CARD.md and use numta_short/FILES.csv for individual source hashes.
The 32x32 digits in Dataset 1 are derived from the originals in Dataset 2; these must not be treated as independent samples.

The existing resized deed copies are included; the large raw deed originals are not repeated.
Source projects, caches, downloaded ZIPs and model weights are not copied into the new datasets.
Both packages retain their original internal paths and labels. All source files were left unchanged.

Verification: all ZIP entries passed CRC, every Numta source file was hash-checked,
all khatian page/crop references and table links passed, and existing land train/val/test roles were preserved.
Exact bytes, counts and hashes are in dataset_report.json and SHA256SUMS.txt.
