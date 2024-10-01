export class RelayEnvs {
  static CHAIN_ID: string = 'CHAIN_ID';
  static CLIENT_TRANSPORT_SECURITY: string = 'CLIENT_TRANSPORT_SECURITY';
  static CONSENSUS_MAX_EXECUTION_TIME: string = 'CONSENSUS_MAX_EXECUTION_TIME';
  static CONTRACT_QUERY_TIMEOUT_RETRIES: string = 'CONTRACT_QUERY_TIMEOUT_RETRIES';
  static DEV_MODE: string = 'DEV_MODE';
  static DEFAULT_RATE_LIMIT: string = 'DEFAULT_RATE_LIMIT';
  static ETH_CALL_CACHE_TTL: string = 'ETH_CALL_CACHE_TTL';
  static ETH_CALL_DEFAULT_TO_CONSENSUS_NODE: string = 'ETH_CALL_DEFAULT_TO_CONSENSUS_NODE';
  static ETH_GET_LOGS_BLOCK_RANGE_LIMIT: string = 'ETH_GET_LOGS_BLOCK_RANGE_LIMIT';
  static GAS_PRICE_TINY_BAR_BUFFER: string = 'GAS_PRICE_TINY_BAR_BUFFER';
  static HBAR_RATE_LIMIT_TINYBAR: string = 'HBAR_RATE_LIMIT_TINYBAR';
  static HBAR_RATE_LIMIT_DURATION: string = 'HBAR_RATE_LIMIT_DURATION';
  static HEDERA_NETWORK: string = 'HEDERA_NETWORK';
  static INPUT_SIZE_LIMIT: string = 'INPUT_SIZE_LIMIT';
  static LIMIT_DURATION: string = 'LIMIT_DURATION';
  static LOG_LEVEL: string = 'LOG_LEVEL';
  static MIRROR_NODE_RETRIES: string = 'MIRROR_NODE_RETRIES';
  static MIRROR_NODE_RETRY_DELAY: string = 'MIRROR_NODE_RETRY_DELAY';
  static MIRROR_NODE_LIMIT_PARAM: string = 'MIRROR_NODE_LIMIT_PARAM';
  static MIRROR_NODE_URL: string = 'MIRROR_NODE_URL';
  static OPERATOR_ID_MAIN: string = 'OPERATOR_ID_MAIN';
  static OPERATOR_KEY_MAIN: string = 'OPERATOR_KEY_MAIN';
  static OPERATOR_ID_ETH_SENDRAWTRANSACTION: string = 'OPERATOR_ID_ETH_SENDRAWTRANSACTION';
  static OPERATOR_KEY_ETH_SENDRAWTRANSACTION: string = 'OPERATOR_KEY_ETH_SENDRAWTRANSACTION';
  static RATE_LIMIT_DISABLED: string = 'RATE_LIMIT_DISABLED';
  static SDK_REQUEST_TIMEOUT: string = 'SDK_REQUEST_TIMEOUT';
  static SERVER_PORT: string = 'SERVER_PORT';
  static SUBSCRIPTIONS_ENABLED: string = 'SUBSCRIPTIONS_ENABLED';
  static TIER_1_RATE_LIMIT: string = 'TIER_1_RATE_LIMIT';
  static TIER_2_RATE_LIMIT: string = 'TIER_2_RATE_LIMIT';
  static TIER_3_RATE_LIMIT: string = 'TIER_3_RATE_LIMIT';
  static WEB_SOCKET_HTTP_PORT: string = 'WEB_SOCKET_HTTP_PORT';
  static WS_CONNECTION_LIMIT_PER_IP: string = 'WS_CONNECTION_LIMIT_PER_IP';
  static WS_CONNECTION_LIMIT: string = 'WS_CONNECTION_LIMIT';
  static WS_MAX_INACTIVITY_TTL: string = 'WS_MAX_INACTIVITY_TTL';
  static WS_MULTIPLE_ADDRESSES_ENABLED: string = 'WS_MULTIPLE_ADDRESSES_ENABLED';
  static WS_SUBSCRIPTION_LIMIT: string = 'WS_SUBSCRIPTION_LIMIT';
  static WS_PING_INTERVAL: string = 'WS_PING_INTERVAL';
  static HAPI_CLIENT_TRANSACTION_RESET: string = 'HAPI_CLIENT_TRANSACTION_RESET';
  static HAPI_CLIENT_DURATION_RESET: string = 'HAPI_CLIENT_DURATION_RESET';
  static HAPI_CLIENT_ERROR_RESET: string = 'HAPI_CLIENT_ERROR_RESET';
  static REDIS_ENABLED: string = 'REDIS_ENABLED';
  static REDIS_URL: string = 'REDIS_URL';
  static REDIS_RECONNECT_DELAY_MS: string = 'REDIS_RECONNECT_DELAY_MS';
  static DEBUG_API_ENABLED: string = 'DEBUG_API_ENABLED';
  static FILTER_API_ENABLED: string = 'FILTER_API_ENABLED';
  static MULTI_SET: string = 'MULTI_SET';
  static GAS_PRICE_PERCENTAGE_BUFFER: string = 'GAS_PRICE_PERCENTAGE_BUFFER';
}

