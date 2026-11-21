# Data audit

Source file `Supermart Grocery Sales - Retail Analytics Dataset.csv`  
SHA-256 `3963521ae14ff1cd3844ca44c974ef644e51ae696a5442d9eb55edda3255c31f`

The pipeline read **9,994 source records** and wrote **9,994 records**. It preserved source row order. It did not deduplicate, aggregate, fill, or drop records.

| Field | Missing or blank | Distinct source values after trimming |
| --- | ---: | ---: |
| Order ID | 0 | 9,994 |
| Customer Name | 0 | 50 |
| Category | 0 | 7 |
| Sub Category | 0 | 23 |
| City | 0 | 24 |
| Order Date | 0 | 1,236 |
| Region | 0 | 5 |
| Sales | 0 | 1,989 |
| Discount | 0 | 26 |
| Profit | 0 | 8,380 |
| State | 0 | 1 |

## Validation

| Check | Result |
| --- | ---: |
| Exact duplicate source rows beyond first occurrence | 0 |
| Repeated order IDs beyond first occurrence | 0 |
| Invalid calendar dates or unsupported formats | 0 |
| Non-numeric or non-finite amounts and discounts | 0 |
| Negative sales | 0 |
| Negative profits | 0 |
| Discounts outside the closed interval [0, 1] | 0 |
| Cells with outer whitespace trimmed | 0 |
| Dimension labels differing only by case or internal spacing | 0 |
| Subcategories associated with multiple categories | 0 |
| Cities associated with multiple states | 0 |
| Cities associated with multiple source regions | 24 |

Duplicate IDs may be legitimate order lines. Negative profit is a valid loss. Both are reported and retained. The pipeline rejects missing required values, invalid numbers, invalid dates, negative sales and out-of-range discounts before replacing outputs.

## Date interpretation

The parser explicitly reads **4,042** hyphenated dates as day–month–year, following the project brief, and **5,952** slash dates as month/day/year. Slash-form days range from 13 to 31. Both leading fields of 4,042 hyphenated dates are at most 12, so their ordering cannot be established from the strings alone. The convention affects monthly results and date filters. The published ISO dates cover **2015-01-02 through 2018-12-30**.

## Classification and geography

The file covers 7 categories, 23 subcategories and 24 cities. State coverage is Tamil Nadu. Regions are the labels supplied on transaction rows. Region counts are Central (2,323), East (2,848), North (1), South (1,619), West (3,203). The same city can occur under multiple regions. A drill-down reports observed region, state and city combinations. The source supplies no geographic coordinates or individual product names.

## Processing and privacy

The parser trims outer whitespace, validates the full column set, converts fiscal fields to numbers and converts dates to ISO. It replaces customer names with sequential aliases in first-appearance order. Reprocessing the same file in the same order yields the same aliases. Alias numbers can change if source rows are reordered. The mapping and original names stay out of the published files. Pseudonyms and retained order IDs can still be linked across transactions, so access and redistribution rights require review before public deployment.

## Independent controls

| Measure | Pandas result |
| --- | ---: |
| Sales (INR) | 14,956,982.00 |
| Profit (INR) | 3,747,121.20 |
| Profit / sales | 25.05265568% |
| Distinct orders | 9,994 |
| Sales / distinct orders (INR) | 1,496.596158 |
| Arithmetic mean discount | 22.68170903% |

The control fixture in `src/tests/controls.json` also contains independent slices for a category, a region, their intersection and a calendar month. The percentage fields in the fixture are decimal fractions.
