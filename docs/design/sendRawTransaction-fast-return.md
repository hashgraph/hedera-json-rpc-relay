# Enhanced eth_sendRawTransaction for Hedera JSON-RPC to Enable Fast Transaction Hash Return

## Abstract

This document outlines the design for improving the `eth_sendRawTransaction` endpoint in the Hedera JSON-RPC repository. The proposed enhancement enables the immediate return of a transaction hash after initial prechecks, allowing subsequent processing to occur asynchronously. This feature aligns Hedera's behavior more closely with Ethereum's `eth_sendRawTransaction`, reducing client wait times while maintaining backend integrity.

---

## Motivation

The current implementation of the `eth_sendRawTransaction` endpoint in Hedera fully processes transactions before returning a hash. This approach leads to higher latency, particularly for transactions involving large `callData`, which leverage the Hedera File Service (HFS). It causes timeouts in many EVM client tools, degrading the user experience. Aligning this functionality with Ethereum's immediate hash return mechanism addresses these issues, offering faster response times and improved usability.

---

## Rationale

Implementing immediate hash return has several advantages:

- **Reduced Latency**: By returning the hash immediately, users experience significantly lower wait times.
- **Asynchronous Processing**: Transactions can be processed in the background without blocking the client, maintaining efficiency and scalability.
- **EVM Equivalence**: This aligns Hedera’s behavior with Ethereum, enhancing interoperability for developers.

However, challenges such as error handling for failed requests and user experience considerations for polling mechanisms must be addressed.

---

## Requirements

### Functional Requirements

1. The `eth_sendRawTransaction` endpoint must:

   - Return a transaction hash immediately after passing prechecks.
   - Perform signature validation and hash computation synchronously.
   - Allowing subsequent processing logic to occur asynchronously

2. The client is responsible for tracking the transaction’s processing status (e.g., via `eth_getTransactionReceipt`).

### Non-Functional Requirements

1. Ensure minimal impact on backend performance.
2. Maintain fault tolerance for failed transactions (e.g., HBAR limits, `maxChunkSize`, errors from mirror nodes and consensus nodes, etc.).
3. Provide compatibility with EVM-compatible client tools.

### Prioritization (MoSCoW)

- **Must Have**: Immediate hash return, signature validation, hash computation.
- **Should Have**: Error handling mechanisms for failed transactions.
- **Could Have**: Enhanced get transaction receipt endpoints to provide more detailed processing status.
- **Won’t Have**: Full processing before returning a transaction hash.

---

## Implementation in Ethereum

### Standard Flow

1. **Immediate Hash Return**:
   - The `eth_sendRawTransaction` endpoint validates the transaction's signature, computes the Keccak-256 hash, and immediately returns it to the client.
2. **Asynchronous Processing**:
   - Transactions undergo validation checks (nonce, gas, balance).
   - Valid transactions are broadcast to the network.
   - Miners include the transaction in a block if successful.
3. **Client Responsibilities**:
   - Clients use the hash to poll transaction status using `eth_getTransactionReceipt`.

---

## Implementation in Hedera

### Current Flow

1. Transactions are fully processed, submitted to the network, and recorded in the mirror node before returning the hash.
2. For transactions with large call data, HFS is used, adding further latency.

### Proposed Flow

1. **Immediate Hash Return**:
   - The server validates the signature, computes the hash, and returns it immediately after prechecks.
2. **Asynchronous Processing**:
   - Background tasks handle broadcasting, HFS management, and consensus submission.
   - Errors during processing are still visible through logs.

---

## Challenges and Potential Approaches

### Challenge: Silent Failure in Failed Requests and Incomplete Processing

When a transaction fails internally during processing (e.g., rate limits, SDK errors, or CN/MN errors), these errors will no longer be thrown and reflected in the client response. Instead, the fast-return mechanism will still provide a transaction hash for the request, effectively creating a `silent failure` scenario.

In such cases, clients relying on polling the transaction status via `eth_getTransactionReceipt` may encounter an endless loop, as the receipt for failed transactions will remain `null` since the transactions never reach consensus. While this approach aligns with practices in the Ethereum ecosystem and shifts responsibility to users to handle such cases, it may introduce additional inconveniences for users on the Hedera network, potentially impacting their overall experience.

### Potential Approaches

### 1. Integrating Failed Transaction Details into `eth_getTransactionReceipt`

#### **Overview**

This approach enhances the existing `eth_getTransactionReceipt` method to include failure details for transactions that fail during asynchronous processing. By incorporating failure metadata directly into the standard receipt response, this design provides a unified interface for querying both successful and failed transactions. Clients can retrieve actionable insights about failures without needing additional endpoints or significant changes to their workflows.

---

#### **Goals**

