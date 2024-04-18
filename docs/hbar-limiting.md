# HBAR Rate Limit

Rate-limiting based on spent HBAR budget for a duration of time. Use to limit execution of queries and transactions.

## Configuration

All rate-limiting options are exposed and can be configured from `.env` .

```js
HBAR_RATE_LIMIT_TINYBAR: 11_000_000_000,
HBAR_RATE_LIMIT_DURATION: 80000
```

- **HBAR_LIMIT_TOTAL_TINYBAR**: - total hbar budget in tinybars. Default is to `11_000_000_000` (110 HBARs).
- **HBAR_RATE_LIMIT_DURATION**: - reset limit duration. This creates a timestamp, which resets all limits, when it's reached. Default is to `80000` (80 seconds).
