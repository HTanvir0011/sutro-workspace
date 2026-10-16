# Sutro dataset bundle (LandTech 2026)

## What is in here
| Folder | What | Size |
|---|---|---|
| **`khatian_form5462/`** | **Main dataset.** Bangla khatian pages in the layout of Bangladesh *Form 5462 (revised)*, with exact field boxes, linked CSV tables, **title lines** (the same land across CS -> SA -> RS -> BS khatians) and OCR line crops | 5,794 pages, 2,000 lands, 318,988 annotated fields, 107,475 OCR crops |
| `synthetic/` | Sutro reasoning cases (packets with injected faults + relational tables) and number-string crops | 20,000 cases, 30,000 crops |
| `real_public/` | Public real data: NumtaDB handwritten digits, DIU deed scans | 72,045 digits, 653 scans |
| `ocr_cells_packed/` | The OCR crops packed as `cells_{train,val,test}.npz` (uint8 strip + widths) and csv - what the training notebooks read | 3 splits |
| `notebooks/` | `01_khatian_cell_ocr_crnn.ipynb` (text-line OCR, CRNN+CTC) and `02_numta_digit_cnn.ipynb` (digit CNN); run on Kaggle GPU or locally | 2 |
| `tools/` | Generators, converters, loader, fonts (all OFL / MIT) | |

## 1. khatian_form5462 (main)
**Layout source.** The page layout, column structure and terminology (9 columns: owner/address, share, revenue, dag no., land class, total area of dag in acre/decimal, share of this khatian in the dag, proportional area, remarks; header block with division/district/thana/mouza/JL/sheet no.; "total land" footer) were modelled on **one real RS khatian supplied by the project owner**. **Nothing from that sample's data, seal or signature is reused.** Every person, dag, khatian number, mouza and office here is invented; admin names (division/district/upazila) are real units used illustratively and paired for plausibility only. The page carries generic stamps that say SYNTHETIC.

**What a page contains** (`annotations.jsonl`, one JSON per page): `fields[]` = `{field, row, text, poly}` (poly = 4 corners in final image coordinates, rotation applied; boxes come from the live layout, not estimated), `lines[]` = ruled table lines, plus `survey`, `year`, `font`, `rotation_deg`. Field names: area_acre, area_dec, dag_no, district, division, father, jl_no, khatian_no, land_class, mouza, owner_name, owner_share, remark, revenue, share_in_dag, share_total, sheet_no, spouse, total_acre, total_dec, total_land_acre, total_land_dec, upazila, village.

**Printed-number conventions** (as on the real form): areas are split into acre (6(ka)/8(ka)) and decimal/shatangsho (6(kha)/8(kha)); the decimal part is printed as **4 digits = hundredths** (`৪৩০০` = 43.00). Owner shares are **3-decimal fractions that sum to exactly `১.০০০`** (largest-remainder rounding of exact fractions; `owners.csv` keeps the exact fraction). Column 7 = share of this khatian in the dag; column 8 = total x share, rounded to hundredths; the footer total is the sum of column 8. All verified in `tools/load_dataset.py`.

**Title lines.** Each *land* (same mouza + same dag numbers) has 2-4 khatian versions in survey order (CS 1890-1940, SA 1950-1968, RS 1968-1996, BS 1998-2021). Between versions the owners change by **inheritance** (a male owner dies; heirs get Hanafi shares computed exactly for Muslim families, or an *illustrative* equal split for Hindu families - `basis` says which; this is not legal advice), **sale** (an owner sells 1/4, 1/3 or 1/2 of their share to a new person), both, or no change. `title_line.csv` links consecutive versions with the transition details; transitions here: {'sale': 890, 'inheritance': 1726, 'inheritance+sale': 758, 'none': 420}.

| table | rows | key columns |
|---|---|---|
| `lands.csv` | 2,000 | land_id, split, religion_of_family, division, district, upazila, mouza, jl_no, n_dags, n_versions |
| `khatians.csv` | 5,794 | khatian_id (`<land_id>-v<k>`), survey, year, khatian_no, sheet_no, total_land_dec, image_file |
| `owners.csv` | 23,120 | khatian_id, name_bn, gender, father_or_spouse_bn, village_bn, share_exact, share_printed_3dp |
| `dag_rows.csv` | 31,572 | khatian_id, dag_no, land_class_bn, total_dec, share_in_dag, area_dec, remark_bn |
| `title_line.csv` | 3,794 | land_id, from/to_khatian_id, from/to_survey, transition, detail_json |
| `ocr_cells/labels.csv` | 107,475 | file, text, field_type, page_id, split |

Splits are **by land** (80/10/10), so versions of one land never straddle train and test. Pages by survey: {'RS': 1776, 'BS': 1139, 'CS': 1104, 'SA': 1775}; by split: {'train': 4645, 'val': 570, 'test': 579}; by font: {'notosans': 1453, 'notoserif': 1131, 'hind': 857, 'nirmala': 2353}. OCR crop types: {'share_in_dag': 5794, 'owner_name': 14079, 'land_class': 11588, 'father': 5794, 'mouza': 5794, 'area_dec': 5794, 'total_dec': 5794, 'owner_share': 5794, 'village': 5794, 'dag_no': 11588, 'upazila': 5794, 'district': 5794, 'division': 5794, 'spouse': 2521, 'remark': 9759}.