export class RelayEnvsTypes {
  static TYPES: Record<string, string> = {
    [RelayEnvs.CHAIN_ID]: 'string',
    [RelayEnvs.CLIENT_TRANSPORT_SECURITY]: 'boolean',
    [RelayEnvs.CONSENSUS_MAX_EXECUTION_TIME]: 'number',
    [RelayEnvs.CONTRACT_QUERY_TIMEOUT_RETRIES]: 'number',
    [RelayEnvs.DEV_MODE]: 'boolean',
    [RelayEnvs.DEFAULT_RATE_LIMIT]: 'number',
    [RelayEnvs.ETH_CALL_CACHE_TTL]: 'number',
    [RelayEnvs.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE]: 'boolean',
    [RelayEnvs.ETH_GET_LOGS_BLOCK_RANGE_LIMIT]: 'number',
    [RelayEnvs.GAS_PRICE_TINY_BAR_BUFFER]: 'number',
    [RelayEnvs.HBAR_RATE_LIMIT_TINYBAR]: 'number',
    [RelayEnvs.HBAR_RATE_LIMIT_DURATION]: 'number',
    [RelayEnvs.HEDERA_NETWORK]: 'string',
    [RelayEnvs.INPUT_SIZE_LIMIT]: 'number',
    [RelayEnvs.LIMIT_DURATION]: 'number',
    [RelayEnvs.LOG_LEVEL]: 'string',
    [RelayEnvs.MIRROR_NODE_RETRIES]: 'number',
    [RelayEnvs.MIRROR_NODE_RETRY_DELAY]: 'number',
    [RelayEnvs.MIRROR_NODE_LIMIT_PARAM]: 'number',
    [RelayEnvs.MIRROR_NODE_URL]: 'string',
    [RelayEnvs.OPERATOR_ID_MAIN]: 'string',
    [RelayEnvs.OPERATOR_KEY_MAIN]: 'string',
    [RelayEnvs.OPERATOR_ID_ETH_SENDRAWTRANSACTION]: 'string',
    [RelayEnvs.OPERATOR_KEY_ETH_SENDRAWTRANSACTION]: 'string',
    [RelayEnvs.RATE_LIMIT_DISABLED]: 'boolean',
    [RelayEnvs.SDK_REQUEST_TIMEOUT]: 'number',
    [RelayEnvs.SERVER_PORT]: 'number',
    [RelayEnvs.SUBSCRIPTIONS_ENABLED]: 'boolean',
    [RelayEnvs.TIER_1_RATE_LIMIT]: 'number',
    [RelayEnvs.TIER_2_RATE_LIMIT]: 'number',
    [RelayEnvs.TIER_3_RATE_LIMIT]: 'number',
    [RelayEnvs.WEB_SOCKET_HTTP_PORT]: 'number',
    [RelayEnvs.WS_CONNECTION_LIMIT_PER_IP]: 'number',
    [RelayEnvs.WS_CONNECTION_LIMIT]: 'number',
    [RelayEnvs.WS_MAX_INACTIVITY_TTL]: 'number',
    [RelayEnvs.WS_MULTIPLE_ADDRESSES_ENABLED]: 'boolean',
    [RelayEnvs.WS_SUBSCRIPTION_LIMIT]: 'number',
    [RelayEnvs.WS_PING_INTERVAL]: 'number',
    [RelayEnvs.HAPI_CLIENT_TRANSACTION_RESET]: 'number',
    [RelayEnvs.HAPI_CLIENT_DURATION_RESET]: 'number',
    [RelayEnvs.HAPI_CLIENT_ERROR_RESET]: 'Array<number>',
    [RelayEnvs.REDIS_ENABLED]: 'boolean',
    [RelayEnvs.REDIS_URL]: 'string',
    [RelayEnvs.REDIS_RECONNECT_DELAY_MS]: 'number',
    [RelayEnvs.DEBUG_API_ENABLED]: 'boolean',
    [RelayEnvs.FILTER_API_ENABLED]: 'boolean',
    [RelayEnvs.MULTI_SET]: 'boolean',
    [RelayEnvs.GAS_PRICE_PERCENTAGE_BUFFER]: 'number',
  };
}
