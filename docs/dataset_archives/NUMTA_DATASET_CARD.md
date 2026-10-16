# NumtaDB short bundle

Source: existing local archive C:\Land Tech\land\raw\numta\numta.zip
Original dataset: NumtaDB, Bengali.AI, Kaggle BengaliAI/numta.
Licence: CC BY-SA 4.0, as recorded in the original Sutro dataset card.
Attribution: see ORIGINAL_LAND_DATASET_CARD.md, reproduced verbatim from the source bundle.

All 72,045 labelled original training images and training-a.csv through training-e.csv are retained unchanged.
Original testing-a/b/c/d/e/f images and testing-all-corrected are retained unchanged.
Only testing-auga and testing-augc are omitted: 4,274 augmented images, 82,120,589 bytes.
No images are resized, recompressed or relabelled. Test folders have no training-label CSV.
Keep original train/test roles. testing-all-corrected may overlap other test folders; do not merge them as independent examples.

FILES.csv records each included source file's path, byte size and SHA-256.
The outer ZIP uses storage mode because the images are already compressed.
Both the archive and its total extracted file bytes are below 2,000,000,000 bytes.
