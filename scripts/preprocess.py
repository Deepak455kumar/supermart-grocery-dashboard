"""Validate the private Supermart CSV and regenerate its public dashboard assets."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd


PROJECT = Path(__file__).resolve().parents[1]
COLUMNS = {
    "Order ID": "id", "Customer Name": "customer", "Category": "category",
    "Sub Category": "subcategory", "City": "city", "Order Date": "date",
    "Region": "region", "Sales": "sales", "Discount": "discount",
    "Profit": "profit", "State": "state",
}
DIMENSIONS = ["Category", "Sub Category", "City", "Region", "State"]


def parse_dates(values):
    hyphens = values.str.fullmatch(r"\d{1,2}-\d{1,2}-\d{4}")
    slashes = values.str.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}")
    parsed = pd.Series(pd.NaT, index=values.index, dtype="datetime64[ns]")
    for mask, pattern in [(hyphens, "%d-%m-%Y"), (slashes, "%m/%d/%Y")]:
        parsed.loc[mask] = pd.to_datetime(values.loc[mask], format=pattern, errors="coerce")
    return parsed, {"dayFirstHyphens": int(hyphens.sum()), "monthFirstSlashes": int(slashes.sum())}


def json_text(value):
    return json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n"


def controls(frame):
    """Independent KPI controls, using Pandas on private source-column names."""
    sales = float(frame["Sales"].sum())
    profit = float(frame["Profit"].sum())
    orders = int(frame["Order ID"].nunique())
    return {
        "rows": len(frame), "sales": round(sales, 2), "profit": round(profit, 2),
        "orders": orders, "margin": profit / sales if sales else None,
        "aov": sales / orders if orders else None,
        "discount": float(frame["Discount"].mean()) if len(frame) else None,
    }


def report(audit):
    formats = audit["dateFormats"]
    m = audit["overall"]
    margin_text = f"{m['margin']:.8%}" if m["margin"] is not None else "N/A"
    slash_range = (f"Slash-form days range from {audit['slashDayMin']} to {audit['slashDayMax']}."
                   if formats["monthFirstSlashes"] else "The source has no slash-form dates.")
    region_counts = ", ".join(f"{k} ({v:,})" for k, v in audit["regions"].items())
    by_column = "\n".join(
        f"| {key} | {count:,} | {audit['distinctValues'][key]:,} |"
        for key, count in audit["missingValues"].items()
    )
    return f"""# Data audit

Source file `{audit['sourceFile']}`  
SHA-256 `{audit['sourceSha256']}`

The pipeline read **{audit['originalRows']:,} source records** and wrote **{audit['finalRows']:,} records**. It preserved source row order. It did not deduplicate, aggregate, fill, or drop records.

| Field | Missing or blank | Distinct source values after trimming |
| --- | ---: | ---: |
{by_column}

## Validation

| Check | Result |
| --- | ---: |
| Exact duplicate source rows beyond first occurrence | {audit['duplicateRows']} |
| Repeated order IDs beyond first occurrence | {audit['duplicateOrderIds']} |
| Invalid calendar dates or unsupported formats | {audit['invalidDates']} |
| Non-numeric or non-finite amounts and discounts | {sum(audit['invalidNumeric'].values())} |
| Negative sales | {audit['negativeSales']} |
| Negative profits | {audit['negativeProfits']} |
| Discounts outside the closed interval [0, 1] | {audit['invalidDiscounts']} |
| Cells with outer whitespace trimmed | {audit['trimmedCells']} |
| Dimension labels differing only by case or internal spacing | {sum(audit['labelVariantGroups'].values())} |
| Subcategories associated with multiple categories | {audit['subcategoriesInMultipleCategories']} |
| Cities associated with multiple states | {audit['citiesInMultipleStates']} |
| Cities associated with multiple source regions | {audit['citiesInMultipleRegions']} |

Duplicate IDs may be legitimate order lines. Negative profit is a valid loss. Both are reported and retained. The pipeline rejects missing required values, invalid numbers, invalid dates, negative sales and out-of-range discounts before replacing outputs.

## Date interpretation

The parser explicitly reads **{formats['dayFirstHyphens']:,}** hyphenated dates as day–month–year, following the project brief, and **{formats['monthFirstSlashes']:,}** slash dates as month/day/year. {slash_range} Both leading fields of {audit['ambiguousHyphenDates']:,} hyphenated dates are at most 12, so their ordering cannot be established from the strings alone. The convention affects monthly results and date filters. The published ISO dates cover **{audit['dateMin']} through {audit['dateMax']}**.

## Classification and geography

The file covers {audit['distinctValues']['Category']} categories, {audit['distinctValues']['Sub Category']} subcategories and {audit['distinctValues']['City']} cities. State coverage is {', '.join(audit['states'])}. Regions are the labels supplied on transaction rows. Region counts are {region_counts}. The same city can occur under multiple regions. A drill-down reports observed region, state and city combinations. The source supplies no geographic coordinates or individual product names.

## Processing and privacy

The parser trims outer whitespace, validates the full column set, converts fiscal fields to numbers and converts dates to ISO. It replaces customer names with sequential aliases in first-appearance order. Reprocessing the same file in the same order yields the same aliases. Alias numbers can change if source rows are reordered. The mapping and original names stay out of the published files. Pseudonyms and retained order IDs can still be linked across transactions, so access and redistribution rights require review before public deployment.

## Independent controls

