# Hbar limiter service design

## Table of Contents

- [Hbar limiter service design](#hbar-limiter-service-design)
  - [Table of Contents](#table-of-contents)
  - [Purpose](#purpose)
  - [Goals](#goals)
  - [Requirements](#requirements)
    - [Spending Tracking](#spending-tracking)
    - [Spending Limits](#spending-limits)
    - [Early Detection and Prevention (Preemptive Rate Limit)](#early-detection-and-prevention-preemptive-rate-limit)
  - [Architecture](#architecture)
    - [High-Level Design](#high-level-design)
    - [Class Diagram](#class-diagram)
      - [Service Layer](#service-layer)
      - [Database Layer:](#database-layer)
    - [Support flexible alerting mechanisms for spending thresholds](#support-flexible-alerting-mechanisms-for-spending-thresholds)
      - [HBar Allocation Strategy](#hbar-allocation-strategy)
        - [Metrics to Track](#metrics-to-track)
        - [Allocation Algorithm](#allocation-algorithm)
  - [Configurations](#configurations)
    - [Pre-populating the Cache with Spending Plans for Supported Projects and Partner Projects](#pre-populating-the-cache-with-spending-plans-for-supported-projects-and-partner-projects)
    - [Spending Limits of Different Tiers](#spending-limits-of-different-tiers)
    - [Total Budget and Limit Duration](#total-budget-and-limit-duration)
  - [Additional Considerations](#additional-considerations)
    - [Performance](#performance)
    - [Monitoring and logging](#monitoring-and-logging)
  - [Future enhancements](#future-enhancements)

## Purpose

The purpose of the HBar Limiter is to track and control the spending of HBars in real-time across various operations and transaction types. It aims to provide flexible hbar limiting capabilities for relay operators, ensuring efficient resource utilization and preventing potential misuse or drainage of HBars.

## Goals

1. Implement real-time tracking of HBar spending across different operations and transaction types.
2. Provide configurable limiting based on various criteria such as sending address and IP address.
3. Offer tiered access control for different user groups or projects.
4. Enable early detection and prevention of potential HBar drainage.
5. Support flexible alerting mechanisms for spending thresholds.

## Requirements

### Spending Tracking

1. Track HBar spending in real-time.
2. Categorize spending by:
   a. Operation type (e.g., FileAppend, FileCreate)
   b. Transaction type (Ethereum or Hedera)

### Spending Limits

1. Compare current spending against:
   a. Total predefined limit
   b. Current operator balance
2. Support limits based on transaction origin address (`tx.from`).
   1. Limit based on `tx.from`
   2. Limit based on IP
3. Support tiered spending limits, e.g.:
   - **Tier 1**: Trusted Partners (unlimited)
   - **Tier 2**: Supported projects (higher limit)
   - **Tier 3**: General users (standard limit)

### Early Detection and Prevention (Preemptive Rate Limit)

**Preemptive Rate Limiting for HFS Transactions**

1. Calculate the number of potential HFS transactions based on the size of the incoming call data:

   - **File Create:** 1 transaction
   - **File Append:** (size_of_call_data / file_chunk_size) transactions

2. Use the [Hedera Fee Estimator](https://hedera.com/fees) to estimate the costs of each HFS transaction, based on the maximum chunk size configuration (currently set to 5 KB).

3. Calculate the total estimated fee and compare it against the remaining budget to determine if a preemptive rate limit should be applied.

## Architecture

### High-Level Design

The HBar limiter will be implemented as a separate service, used by other services/classes that need it. It will have two main purposes - to capture the gas fees for different operation and to check if an operation needs to be paused, due to an exceeded HBar limit.

### General Users (BASIC tier):

**NOTE:** Each general user will have a unique spending plan, linked both to their ETH and IP addresses. Each new user will be automatically assigned a BASIC spending plan when they send their first transaction and this plan will remain linked to them for any subsequent requests.

```mermaid
flowchart TD
    A[User] -->|sends transaction| B[JSON-RPC Relay]
    B --> C[Estimate fees which will be paid by the relay operator]
    C --> D{HBAR Limiter}
    D -->|new user, i.e., who is not linked to a spending plan| E[Create a new BASIC spending plan]
    E --> F[Link user's ETH & IP addresses to plan]
    D -->|existing user, i.e., who is linked to a spending plan| G[Retrieve spending plan linked to user]
    F --> H{Plan has enough balance to cover fees}
    G --> H
    H --> |no| I[Limit request]
    H --> |yes| J[Execute transaction]
    J --> K[Capture all fees the operator has been charged during execution]
    K --> L[Update the spending plan's remaining balance]
```

### Supported Projects (EXTENDED tier) and Trusted Partners (PRIVILEGED tier):

**NOTE:** There will be one spending plan per project/partner with a total spending limit, shared amongst a group of users (IP and ETH addresses) linked to that plan. This means that they will share a common total spending limit for the project/partner.

All users associated with a project/partner will be pre-configured in the relay as shown in the 

```mermaid
flowchart TD
    A[User] -->|sends transaction| B[JSON-RPC Relay]
    B --> C[Estimate fees which will be paid by the relay operator]
    C --> D{HBAR Limiter}
    D --> E[Retrieve spending plan linked to user's ETH and/or IP address]
    E --> F{Plan has enough balance to cover fees}
    F --> |no| G[Limit request]
    F --> |yes| H[Execute transaction]
    H --> I[Capture all fees the operator has been charged during execution]
    I --> J[Update the spending plan's remaining balance]
```

### Class Diagram

#### Service Layer

```mermaid
classDiagram
    class SdkClient {
        -hbarLimitService: IHBarLimitService
        -metricService: MetricService
        +executeTransaction(transaction: Transaction, callerName: string, interactingEntity: string, requestId?: string): Promise<TransactionId>
        +executeQuery~T~(query: Query~T~, callerName: string, interactingEntity: string, requestId?: string): Promise<Query~T~>
    }

    class MetricService {
      -hbarLimitService: IHBarLimitService
      +captureTransactionFees(transaction: Transaction, callerName: string, interactingEntity: string, requestId?: string) void
      +captureQueryFees~T~(query: Query~T~, callerName: string, interactingEntity: string, requestId?: string) void
    }

    class HBarLimitService {
        -hbarSpendingPlanRepository: HbarSpendingPlanRepository
        -ethAddressHbarSpendingPlanRepository: EthAddressHbarSpendingPlanRepository
        -ipAddressHbarSpendingPlanRepository: IpAddressHbarSpendingPlanRepository
        +shouldLimit(txFrom: string, ip?: string) boolean
        +shouldPreemtivelyLimitFileTransactions(callDataSize: number, fileChunkSize: number, currentNetworkExchangeRateInCents: number) boolean
        +resetLimiter() void
        +addExpense(amount: number, txFrom: string, ip?: string) void
        -getSpendingPlanOfEthAddress(address: string): HbarSpendingPlan
        -getSpendingPlanOfIpAddress(ip: string): HbarSpendingPlan
        -checkTotalSpent() boolean
        -shouldReset() boolean
    }

    class IHBarLimitService
    <<interface>> IHBarLimitService
    IHBarLimitService : shouldLimit() boolean
    IHBarLimitService : shouldPreemtivelyLimitFileTransactions() boolean
    IHBarLimitService : resetLimiter() void
    IHBarLimitService : addExpense() void

    SdkClient --> MetricService : uses
    SdkClient --> IHBarLimitService : uses
    MetricService --> IHBarLimitService : uses
    IHBarLimitService <|-- HBarLimitService: implements
```

#### Database Layer:

```mermaid
classDiagram
    class HbarSpendingPlan {
        -id: string
        -subscriptionType: SubscriptionType
        -createdAt: Date
        -active: boolean
        -spendingHistory: HbarSpendingRecord[]
        -amountSpent: number
    }

    class HbarSpendingRecord {
        -amount: number
        -timestamp: Date
    }

    class EthAddressHbarSpendingPlan {
        -ethAddress: string
        -planId: string
    }

    class IpAddressHbarSpendingPlan {
        -ipAddress: string
        -planId: string
    }

    class CacheService {
        -internalCache: ICacheClient
        -sharedCache: ICacheClient
        +getAsync<T>(key: string, callingMethod: string, requestIdPrefix?: string): Promise<T>
        +set(key: string, value: any, callingMethod: string, ttl?: number, requestIdPrefix?: string): Promise<void>
        +multiSet(entries: Record<string, any>, callingMethod: string, ttl?: number, requestIdPrefix?: string): Promise<void>
        +delete(key: string, callingMethod: string, requestIdPrefix?: string): Promise<void>
        +clear(requestIdPrefix?: string): Promise<void>
        +incrBy(key: string, amount: number, callingMethod: string, requestIdPrefix?: string): Promise<number>
        +rPush(key: string, value: any, callingMethod: string, requestIdPrefix?: string): Promise<number>
        +lRange<T>(key: string, start: number, end: number, callingMethod: string, requestIdPrefix?: string): Promise<T[]>
    }

    class HbarSpendingPlanRepository {
        -cache: CacheService
        +findById(id: string): Promise<IHbarSpendingPlan>
        +findByIdWithDetails(id: string): Promise<IDetailedHbarSpendingPlan>
        +create(subscriptionType: SubscriptionType): Promise<IDetailedHbarSpendingPlan>
        +checkExistsAndActive(id: string): Promise<void>
        +getSpendingHistory(id: string): Promise<HbarSpendingRecord[]>
        +addAmountToSpendingHistory(id: string, amount: number): Promise<number>
        +getAmountSpent(id: string): Promise<number>
        +addToAmountSpent(id: string, amount: number): Promise<void>
    }

    class EthAddressHbarSpendingPlanRepository {
        -cache: CacheService
        +findByAddress(ethAddress: string): Promise<EthAddressHbarSpendingPlan>
        +save(ethAddressPlan: EthAddressHbarSpendingPlan): Promise<void>
        +delete(ethAddress: string): Promise<void>
    }

    class IpAddressHbarSpendingPlanRepository {
        -cache: CacheService
        +findByIp(ip: string): Promise<IpAddressHbarSpendingPlan>
        +save(ipAddressPlan: IpAddressHbarSpendingPlan): Promise<void>
        +delete(ip: string): Promise<void>
    }

    class SubscriptionType
    <<Enumeration>> SubscriptionType
    SubscriptionType : BASIC
    SubscriptionType : EXTENDED
    SubscriptionType : PRIVILEGED

    HbarSpendingPlan --> SubscriptionType : could be one of the types
    HbarSpendingPlan --> HbarSpendingRecord : stores history of
    EthAddressHbarSpendingPlan --> HbarSpendingPlan : links an ETH address to
    IpAddressHbarSpendingPlan --> HbarSpendingPlan : links an IP address to

    HbarSpendingPlanRepository --> CacheService : uses
    EthAddressHbarSpendingPlanRepository --> CacheService : uses
    IpAddressHbarSpendingPlanRepository --> CacheService : uses
```
### Support flexible alerting mechanisms for spending thresholds
The existing technical infrastructure, prometheus and grafana will be used to trigger alerts.  At the time of this writing 10K HBar is the maximum the relay operator can spend in one day, on HashIO.

The rest of this section describes addtional metrics that will be added, with alerts later, to track critical balances, and how new values for those tiers in HashIO will
be determined.

The initial spending threshold of the Tier 3 General users will be a rough
estimate based on the current daily spending of the Relay Operator.  In order
to refine this over time a prometheus metric called the `basicSpendingPlanCounter`
will be used to track the number of unique spending plans.  

The metrics listed below will be added to help determine the best Tier 3 General users over time:

1. Daily Unique Users Counter
2. Average Daily Users
3. Dynamic Per-User Limit - Daily budget for the Relay Operator (10K) divided by the average number of users
4. Time-based Allocation - Allocating the Relay Operator's budget throughout the day to prevent early users from consuming all resources
5. User History - Track individual user usage over time to identify and manage heavy users
6. Flexible Limits - Implement a system that can adjust limits based on current usage and time of day
   
#### HBar Allocation Strategy
##### Metrics to Track
1. Daily Unique Users
2. Total HBar Spent per Day
3. Rolling Average of Daily Unique Users (e.g., over 7 or 30 days)
4. Individual User Daily and Monthly Usage
   
##### Allocation Algorithm
1. Base Allocation:
   - Daily Budget / Rolling Average of Daily Unique Users = Base User Limit
  
2. Time-Based Adjustment:
   - Divide the day into time slots (e.g., 6 4-hour slots)
   - Allocate a portion of the daily budget to each slot
   - Adjust user limits based on remaining budget in the current slot

3. Dynamic User Limit:
   - Start with the Base User Limit
   - Adjust based on:
a. User's historical usage (lower limit for consistently heavy users)
b. Time of day (higher limits when usage is typically lower)
c. Current day's usage (increase limits if overall usage is low)

4. Flexible Ceiling:
   - Implement a hard cap (e.g., 2x Base User Limit) to prevent single user from consuming too much

5. Reserve Pool:
   - Keep a small portion of the daily budget (e.g., 10%) as a reserve
   - Use this to accommodate unexpected spikes or high-priority users

## Configurations

### Pre-populating the Cache with Spending Plans for Supported Projects and Partner Projects

The following configurations will be used to automatically populate the cache with `HbarSpendingPlan`, `EthAddressHbarSpendingPlan`, and `IPAddressHbarSpendingPlan` entries for the outlined supported projects and partner projects on every start-up of the relay.

All other users (ETH and IP addresses which are not specified in the configuration file) will be treated as "general users" and will be assigned a basic `HbarSpendingPlan` on their first request and their ETH address and IP address will be linked to that plan for all subsequent requests.

### JSON Configuration File

The relay will read the pre-configured spending plans from a JSON file. This file should be placed in the root directory of the relay.

The default filename for the configuration file is `spendingPlansConfig.json`, but it could also be specified by the environment variable `HBAR_SPENDING_PLANS_CONFIG_FILE`.
- `HBAR_SPENDING_PLANS_CONFIG_FILE`: The name of the file containing the pre-configured spending plans for supported projects and partners.

#### The JSON file should have the following structure:
```json
[
  {
    "id": "c758c095-342c-4607-9db5-867d7e90ab9d",
    "name": "partner name",
    "ethAddresses": ["0x123", "0x124"],
    "ipAddresses": ["127.0.0.1", "128.0.0.1"],
    "subscriptionType": "PRIVILEGED"
  },
  {
    "id": "a68488b0-6f7d-44a0-87c1-774ad64615f2",
    "name": "some other partner that has given us only eth addresses",
    "ethAddresses": ["0x125", "0x126"],
    "subscriptionType": "PRIVILEGED"
  },
  {
    "id": "af13d6ed-d676-4d33-8b9d-cf05d1ad7134",
    "name": "supported project name",
    "ethAddresses": ["0x127", "0x128"],
    "ipAddresses": ["129.0.0.1", "130.0.0.1"],
    "subscriptionType": "EXTENDED"
  },
  {
    "id": "7f665aa3-6b73-41d7-bf9b-92d04cdab96b",
    "name": "some other supported project that has given us only ip addresses",
    "ipAddresses": ["131.0.0.1", "132.0.0.1"],
    "subscriptionType": "EXTENDED"
  }
]
```

#### Important notes
- The `id` field is **strictly required** for each supported project or partner project. It is used as a unique identifier and as key in the cache and also for reference in the logs. We recommend using a UUID for this field, but any unique string will work.
- The `name` field is used just for reference and can be any string. It is not used in the cache or for any other purpose, only for better readability in the logs on start-up of the relay when the spending plans are being configured.
- The `ethAddresses` and `ipAddresses` fields are arrays of strings containing the ETH addresses and IP addresses associated with the supported project or partner project. **At least one** of these two fields must be present and contain **at least one entry**.
- The `subscriptionType` field is also **required**. It is an enum with the following possible values: `BASIC`, `EXTENDED`, and `PRIVILEGED`.

On every start-up, the relay will check if these entries are already populated in the cache. If not, it will populate them accordingly. 

If the cache already contains some of these entries, it will only populate the new entries and remove the obsolete ones.

### Incremental changes to the JSON file

#### Adding new partners or supported projects

The JSON file can also be updated over time to add new partners or supported projects, and it will populate only the new entries on the next start-up.

```javascript
[
  // rest of JSON file remains the same
  ...oldContent,
  {
    "id": "0b054498-5c48-4402-aad4-b9b455f33457",
    "name": "new partner name",
    "ethAddresses": ["0x129", "0x130"],
    "ipAddresses": ["133.0.0.1"],
    "subscriptionType": "PRIVILEGED"
  }
]
```

#### Removing or updating existing partners or supported projects

If some of the pre-configured plans are removed them from the JSON file, they will be considered "obsolete" and removed from the cache on the next start-up of the relay.

You can also add new ETH addresses or IP addresses to existing plans by updating the JSON file.

```javascript
[
  // rest of JSON file remains the same
  ...oldContent,
  {
    "id": "c758c095-342c-4607-9db5-867d7e90ab9d",
    "name": "partner name",
    "ethAddresses": ["0x123", "0x124", "<new_eth_address>"],
    "ipAddresses": ["127.0.0.1", "128.0.0.1", "<new_ip_address>", "<another_new_ip_address>"],
    "subscriptionType": "PRIVILEGED",
  }
]
```

Or if you remove any existing ETH addresses or IP addresses from the JSON file, only those will be removed from the cache on the next start-up.

```javascript
[
  // rest of JSON file remains the same
  ...oldContent,
  {
    "id": "c758c095-342c-4607-9db5-867d7e90ab9d",
    "name": "partner name",
    "ethAddresses": ["0x123"], // removed "0x124"
    "ipAddresses": ["127.0.0.1"], // removed "128.0.0.1"
    "subscriptionType": "PRIVILEGED",
  }
]
```

### Spending Limits of Different Tiers

The spending limits for different tiers are defined as environment variables:
- `HBAR_RATE_LIMIT_BASIC`: The spending limit in tinybars (tℏ) for general users (tier 3)
- `HBAR_RATE_LIMIT_EXTENDED`: The spending limit in tinybars (tℏ) for supported projects (tier 2)
- `HBAR_RATE_LIMIT_PRIVILEGED`: The spending limit in tinybars (tℏ) for trusted partners (tier 1)

Example configuration for tiered spending limits of 0.1 ℏ, 1 ℏ, and 10 ℏ respectively:
```dotenv
HBAR_RATE_LIMIT_BASIC=10000000
HBAR_RATE_LIMIT_EXTENDED=100000000
HBAR_RATE_LIMIT_PRIVILEGED=1000000000
```

### Total Budget and Limit Duration

The total budget and the limit duration are defined as environment variables:
- `HBAR_RATE_LIMIT_DURATION`: The time window (in milliseconds) for which both the total budget and the spending limits are applicable. 
  - On initialization of `HbarLimitService`, a reset timestamp is calculated by adding the `HBAR_RATE_LIMIT_DURATION` to the current timestamp.
  - The total budget and spending limits are reset when the current timestamp exceeds the reset timestamp.
- `HBAR_RATE_LIMIT_TINYBAR`: The ceiling (in tinybars) on the total amount of HBARs that can be spent in the limit duration. 
  - This is the largest bucket from which others pull from.
  - If the total amount spent exceeds this limit, all spending is paused until the next reset.

Example configuration for a total budget of 110 ℏ (11_000_000_000 tℏ) per 80 seconds:
```dotenv
HBAR_RATE_LIMIT_TINYBAR=11000000000
HBAR_RATE_LIMIT_DURATION=80000
```

## Additional Considerations

### Performance

1. Ensure minimal impact on transaction processing times. (Capturing of transaction fees should happen asynchronously behind the scenes)
2. Design for high throughput to handle peak transaction volumes

### Monitoring and logging

1. Use the existing logger in the relay
2. Build on existing dashboards for system health and rate limiting statistics. Add any new metrics to the current dashboards.

## Future enhancements

1. Machine learning-based anomaly detection for unusual spending patterns.
