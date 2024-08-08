// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import './precompile/HederaResponseCodes.sol';
import './precompile/hedera-token-service/KeyHelper.sol';
import './HederaFungibleToken.sol';
import './HederaNonFungibleToken.sol';
import './base/NoDelegateCall.sol';
import './libraries/Constants.sol';

import './interfaces/IHtsPrecompileMock.sol';
import './libraries/HederaTokenValidation.sol';

contract HtsSystemContractMock is NoDelegateCall, KeyHelper, IHtsPrecompileMock {
    error HtsPrecompileError(int64 responseCode);

    /// @dev only for Fungible tokens
    // Fungible token -> FungibleTokenInfo
    FungibleTokenInfo internal _fungibleTokenInfos;
    // Fungible token -> _isFungible
    bool internal _isFungible;

    /// @dev only for NonFungibleToken
    // NFT token -> TokenInfo; TokenInfo is used instead of NonFungibleTokenInfo as the former is common to all NFT instances whereas the latter is for a specific NFT instance(uniquely identified by its serialNumber)
    TokenInfo internal _nftTokenInfos;
    // NFT token -> serialNumber -> PartialNonFungibleTokenInfo
    PartialNonFungibleTokenInfo[] internal _partialNonFungibleTokenInfos;
    // NFT token -> _isNonFungible
    bool internal _isNonFungible;

    /// @dev common to both NFT and Fungible HTS tokens
    // HTS token -> account -> isAssociated
    address[] internal _associatedAccounts;
    bool[] internal _associationStatuses;
    // HTS token -> account -> isKyced
    address[] internal _kycAccounts;
    TokenConfig[] internal _kycStatuses;
    // HTS token -> account -> isFrozen
    address[] internal _unfrozenAccounts;
    TokenConfig[] internal _unfrozenStatuses;
    // HTS token -> keyType -> key address(contractId) e.g. tokenId -> 16 -> 0x123 means that the SUPPLY key for tokenId is account 0x123
    uint[] internal _tokenKeyTypes;
    address[] internal _tokenKeyAddresses;
    // HTS token -> deleted
    bool internal _tokenDeleted;
    // HTS token -> paused
    TokenConfig internal _tokenPaused;

    // - - - - - - EVENTS - - - - - -

    // emitted for convenience of having the token address accessible in a Hardhat environment
    event TokenCreated(address indexed token);

    constructor() NoDelegateCall(HTS_PRECOMPILE) {}

    // peripheral internal helpers:
    // Concatenate metadata bytes arrays
    function _concatenate(bytes[] memory metadata) internal pure returns (bytes memory) {
        // Calculate the total length of concatenated bytes
        uint totalLength = 0;
        for (uint i = 0; i < metadata.length; i++) {
            totalLength += metadata[i].length;
        }

        // Create a new bytes variable with the total length
        bytes memory result = new bytes(totalLength);

        // Concatenate bytes from metadata array into result
        uint currentIndex = 0;
        for (uint i = 0; i < metadata.length; i++) {
            for (uint j = 0; j < metadata[i].length; j++) {
                result[currentIndex] = metadata[i][j];
                currentIndex++;
            }
        }

        return result;
    }

    modifier onlyHederaToken() {
        require(_isToken(msg.sender), 'NOT_HEDERA_TOKEN');
        _;
    }

    // Check if the address is a token
    function _isToken() internal view returns (bool) {
        return _isFungible || _isNonFungible;
    }

    /// @dev Hedera appears to have phased out authorization from the EOA with https://github.com/hashgraph/hedera-services/releases/tag/v0.36.0
    function _isAccountOriginOrSender(address account) internal view returns (bool) {
        return _isAccountOrigin(account) || _isAccountSender(account);
    }

    function _isAccountOrigin(address account) internal view returns (bool) {
        return account == tx.origin;
    }

    function _isAccountSender(address account) internal view returns (bool) {
        return account == msg.sender;
    }

    // Get the treasury account for a token
    function _getTreasuryAccount() internal view returns (address treasury) {
        if (_isFungible) {
            treasury = _fungibleTokenInfos.tokenInfo.token.treasury;
        } else {
            treasury = _nftTokenInfos.token.treasury;
        }
    }

    // Check if the treasury signature is valid
    function _hasTreasurySig() internal view returns (bool validKey, bool noKey) {
        address key = _getTreasuryAccount(token);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the admin key signature is valid
    function _hasAdminKeySig() internal view returns (bool validKey, bool noKey) {
        address key = _getKey(KeyHelper.KeyType.ADMIN);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the kyc key signature is valid
    function _hasKycKeySig() internal view returns (bool validKey, bool noKey) {
        address key = _getKey(KeyHelper.KeyType.KYC);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the freeze key signature is valid
    function _hasFreezeKeySig() internal view returns (bool validKey, bool noKey) {
        address key = _getKey(KeyHelper.KeyType.FREEZE);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the wipe key signature is valid
    function _hasWipeKeySig() internal view returns (bool validKey, bool noKey) {
        address key = _getKey(KeyHelper.KeyType.WIPE);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the supply key signature is valid
    function _hasSupplyKeySig() internal view returns (bool validKey, bool noKey) {
        address key = _getKey(KeyHelper.KeyType.SUPPLY);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the fee schedule key signature is valid
    function _hasFeeScheduleKeySig() internal view returns (bool validKey, bool noKey) {
        address key = _getKey(KeyHelper.KeyType.FEE);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the pause key signature is valid
    function _hasPauseKeySig() internal view returns (bool validKey, bool noKey) {
        address key = _getKey(KeyHelper.KeyType.PAUSE);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    function _setFungibleTokenInfoToken(HederaToken memory hederaToken) internal {
        _fungibleTokenInfos.tokenInfo.token.name = hederaToken.name;
        _fungibleTokenInfos.tokenInfo.token.symbol = hederaToken.symbol;
        _fungibleTokenInfos.tokenInfo.token.treasury = hederaToken.treasury;
        _fungibleTokenInfos.tokenInfo.token.memo = hederaToken.memo;
        _fungibleTokenInfos.tokenInfo.token.tokenSupplyType = hederaToken.tokenSupplyType;
        _fungibleTokenInfos.tokenInfo.token.maxSupply = hederaToken.maxSupply;
        _fungibleTokenInfos.tokenInfo.token.freezeDefault = hederaToken.freezeDefault;
    }

    function _setFungibleTokenExpiry(Expiry memory expiryInfo) internal {
        _fungibleTokenInfos.tokenInfo.token.expiry.second = expiryInfo.second;
        _fungibleTokenInfos.tokenInfo.token.expiry.autoRenewAccount = expiryInfo.autoRenewAccount;
        _fungibleTokenInfos.tokenInfo.token.expiry.autoRenewPeriod = expiryInfo.autoRenewPeriod;
    }

    function _setFungibleTokenInfo(TokenInfo memory tokenInfo) internal {
        _fungibleTokenInfos.tokenInfo.totalSupply = tokenInfo.totalSupply;
        _fungibleTokenInfos.tokenInfo.deleted = tokenInfo.deleted;
        _fungibleTokenInfos.tokenInfo.defaultKycStatus = tokenInfo.defaultKycStatus;
        _fungibleTokenInfos.tokenInfo.pauseStatus = tokenInfo.pauseStatus;
        _fungibleTokenInfos.tokenInfo.ledgerId = tokenInfo.ledgerId;

        // TODO: Handle copying of other arrays (fixedFees, fractionalFees, and royaltyFees) if needed
    }

    function _setFungibleTokenKeys(TokenKey[] memory tokenKeys) internal {
        uint256 length = tokenKeys.length;
        for (uint256 i = 0; i < length; i++) {
            TokenKey memory tokenKey = tokenKeys[i];
            _fungibleTokenInfos.tokenInfo.token.tokenKeys.push(tokenKey);
            _tokenKeyTypes.push(tokenKey.keyType);
            _tokenKeyAddresses.push(tokenKey.key.contractId);
        }
    }

    function _setFungibleTokenInfo(FungibleTokenInfo memory fungibleTokenInfo) internal returns (address treasury) {
        treasury = fungibleTokenInfo.tokenInfo.token.treasury;

        _setFungibleTokenInfoToken(fungibleTokenInfo.tokenInfo.token);
        _setFungibleTokenExpiry(fungibleTokenInfo.tokenInfo.token.expiry);
        _setFungibleTokenKeys(fungibleTokenInfo.tokenInfo.token.tokenKeys);
        _setFungibleTokenInfo(fungibleTokenInfo.tokenInfo);

        _fungibleTokenInfos.decimals = fungibleTokenInfo.decimals;
    }

    function _setNftTokenInfoToken(HederaToken memory hederaToken) internal {
        _nftTokenInfos.token.name = hederaToken.name;
        _nftTokenInfos.token.symbol = hederaToken.symbol;
        _nftTokenInfos.token.treasury = hederaToken.treasury;
        _nftTokenInfos.token.memo = hederaToken.memo;
        _nftTokenInfos.token.tokenSupplyType = hederaToken.tokenSupplyType;
        _nftTokenInfos.token.maxSupply = hederaToken.maxSupply;
        _nftTokenInfos.token.freezeDefault = hederaToken.freezeDefault;
    }

    function _setNftTokenExpiry(Expiry memory expiryInfo) internal {
        _nftTokenInfos.token.expiry.second = expiryInfo.second;
        _nftTokenInfos.token.expiry.autoRenewAccount = expiryInfo.autoRenewAccount;
        _nftTokenInfos.token.expiry.autoRenewPeriod = expiryInfo.autoRenewPeriod;
    }

    function _setNftTokenInfo(TokenInfo memory nftTokenInfo) internal {
        _nftTokenInfos.totalSupply = nftTokenInfo.totalSupply;
        _nftTokenInfos.deleted = nftTokenInfo.deleted;
        _nftTokenInfos.defaultKycStatus = nftTokenInfo.defaultKycStatus;
        _nftTokenInfos.pauseStatus = nftTokenInfo.pauseStatus;
        _nftTokenInfos.ledgerId = nftTokenInfo.ledgerId;
    }

    function _setNftTokenKeys(TokenKey[] memory tokenKeys) internal {
        // Copy the tokenKeys array
        uint256 length = tokenKeys.length;
        for (uint256 i = 0; i < length; i++) {
            TokenKey memory tokenKey = tokenKeys[i];
            _nftTokenInfos.token.tokenKeys.push(tokenKey);

            /// @dev contractId can in fact be any address including an EOA address
            ///      The KeyHelper lists 5 types for KeyValueType; however only CONTRACT_ID is considered
            _tokenKeyTypes.push(tokenKey.keyType);
            _tokenKeyAddresses.push(tokenKey.key.contractId);
        }
    }

    function _setNftTokenInfo(TokenInfo memory nftTokenInfo) internal returns (address treasury) {
        treasury = nftTokenInfo.token.treasury;

        _setNftTokenInfoToken(nftTokenInfo.token);
        _setNftTokenKeys(nftTokenInfo.token.tokenKeys);
        _setNftTokenExpiry(nftTokenInfo.token.expiry);
        _setNftTokenInfo(nftTokenInfo);
    }

    // TODO: implement _post{Action} "internal" functions called inside and at the end of the pre{Action} functions is success == true
    // for getters implement _get{Data} "view internal" functions that have the exact same name as the HTS getter function name that is called after the precheck

    function _precheckCreateToken(
        address sender,
        HederaToken memory token,
        int64 initialTotalSupply,
        int32 decimals
    ) internal view returns (int64 responseCode) {
        bool validTreasurySig = sender == token.treasury;

        // if admin key is specified require admin sig
        KeyValue memory key = _getTokenKey(token.tokenKeys, _getKeyTypeValue(KeyHelper.KeyType.ADMIN));

        if (key.contractId != ADDRESS_ZERO) {
            if (sender != key.contractId) {
                return HederaResponseCodes.INVALID_ADMIN_KEY;
            }
        }

        for (uint256 i = 0; i < token.tokenKeys.length; i++) {
            TokenKey memory tokenKey = token.tokenKeys[i];

            if (tokenKey.key.contractId != ADDRESS_ZERO) {
                bool accountExists = _doesAccountExist(tokenKey.key.contractId);

                if (!accountExists) {

                    if (tokenKey.keyType == 1) { // KeyType.ADMIN
                        return HederaResponseCodes.INVALID_ADMIN_KEY;
                    }

                    if (tokenKey.keyType == 2) { // KeyType.KYC
                        return HederaResponseCodes.INVALID_KYC_KEY;
                    }

                    if (tokenKey.keyType == 4) { // KeyType.FREEZE
                        return HederaResponseCodes.INVALID_FREEZE_KEY;
                    }

                    if (tokenKey.keyType == 8) { // KeyType.WIPE
                        return HederaResponseCodes.INVALID_WIPE_KEY;
                    }

                    if (tokenKey.keyType == 16) { // KeyType.SUPPLY
                        return HederaResponseCodes.INVALID_SUPPLY_KEY;
                    }

                    if (tokenKey.keyType == 32) { // KeyType.FEE
                        return HederaResponseCodes.INVALID_CUSTOM_FEE_SCHEDULE_KEY;
                    }

                    if (tokenKey.keyType == 64) { // KeyType.PAUSE
                        return HederaResponseCodes.INVALID_PAUSE_KEY;
                    }
                }
            }
        }

        // TODO: add additional validation on token; validation most likely required on only tokenKeys(if an address(contract/EOA) has a zero-balance then consider the tokenKey invalid since active accounts on Hedera must have a positive HBAR balance)
        if (!validTreasurySig) {
            return HederaResponseCodes.AUTHORIZATION_FAILED;
        }

        if (decimals < 0 || decimals > 18) {
            return HederaResponseCodes.INVALID_TOKEN_DECIMALS;
        }

        if (initialTotalSupply < 0) {
            return HederaResponseCodes.INVALID_TOKEN_INITIAL_SUPPLY;
        }

        uint256 tokenNameLength = _getStringLength(token.name);
        uint256 tokenSymbolLength = _getStringLength(token.symbol);

        if (tokenNameLength == 0) {
            return HederaResponseCodes.MISSING_TOKEN_NAME;
        }

        // TODO: investigate correctness of max length conditionals
        // solidity strings use UTF-8 encoding, Hedera restricts the name and symbol to 100 bytes
        // in ASCII that is 100 characters
        // however in UTF-8 it is 100/4 = 25 UT-8 characters
        if (tokenNameLength > 100) {
            return HederaResponseCodes.TOKEN_NAME_TOO_LONG;
        }

        if (tokenSymbolLength == 0) {
            return HederaResponseCodes.MISSING_TOKEN_SYMBOL;
        }

        if (tokenSymbolLength > 100) {
            return HederaResponseCodes.TOKEN_SYMBOL_TOO_LONG;
        }

        return HederaResponseCodes.SUCCESS;
    }

    function _precheckDeleteToken(address sender) internal view returns (bool success, int64 responseCode) {

        /// @dev success is initialised to true such that the sequence of any of the validation functions below can be easily rearranged
        ///      the rearrangement of the functions may be done to more closely align the response codes with the actual response codes returned by Hedera
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (bool validKey, bool noKey) = _hasAdminKeySig();
        (success, responseCode) = success ? HederaTokenValidation._validateAdminKey(validKey, noKey) : (success, responseCode);
    }

    /// @dev handles precheck logic for both freeze and unfreeze
    function _precheckFreezeToken(address sender, address account) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (bool validKey, bool noKey) = _hasFreezeKeySig();
        (success, responseCode) = success ? HederaTokenValidation._validateFreezeKey(validKey, noKey) : (success, responseCode);
    }

    /// @dev handles precheck logic for both pause and unpause
    function _precheckPauseToken(address sender) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(token, _tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (bool validKey, bool noKey) = _hasPauseKeySig(token);
        (success, responseCode) = success ? HederaTokenValidation._validatePauseKey(validKey, noKey) : (success, responseCode);
    }

    /// @dev handles precheck logic for both kyc grant and revoke
    function _precheckKyc(address sender, address account) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? _validateKycKey() : (success, responseCode);
    }

    function _precheckUpdateTokenExpiryInfo(address sender, Expiry memory expiryInfo) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? _validateAdminKey() : (success, responseCode);
        // TODO: validate expiryInfo; move validation into common HederaTokenValidation contract that exposes validation functions
    }

    function _precheckUpdateTokenInfo(address sender, HederaToken memory tokenInfo) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken( _tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? _validateAdminKey() : (success, responseCode);
        // TODO: validate tokenInfo; move validation into common HederaTokenValidation contract that exposes validation functions
    }

    function _precheckUpdateTokenKeys(address sender, TokenKey[] memory keys) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? _validateAdminKey() : (success, responseCode);
        // TODO: validate keys; move validation into common HederaTokenValidation contract that exposes validation functions
    }

    function _validateAdminKey() internal view returns (bool success, int64 responseCode) {
        (bool validKey, bool noKey) = _hasAdminKeySig();
        (success, responseCode) = HederaTokenValidation._validateAdminKey(validKey, noKey);
    }

    function _validateKycKey() internal view returns (bool success, int64 responseCode) {
        (bool validKey, bool noKey) = _hasKycKeySig();
        (success, responseCode) = HederaTokenValidation._validateKycKey(validKey, noKey);
    }

    function _validateSupplyKey() internal view returns (bool success, int64 responseCode) {
        (bool validKey, bool noKey) = _hasSupplyKeySig();
        (success, responseCode) = HederaTokenValidation._validateSupplyKey(validKey, noKey);
    }

    function _validateFreezeKey() internal view returns (bool success, int64 responseCode) {
        (bool validKey, bool noKey) = _hasFreezeKeySig();
        (success, responseCode) = HederaTokenValidation._validateFreezeKey(validKey, noKey);
    }

    function _validateTreasuryKey() internal view returns (bool success, int64 responseCode) {
        (bool validKey, bool noKey) = _hasTreasurySig();
        (success, responseCode) = HederaTokenValidation._validateTreasuryKey(validKey, noKey);
    }

    function _validateWipeKey() internal view returns (bool success, int64 responseCode) {
        (bool validKey, bool noKey) = _hasWipeKeySig();
        (success, responseCode) = HederaTokenValidation._validateWipeKey(validKey, noKey);
    }

    function _validateAccountKyc(address account) internal view returns (bool success, int64 responseCode) {
        bool isKyced;
        (responseCode, isKyced) = isKyc(account);
        success = _doesAccountPassKyc(responseCode, isKyced);
        (success, responseCode) = HederaTokenValidation._validateAccountKyc(success);
    }

    function _validateAccountUnfrozen(address account) internal view returns (bool success, int64 responseCode) {
        bool isAccountFrozen;
        (responseCode, isAccountFrozen) = isFrozen(account);
        success = _doesAccountPassUnfrozen(responseCode, isAccountFrozen);
        (success, responseCode) = success ? HederaTokenValidation._validateAccountFrozen(success) : (success, responseCode);
    }

    /// @dev the following internal _precheck functions are called in either of the following 2 scenarios:
    ///      1. before the HtsSystemContractMock calls any of the HederaFungibleToken or HederaNonFungibleToken functions that specify the onlyHtsPrecompile modifier
    ///      2. in any of HtsSystemContractMock functions that specifies the onlyHederaToken modifier which is only callable by a HederaFungibleToken or HederaNonFungibleToken contract

    /// @dev for both Fungible and NonFungible
    function _precheckApprove(
        address sender, // sender should be owner in order to approve
        address spender,
        uint256 amountOrSerialNumber /// for Fungible is the amount and for NonFungible is the serialNumber
    ) internal view returns (bool success, int64 responseCode) {

        success = true;

        /// @dev Hedera does not require an account to be associated with a token in be approved an allowance
        // if (!_association[owner] || !_association[spender]) {
        //     return HederaResponseCodes.TOKEN_NOT_ASSOCIATED_TO_ACCOUNT;
        // }

        (success, responseCode) = success ? _validateAccountKyc(sender) : (success, responseCode);
        (success, responseCode) = success ? _validateAccountKyc(spender) : (success, responseCode);

        (success, responseCode) = success ? _validateAccountUnfrozen(sender) : (success, responseCode);
        (success, responseCode) = success ? _validateAccountUnfrozen(spender) : (success, responseCode);

        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? HederaTokenValidation._validateNftOwnership(sender, amountOrSerialNumber, _isNonFungible, _partialNonFungibleTokenInfos) : (success, responseCode);
    }

    function _precheckSetApprovalForAll(
        address owner,
        address operator,
        bool approved
    ) internal view returns (bool success, int64 responseCode) {

        success = true;

        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);

        (success, responseCode) = success ? HederaTokenValidation._validateTokenAssociation(owner, _association) : (success, responseCode);
        (success, responseCode) = success ? HederaTokenValidation._validateTokenAssociation(operator, _association) : (success, responseCode);

        (success, responseCode) = success ? _validateAccountKyc(owner) : (success, responseCode);
        (success, responseCode) = success ? _validateAccountKyc(operator) : (success, responseCode);

        (success, responseCode) = success ? _validateAccountUnfrozen(owner) : (success, responseCode);
        (success, responseCode) = success ? _validateAccountUnfrozen(operator) : (success, responseCode);

        (success, responseCode) = success ? HederaTokenValidation._validateIsNonFungible( _isNonFungible) : (success, responseCode);
    }

    function _precheckMint(
        int64 amount,
        bytes[] memory metadata
    ) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(token, _tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? _validateSupplyKey(token) : (success, responseCode);
    }

    // TODO: implement multiple NFTs being burnt instead of just index 0
    function _precheckBurn(
        int64 amount,
        int64[] memory serialNumbers // since only 1 NFT can be burnt at a time; expect length to be 1
    ) internal view returns (bool success, int64 responseCode) {
        success = true;

        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? _validateTreasuryKey() : (success, responseCode);
        (success, responseCode) = success ? HederaTokenValidation._validateTokenSufficiency(_getTreasuryAccount(), amount, serialNumbers[0], _isFungible, _isNonFungible, _partialNonFungibleTokenInfos) : (success, responseCode);
    }

    // TODO: implement multiple NFTs being wiped, instead of just index 0
    function _precheckWipe(
        address sender,
        address account,
        int64 amount,
        int64[] memory serialNumbers // since only 1 NFT can be wiped at a time; expect length to be 1
    ) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? HederaTokenValidation._validBurnInput(_isFungible, _isNonFungible, amount, serialNumbers) : (success, responseCode);
        (success, responseCode) = success ? _validateWipeKey() : (success, responseCode);
        (success, responseCode) = success ? HederaTokenValidation._validateTokenSufficiency(account, amount, serialNumbers[0], _isFungible, _isNonFungible, _partialNonFungibleTokenInfos) : (success, responseCode);
    }

    function _precheckGetApproved(
        uint256 serialNumber
    ) internal view returns (bool success, int64 responseCode) {
        // TODO: do additional validation that serialNumber exists and is not burnt
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
    }

    function _precheckGetFungibleTokenInfo() internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? HederaTokenValidation._validateIsFungible(_isFungible) : (success, responseCode);
    }

    function _precheckGetNonFungibleTokenInfo() internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? HederaTokenValidation._validateIsNonFungible(_isNonFungible) : (success, responseCode);
    }

    function _precheckGetTokenCustomFees() internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
    }

    function _precheckGetTokenDefaultFreezeStatus() internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
    }

    function _precheckGetTokenDefaultKycStatus() internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
    }

    function _precheckGetTokenExpiryInfo() internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
    }

    function _precheckGetTokenInfo() internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
    }

    function _precheckGetTokenKey() internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
    }

    function _precheckGetTokenType() internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken( _tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
    }

    function _precheckIsFrozen(address account) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? _validateFreezeKey() : (success, responseCode);
    }

    function _precheckIsKyc(address account) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? _validateKycKey() : (success, responseCode);
    }

    function _precheckAllowance(
        address owner,
        address spender
    ) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
    }

    function _precheckAssociateToken(address account) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);

        // TODO: consider extending HederaTokenValidation#_validateTokenAssociation with TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT
        if (success) {
            for (uint256 i = 0; i < _associatedAccounts.length; i++) {
                if (_associatedAccounts[i] == account && _associationStatuses[i]) {
                    return (false, HederaResponseCodes.TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT);
                }
            }
        }
    }

    function _precheckDissociateToken(address account) internal view returns (bool success, int64 responseCode) {
        success = true;
        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);
        (success, responseCode) = success ? HederaTokenValidation._validateTokenAssociation(account, _association) : (success, responseCode);
        (success, responseCode) = success ? HederaTokenValidation._validateTokenDissociation(account, _association, _isFungible, _isNonFungible) : (success, responseCode);
    }

    /// @dev doesPassKyc if KYC is not enabled or if enabled then account is KYCed explicitly or by default
    function _doesAccountPassKyc(int64 responseCode, bool isKyced) internal pure returns (bool doesPassKyc) {
        doesPassKyc = responseCode == HederaResponseCodes.SUCCESS ? isKyced : true;
    }

    /// @dev doesPassUnfrozen if freeze is not enabled or if enabled then account is unfrozen explicitly or by default
    function _doesAccountPassUnfrozen(int64 responseCode, bool isFrozen) internal pure returns (bool doesPassUnfrozen) {
        doesPassUnfrozen = responseCode == HederaResponseCodes.SUCCESS ? !isFrozen : true;
    }

    function _precheckTransfer(
        address spender,
        address from,
        address to,
        uint256 amountOrSerialNumber
    ) internal view returns (bool success, int64 responseCode, bool isRequestFromOwner) {

        success = true;

        (success, responseCode) = success ? HederaTokenValidation._validateToken(_tokenDeleted, _isFungible, _isNonFungible) : (success, responseCode);

        (success, responseCode) = success ? HederaTokenValidation._validateTokenAssociation(from, _association) : (success, responseCode);
        (success, responseCode) = success ? HederaTokenValidation._validateTokenAssociation(to, _association) : (success, responseCode);

        (success, responseCode) = success ? _validateAccountKyc(spender) : (success, responseCode);
        (success, responseCode) = success ? _validateAccountKyc(from) : (success, responseCode);
        (success, responseCode) = success ? _validateAccountKyc(to) : (success, responseCode);

        (success, responseCode) = success ? _validateAccountUnfrozen(spender) : (success, responseCode);
        (success, responseCode) = success ? _validateAccountUnfrozen(from) : (success, responseCode);
        (success, responseCode) = success ? _validateAccountUnfrozen(to) : (success, responseCode);

        // If transfer request is not from owner then check allowance of msg.sender
        bool shouldAssumeRequestFromOwner = spender == ADDRESS_ZERO;
        isRequestFromOwner = _isAccountSender(from) || shouldAssumeRequestFromOwner;

        (success, responseCode) = success ? HederaTokenValidation._validateTokenSufficiency(from, amountOrSerialNumber, amountOrSerialNumber, _isFungible, _isNonFungible, _partialNonFungibleTokenInfos) : (success, responseCode);

        if (isRequestFromOwner || !success) {
            return (success, responseCode, isRequestFromOwner);
        }

        (success, responseCode) = success ? HederaTokenValidation._validateApprovalSufficiency(token, spender, from, amountOrSerialNumber, _isFungible, _isNonFungible) : (success, responseCode);

        return (success, responseCode, isRequestFromOwner);
    }

    function _postTransfer(
        address spender,
        address from,
        address to,
        uint256 amountOrSerialNumber
    ) internal {
        if (_isNonFungible) {
            int64 serialNumber = int64(uint64(amountOrSerialNumber));
            _partialNonFungibleTokenInfos[serialNumber].ownerId = to;
            delete _partialNonFungibleTokenInfos[serialNumber].spenderId;
        }
    }

    function _postAssociate(
        address sender
    ) internal {
        _associatedAccounts.push(sender);
        _associationStatuses.push(true);
    }

    function _postDissociate(
        address sender
    ) internal {
        for (uint256 i = 0; i < _associatedAccounts.length; i++) {
            if (_associatedAccounts[i] == sender) {
                _associationStatuses[i] = false;
            }
        }
    }

    function _postApprove(
        address sender,
        address spender,
        uint256 amountOrSerialNumber
    ) internal {
        if (_isNonFungible) {
            int64 serialNumber = int64(uint64(amountOrSerialNumber));
            _partialNonFungibleTokenInfos[serialNumber].spenderId = spender;
        }
    }

    function _postMint(
        int64 amountOrSerialNumber,
        bytes[] memory metadata
    ) internal {
        if (_isNonFungible) {
            _partialNonFungibleTokenInfos[amountOrSerialNumber] = PartialNonFungibleTokenInfo({
                ownerId: _getTreasuryAccount(),
                creationTime: int64(int(block.timestamp)),
                metadata: _concatenate(metadata),
                spenderId: ADDRESS_ZERO
            });
        }
    }

    function _postBurn(
        int64 amount,
        int64[] memory serialNumbers
    ) internal {
        if (_isNonFungible) {
            int64 serialNumber;
            uint burnCount = serialNumbers.length;
            for (uint256 i = 0; i < burnCount; i++) {
                serialNumber = serialNumbers[i];
                delete _partialNonFungibleTokenInfos[serialNumber].ownerId;
                delete _partialNonFungibleTokenInfos[serialNumber].spenderId;

                // TODO: remove the break statement below once multiple NFT burns are enabled in a single call
                break; // only delete the info at index 0 since only 1 NFT is burnt at a time
            }
        }
    }

    function preAssociate(
        address sender // msg.sender in the context of the Hedera{Non|}FungibleToken; it should be owner for SUCCESS
    ) external onlyHederaToken returns (int64 responseCode) {
        bool success;
        (success, responseCode) = _precheckAssociateToken(sender);
        if (success) {
            _postAssociate(sender);
        }
    }

    function preDissociate(
        address sender // msg.sender in the context of the Hedera{Non|}FungibleToken; it should be owner for SUCCESS
    ) external onlyHederaToken returns (int64 responseCode) {
        bool success;
        (success, responseCode) = _precheckDissociateToken(sender);
        if (success) {
            _postDissociate(sender);
        }
    }

    function preApprove(
        address sender, // msg.sender in the context of the Hedera{Non|}FungibleToken; it should be owner for SUCCESS
        address spender,
        uint256 amountOrSerialNumber /// for Fungible is the amount and for NonFungible is the serialNumber
    ) external onlyHederaToken returns (int64 responseCode) {
        bool success;
        (success, responseCode) = _precheckApprove(sender, spender, amountOrSerialNumber);
        if (success) {
            _postApprove(sender, spender, amountOrSerialNumber);
        }
    }

    function preSetApprovalForAll(
        address sender, // msg.sender in the context of the Hedera{Non|}FungibleToken; it should be owner for SUCCESS
        address operator,
        bool approved
    ) external onlyHederaToken returns (int64 responseCode) {
        bool success;
        (success, responseCode) = _precheckSetApprovalForAll(sender, operator, approved);
    }

    /// @dev not currently called by Hedera{}Token
    function preMint(
        int64 amount,
        bytes[] memory metadata
    ) external onlyHederaToken returns (int64 responseCode) {
        bool success;
        (success, responseCode) = _precheckMint(token, amount, metadata);

        if (success) {

            int64 amountOrSerialNumber;

            if (_isFungible) {
                amountOrSerialNumber = amount;
            } else {
                amountOrSerialNumber = HederaNonFungibleToken().mintCount() + 1;
            }

            _postMint(amountOrSerialNumber, metadata);
        }
    }

    /// @dev not currently called by Hedera{}Token
    function preBurn(int64 amount, int64[] memory serialNumbers) external onlyHederaToken returns (int64 responseCode) {
        bool success;
        (success, responseCode) = _precheckBurn(amount, serialNumbers);

        if (success) {
            _postBurn(amount, serialNumbers);
        }
    }

    function preTransfer(
        address spender, /// @dev if spender == ADDRESS_ZERO then assume ERC20#transfer(i.e. msg.sender is attempting to spend their balance) otherwise ERC20#transferFrom(i.e. msg.sender is attempting to spend balance of "from" using allowance)
        address from,
        address to,
        uint256 amountOrSerialNumber
    ) external onlyHederaToken returns (int64 responseCode) {
        bool success;
        (success, responseCode, ) = _precheckTransfer(spender, from, to, amountOrSerialNumber);
        if (success) {
            _postTransfer(spender, from, to, amountOrSerialNumber);
        }
    }

    /// @dev register HederaFungibleToken; msg.sender is the HederaFungibleToken
    ///      can be called by any contract; however assumes msg.sender is a HederaFungibleToken
    function registerHederaFungibleToken(address caller, FungibleTokenInfo memory fungibleTokenInfo) external {

        /// @dev if caller is this contract(i.e. the HtsSystemContractMock) then no need to call _precheckCreateToken since it was already called when the createFungibleToken or other relevant method was called
        bool doPrecheck = caller != address(this);

        int64 responseCode = doPrecheck ? _precheckCreateToken(caller, fungibleTokenInfo.tokenInfo.token, fungibleTokenInfo.tokenInfo.totalSupply, fungibleTokenInfo.decimals) : HederaResponseCodes.SUCCESS;

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("PRECHECK_FAILED"); // TODO: revert with custom error that includes response code
        }

        _isFungible = true;
        address treasury = _setFungibleTokenInfo(fungibleTokenInfo);
        associateToken(treasury);
    }

    /// @dev register HederaNonFungibleToken; msg.sender is the HederaNonFungibleToken
    ///      can be called by any contract; however assumes msg.sender is a HederaNonFungibleToken
    function registerHederaNonFungibleToken(address caller, TokenInfo memory nftTokenInfo) external {

        /// @dev if caller is this contract(i.e. the HtsSystemContractMock) then no need to call _precheckCreateToken since it was already called when the createNonFungibleToken or other relevant method was called
        bool doPrecheck = caller != address(this);

        int64 responseCode = doPrecheck ? _precheckCreateToken(caller, nftTokenInfo.token, 0, 0) : HederaResponseCodes.SUCCESS;

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("PRECHECK_FAILED"); // TODO: revert with custom error that includes response code
        }

        _isNonFungible = true;
        address treasury = _setNftTokenInfo(nftTokenInfo);

        associateToken(treasury);
    }

    // IHederaTokenService public/external view functions:
    function getApproved(
        uint256 serialNumber
    ) external view returns (int64 responseCode, address approved) {

        bool success;
        (success, responseCode) = _precheckGetApproved(serialNumber);

        if (!success) {
            return (responseCode, approved);
        }

        // TODO: abstract logic into _get{Data} function
        approved = HederaNonFungibleToken().getApproved(serialNumber);
    }

    function getFungibleTokenInfo(
    ) external view returns (int64 responseCode, FungibleTokenInfo memory fungibleTokenInfo) {

        bool success;
        (success, responseCode) = _precheckGetFungibleTokenInfo();

        if (!success) {
            return (responseCode, fungibleTokenInfo);
        }

        // TODO: abstract logic into _get{Data} function
        fungibleTokenInfo = _fungibleTokenInfos;
    }

    function getNonFungibleTokenInfo(
        int64 serialNumber
    ) external view returns (int64 responseCode, NonFungibleTokenInfo memory nonFungibleTokenInfo) {

        bool success;
        (success, responseCode) = _precheckGetNonFungibleTokenInfo();

        if (!success) {
            return (responseCode, nonFungibleTokenInfo);
        }

        // TODO: abstract logic into _get{Data} function
        TokenInfo memory nftTokenInfo = _nftTokenInfos;
        PartialNonFungibleTokenInfo memory partialNonFungibleTokenInfo = _partialNonFungibleTokenInfos[
                    serialNumber
            ];

        nonFungibleTokenInfo.tokenInfo = nftTokenInfo;

        nonFungibleTokenInfo.serialNumber = serialNumber;

        nonFungibleTokenInfo.ownerId = partialNonFungibleTokenInfo.ownerId;
        nonFungibleTokenInfo.creationTime = partialNonFungibleTokenInfo.creationTime;
        nonFungibleTokenInfo.metadata = partialNonFungibleTokenInfo.metadata;
        nonFungibleTokenInfo.spenderId = partialNonFungibleTokenInfo.spenderId;
    }

    function getTokenCustomFees(
    )
    external
    view
    returns (
        int64 responseCode,
        FixedFee[] memory fixedFees,
        FractionalFee[] memory fractionalFees,
        RoyaltyFee[] memory royaltyFees
    )
    {

        bool success;
        (success, responseCode) = _precheckGetTokenCustomFees(token);

        if (!success) {
            return (responseCode, fixedFees, fractionalFees, royaltyFees);
        }

        // TODO: abstract logic into _get{Data} function
        if (_isFungible) {
            fixedFees = _fungibleTokenInfos.tokenInfo.fixedFees;
            fractionalFees = _fungibleTokenInfos.tokenInfo.fractionalFees;
            royaltyFees = _fungibleTokenInfos.tokenInfo.royaltyFees;
        } else {
            fixedFees = _nftTokenInfos.fixedFees;
            fractionalFees = _nftTokenInfos.fractionalFees;
            royaltyFees = _nftTokenInfos.royaltyFees;
        }
    }

    function getTokenDefaultFreezeStatus(
    ) external view returns (int64 responseCode, bool defaultFreezeStatus) {

        bool success;
        (success, responseCode) = _precheckGetTokenDefaultFreezeStatus();

        if (!success) {
            return (responseCode, defaultFreezeStatus);
        }

        // TODO: abstract logic into _get{Data} function
        if (_isFungible) {
            defaultFreezeStatus = _fungibleTokenInfos.tokenInfo.token.freezeDefault;
        } else {
            defaultFreezeStatus = _nftTokenInfos.token.freezeDefault;
        }
    }

    function getTokenDefaultKycStatus() external view returns (int64 responseCode, bool defaultKycStatus) {

        bool success;
        (success, responseCode) = _precheckGetTokenDefaultKycStatus();

        if (!success) {
            return (responseCode, defaultKycStatus);
        }

        // TODO: abstract logic into _get{Data} function
        if (_isFungible) {
            defaultKycStatus = _fungibleTokenInfos.tokenInfo.defaultKycStatus;
        } else {
            defaultKycStatus = _nftTokenInfos.defaultKycStatus;
        }
    }

    function getTokenExpiryInfo() external view returns (int64 responseCode, Expiry memory expiry) {

        bool success;
        (success, responseCode) = _precheckGetTokenExpiryInfo();

        if (!success) {
            return (responseCode, expiry);
        }

        // TODO: abstract logic into _get{Data} function
        if (_isFungible) {
            expiry = _fungibleTokenInfos.tokenInfo.token.expiry;
        } else {
            expiry = _nftTokenInfos.token.expiry;
        }
    }

    function getTokenInfo() external view returns (int64 responseCode, TokenInfo memory tokenInfo) {

        bool success;
        (success, responseCode) = _precheckGetTokenInfo();

        if (!success) {
            return (responseCode, tokenInfo);
        }

        // TODO: abstract logic into _get{Data} function
        if (_isFungible) {
            tokenInfo = _fungibleTokenInfos.tokenInfo;
        } else {
            tokenInfo = _nftTokenInfos;
        }
    }

    function getTokenKey(uint keyType) external view returns (int64 responseCode, KeyValue memory key) {

        bool success;
        (success, responseCode) = _precheckGetTokenKey();

        if (!success) {
            return (responseCode, key);
        }

        // TODO: abstract logic into _get{Data} function
        /// @dev the key can be retrieved using either of the following methods
        // method 1: gas inefficient
        // key = _getTokenKey(_fungibleTokenInfos.tokenInfo.token.tokenKeys, keyType);

        // method 2: more gas efficient and works for BOTH token types; however currently only considers contractId
        for (uint256 i = 0; i < _tokenKeyTypes.length; i++) {
            if (_tokenKeyTypes[i] == keyType) {
                key.contractId = _tokenKeyAddresses[i];
                break;
            }
        }
    }

    function _getTokenKey(IHederaTokenService.TokenKey[] memory tokenKeys, uint keyType) internal view returns (KeyValue memory key) {
        uint256 length = tokenKeys.length;

        for (uint256 i = 0; i < length; i++) {
            IHederaTokenService.TokenKey memory tokenKey = tokenKeys[i];
            if (tokenKey.keyType == keyType) {
                key = tokenKey.key;
                break;
            }
        }
    }

    function getTokenType() external view returns (int64 responseCode, int32 tokenType) {

        bool success;
        (success, responseCode) = _precheckGetTokenType();

        if (!success) {
            return (responseCode, tokenType);
        }

        // TODO: abstract logic into _get{Data} function
        bool isFungibleToken = _isFungible;
        bool isNonFungibleToken = _isNonFungible;
        tokenType = isFungibleToken ? int32(0) : int32(1);
    }

    function grantTokenKyc(address account) external returns (int64 responseCode) {

        bool success;
        (success, responseCode) = _precheckKyc(msg.sender, account);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        _kycAccounts.push(account);
        _kycStatuses.push(TokenConfig({
            explicit: true,
            value: true
        }));
    }

    /// @dev Applicable ONLY to NFT Tokens; accessible via IERC721
    function isApprovedForAll(
        address owner,
        address operator
    ) external view returns (int64 responseCode, bool approved) {}

    function isFrozen(address account) public view returns (int64 responseCode, bool frozen) {

        bool success = true;
        (success, responseCode) = _precheckIsFrozen(account);

        if (!success) {
            return (responseCode, frozen);
        }

        bool isFungible = _isFungible;
        bool isNonFungible = _isNonFungible;
        // TODO: abstract logic into _isFrozen function
        bool freezeDefault;
        if (isFungible) {
            FungibleTokenInfo memory fungibleTokenInfo = _fungibleTokenInfos;
            freezeDefault = fungibleTokenInfo.tokenInfo.token.freezeDefault;
        } else {
            TokenInfo memory nftTokenInfo = _nftTokenInfos;
            freezeDefault = nftTokenInfo.token.freezeDefault;
        }

        for (uint256 i = 0; i < _unfrozenAccounts.length; i++) {
            if (_unfrozenAccounts[i] == account) {
                TokenConfig memory unfrozenConfig = _unfrozenStatuses[i];
                frozen = unfrozenConfig.explicit ? !(unfrozenConfig.value) : (freezeDefault ? !(unfrozenConfig.value) : false);
                break;
            }
        }
    }

    function isKyc(address account) public view returns (int64 responseCode, bool kycGranted) {

        bool success;
        (success, responseCode) = _precheckIsKyc(account);

        if (!success) {
            return (responseCode, kycGranted);
        }

        // TODO: abstract logic into _isKyc function
        bool isFungible = _isFungible;
        bool isNonFungible = _isNonFungible;
        bool defaultKycStatus;
        if (isFungible) {
            FungibleTokenInfo memory fungibleTokenInfo = _fungibleTokenInfos;
            defaultKycStatus = fungibleTokenInfo.tokenInfo.defaultKycStatus;
        } else {
            TokenInfo memory nftTokenInfo = _nftTokenInfos;
            defaultKycStatus = nftTokenInfo.defaultKycStatus;
        }

        for (uint256 i = 0; i < _kycAccounts.length; i++) {
            if (_kycAccounts[i] == account) {
                TokenConfig memory kycConfig = _kycStatuses[i];
                kycGranted = kycConfig.explicit ? kycConfig.value : (defaultKycStatus ? kycConfig.value : true);
                break;
            }
        }
    }

    function isToken() public view returns (int64 responseCode, bool isToken) {
        isToken = _isToken();
        responseCode = isToken ? HederaResponseCodes.SUCCESS : HederaResponseCodes.INVALID_TOKEN_ID;
    }

    function allowance(
        address owner,
        address spender
    ) public view returns (int64 responseCode, uint256 allowance) {

        bool success;
        (success, responseCode) = _precheckAllowance(owner, spender);

        if (!success) {
            return (responseCode, allowance);
        }

        // TODO: abstract logic into _allowance function
        allowance = HederaFungibleToken().allowance(owner, spender);
    }

    // Additional(not in IHederaTokenService) public/external view functions:
    /// @dev KeyHelper.KeyType is an enum; whereas KeyHelper.keyTypes is a mapping that maps the enum index to a uint256
    /// keyTypes[KeyType.ADMIN] = 1;
    /// keyTypes[KeyType.KYC] = 2;
    /// keyTypes[KeyType.FREEZE] = 4;
    /// keyTypes[KeyType.WIPE] = 8;
    /// keyTypes[KeyType.SUPPLY] = 16;
    /// keyTypes[KeyType.FEE] = 32;
    /// keyTypes[KeyType.PAUSE] = 64;
    /// i.e. the relation is 2^(uint(KeyHelper.KeyType)) = keyType
    function _getKey(KeyHelper.KeyType keyType) internal view returns (address keyOwner) {
        /// @dev the following relation is used due to the below described issue with KeyHelper.getKeyType
        uint _keyType = _getKeyTypeValue(keyType);
        /// @dev the following does not work since the KeyHelper has all of its storage/state cleared/defaulted once vm.etch is used
        ///      to fix this KeyHelper should expose a function that does what it's constructor does i.e. initialise the keyTypes mapping
        // uint _keyType = getKeyType(keyType);
        for (uint256 i = 0; i < _tokenKeyTypes.length; i++) {
            if (_tokenKeyTypes[i] == _keyType) {
                keyOwner = _tokenKeyAddresses[i];
                break;
            }
        }
    }

    // TODO: move into a common util contract as it's used elsewhere
    function _getKeyTypeValue(KeyHelper.KeyType keyType) internal pure returns (uint256 keyTypeValue) {
        keyTypeValue = 2 ** uint(keyType);
    }

    function _getBalance(address account) internal view returns (uint256 balance) {
        balance = account.balance;
    }

    // TODO: validate account exists wherever applicable; transfers, mints, burns, etc
    // is account(either an EOA or contract) has a non-zero balance then assume it exists
    function _doesAccountExist(address account) internal view returns (bool exists) {
        exists = _getBalance(account) > 0;
    }

    // IHederaTokenService public/external state-changing functions:
    function createFungibleToken(
        HederaToken memory token,
        int64 initialTotalSupply,
        int32 decimals
    ) external payable noDelegateCall returns (int64 responseCode, address tokenAddress) {
        responseCode = _precheckCreateToken(msg.sender, token, initialTotalSupply, decimals);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            return (responseCode, ADDRESS_ZERO);
        }

        FungibleTokenInfo memory fungibleTokenInfo;
        TokenInfo memory tokenInfo;

        tokenInfo.token = token;
        tokenInfo.totalSupply = initialTotalSupply;

        fungibleTokenInfo.decimals = decimals;
        fungibleTokenInfo.tokenInfo = tokenInfo;

        /// @dev no need to register newly created HederaFungibleToken in this context as the constructor will call HtsSystemContractMock#registerHederaFungibleToken
        HederaFungibleToken hederaFungibleToken = new HederaFungibleToken(fungibleTokenInfo);
        emit TokenCreated(address(hederaFungibleToken));
        return (HederaResponseCodes.SUCCESS, address(hederaFungibleToken));
    }

    function createNonFungibleToken(
        HederaToken memory token
    ) external payable noDelegateCall returns (int64 responseCode, address tokenAddress) {
        responseCode = _precheckCreateToken(msg.sender, token, 0, 0);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            return (responseCode, ADDRESS_ZERO);
        }

        TokenInfo memory tokenInfo;
        tokenInfo.token = token;

        /// @dev no need to register newly created HederaNonFungibleToken in this context as the constructor will call HtsSystemContractMock#registerHederaNonFungibleToken
        HederaNonFungibleToken hederaNonFungibleToken = new HederaNonFungibleToken(tokenInfo);
        emit TokenCreated(address(hederaNonFungibleToken));
        return (HederaResponseCodes.SUCCESS, address(hederaNonFungibleToken));
    }

    // TODO: implement logic that considers fixedFees, fractionalFees where applicable such as on transfers
    function createFungibleTokenWithCustomFees(
        HederaToken memory token,
        int64 initialTotalSupply,
        int32 decimals,
        FixedFee[] memory fixedFees,
        FractionalFee[] memory fractionalFees
    ) external payable noDelegateCall returns (int64 responseCode, address tokenAddress) {
        responseCode = _precheckCreateToken(msg.sender, token, initialTotalSupply, decimals);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            return (responseCode, ADDRESS_ZERO);
        }

        FungibleTokenInfo memory fungibleTokenInfo;
        TokenInfo memory tokenInfo;

        tokenInfo.token = token;
        tokenInfo.totalSupply = initialTotalSupply;
        tokenInfo.fixedFees = fixedFees;
        tokenInfo.fractionalFees = fractionalFees;

        fungibleTokenInfo.decimals = decimals;
        fungibleTokenInfo.tokenInfo = tokenInfo;

        /// @dev no need to register newly created HederaFungibleToken in this context as the constructor will call HtsSystemContractMock#registerHederaFungibleToken
        HederaFungibleToken hederaFungibleToken = new HederaFungibleToken(fungibleTokenInfo);
        emit TokenCreated(address(hederaFungibleToken));
        return (HederaResponseCodes.SUCCESS, address(hederaFungibleToken));
    }

    // TODO: implement logic that considers fixedFees, royaltyFees where applicable such as on transfers
    function createNonFungibleTokenWithCustomFees(
        HederaToken memory token,
        FixedFee[] memory fixedFees,
        RoyaltyFee[] memory royaltyFees
    ) external payable noDelegateCall returns (int64 responseCode, address tokenAddress) {
        responseCode = _precheckCreateToken(msg.sender, token, 0, 0);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            return (responseCode, ADDRESS_ZERO);
        }

        TokenInfo memory tokenInfo;
        tokenInfo.token = token;
        tokenInfo.fixedFees = fixedFees;
        tokenInfo.royaltyFees = royaltyFees;

        /// @dev no need to register newly created HederaNonFungibleToken in this context as the constructor will call HtsSystemContractMock#registerHederaNonFungibleToken
        HederaNonFungibleToken hederaNonFungibleToken = new HederaNonFungibleToken(tokenInfo);
        emit TokenCreated(address(hederaNonFungibleToken));
        return (HederaResponseCodes.SUCCESS, address(hederaNonFungibleToken));
    }

    // TODO
    function cryptoTransfer(
        TransferList memory transferList,
        TokenTransferList[] memory tokenTransfers
    ) external noDelegateCall returns (int64 responseCode) {}

    function deleteToken() external noDelegateCall returns (int64 responseCode) {
        bool success;
        (success, responseCode) = _precheckDeleteToken(msg.sender);

        if (!success) {
            return responseCode;
        }

        _tokenDeleted = true;
    }

    function approve(
        address spender,
        uint256 amount
    ) external noDelegateCall returns (int64 responseCode) {
        address owner = msg.sender;
        bool success;
        (success, responseCode) = _precheckApprove(token, owner, spender, amount); // _precheckApprove works for BOTH token types

        if (!success) {
            return responseCode;
        }

        _postApprove(owner, spender, amount);
        HederaFungibleToken().approveRequestFromHtsPrecompile(owner, spender, amount);
    }

    function approveNFT(
        address approved,
        uint256 serialNumber
    ) external noDelegateCall returns (int64 responseCode) {
        address owner = msg.sender;
        address spender = approved;
        int64 _serialNumber = int64(int(serialNumber));
        bool success;
        (success, responseCode) = _precheckApprove(owner, spender, serialNumber); // _precheckApprove works for BOTH token types

        if (!success) {
            return responseCode;
        }

        _postApprove(owner, spender, serialNumber);
        HederaNonFungibleToken().approveRequestFromHtsPrecompile(spender, _serialNumber, owner);
    }

    function associateToken(address account) public noDelegateCall returns (int64 responseCode) {

        bool success;
        (success, responseCode) = _precheckAssociateToken(account);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        _associatedAccounts.push(account);
        _associationStatuses.push(true);
    }

    function associateTokens(
        address account,
        address[] memory tokens
    ) external noDelegateCall returns (int64 responseCode) {
        for (uint256 i = 0; i < tokens.length; i++) {
            responseCode = associateToken(account, tokens[i]);
            if (responseCode != HederaResponseCodes.SUCCESS) {
                return responseCode;
            }
        }
    }

    function dissociateTokens(
        address account,
        address[] memory tokens
    ) external noDelegateCall returns (int64 responseCode) {
        for (uint256 i = 0; i < tokens.length; i++) {
            int64 responseCode = dissociateToken(account, tokens[i]);
            if (responseCode != HederaResponseCodes.SUCCESS) {
                return responseCode;
            }
        }
    }

    function dissociateToken(address account) public noDelegateCall returns (int64 responseCode) {

        bool success;
        (success, responseCode) = _precheckDissociateToken(account);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        for (uint256 i = 0; i < _associatedAccounts.length; i++) {
            if (_associatedAccounts[i] == account) {
                _associationStatuses[i] = false;
            }
        }
    }

    function freezeToken(address account) external noDelegateCall returns (int64 responseCode) {

        bool success;
        (success, responseCode) = _precheckFreezeToken(msg.sender, account);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        _unfrozenAccounts.push(account);
        _unfrozenStatuses.push(TokenConfig({
            explicit: true,
            value: false
        }));
    }

    function mintToken(
        int64 amount,
        bytes[] memory metadata
    ) external noDelegateCall returns (int64 responseCode, int64 newTotalSupply, int64[] memory serialNumbers) {
        bool success;
        (success, responseCode) = _precheckMint(amount, metadata);

        if (!success) {
            return (responseCode, 0, new int64 );
        }

        int64 amountOrSerialNumber;

        if (_isFungible) {
            amountOrSerialNumber = amount;
            HederaFungibleToken hederaFungibleToken = HederaFungibleToken();
            hederaFungibleToken.mintRequestFromHtsPrecompile(amount);
            newTotalSupply = int64(int(hederaFungibleToken.totalSupply()));
        }

        if (_isNonFungible) {
            serialNumbers = new int64 ; // since you can only mint 1 NFT at a time
            int64 serialNumber;
            (newTotalSupply, serialNumber) = HederaNonFungibleToken().mintRequestFromHtsPrecompile(metadata);
            serialNumbers[0] = serialNumber;
            amountOrSerialNumber = serialNumber;
        }

        _postMint(amountOrSerialNumber, metadata);
        return (responseCode, newTotalSupply, serialNumbers);
    }

    function burnToken(
        int64 amount,
        int64[] memory serialNumbers
    ) external noDelegateCall returns (int64 responseCode, int64 newTotalSupply) {
        bool success;
        (success, responseCode) = _precheckBurn(amount, serialNumbers);

        if (!success) {
            return (responseCode, 0);
        }

        // TODO: abstract logic into _post{Action} function
        if (_isFungible) {
            HederaFungibleToken hederaFungibleToken = HederaFungibleToken();
            hederaFungibleToken.burnRequestFromHtsPrecompile(amount);
            newTotalSupply = int64(int(hederaFungibleToken.totalSupply()));
        }

        if (_isNonFungible) { // this conditional is redundant but added for code readibility
            newTotalSupply = HederaNonFungibleToken().burnRequestFromHtsPrecompile(serialNumbers);
        }

        _postBurn(token, amount, serialNumbers);
    }

    function pauseToken() external noDelegateCall returns (int64 responseCode) {

        bool success;
        (success, responseCode) = _precheckPauseToken(msg.sender);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        _tokenPaused.explicit = true;
        _tokenPaused.value = true;
    }

    function revokeTokenKyc(address account) external noDelegateCall returns (int64 responseCode) {

        bool success;
        (success, responseCode) = _precheckKyc(msg.sender, account);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        for (uint256 i = 0; i < _kycAccounts.length; i++) {
            if (_kycAccounts[i] == account) {
                _kycStatuses[i].explicit = true;
                _kycStatuses[i].value = false;
            }
        }
    }

    function setApprovalForAll(
        address operator,
        bool approved
    ) external noDelegateCall returns (int64 responseCode) {
        address owner = msg.sender;
        bool success;
        (success, responseCode) = _precheckSetApprovalForAll(owner, operator, approved);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        HederaNonFungibleToken().setApprovalForAllFromHtsPrecompile(owner, operator, approved);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external noDelegateCall returns (int64 responseCode) {
        /// @dev spender is set to non-zero address such that shouldAssumeRequestFromOwner always evaluates to false if HtsSystemContractMock#transferFrom is called
        address spender = msg.sender;
        bool isRequestFromOwner;

        bool success;
        (success, responseCode, isRequestFromOwner) = _precheckTransfer(spender, from, to, amount);

        if (!success) {
            return responseCode;
        }

        _postTransfer(token, spender, from, to, amount);
        responseCode = HederaFungibleToken(token).transferRequestFromHtsPrecompile(
            isRequestFromOwner,
            spender,
            from,
            to,
            amount
        );
    }

    function transferFromNFT(
        address from,
        address to,
        uint256 serialNumber
    ) external noDelegateCall returns (int64 responseCode) {
        address spender = msg.sender;
        bool isRequestFromOwner;

        bool success;
        (success, responseCode, isRequestFromOwner) = _precheckTransfer(spender, from, to, serialNumber);

        if (!success) {
            return responseCode;
        }

        _postTransfer(spender, from, to, serialNumber);
        HederaNonFungibleToken().transferRequestFromHtsPrecompile(
            isRequestFromOwner,
            spender,
            from,
            to,
            serialNumber
        );
    }

    /// TODO implementation is currently identical to transferFromNFT; investigate the differences between the 2 functions
    function transferNFT(
        address sender,
        address recipient,
        int64 serialNumber
    ) public noDelegateCall returns (int64 responseCode) {
        address spender = msg.sender;
        uint256 _serialNumber = uint64(serialNumber);
        bool isRequestFromOwner;

        bool success;
        (success, responseCode, isRequestFromOwner) = _precheckTransfer(spender, sender, recipient, _serialNumber);

        if (!success) {
            return responseCode;
        }

        _postTransfer(spender, sender, recipient, _serialNumber);
        responseCode = HederaNonFungibleToken().transferRequestFromHtsPrecompile(
            isRequestFromOwner,
            spender,
            sender,
            recipient,
            _serialNumber
        );
    }

    function transferNFTs(
        address[] memory sender,
        address[] memory receiver,
        int64[] memory serialNumber
    ) external noDelegateCall returns (int64 responseCode) {
        uint length = sender.length;
        uint receiverCount = receiver.length;
        uint serialNumberCount = serialNumber.length;

        require(length == receiverCount && length == serialNumberCount, 'UNEQUAL_ARRAYS');

        address _sender;
        address _receiver;
        int64 _serialNumber;

        for (uint256 i = 0; i < length; i++) {
            _sender = sender[i];
            _receiver = receiver[i];
            _serialNumber = serialNumber[i];

            responseCode = transferNFT(token, _sender, _receiver, _serialNumber);

            // TODO: instead of reverting return responseCode; this will require prechecks on each individual transfer before enacting the transfer of all NFTs
            // alternatively consider reverting but catch error and extract responseCode from the error and return the responseCode
            if (responseCode != HederaResponseCodes.SUCCESS) {
                revert HtsPrecompileError(responseCode);
            }
        }
    }

    /// TODO implementation is currently identical to transferFrom; investigate the differences between the 2 functions
    function transferToken(
        address sender,
        address recipient,
        int64 amount
    ) public noDelegateCall returns (int64 responseCode) {
        address spender = msg.sender;
        bool isRequestFromOwner;
        uint _amount = uint(int(amount));

        bool success;
        (success, responseCode, isRequestFromOwner) = _precheckTransfer(spender, sender, recipient, _amount);

        if (!success) {
            return responseCode;
        }

        _postTransfer(spender, sender, recipient, _amount);
        responseCode = HederaFungibleToken().transferRequestFromHtsPrecompile(
            isRequestFromOwner,
            spender,
            sender,
            recipient,
            _amount
        );
    }

    function transferTokens(
        address[] memory accountId,
        int64[] memory amount
    ) external noDelegateCall returns (int64 responseCode) {
        uint length = accountId.length;
        uint amountCount = amount.length;

        require(length == amountCount, 'UNEQUAL_ARRAYS');

        address spender = msg.sender;
        address receiver;
        int64 _amount;

        for (uint256 i = 0; i < length; i++) {
            receiver = accountId[i];
            _amount = amount[i];

            responseCode = transferToken(spender, receiver, _amount);

            // TODO: instead of reverting return responseCode; this will require prechecks on each individual transfer before enacting the transfer of all NFTs
            // alternatively consider reverting but catch error and extract responseCode from the error and return the responseCode
            if (responseCode != HederaResponseCodes.SUCCESS) {
                revert HtsPrecompileError(responseCode);
            }
        }
    }

    function unfreezeToken(address account) external noDelegateCall returns (int64 responseCode) {

        bool success;
        (success, responseCode) = _precheckFreezeToken(msg.sender, account);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        _unfrozenAccounts.push(account);
        _unfrozenStatuses.push(TokenConfig({
            explicit: true,
            value: true
        }));
    }

    function unpauseToken() external noDelegateCall returns (int64 responseCode) {

        bool success;
        (success, responseCode) = _precheckPauseToken(msg.sender);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        _tokenPaused.explicit = true;
        _tokenPaused.value = false;
    }

    function updateTokenExpiryInfo(
        Expiry memory expiryInfo
    ) external noDelegateCall returns (int64 responseCode) {

        bool success;
        (success, responseCode) = _precheckUpdateTokenExpiryInfo(msg.sender, expiryInfo);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        if (_isFungible) {
            _setFungibleTokenExpiry(expiryInfo);
        }

        if (_isNonFungible) {
            _setNftTokenExpiry(expiryInfo);
        }
    }

    function updateTokenInfo(
        HederaToken memory tokenInfo
    ) external noDelegateCall returns (int64 responseCode) {

        bool success;
        (success, responseCode) = _precheckUpdateTokenInfo(msg.sender, tokenInfo);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        if (_isFungible) {
            _setFungibleTokenInfoToken(tokenInfo);
        }

        if (_isNonFungible) {
            _setNftTokenInfoToken(tokenInfo);
        }
    }

    function updateTokenKeys(
        TokenKey[] memory keys
    ) external noDelegateCall returns (int64 responseCode) {

        bool success;
        (success, responseCode) = _precheckUpdateTokenKeys(msg.sender, keys);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        if (_isFungible) {
            _setFungibleTokenKeys(keys);
        }

        if (_isNonFungible) {
            _setNftTokenKeys(keys);
        }

    }

    function wipeTokenAccount(
        address account,
        int64 amount
    ) external noDelegateCall returns (int64 responseCode) {

        int64[] memory nullArray;

        bool success;
        (success, responseCode) = _precheckWipe(msg.sender, account, amount, nullArray);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        HederaFungibleToken hederaFungibleToken = HederaFungibleToken();
        hederaFungibleToken.wipeRequestFromHtsPrecompile(account, amount);
    }

    function wipeTokenAccountNFT(
        address account,
        int64[] memory serialNumbers
    ) external noDelegateCall returns (int64 responseCode) {

        bool success;
        (success, responseCode) = _precheckWipe(msg.sender, account, 0, serialNumbers);

        if (!success) {
            return responseCode;
        }

        // TODO: abstract logic into _post{Action} function
        int64 serialNumber;
        uint burnCount = serialNumbers.length;
        for (uint256 i = 0; i < burnCount; i++) {
            serialNumber = serialNumbers[i];
            delete _partialNonFungibleTokenInfos[serialNumber].ownerId;
            delete _partialNonFungibleTokenInfos[serialNumber].spenderId;
        }
    }

    // TODO
    function redirectForToken(bytes memory encodedFunctionSelector) external noDelegateCall override returns (int64 responseCode, bytes memory response) {}

    // Additional(not in IHederaTokenService) public/external state-changing functions:
    function isAssociated(address account) external view returns (bool associated) {
        for (uint256 i = 0; i < _associatedAccounts.length; i++) {
            if (_associatedAccounts[i] == account && _associationStatuses[i]) {
                associated = true;
                break;
            }
        }
    }

    function getTreasuryAccount() external view returns (address treasury) {
        return _getTreasuryAccount();
    }

    function _getStringLength(string memory _string) internal pure returns (uint length) {
        length = bytes(_string).length;
    }
}
