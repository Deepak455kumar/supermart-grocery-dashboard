"""Regression checks for the two date formats and source validation."""
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import unittest

import pandas as pd
from preprocess import parse_dates, prepare


class DateParsingTests(unittest.TestCase):
    def test_ambiguous_hyphens_follow_the_brief(self):
        dates, formats = parse_dates(pd.Series(["11-08-2017", "06-12-2017"]))
        self.assertEqual(list(dates.dt.strftime("%Y-%m-%d")), ["2017-08-11", "2017-12-06"])
        self.assertEqual(formats["dayFirstHyphens"], 2)

    def test_slashes_and_leap_days(self):
        dates, _ = parse_dates(pd.Series(["9/23/2018", "2/29/2016", "2/29/2015", "2017-09-21"]))
        self.assertEqual(dates.iloc[0].isoformat()[:10], "2018-09-23")
        self.assertEqual(dates.iloc[1].isoformat()[:10], "2016-02-29")
        self.assertTrue(dates.iloc[2:].isna().all())


class PipelineTests(unittest.TestCase):
    def test_preserves_multiple_lines_losses_and_private_customer_mapping(self):
        record = {"Order ID": "A", "Customer Name": "Private fixture", "Category": "Group",
                  "Sub Category": "Subset", "City": "City", "Order Date": "1/15/2018",
                  "Region": "Area", "Sales": 20, "Discount": .12, "Profit": -1.25, "State": "State"}
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "input.csv"
            pd.DataFrame([record, record]).to_csv(source, index=False)
            prepare(source, root)
            rows_file = root / "public/data/sales.json"
            before = rows_file.read_bytes()
            rows = json.loads(before)
            self.assertEqual(len(rows), 2)
            self.assertNotIn(b"Private fixture", before)
            self.assertEqual(rows[0]["customer"], rows[1]["customer"])
            self.assertEqual(rows[0]["profit"], -1.25)
            audit = json.loads((root / "public/data/audit.json").read_bytes())
            self.assertEqual(audit["duplicateOrderIds"], 1)
            self.assertEqual(audit["overall"]["orders"], 1)
            pd.DataFrame([{**record, "Discount": 1.2}]).to_csv(source, index=False)
            with self.assertRaises(ValueError):
                prepare(source, root)
            self.assertEqual(rows_file.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()

