# KoaJsonRpc Rate Limit

Rate-limiting middleware for Koa Json Rpc. Use to limit repeated requests to APIs and/or endpoints by IP.

## Configuration

All rate-limiting options are exposed and can be configured from `.env` .
Limit tiers are total number of requests for a configurable duration per IP and endpoint.

```js
DEFAULT_RATE_LIMIT = 200;
TIER_1_RATE_LIMIT = 100;
TIER_2_RATE_LIMIT = 800;
TIER_3_RATE_LIMIT = 1600;
LIMIT_DURATION = 60000;
RATE_LIMIT_DISABLED = false;
```

- **DEFAULT_RATE_LIMIT**: - default fallback rate limit, if no other is configured. Default is to `200` (200 request per IP).
- **TIER_1_RATE_LIMIT**: - restrictive limiting tier, for expensive endpoints. Default is to `100` (100 request per IP).
- **TIER_2_RATE_LIMIT**: - moderate limiting tier, for non expensive endpoints. Default is to `800` (800 request per IP).
- **TIER_3_RATE_LIMIT**: - relaxed limiting tier. Default is to `1600` (1600 request per IP).
- **LIMIT_DURATION**: - reset limit duration. This creates a timestamp, which resets all limits, when it's reached. Default is to `60000` (1 minute).
- **RATE_LIMIT_DISABLED**: - if set to `true` no rate limiting will be performed.