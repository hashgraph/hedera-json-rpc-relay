/*-
 * ‌
 * Hedera Mirror Node
 * ​
 * Copyright (C) 2019 - 2022 Hedera Hashgraph, LLC
 * ​
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ‍
 */

import http from 'k6/http';

import {
  logListName,
  resultListName,
  transactionListName
} from "./constants.js";

const getValidResponse = (requestUrl, requestBody, httpVerbMethod) => {
  const response = httpVerbMethod(requestUrl, JSON.stringify(requestBody));
  if (response.status !== 200) {
    throw new Error(`${response.status} received when requesting ${requestUrl}`);
  }
  return JSON.parse(response.body);
};

const getFirstEntity = (entityPath, key) => {
  const body = getValidResponse(entityPath, null, http.get);
  if (!body.hasOwnProperty(key)) {
    throw new Error(`Missing ${key} property in ${entityPath} response`);
  }
  const entity = body[key];
  if (entity.length === 0) {
    throw new Error(`No ${key} were found in the response for request at ${entityPath}`);
  }
  return entity[0];
};

const copyEnvParamsFromEnvMap = (propertyList) => {
  const envProperties = {};
  let allPropertiesFound = true;
  for (const property of propertyList) {
    if (__ENV.hasOwnProperty(property)) {
      envProperties[property] = __ENV[property];
    } else {
      allPropertiesFound = false;
    }
  }
  return {
    allPropertiesFound,
    envProperties
  };
};

const computeProperties = (propertyList, fallback) => {
  const copyResult = copyEnvParamsFromEnvMap(propertyList);
  if (copyResult.allPropertiesFound) {
    return copyResult.envProperties;
  }
  return Object.assign(copyResult.envProperties, fallback());
};

export const computeLatestContractResultParameters = (configuration) =>
  computeProperties(
    ['DEFAULT_ENTITY_FROM', 'DEFAULT_TIMESTAMP', 'DEFAULT_ENTITY_TO'],
    () => {
      const contractResultPath = `${configuration.baseApiUrl}/contracts/results?limit=1&order=desc`;
      const firstResult = getFirstEntity(contractResultPath, resultListName);

      return {
        DEFAULT_ENTITY_FROM: firstResult.from.substring(0, 42),
        DEFAULT_TIMESTAMP: firstResult.timestamp,
        DEFAULT_ENTITY_TO: firstResult.to.substring(0, 42)
      };
    });

export const computeLatestEthereumTransactionParameters = (configuration) =>
  computeProperties(
    ['DEFAULT_BLOCK_HASH', 'DEFAULT_ETH_TRANSACTION_ID', 'DEFAULT_TRANSACTION_HASH'],
    () => {
      const transactionResultPath = `${configuration.baseApiUrl}/transactions?transactiontype=ethereumtransaction&limit=1&order=desc&result=success`;
      const firstResult = getFirstEntity(transactionResultPath, transactionListName);
      const contractResultPath = `${configuration.baseApiUrl}/contracts/results/${firstResult.transaction_id}`;
      const secondResult = getValidResponse(contractResultPath, null, http.get);

      return {
        DEFAULT_BLOCK_HASH: secondResult.block_hash.substring(0, 66),
        DEFAULT_ETH_TRANSACTION_ID: firstResult.transaction_id,
        DEFAULT_TRANSACTION_HASH: secondResult.hash.substring(0, 66)
      };
    });

export const computeLatestLogParameters = (configuration) =>
  computeProperties(
    ['DEFAULT_CONTRACT_ADDRESS', 'DEFAULT_LOG_TIMESTAMP'],
    () => {
      const logResultPath = `${configuration.baseApiUrl}/contracts/results/logs?limit=1&order=desc`;
      const firstResult = getFirstEntity(logResultPath, logListName);
      
      return {
        DEFAULT_CONTRACT_ADDRESS: firstResult.address,
        DEFAULT_LOG_TIMESTAMP: firstResult.timestamp
      };
    });

export const setDefaultValuesForEnvParameters = () => {
  __ENV['MIRROR_BASE_URL'] = __ENV['MIRROR_BASE_URL'] || 'http://localhost:5551';
  __ENV['RELAY_BASE_URL'] = __ENV['RELAY_BASE_URL'] || 'http://localhost:7546';
  __ENV['DEFAULT_DURATION'] = __ENV['DEFAULT_DURATION'] || '120s';
  __ENV['DEFAULT_VUS'] = __ENV['DEFAULT_VUS'] || 10;
  __ENV['DEFAULT_LIMIT'] = __ENV['DEFAULT_LIMIT'] || 100;
  __ENV['DEFAULT_PASS_RATE'] = __ENV['DEFAULT_PASS_RATE'] || 0.95;
  __ENV['DEFAULT_MAX_DURATION'] = __ENV['DEFAULT_MAX_DURATION'] || 500;
};
