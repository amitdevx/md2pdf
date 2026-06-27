# Tables

This file tests GFM tables.

## Basic Table
| Header 1 | Header 2 |
|----------|----------|
| Row 1 Col 1 | Row 1 Col 2 |
| Row 2 Col 1 | Row 2 Col 2 |

## Aligned Columns
| Left | Center | Right |
| :--- | :----: | ----: |
| L1   | C1     | R1    |
| L2   | C2     | R2    |

## Wide Table (Overflow testing)
| Col 1 | Col 2 | Col 3 | Col 4 | Col 5 | Col 6 | Col 7 | Col 8 | Col 9 | Col 10 |
|---|---|---|---|---|---|---|---|---|---|
| A | B | C | D | E | F | G | H | I | J |
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |

## Markdown inside cells
| Code | Bold | Italic |
|------|------|--------|
| `console.log()` | **Heavy** | *Slanted* |