1. **Unified Interface**: Ensure `eth_getTransactionReceipt` serves as a single source of truth for transaction statuses, including failures.
2. **Transparent Error Reporting**: Allow clients to retrieve failure details without modifying their existing integration workflows.
3. **Seamless Compatibility**: Maintain compatibility with Ethereum tooling such as `ethers.js` or `web3.js`.

---

#### **Implementation**

1. **Storage and Retention for Failed `eth_sendRawTransaction` Transactions**:

   - For `eth_sendRawTransaction` silent failures, retain only records of failed transactions in the cache system. The key-value object can be constructed as below:

     ```
     {
       transaction_hash: error #SDKClientError or JsonRpcError
     }
     ```

   - Establish a retention period for these records, such as a TTL of one hour or less, or a duration based on blocks (e.g., 10–20 blocks, approximately 20–40 seconds). Since these transactions fail silently and never reach consensus, the metadata acts as a temporary reference for `eth_getTransactionReceipt`.

2. **`eth_getTransactionReceipt` Behavior Update**:

   - Extend `eth_getTransactionReceipt` to:
     - First, check the cache system for the transaction hash.
     - If the hash is not found in the cache, three possibilities exist:
       1. The transaction is still being processed.
       2. The transaction was never submitted to the network.
       3. The transaction was successfully processed
          In any of the cases above, the existing logic remains unchanged, and the getTransactionReceipt request is forwarded to the network to fetch the transaction status.
     - If the hash exists in the cache, it indicates the transaction was previously submitted but failed silently. A response is then constructed using the failure metadata.

3. **Request Format**:

   - The request remains unchanged from the current implementation:
     ```json
     {
       "id": 1,
       "jsonrpc": "2.0",
       "method": "eth_getTransactionReceipt",
       "params": ["0xtransaction_hash"]
     }
     ```

4. **Response Format**:

   - **Success Case** (Unchanged):
     For successfully processed transactions, the response includes standard receipt details:
     ```json
     {
       "id": 1,
       "jsonrpc": "2.0",
       "result": {
         "receipt": "standard_transaction_receipt"
       }
     }
     ```
   - **Not Found** (Unchanged):
     If the transaction hash doesn’t exist in the system (cache and whole network), simply return null as is in current implementation:
     ```json
     {
       "id": 1,
       "jsonrpc": "2.0",
       "result": null
     }
     ```
   - **Failure Case** (Enhanced):
     If the transaction hash is found in the cache, it signifies that the transaction failed silently. The response could object should contain the error member:
     ```json
     {
       "id": 1,
       "jsonrpc": "2.0",
       "error": {
         "code": "cached_error.code",
         "message": "cached_error.message"
       }
     }
     ```

#### **Benefits**

1. **Streamlined Workflow**:
   - Clients can rely on `eth_getTransactionReceipt` for both success and failure scenarios without needing a separate API.
2. **Compatibility**:
   - No changes to existing tools or libraries are required, as the response format remains compatible with Ethereum standards.
3. **Ease of Adoption**:
   - Developers don’t need to modify client-side logic significantly to access failure details.

#### **Challenges**

1. **Retention Policies**:
   - Balance between retaining sufficient historical data and optimizing storage costs.
2. **Backend Complexity**:
   - Requires careful integration of failure logs into the receipt-handling flow to avoid performance bottlenecks.
3. **Error Categorization**:
   - Standardizing and storing detailed error metadata may require consistent logging practices across all transaction processing subsystems.

---

#### 2. **Timeout Logic on Client Side**

- **Overview**: Encourage clients to implement timeout mechanisms when polling for transaction receipts, preventing infinite loops when transactions fail silently.
- **Implementation**:

  - Recommend a maximum polling timeout (e.g., 120 seconds) in Hedera’s developer guidelines:

    - Example timeout logic for clients:

      ```javascript
      const MAX_RETRIES = 10;
      const POLL_INTERVAL_MS = 2000; // 2 seconds

      const pollForReceipt = async (transactionHash) => {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          const receipt = await getTransactionReceipt(transactionHash);
          if (receipt) {
            return receipt;
          }
          await sleep(POLL_INTERVAL_MS);
        }
        throw new Error('Transaction receipt not found after maximum retries. Please check transaction status.');
      };

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      ```

  - Add detailed explanations in the documentation:
    - Highlight the risks of infinite polling.
    - Provide guidelines for setting reasonable polling intervals and retry counts.

- **Benefits**:
  - Prevents clients from entering unproductive infinite loops.
  - Promotes best practices for efficient resource utilization.
- **Challenges**:
  - Shifts some of the burden to the client-side implementation.
  - Requires developers to carefully calibrate timeout and retry parameters.

---