**Limits - read before using.**
- Only **one** layout (Form 5462 style) is modelled, applied to all four survey labels. Real CS/SA khatians are older, differently-formatted (often handwritten) records and are **not** replicated here.
- Pages are **printed-text renders** (4 Bengali font families: Nirmala UI, Hind Siliguri, Noto Sans Bengali, Noto Serif Bengali) with simulated scanning (paper tint, uneven light, noise, blur, rotation up to 1.3 degrees, JPEG). They are not photographs, not handwriting, and not real scans; a model trained only on them needs real data (e.g. the DIU deeds) to be trusted.
- Real forms have quirks this does not model (smudges, hand corrections, torn margins, stamps over text, multi-page khatians).
- The column-5 sub-headers are both printed as in the reference sample; the land class is placed in the first sub-column.

## 2. synthetic/ (Sutro reasoning cases)
20,000 case packets ({'train': 16000, 'val': 2000, 'test': 2000}) with injected faults; `tables/` is the same data as relational CSV ({'cases': 20000, 'deed_parties': 31764, 'deeds': 15882, 'heir_certs': 20000, 'heirs': 100004, 'khatian_owners': 116767, 'khatians': 40000, 'mutations': 14333, 'searches': 20000}); `number_strings/` = 30,000 font-rendered number crops. `tools/verify_packets.js` ran the real Sutro engine over all 20,000 cases: **20,000/20,000** show every expected finding and no unexpected one. That is a **generator-vs-engine self-consistency check (both written by the same author), not evidence of real-world accuracy**.

| fault | cases |
|---|---|
| `clean` | 3,240 |
| `clean_stated` | 3,177 |
| `dead_seller` | 865 |
| `mutation_before_deed` | 836 |
| `search_omits_deed` | 835 |
| `over_sale_deed` | 825 |
| `double_sale` | 823 |
| `coverage_gap` | 820 |
| `no_surviving_son` | 811 |
| `heir_omitted` | 808 |
| `missing_previous_deed` | 798 |
| `duplicate_deed_no` | 786 |
| `share_sum_bad` | 782 |
| `predeceased_unknown` | 773 |
| `stated_share_diff` | 773 |
| `deed_area_mismatch` | 769 |
| `no_mutation` | 763 |
| `dag_unmapped` | 760 |
| `uncertified_copy` | 756 |

## 3. real_public/ (real data; read the privacy notes)
| Folder | What | Count | Labels | Licence |
|---|---|---|---|---|
| `numta_digits/` | NumtaDB handwritten Bangla digits, 32x32, ink bright (`numta_32x32.npz`) | 64,841 train + 7,204 val | digit 0-9 | **CC BY-SA 4.0** (ShareAlike applies to this converted copy) |
| `dolil_deeds/` | DIU *Bangla Handwritten Dolil Dataset*: scans of **real** handwritten deeds, long side <= 1600 px, with original SHA-256 | 653 {'train': 522, 'val': 65, 'test': 66} | none | CC BY 4.0 |

## Quick start
```bash
python tools/load_dataset.py .       # loads every part, checks page<->CSV links and that printed shares sum to 1.000
```

## Privacy and rulebook notes (LandTech 2026, section 8)
- **The reference khatian image you used for the layout contains real people's names and an official seal/signature. Do not commit it, publish it or show it in the demo** unless the organisers approve it in writing after full anonymisation. Nothing from it is in this bundle.
- `real_public/dolil_deeds` are **real deeds** and may contain personal data: keep them out of your repo, video and slides until approved (csetech@diu.edu.bd). `khatian_form5462/` and `synthetic/` contain only invented data and are safe to show (every page is marked SYNTHETIC).
- No government portal was scraped. No real khatian dataset (RS/BS/CS/SA, image or CSV) is publicly available: KhatianDoc's Hugging Face repo is empty.

## Units
`synthetic/tables/share_units.csv` / `area_units.csv`: ana-ganda-kora-kranti-til ratios (20 til = 1 kranti; 3 kranti = 1 kora; 4 kora = 1 ganda; 20 ganda = 1 ana) come from a Ministry of Land portal page via search; **"whole = 16 ana" is unverified**. Area: 1 decimal = 435.6 sq ft; 1 katha = 720 sq ft; 1 bigha = 20 katha - approximate, regional.

## Attribution and licences
- Fonts (in `tools/fonts/`): Hind Siliguri, Noto Sans Bengali, Noto Serif Bengali - SIL Open Font License 1.1 (from github.com/google/fonts). Nirmala UI is a Windows system font and is not redistributed.
- Saifullah Anik, Md. Obydul Hossain, Radoanul Arifen, Md. Shakib Ahammed (Daffodil International University). *Bangla Handwritten Dolil Dataset (653 Images)*. Mendeley Data V1, 2025, doi:10.17632/yk3c3xy9vm.1, CC BY 4.0. **Changes: resized to long side <= 1600 px, re-encoded as JPEG, split added.**
- NumtaDB, Bengali.AI (Kaggle `BengaliAI/numta`), CC BY-SA 4.0. **Changes: resized to 32x32, inverted, packed as npz.**
- Generated data and tools: MIT.

## Removed on purpose
General handwriting/layout datasets (BN-HTRd, Ekush, BanglaLekha, BaDLAD), the earlier invented-layout page set, partial downloads and scratch files.
