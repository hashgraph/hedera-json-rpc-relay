// SPDX-License-Identifier: Apache-2.0

import {
  computeLatestContractResultParameters,
  computeLatestEthereumTransactionParameters,
  computeLatestLogParameters,
  setDefaultValuesForEnvParameters,
} from './parameters.js';

const scParams = JSON.parse(open('../prepare/.smartContractParams.json'));

const computeTestParameters = (configuration) =>
  Object.assign(
    {},
    computeLatestContractResultParameters(configuration),
    computeLatestEthereumTransactionParameters(configuration),
    computeLatestLogParameters(configuration),
  );

const setupTestParameters = () => {
  setDefaultValuesForEnvParameters();
  const baseApiUrl = __ENV['MIRROR_BASE_URL'];
  const testParametersMap = computeTestParameters({ baseApiUrl: `${baseApiUrl}/api/v1` });
  return Object.assign(testParametersMap, scParams, {
    MIRROR_BASE_URL: baseApiUrl,
    RELAY_BASE_URL: __ENV['RELAY_BASE_URL'],
    DEFAULT_LIMIT: __ENV.DEFAULT_LIMIT,
  });
};

export { setupTestParameters };
