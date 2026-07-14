# MulRate v1.0.0 beta.16 Balance Notes

The beta.15 rate curve was kept as the base. beta.16 adds a written-work grace factor for problems where many learners are expected to use written calculation.

## Written-work grace

The stored curriculum target seconds are unchanged. For progress and rate calculations, an effective target is used:

- 2-digit/3-digit × 2-digit: x1.18
- Decimal multiplication: x1.12 to x1.18
- Advanced 4-digit / 3-digit multiplier stages: x1.28
- Other stages with difficulty 4.0+: x1.12
- Kuku stages: unchanged

This reduces excessive penalty from handwriting and written calculation without making careless fast answers more valuable.