| Measure | Pandas result |
| --- | ---: |
| Sales (INR) | {m['sales']:,.2f} |
| Profit (INR) | {m['profit']:,.2f} |
| Profit / sales | {margin_text} |
| Distinct orders | {m['orders']:,} |
| Sales / distinct orders (INR) | {m['aov']:,.6f} |
| Arithmetic mean discount | {m['discount']:.8%} |

The control fixture in `src/tests/controls.json` also contains independent slices for a category, a region, their intersection and a calendar month. The percentage fields in the fixture are decimal fractions.
"""


def prepare(source, output):
    raw = pd.read_csv(source, dtype=str, encoding="utf-8-sig", keep_default_na=False,
                      skip_blank_lines=False)
    if set(raw.columns) != set(COLUMNS) or raw.empty:
        raise ValueError(f"Expected a nonempty CSV with columns {list(COLUMNS)}. Found {list(raw.columns)}.")
    frame = raw.loc[:, list(COLUMNS)].apply(lambda col: col.str.strip())
    dates, formats = parse_dates(frame["Order Date"])
    audit = {
        "sourceFile": source.name,
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "originalRows": len(raw),
        "missingValues": {k: int(v) for k, v in frame.eq("").sum().items()},
        "distinctValues": {k: int(v) for k, v in frame.nunique().items()},
        "trimmedCells": int(raw.ne(frame).sum().sum()),
        "duplicateRows": int(raw.duplicated().sum()),
        "duplicateOrderIds": int(frame["Order ID"].duplicated().sum()),
        "invalidDates": int(dates.isna().sum()), "dateFormats": formats,
    }
    for col in ["Sales", "Profit", "Discount"]:
        frame[col] = pd.to_numeric(frame[col], errors="coerce")
    audit["invalidNumeric"] = {c: int((~np.isfinite(frame[c])).sum()) for c in ["Sales", "Profit", "Discount"]}
    audit["negativeSales"] = int(frame["Sales"].lt(0).sum())
    audit["negativeProfits"] = int(frame["Profit"].lt(0).sum())
    audit["invalidDiscounts"] = int((~frame["Discount"].between(0, 1)).sum())
    if any([sum(audit["missingValues"].values()), sum(audit["invalidNumeric"].values()),
            audit["invalidDates"], audit["negativeSales"], audit["invalidDiscounts"]]):
        raise ValueError("Input failed validation. No output was replaced.\n" + json_text(audit))

    hyphen_parts = frame.loc[frame["Order Date"].str.contains("-"), "Order Date"].str.extract(r"^(\d+)-(\d+)-").astype(int)
    slash_days = dates[frame["Order Date"].str.contains("/")].dt.day
    variants = {}
    for c in DIMENSIONS:
        labels = frame[c].drop_duplicates()
        normalized = labels.str.casefold().str.replace(r"\s+", " ", regex=True)
        variants[c] = int(normalized.value_counts().gt(1).sum())
    audit.update({
        "dateMin": dates.min().date().isoformat(), "dateMax": dates.max().date().isoformat(),
        "ambiguousHyphenDates": int(hyphen_parts.le(12).all(axis=1).sum()),
        "slashDayMin": int(slash_days.min()) if len(slash_days) else None,
        "slashDayMax": int(slash_days.max()) if len(slash_days) else None,
        "labelVariantGroups": variants,
        "subcategoriesInMultipleCategories": int(frame.groupby("Sub Category")["Category"].nunique().gt(1).sum()),
        "citiesInMultipleStates": int(frame.groupby("City")["State"].nunique().gt(1).sum()),
        "citiesInMultipleRegions": int(frame.groupby("City")["Region"].nunique().gt(1).sum()),
        "regions": {k: int(v) for k, v in frame["Region"].value_counts().sort_index().items()},
        "states": sorted(frame["State"].unique().tolist()),
        "overall": controls(frame),
    })
    frame["Order Date"] = dates.dt.strftime("%Y-%m-%d")
    category = "Beverages" if "Beverages" in set(frame["Category"]) else frame["Category"].iloc[0]
    region = "South" if "South" in set(frame["Region"]) else frame["Region"].iloc[0]
    month = dates.min().to_period("M")
    slices = [
        ({"category": category}, frame["Category"].eq(category)),
        ({"region": region}, frame["Region"].eq(region)),
        ({"category": category, "region": region}, frame["Category"].eq(category) & frame["Region"].eq(region)),
        ({"from": month.start_time.date().isoformat(), "to": month.end_time.date().isoformat()}, dates.dt.to_period("M").eq(month)),
    ]
    fixture = {"overall": controls(frame), "slices": [
        {"filters": filters, "expected": controls(frame.loc[mask])} for filters, mask in slices
    ]}
    codes, _ = pd.factorize(frame["Customer Name"], sort=False)
    frame["Customer Name"] = [f"Customer {code + 1:03d}" for code in codes]
    records = frame.rename(columns=COLUMNS)
    audit["finalRows"] = len(records)
    outputs = {
        "public/data/sales.json": json.dumps(records.to_dict(orient="records"),
                                             ensure_ascii=False, allow_nan=False, separators=(",", ":")),
        "public/data/audit.json": json_text(audit),
        "src/tests/controls.json": json_text(fixture),
        "docs/DATA_AUDIT.md": report(audit),
    }
    for relative, payload in outputs.items():
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(payload, encoding="utf-8")
    print(f"Validated and exported {len(records):,} transactions to {output}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, help="Private source CSV (preserved)")
    parser.add_argument("--output", type=Path, default=PROJECT, help="Project root")
    args = parser.parse_args()
    prepare(args.csv, args.output)
