# Data dictionary

Each JSON object represents one row of the original retail CSV. The public file retains all 11 source fields and replaces customer names with aliases. The source describes sales and profit as monetary amounts. The dashboard follows the project convention of displaying them in Indian rupees.

| CSV column | JSON key | Type and meaning |
| --- | --- | --- |
| Order ID | `id` | String. Source order identifier. Count distinct values for orders. |
| Customer Name | `customer` | String. Pseudonymous customer alias derived from the source name. A shared name does not establish a shared identity. |
| Category | `category` | String. Grocery category. |
| Sub Category | `subcategory` | String. Product group within the category. This is the finest available product dimension. |
| City | `city` | String. City label on the source record. |
| Order Date | `date` | ISO date string (`YYYY-MM-DD`). Calendar dates carry no time or timezone. |
| Region | `region` | String. Region assigned to this record. A city can have records in several regions. |
| Sales | `sales` | Number, INR. Sales amount for this record. |
| Discount | `discount` | Number, fraction in [0, 1]. A stored 0.12 displays as 12%. |
| Profit | `profit` | Number, INR. Profit amount for this record. |
| State | `state` | String. State label on the source record. |

## Metric definitions

All calculations apply to rows remaining after global filters. Sales and profit are sums. Profit margin divides total profit by total sales. Average order value divides total sales by distinct order count. Average discount is the arithmetic mean of the source discount fractions. A discount-band margin divides the band's profit sum by its sales sum. Undefined ratios or correlations should be displayed as unavailable.

Date bounds include both selected endpoints. Month, quarter and year refer to calendar periods. Discount bands include their upper boundary: [0%, 5%], (5%, 10%], (10%, 15%], (15%, 20%] and (20%, 100%]. Within the current selection, a group qualifies for high-sales/low-profitability review when its total sales exceed the median group sales and its margin falls below the median group margin. Median ties do not qualify.

Pearson's correlation uses each matched transaction's decimal discount and profit in rupees. It is undefined with fewer than two records or with constant values on either axis. It describes a linear association and cannot identify a price or discount policy's causal effect.

## Rebuilding

Install `requirements.txt` and run `python scripts/preprocess.py "path/to/private-source.csv"` from the project root. The command generates the browser transactions, a machine-readable audit, an audit report and the independent Pandas controls for the test suite. See [the data audit](DATA_AUDIT.md) for source-specific date conventions, coverage, aliasing and validation counts.
