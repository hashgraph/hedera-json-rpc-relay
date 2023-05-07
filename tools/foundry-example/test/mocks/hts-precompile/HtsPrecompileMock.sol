// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import 'forge-std/console.sol';

import 'hedera-smart-contracts/hts-precompile/HederaResponseCodes.sol';
import 'hedera-smart-contracts/hts-precompile/IHederaTokenService.sol';
import 'hedera-smart-contracts/hts-precompile/KeyHelper.sol';
import './HederaFungibleToken.sol';
import './HederaNonFungibleToken.sol';
import '../../../src/NoDelegateCall.sol';
import '../../libraries/Constants.sol';

contract HtsPrecompileMock is NoDelegateCall, IHederaTokenService, KeyHelper {

    error HtsPrecompileError(int64 responseCode);

    /// @dev only for Fungible tokens
    // Fungible token -> FungibleTokenInfo
    mapping(address => FungibleTokenInfo) internal _fungibleTokenInfos;
    // Fungible token -> _isFungible
    mapping(address => bool) internal _isFungible;

    /// @dev only for NonFungibleToken
    // NFT token -> TokenInfo; TokenInfo is used instead of NonFungibleTokenInfo as the former is common to all NFT instances whereas the latter is for a specific NFT instance(uniquely identified by its serialNumber)
    mapping(address => TokenInfo) internal _nftTokenInfos;
    // NFT token -> serialNumber -> PartialNonFungibleTokenInfo
    mapping(address => mapping(int64 => PartialNonFungibleTokenInfo)) internal _partialNonFungibleTokenInfos;
    // NFT token -> _isNonFungible
    mapping(address => bool) internal _isNonFungible;

    /// @dev common to both NFT and Fungible HTS tokens
    // HTS token -> account -> isAssociated
    mapping(address => mapping(address => bool)) internal _association;
    // HTS token -> account -> isKyced
    mapping(address => mapping(address => bool)) internal _kyc; // is KYCed is the positive case(i.e. explicitly requires KYC approval); see defaultKycStatus
    // HTS token -> account -> isFrozen
    mapping(address => mapping(address => bool)) internal _unfrozen; // is unfrozen is positive case(i.e. explicitly requires being unfrozen); see freezeDefault
    // HTS token -> keyType -> value e.g. tokenId -> 16 -> 0x123 means that the SUPPLY key for tokenId is account 0x123
    mapping(address => mapping(uint => address)) internal _tokenKeys; /// @dev faster access then getting keys via {FungibleTokenInfo|NonFungibleTokenInfo}#TokenInfo.HederaToken.tokenKeys[]; however only supports KeyValueType.CONTRACT_ID

    // this struct avoids duplicating common NFT data, in particular IHederaTokenService.NonFungibleTokenInfo.tokenInfo
    struct PartialNonFungibleTokenInfo {
        address ownerId;
        int64 creationTime;
        bytes metadata;
        address spenderId;
    }

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
    function _isToken(address token) internal view returns (bool) {
        return _isFungible[token] || _isNonFungible[token];
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
    function _getTreasuryAccount(address token) internal view returns (address treasury) {
        if (_isFungible[token]) {
            treasury = _fungibleTokenInfos[token].tokenInfo.token.treasury;
        } else {
            treasury = _nftTokenInfos[token].token.treasury;
        }
    }

    // Check if the treasury signature is valid
    function _hasTreasurySig(address token) internal view returns (bool validKey, bool noKey) {
        address key = _getTreasuryAccount(token);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the admin key signature is valid
    function _hasAdminKeySig(address token) internal view returns (bool validKey, bool noKey) {
        address key = getKey(token, KeyHelper.KeyType.ADMIN);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the kyc key signature is valid
    function _hasKycKeySig(address token) internal view returns (bool validKey, bool noKey) {
        address key = getKey(token, KeyHelper.KeyType.KYC);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the freeze key signature is valid
    function _hasFreezeKeySig(address token) internal view returns (bool validKey, bool noKey) {
        address key = getKey(token, KeyHelper.KeyType.FREEZE);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the wipe key signature is valid
    function _hasWipeKeySig(address token) internal view returns (bool validKey, bool noKey) {
        address key = getKey(token, KeyHelper.KeyType.WIPE);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the supply key signature is valid
    function _hasSupplyKeySig(address token) internal view returns (bool validKey, bool noKey) {
        address key = getKey(token, KeyHelper.KeyType.SUPPLY);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the fee schedule key signature is valid
    function _hasFeeScheduleKeySig(address token) internal view returns (bool validKey, bool noKey) {
        address key = getKey(token, KeyHelper.KeyType.FEE);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    // Check if the pause key signature is valid
    function _hasPauseKeySig(address token) internal view returns (bool validKey, bool noKey) {
        address key = getKey(token, KeyHelper.KeyType.PAUSE);
        noKey = key == ADDRESS_ZERO;
        validKey = _isAccountSender(key);
    }

    function _setFungibleTokenInfo(FungibleTokenInfo memory fungibleTokenInfo) internal returns (address treasury) {
        address tokenAddress = msg.sender;
        _fungibleTokenInfos[tokenAddress].tokenInfo.token.name = fungibleTokenInfo.tokenInfo.token.name;
        _fungibleTokenInfos[tokenAddress].tokenInfo.token.symbol = fungibleTokenInfo.tokenInfo.token.symbol;
        _fungibleTokenInfos[tokenAddress].tokenInfo.token.treasury = fungibleTokenInfo.tokenInfo.token.treasury;

        treasury = fungibleTokenInfo.tokenInfo.token.treasury;

        _fungibleTokenInfos[tokenAddress].tokenInfo.token.memo = fungibleTokenInfo.tokenInfo.token.memo;
        _fungibleTokenInfos[tokenAddress].tokenInfo.token.tokenSupplyType = fungibleTokenInfo
            .tokenInfo
            .token
            .tokenSupplyType;
        _fungibleTokenInfos[tokenAddress].tokenInfo.token.maxSupply = fungibleTokenInfo.tokenInfo.token.maxSupply;
        _fungibleTokenInfos[tokenAddress].tokenInfo.token.freezeDefault = fungibleTokenInfo
            .tokenInfo
            .token
            .freezeDefault;

        // Copy the tokenKeys array
        uint256 length = fungibleTokenInfo.tokenInfo.token.tokenKeys.length;
        for (uint256 i = 0; i < length; i++) {
            TokenKey memory tokenKey = fungibleTokenInfo.tokenInfo.token.tokenKeys[i];
            _fungibleTokenInfos[tokenAddress].tokenInfo.token.tokenKeys.push(tokenKey);

            /// @dev contractId can in fact be any address including an EOA address
            ///      The KeyHelper lists 5 types for KeyValueType; however only CONTRACT_ID is considered
            _tokenKeys[tokenAddress][tokenKey.keyType] = tokenKey.key.contractId;
        }

        _fungibleTokenInfos[tokenAddress].tokenInfo.token.expiry.second = fungibleTokenInfo
            .tokenInfo
            .token
            .expiry
            .second;
        _fungibleTokenInfos[tokenAddress].tokenInfo.token.expiry.autoRenewAccount = fungibleTokenInfo
            .tokenInfo
            .token
            .expiry
            .autoRenewAccount;
        _fungibleTokenInfos[tokenAddress].tokenInfo.token.expiry.autoRenewPeriod = fungibleTokenInfo
            .tokenInfo
            .token
            .expiry
            .autoRenewPeriod;

        _fungibleTokenInfos[tokenAddress].tokenInfo.totalSupply = fungibleTokenInfo.tokenInfo.totalSupply;
        _fungibleTokenInfos[tokenAddress].tokenInfo.deleted = fungibleTokenInfo.tokenInfo.deleted;
        _fungibleTokenInfos[tokenAddress].tokenInfo.defaultKycStatus = fungibleTokenInfo.tokenInfo.defaultKycStatus;
        _fungibleTokenInfos[tokenAddress].tokenInfo.pauseStatus = fungibleTokenInfo.tokenInfo.pauseStatus;

        // Handle copying of other arrays (fixedFees, fractionalFees, and royaltyFees) if needed

        _fungibleTokenInfos[tokenAddress].tokenInfo.ledgerId = fungibleTokenInfo.tokenInfo.ledgerId;
        _fungibleTokenInfos[tokenAddress].decimals = fungibleTokenInfo.decimals;
    }

    function _setNftTokenInfo(TokenInfo memory nftTokenInfo) internal returns (address treasury) {
        address tokenAddress = msg.sender;
        _nftTokenInfos[tokenAddress].token.name = nftTokenInfo.token.name;
        _nftTokenInfos[tokenAddress].token.symbol = nftTokenInfo.token.symbol;
        _nftTokenInfos[tokenAddress].token.treasury = nftTokenInfo.token.treasury;

        treasury = nftTokenInfo.token.treasury;

        _nftTokenInfos[tokenAddress].token.memo = nftTokenInfo.token.memo;
        _nftTokenInfos[tokenAddress].token.tokenSupplyType = nftTokenInfo.token.tokenSupplyType;
        _nftTokenInfos[tokenAddress].token.maxSupply = nftTokenInfo.token.maxSupply;
        _nftTokenInfos[tokenAddress].token.freezeDefault = nftTokenInfo.token.freezeDefault;

        // Copy the tokenKeys array
        uint256 length = nftTokenInfo.token.tokenKeys.length;
        for (uint256 i = 0; i < length; i++) {
            TokenKey memory tokenKey = nftTokenInfo.token.tokenKeys[i];
            _nftTokenInfos[tokenAddress].token.tokenKeys.push(tokenKey);

            /// @dev contractId can in fact be any address including an EOA address
            ///      The KeyHelper lists 5 types for KeyValueType; however only CONTRACT_ID is considered
            _tokenKeys[tokenAddress][tokenKey.keyType] = tokenKey.key.contractId;
        }

        _nftTokenInfos[tokenAddress].token.expiry.second = nftTokenInfo.token.expiry.second;
        _nftTokenInfos[tokenAddress].token.expiry.autoRenewAccount = nftTokenInfo.token.expiry.autoRenewAccount;
        _nftTokenInfos[tokenAddress].token.expiry.autoRenewPeriod = nftTokenInfo.token.expiry.autoRenewPeriod;

        _nftTokenInfos[tokenAddress].totalSupply = nftTokenInfo.totalSupply;
        _nftTokenInfos[tokenAddress].deleted = nftTokenInfo.deleted;
        _nftTokenInfos[tokenAddress].defaultKycStatus = nftTokenInfo.defaultKycStatus;
        _nftTokenInfos[tokenAddress].pauseStatus = nftTokenInfo.pauseStatus;

        // Handle copying of other arrays (fixedFees, fractionalFees, and royaltyFees) if needed

        _nftTokenInfos[tokenAddress].ledgerId = nftTokenInfo.ledgerId;
    }

    function _preCreateToken(
        address sender,
        HederaToken memory token,
        int64 initialTotalSupply,
        int32 decimals
    ) internal view returns (int64 responseCode) {
        bool validTreasurySig = sender == token.treasury;
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

    /// @dev the following internal _precheck functions are called in either of the following 2 scenarios:
    ///      1. before the HtsPrecompileMock calls any of the HederaFungibleToken or HederaNonFungibleToken functions that specify the onlyHtsPrecompile modifier
    ///      2. in any of HtsPrecompileMock functions that specifies the onlyHederaToken modifier which is only callable by a HederaFungibleToken or HederaNonFungibleToken contract

    /// @dev for both Fungible and NonFungible
    function _precheckApprove(
        address token,
        address sender, // sender should be owner in order to approve
        address spender,
        uint256 amountOrSerialNumber /// for Fungible is the amount and for NonFungible is the serialNumber
    ) internal view returns (int64 responseCode) {

        CommonPrecheckData memory commonPrecheckData = _getCommonPrecheckData(token, sender, sender, ADDRESS_ZERO);

        /// @dev Hedera does not require an account to be associated with a token in be approved an allowance
        // if (!_association[token][owner] || !_association[token][spender]) {
        //     return HederaResponseCodes.TOKEN_NOT_ASSOCIATED_TO_ACCOUNT;
        // }

        if (!commonPrecheckData.doesAccount1PassUnfrozen || !commonPrecheckData.doesAccount2PassUnfrozen) {
            return HederaResponseCodes.ACCOUNT_FROZEN_FOR_TOKEN;
        }
        if (!commonPrecheckData.doesAccount1PassKyc || !commonPrecheckData.doesAccount2PassKyc) {
            return HederaResponseCodes.ACCOUNT_KYC_NOT_GRANTED_FOR_TOKEN;
        }

        if (!commonPrecheckData.isFungible && !commonPrecheckData.isNonFungible) {
            return HederaResponseCodes.INVALID_TOKEN_ID;
        }

        if (commonPrecheckData.isNonFungible) {
            int64 serialNumber = int64(uint64(amountOrSerialNumber));
            PartialNonFungibleTokenInfo memory partialNonFungibleTokenInfo = _partialNonFungibleTokenInfos[token][serialNumber];
            if (partialNonFungibleTokenInfo.ownerId != sender) {
                return HederaResponseCodes.SENDER_DOES_NOT_OWN_NFT_SERIAL_NO;
            }
        }

        return HederaResponseCodes.SUCCESS;
    }

    function _precheckSetApprovalForAll(
        address token,
        address owner,
        address operator,
        bool approved
    ) internal view returns (int64 responseCode) {
        CommonPrecheckData memory commonPrecheckData = _getCommonPrecheckData(token, operator, owner, ADDRESS_ZERO);

        if (!_association[token][owner] || !_association[token][operator]) {
            return HederaResponseCodes.TOKEN_NOT_ASSOCIATED_TO_ACCOUNT;
        }
        if (!commonPrecheckData.doesAccount1PassUnfrozen || !commonPrecheckData.doesAccount2PassUnfrozen) {
            return HederaResponseCodes.ACCOUNT_FROZEN_FOR_TOKEN;
        }
        if (!commonPrecheckData.doesAccount1PassKyc || !commonPrecheckData.doesAccount2PassKyc) {
            return HederaResponseCodes.ACCOUNT_KYC_NOT_GRANTED_FOR_TOKEN;
        }

        if (!commonPrecheckData.isNonFungible) {
            /// @dev since setApprovalForAll is only applicable to token of type NON_FUNGIBLE
            return HederaResponseCodes.INVALID_TOKEN_ID;
        }

        return HederaResponseCodes.SUCCESS;
    }

    function _precheckMint(
        address token,
        int64 amount,
        bytes[] memory metadata
    ) internal view returns (int64 responseCode) {
        bool isFungible = _isFungible[token];
        bool isNonFungible = _isNonFungible[token];

        if (!isFungible && !isNonFungible) {
            return HederaResponseCodes.INVALID_TOKEN_ID;
        }

        (bool validKey, bool noKey) = _hasSupplyKeySig(token);

        if (noKey) {
            return HederaResponseCodes.TOKEN_HAS_NO_SUPPLY_KEY;
        }
        if (!validKey) {
            return HederaResponseCodes.INVALID_SUPPLY_KEY;
        }

        return HederaResponseCodes.SUCCESS;
    }

    function _precheckBurn(
        address token,
        int64 amount,
        int64[] memory serialNumbers // since only 1 NFT can be burnt at a time; expect length to be 1
    ) internal view returns (int64 responseCode) {
        bool isFungible = _isFungible[token];
        bool isNonFungible = _isNonFungible[token];

        if (!isFungible && !isNonFungible) {
            return HederaResponseCodes.INVALID_TOKEN_ID;
        }

        (bool validKey, bool noKey) = _hasTreasurySig(token);
        address treasuryKey = _getTreasuryAccount(token);

        HederaFungibleToken hederaFungibleToken = HederaFungibleToken(token);
        HederaNonFungibleToken hederaNonFungibleToken = HederaNonFungibleToken(token);

        bool doesTreasuryOwnSufficientToken = isFungible
            ? (hederaFungibleToken.balanceOf(treasuryKey) >= uint64(amount))
            : (treasuryKey == hederaNonFungibleToken.ownerOf(uint64(serialNumbers[0])));

        if (noKey || !validKey) {
            // @dev noKey should always be false as a token must have a treasury account; however use INVALID_TREASURY_ACCOUNT_FOR_TOKEN if treasury has been deleted
            return HederaResponseCodes.AUTHORIZATION_FAILED;
        }
        if (!doesTreasuryOwnSufficientToken) {
            if (isFungible) {
                return HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE;
            }
            if (isNonFungible) {
                return HederaResponseCodes.SENDER_DOES_NOT_OWN_NFT_SERIAL_NO;
            }
        }

        return HederaResponseCodes.SUCCESS;
    }

    // account1 is typically the spender
    // account2 is typically the owner
    // account3 is typically the recipient
    struct CommonPrecheckData {
        bool isFungible;
        bool isNonFungible;
        bool doesAccount1PassKyc;
        bool doesAccount2PassKyc;
        bool doesAccount3PassKyc;
        bool doesAccount1PassUnfrozen;
        bool doesAccount2PassUnfrozen;
        bool doesAccount3PassUnfrozen;
    }

    /// @dev doesPassKyc if KYC is not enabled or if enabled then account is KYCed explicitly or by default
    function _doesAccountPassKyc(int64 responseCode, bool isKyced) internal pure returns (bool doesPassKyc) {
        doesPassKyc = responseCode == HederaResponseCodes.SUCCESS ? isKyced : true;
    }

    /// @dev doesPassUnfrozen if freeze is not enabled or if enabled then account is unfrozen explicitly or by default
    function _doesAccountPassUnfrozen(int64 responseCode, bool isFrozen) internal pure returns (bool doesPassUnfrozen) {
        doesPassUnfrozen = responseCode == HederaResponseCodes.SUCCESS ? !isFrozen : true;
    }

    function _getCommonPrecheckData(
        address token,
        address account1,
        address account2,
        address account3
    ) internal view returns (CommonPrecheckData memory commonPrecheckData) {
        commonPrecheckData.isFungible = _isFungible[token];
        commonPrecheckData.isNonFungible = _isNonFungible[token];

        (int64 responseCodeForKyc, bool _isKyced) = isKyc(token, account1);
        commonPrecheckData.doesAccount1PassKyc = _doesAccountPassKyc(responseCodeForKyc, _isKyced);

        (responseCodeForKyc, _isKyced) = isKyc(token, account2);
        commonPrecheckData.doesAccount2PassKyc = _doesAccountPassKyc(responseCodeForKyc, _isKyced);

        (responseCodeForKyc, _isKyced) = isKyc(token, account3);
        commonPrecheckData.doesAccount3PassKyc = _doesAccountPassKyc(responseCodeForKyc, _isKyced);

        (int64 responseCodeForFrozen, bool _isFrozen) = isFrozen(token, account1);
        commonPrecheckData.doesAccount1PassUnfrozen = _doesAccountPassUnfrozen(responseCodeForFrozen, _isFrozen);

        (responseCodeForFrozen, _isFrozen) = isFrozen(token, account2);
        commonPrecheckData.doesAccount2PassUnfrozen = _doesAccountPassUnfrozen(responseCodeForFrozen, _isFrozen);

        (responseCodeForFrozen, _isFrozen) = isFrozen(token, account3);
        commonPrecheckData.doesAccount3PassUnfrozen = _doesAccountPassUnfrozen(responseCodeForFrozen, _isFrozen);
    }

    function _precheckTransfer(
        address token,
        address spender,
        address from,
        address to,
        uint256 amountOrSerialNumber
    ) internal view returns (int64 responseCode, bool isRequestFromOwner) {
        CommonPrecheckData memory commonPrecheckData = _getCommonPrecheckData(token, spender, from, to);

        if (!_association[token][from] || !_association[token][to]) {
            return (HederaResponseCodes.TOKEN_NOT_ASSOCIATED_TO_ACCOUNT, false);
        }
        if (!commonPrecheckData.doesAccount2PassUnfrozen || !commonPrecheckData.doesAccount3PassUnfrozen) {
            return (HederaResponseCodes.ACCOUNT_FROZEN_FOR_TOKEN, false);
        }
        if (!commonPrecheckData.doesAccount2PassKyc || !commonPrecheckData.doesAccount3PassKyc) {
            return (HederaResponseCodes.ACCOUNT_KYC_NOT_GRANTED_FOR_TOKEN, false);
        }

        // If transfer request is not from owner then check allowance of msg.sender
        bool shouldAssumeRequestFromOwner = spender == ADDRESS_ZERO;
        isRequestFromOwner = _isAccountSender(from) || shouldAssumeRequestFromOwner;

        // do balance checks here even if request is from owner
        HederaFungibleToken hederaFungibleToken = HederaFungibleToken(token);
        HederaNonFungibleToken hederaNonFungibleToken = HederaNonFungibleToken(token);

        bool doesFromOwnSufficientToken = commonPrecheckData.isFungible
            ? (hederaFungibleToken.balanceOf(from) >= amountOrSerialNumber)
            : (from == hederaNonFungibleToken.ownerOf(amountOrSerialNumber));

        if (!doesFromOwnSufficientToken) {
            if (commonPrecheckData.isFungible) {
                return (HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE, isRequestFromOwner);
            }
            if (commonPrecheckData.isNonFungible) {
                return (HederaResponseCodes.SENDER_DOES_NOT_OWN_NFT_SERIAL_NO, isRequestFromOwner);
            }
        }

        if (isRequestFromOwner) {
            return (HederaResponseCodes.SUCCESS, true);
        }

        address spender = spender; // TODO: investigate if Hedera also considers tx.origin as a possible spender
        if (commonPrecheckData.isFungible) {
            (, uint256 spenderAllowance) = allowance(token, from, spender);
            // TODO: do validation for other allowance response codes such as SPENDER_DOES_NOT_HAVE_ALLOWANCE and MAX_ALLOWANCES_EXCEEDED
            if (spenderAllowance < amountOrSerialNumber) {
                return (HederaResponseCodes.AMOUNT_EXCEEDS_ALLOWANCE, false);
            }
        } else {
            bool canSpendToken = HederaNonFungibleToken(token).isApprovedOrOwner(spender, amountOrSerialNumber);
            if (!canSpendToken) {
                return (HederaResponseCodes.INSUFFICIENT_ACCOUNT_BALANCE, false);
            }
        }

        return (HederaResponseCodes.SUCCESS, false);
    }

    function preApprove(
        address sender, // msg.sender in the context of the Hedera{Non|}FungibleToken; it should be owner for SUCCESS
        address spender,
        uint256 amountOrSerialNumber /// for Fungible is the amount and for NonFungible is the serialNumber
    ) external onlyHederaToken returns (int64 responseCode) {
        address token = msg.sender;
        responseCode = _precheckApprove(token, sender, spender, amountOrSerialNumber);
    }

    function preSetApprovalForAll(
        address sender, // msg.sender in the context of the Hedera{Non|}FungibleToken; it should be owner for SUCCESS
        address operator,
        bool approved
    ) external onlyHederaToken returns (int64 responseCode) {
        address token = msg.sender;
        responseCode = _precheckSetApprovalForAll(token, sender, operator, approved);
    }

    /// @dev not currently called by Hedera{}Token
    function preMint(
        address token,
        int64 amount,
        bytes[] memory metadata
    ) external onlyHederaToken returns (int64 responseCode) {
        address token = msg.sender;
        responseCode = _precheckMint(token, amount, metadata);
    }

    /// @dev not currently called by Hedera{}Token
    function preBurn(int64 amount, int64[] memory serialNumbers) external onlyHederaToken returns (int64 responseCode) {
        address token = msg.sender;
        responseCode = _precheckBurn(token, amount, serialNumbers);
    }

    function preTransfer(
        address spender, /// @dev if spender == ADDRESS_ZERO then assume ERC20#transfer(i.e. msg.sender is attempting to spend their balance) otherwise ERC20#transferFrom(i.e. msg.sender is attempting to spend balance of "from" using allowance)
        address from,
        address to,
        uint256 amountOrSerialNumber
    ) external onlyHederaToken returns (int64 responseCode) {
        address token = msg.sender;
        (responseCode, ) = _precheckTransfer(token, spender, from, to, amountOrSerialNumber);
    }

    /// @dev register HederaFungibleToken; msg.sender is the HederaFungibleToken
    ///      can be called by any contract; however assumes msg.sender is a HederaFungibleToken
    function registerHederaFungibleToken(address caller, FungibleTokenInfo memory fungibleTokenInfo) external {

        /// @dev if caller is this contract(i.e. the HtsPrecompileMock) then no need to call _preCreateToken since it was already called when the createFungibleToken or other relevant method was called
        bool doPrecheck = caller != address(this);

        int64 responseCode = doPrecheck ? _preCreateToken(caller, fungibleTokenInfo.tokenInfo.token, fungibleTokenInfo.tokenInfo.totalSupply, fungibleTokenInfo.decimals) : HederaResponseCodes.SUCCESS;

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("PRECHECK_FAILED"); // TODO: revert with custom error that includes response code
        }

        address tokenAddress = msg.sender;
        _isFungible[tokenAddress] = true;
        address treasury = _setFungibleTokenInfo(fungibleTokenInfo);
        associateToken(treasury, tokenAddress);
    }

    /// @dev register HederaNonFungibleToken; msg.sender is the HederaNonFungibleToken
    ///      can be called by any contract; however assumes msg.sender is a HederaNonFungibleToken
    function registerHederaNonFungibleToken(address caller, TokenInfo memory nftTokenInfo) external {

        /// @dev if caller is this contract(i.e. the HtsPrecompileMock) then no need to call _preCreateToken since it was already called when the createNonFungibleToken or other relevant method was called
        bool doPrecheck = caller != address(this);

        int64 responseCode = doPrecheck ? _preCreateToken(caller, nftTokenInfo.token, 0, 0) : HederaResponseCodes.SUCCESS;

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("PRECHECK_FAILED"); // TODO: revert with custom error that includes response code
        }

        address tokenAddress = msg.sender;
        _isNonFungible[tokenAddress] = true;
        address treasury = _setNftTokenInfo(nftTokenInfo);

        associateToken(treasury, tokenAddress);
    }

    // IHederaTokenService public/external view functions:
    function getApproved(
        address token,
        uint256 serialNumber
    ) external view returns (int64 responseCode, address approved) {
        // TODO: do prechecks; that token is valid and serialNumber exists
        responseCode = HederaResponseCodes.SUCCESS;
        approved = HederaNonFungibleToken(token).getApproved(serialNumber);
    }

    function getFungibleTokenInfo(
        address token
    ) external view returns (int64 responseCode, FungibleTokenInfo memory fungibleTokenInfo) {
        fungibleTokenInfo = _fungibleTokenInfos[token];
    }

    function getNonFungibleTokenInfo(
        address token,
        int64 serialNumber
    ) external view returns (int64 responseCode, NonFungibleTokenInfo memory nonFungibleTokenInfo) {
        TokenInfo memory nftTokenInfo = _nftTokenInfos[token];
        PartialNonFungibleTokenInfo memory partialNonFungibleTokenInfo = _partialNonFungibleTokenInfos[token][
            serialNumber
        ];

        nonFungibleTokenInfo.tokenInfo = nftTokenInfo;

        nonFungibleTokenInfo.serialNumber = serialNumber;

        nonFungibleTokenInfo.ownerId = partialNonFungibleTokenInfo.ownerId;
        nonFungibleTokenInfo.creationTime = partialNonFungibleTokenInfo.creationTime;
        nonFungibleTokenInfo.metadata = partialNonFungibleTokenInfo.metadata;
        nonFungibleTokenInfo.spenderId = partialNonFungibleTokenInfo.spenderId;

        responseCode = HederaResponseCodes.SUCCESS;
    }

    function getTokenCustomFees(
        address token
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
        responseCode = HederaResponseCodes.SUCCESS;
        fixedFees = _fungibleTokenInfos[token].tokenInfo.fixedFees;
        fractionalFees = _fungibleTokenInfos[token].tokenInfo.fractionalFees;
        royaltyFees = _fungibleTokenInfos[token].tokenInfo.royaltyFees;
    }

    function getTokenDefaultFreezeStatus(
        address token
    ) external view returns (int64 responseCode, bool defaultFreezeStatus) {
        responseCode = HederaResponseCodes.SUCCESS;
        defaultFreezeStatus = _fungibleTokenInfos[token].tokenInfo.token.freezeDefault;
    }

    function getTokenDefaultKycStatus(address token) external view returns (int64 responseCode, bool defaultKycStatus) {
        responseCode = HederaResponseCodes.SUCCESS;
        defaultKycStatus = _fungibleTokenInfos[token].tokenInfo.defaultKycStatus;
    }

    function getTokenExpiryInfo(address token) external view returns (int64 responseCode, Expiry memory expiry) {
        if (!_isToken(token)) {
            return (HederaResponseCodes.INVALID_TOKEN_ID, expiry);
        }

        if (_isFungible[token]) {
            expiry = _fungibleTokenInfos[token].tokenInfo.token.expiry;
        } else {
            expiry = _nftTokenInfos[token].token.expiry;
        }

        return (HederaResponseCodes.SUCCESS, expiry);
    }

    function getTokenInfo(address token) external view returns (int64 responseCode, TokenInfo memory tokenInfo) {
        if (!_isToken(token)) {
            return (HederaResponseCodes.INVALID_TOKEN_ID, tokenInfo);
        }

        if (_isFungible[token]) {
            tokenInfo = _fungibleTokenInfos[token].tokenInfo;
        } else {
            tokenInfo = _nftTokenInfos[token];
        }

        return (HederaResponseCodes.SUCCESS, tokenInfo);
    }

    function getTokenKey(address token, uint keyType) external view returns (int64 responseCode, KeyValue memory key) {
        if (!_isToken(token)) {
            return (HederaResponseCodes.INVALID_TOKEN_ID, key);
        }

        /// @dev the key can be retrieved using either of the following method
        // method 1: gas inefficient
        // key = _getTokenKey(_fungibleTokenInfos[token].tokenInfo.token.tokenKeys, keyType);

        // method 2: more gas efficient and works for BOTH token types; however currently only considers contractId
        address keyValue = _tokenKeys[token][keyType];
        key.contractId = keyValue;

        return (HederaResponseCodes.SUCCESS, key);
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

    function getTokenType(address token) external view returns (int64 responseCode, int32 tokenType) {
        bool isFungibleToken = _isFungible[token];
        bool isNonFungibleToken = _isNonFungible[token];
        if (!isFungibleToken && !isNonFungibleToken) {
            return (HederaResponseCodes.INVALID_TOKEN_ID, tokenType);
        }

        tokenType = isFungibleToken ? int32(0) : int32(1);
        return (HederaResponseCodes.SUCCESS, tokenType);
    }

    function grantTokenKyc(address token, address account) external returns (int64 responseCode) {
        if (!_isFungible[token] && !_isNonFungible[token]) {
            return (HederaResponseCodes.INVALID_TOKEN_ID);
        }

        if (_kyc[token][account]) {
            return (HederaResponseCodes.SUCCESS);
        }

        (bool validKey, bool noKey) = _hasKycKeySig(token);

        if (noKey) {
            return (HederaResponseCodes.TOKEN_HAS_NO_KYC_KEY);
        }

        if (!validKey) {
            return (HederaResponseCodes.INVALID_KYC_KEY);
        }

        _kyc[token][account] = true;
        return (HederaResponseCodes.SUCCESS);
    }

    /// @dev Applicable ONLY to NFT Tokens; accessible via IERC721
    function isApprovedForAll(
        address token,
        address owner,
        address operator
    ) external view returns (int64 responseCode, bool approved) {}

    function isFrozen(address token, address account) public view returns (int64 responseCode, bool frozen) {
        bool isFungible = _isFungible[token];
        bool isNonFungible = _isNonFungible[token];

        if (!isFungible && !isNonFungible) {
            return (HederaResponseCodes.INVALID_TOKEN_ID, false);
        }

        if (getKey(token, KeyHelper.KeyType.FREEZE) == ADDRESS_ZERO) {
            return (HederaResponseCodes.TOKEN_HAS_NO_FREEZE_KEY, false);
        }

        bool freezeDefault;
        if (isFungible) {
            FungibleTokenInfo memory fungibleTokenInfo = _fungibleTokenInfos[token];
            freezeDefault = fungibleTokenInfo.tokenInfo.token.freezeDefault;
        } else {
            TokenInfo memory nftTokenInfo = _nftTokenInfos[token];
            freezeDefault = nftTokenInfo.token.freezeDefault;
        }

        /// @dev if freezeDefault is true then an account must explicitly be unfrozen otherwise assume unfrozen
        frozen = freezeDefault ? !(_unfrozen[token][account]) : false;
        return (HederaResponseCodes.SUCCESS, frozen);
    }

    function isKyc(address token, address account) public view returns (int64 responseCode, bool kycGranted) {
        bool isFungible = _isFungible[token];
        bool isNonFungible = _isNonFungible[token];

        if (!isFungible && !isNonFungible) {
            return (HederaResponseCodes.INVALID_TOKEN_ID, false);
        }

        if (getKey(token, KeyHelper.KeyType.KYC) == ADDRESS_ZERO) {
            return (HederaResponseCodes.TOKEN_HAS_NO_KYC_KEY, false);
        }

        bool defaultKycStatus;
        if (isFungible) {
            FungibleTokenInfo memory fungibleTokenInfo = _fungibleTokenInfos[token];
            defaultKycStatus = fungibleTokenInfo.tokenInfo.defaultKycStatus;
        } else {
            TokenInfo memory nftTokenInfo = _nftTokenInfos[token];
            defaultKycStatus = nftTokenInfo.defaultKycStatus;
        }

        /// @dev if defaultKycStatus is true then an account must explicitly be KYCed otherwise assume KYCed
        kycGranted = defaultKycStatus ? _kyc[token][account] : true;
        return (HederaResponseCodes.SUCCESS, kycGranted);
    }

    function isToken(address token) public view returns (int64 responseCode, bool isToken) {
        isToken = _isToken(token);
        responseCode = isToken ? HederaResponseCodes.SUCCESS : HederaResponseCodes.INVALID_TOKEN_ID;
    }

    function allowance(
        address token,
        address owner,
        address spender
    ) public view returns (int64 responseCode, uint256 allowance) {
        if (!_isFungible[token]) {
            return (HederaResponseCodes.INVALID_TOKEN_ID, 0);
        }

        allowance = HederaFungibleToken(token).allowance(owner, spender);
        return (HederaResponseCodes.SUCCESS, allowance);
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
    function getKey(address token, KeyHelper.KeyType keyType) public view returns (address keyOwner) {
        /// @dev the following relation is used due to the below described issue with KeyHelper.getKeyType
        uint _keyType = 2 ** uint(keyType);
        /// @dev the following does not work since the KeyHelper has all of its storage/state cleared/defaulted once vm.etch is used
        ///      to fix this KeyHelper should expose a function that does what it's constructor does i.e. initialise the keyTypes mapping
        // uint _keyType = getKeyType(keyType);
        keyOwner = _tokenKeys[token][_keyType];
    }

    // IHederaTokenService public/external state-changing functions:
    function createFungibleToken(
        HederaToken memory token,
        int64 initialTotalSupply,
        int32 decimals
    ) external payable noDelegateCall returns (int64 responseCode, address tokenAddress) {
        responseCode = _preCreateToken(msg.sender, token, initialTotalSupply, decimals);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            return (responseCode, ADDRESS_ZERO);
        }

        FungibleTokenInfo memory fungibleTokenInfo;
        TokenInfo memory tokenInfo;

        tokenInfo.token = token;
        tokenInfo.totalSupply = initialTotalSupply;

        fungibleTokenInfo.decimals = decimals;
        fungibleTokenInfo.tokenInfo = tokenInfo;

        /// @dev no need to register newly created HederaFungibleToken in this context as the constructor will call HtsPrecompileMock#registerHederaFungibleToken
        HederaFungibleToken hederaFungibleToken = new HederaFungibleToken(fungibleTokenInfo);
        return (HederaResponseCodes.SUCCESS, address(hederaFungibleToken));
    }

    function createNonFungibleToken(
        HederaToken memory token
    ) external payable noDelegateCall returns (int64 responseCode, address tokenAddress) {
        responseCode = _preCreateToken(msg.sender, token, 0, 0);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            return (responseCode, ADDRESS_ZERO);
        }

        TokenInfo memory tokenInfo;
        tokenInfo.token = token;

        /// @dev no need to register newly created HederaNonFungibleToken in this context as the constructor will call HtsPrecompileMock#registerHederaNonFungibleToken
        HederaNonFungibleToken hederaNonFungibleToken = new HederaNonFungibleToken(tokenInfo);
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
        responseCode = _preCreateToken(msg.sender, token, initialTotalSupply, decimals);
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

        /// @dev no need to register newly created HederaFungibleToken in this context as the constructor will call HtsPrecompileMock#registerHederaFungibleToken
        HederaFungibleToken hederaFungibleToken = new HederaFungibleToken(fungibleTokenInfo);
        return (HederaResponseCodes.SUCCESS, address(hederaFungibleToken));
    }

    // TODO: implement logic that considers fixedFees, royaltyFees where applicable such as on transfers
    function createNonFungibleTokenWithCustomFees(
        HederaToken memory token,
        FixedFee[] memory fixedFees,
        RoyaltyFee[] memory royaltyFees
    ) external payable noDelegateCall returns (int64 responseCode, address tokenAddress) {
        responseCode = _preCreateToken(msg.sender, token, 0, 0);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            return (responseCode, ADDRESS_ZERO);
        }

        TokenInfo memory tokenInfo;
        tokenInfo.token = token;
        tokenInfo.fixedFees = fixedFees;
        tokenInfo.royaltyFees = royaltyFees;

        /// @dev no need to register newly created HederaNonFungibleToken in this context as the constructor will call HtsPrecompileMock#registerHederaNonFungibleToken
        HederaNonFungibleToken hederaNonFungibleToken = new HederaNonFungibleToken(tokenInfo);
        return (HederaResponseCodes.SUCCESS, address(hederaNonFungibleToken));
    }

    // TODO
    function cryptoTransfer(
        TransferList memory transferList,
        TokenTransferList[] memory tokenTransfers
    ) external noDelegateCall returns (int64 responseCode) {}

    // TODO
    function deleteToken(address token) external noDelegateCall returns (int64 responseCode) {}

    function approve(
        address token,
        address spender,
        uint256 amount
    ) external noDelegateCall returns (int64 responseCode) {
        address owner = msg.sender;
        responseCode = _precheckApprove(token, owner, spender, amount); // _precheckApprove works for BOTH token types

        if (responseCode != HederaResponseCodes.SUCCESS) {
            return responseCode;
        }

        HederaFungibleToken(token).approveRequestFromHtsPrecompile(owner, spender, amount);
        return HederaResponseCodes.SUCCESS;
    }

    function approveNFT(
        address token,
        address approved,
        uint256 serialNumber
    ) external noDelegateCall returns (int64 responseCode) {
        address owner = msg.sender;
        address spender = approved;
        int64 _serialNumber = int64(int(serialNumber));
        responseCode = _precheckApprove(token, owner, spender, serialNumber); // _precheckApprove works for BOTH token types

        if (responseCode != HederaResponseCodes.SUCCESS) {
            return responseCode;
        }

        HederaNonFungibleToken(token).approveRequestFromHtsPrecompile(spender, _serialNumber);
        _partialNonFungibleTokenInfos[token][_serialNumber].spenderId = spender;
        return HederaResponseCodes.SUCCESS;
    }

    function associateToken(address account, address token) public noDelegateCall returns (int64 responseCode) {
        if (!_isFungible[token] && !_isNonFungible[token]) {
            return HederaResponseCodes.INVALID_TOKEN_ID;
        }

        if (_association[token][account]) {
            return HederaResponseCodes.TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT;
        }

        _association[token][account] = true;
        return HederaResponseCodes.SUCCESS;
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

        return HederaResponseCodes.SUCCESS;
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

        return HederaResponseCodes.SUCCESS;
    }

    function dissociateToken(address account, address token) public noDelegateCall returns (int64 responseCode) {
        if (!_isFungible[token] && !_isNonFungible[token]) {
            return HederaResponseCodes.INVALID_TOKEN_ID;
        }

        if (!_association[token][account]) {
            return HederaResponseCodes.TOKEN_NOT_ASSOCIATED_TO_ACCOUNT;
        }

        _association[token][account] = false;
        return HederaResponseCodes.SUCCESS;
    }

    // TODO
    function freezeToken(address token, address account) external noDelegateCall returns (int64 responseCode) {}

    function mintToken(
        address token,
        int64 amount,
        bytes[] memory metadata
    ) external noDelegateCall returns (int64 responseCode, int64 newTotalSupply, int64[] memory serialNumbers) {
        responseCode = _precheckMint(token, amount, metadata);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            return (responseCode, 0, new int64[](0));
        }

        if (_isFungible[token]) {
            HederaFungibleToken hederaFungibleToken = HederaFungibleToken(token);
            hederaFungibleToken.mintRequestFromHtsPrecompile(amount);
            newTotalSupply = int64(int(hederaFungibleToken.totalSupply()));
            return (responseCode, newTotalSupply, new int64[](0));
        }

        serialNumbers = new int64[](1); // since you can only mint 1 NFT at a time

        int64 serialNumber;
        (newTotalSupply, serialNumber) = HederaNonFungibleToken(token).mintRequestFromHtsPrecompile(metadata);

        serialNumbers[0] = serialNumber;

        _partialNonFungibleTokenInfos[token][serialNumber] = PartialNonFungibleTokenInfo({
            ownerId: _getTreasuryAccount(token),
            creationTime: int64(int(block.timestamp)),
            metadata: _concatenate(metadata),
            spenderId: ADDRESS_ZERO
        });

        return (responseCode, newTotalSupply, serialNumbers);
    }

    function burnToken(
        address token,
        int64 amount,
        int64[] memory serialNumbers
    ) external noDelegateCall returns (int64 responseCode, int64 newTotalSupply) {
        responseCode = _precheckBurn(token, amount, serialNumbers);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            return (responseCode, 0);
        }

        if (_isFungible[token]) {
            HederaFungibleToken hederaFungibleToken = HederaFungibleToken(token);
            hederaFungibleToken.burnRequestFromHtsPrecompile(amount);
            newTotalSupply = int64(int(hederaFungibleToken.totalSupply()));
            return (responseCode, newTotalSupply);
        }

        newTotalSupply = HederaNonFungibleToken(token).burnRequestFromHtsPrecompile(serialNumbers);
        int64 serialNumber;
        uint burnCount = serialNumbers.length;
        for (uint256 i = 0; i < burnCount; i++) {
            serialNumber = serialNumbers[i];
            delete _partialNonFungibleTokenInfos[token][serialNumber].ownerId;
            delete _partialNonFungibleTokenInfos[token][serialNumber].spenderId;
        }

        return (responseCode, newTotalSupply);
    }

    // TODO
    function pauseToken(address token) external noDelegateCall returns (int64 responseCode) {}

    // TODO
    function revokeTokenKyc(address token, address account) external noDelegateCall returns (int64 responseCode) {}

    function setApprovalForAll(
        address token,
        address operator,
        bool approved
    ) external noDelegateCall returns (int64 responseCode) {
        address owner = msg.sender;
        responseCode = _precheckSetApprovalForAll(token, owner, operator, approved);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            return responseCode;
        }

        HederaNonFungibleToken(token).setApprovalForAllFromHtsPrecompile(owner, operator, approved);
        return HederaResponseCodes.SUCCESS;
    }

    function transferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) external noDelegateCall returns (int64 responseCode) {
        /// @dev spender is set to non-zero address such that shouldAssumeRequestFromOwner always evaluates to false if HtsPrecompileMock#transferFrom is called
        address spender = msg.sender;
        bool isRequestFromOwner;

        (responseCode, isRequestFromOwner) = _precheckTransfer(token, spender, from, to, amount);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            return responseCode;
        }

        responseCode = HederaFungibleToken(token).transferRequestFromHtsPrecompile(
            isRequestFromOwner,
            spender,
            from,
            to,
            amount
        );

        return responseCode;
    }

    function transferFromNFT(
        address token,
        address from,
        address to,
        uint256 serialNumber
    ) external noDelegateCall returns (int64 responseCode) {
        address spender = msg.sender;
        bool isRequestFromOwner;

        (responseCode, isRequestFromOwner) = _precheckTransfer(token, spender, from, to, serialNumber);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            return responseCode;
        }

        HederaNonFungibleToken(token).transferRequestFromHtsPrecompile(
            isRequestFromOwner,
            spender,
            from,
            to,
            serialNumber
        );

        int64 _serialNumber = int64(uint64(serialNumber));
        _partialNonFungibleTokenInfos[token][_serialNumber].ownerId = to;
        delete _partialNonFungibleTokenInfos[token][_serialNumber].spenderId;

        return responseCode;
    }

    /// TODO implementation is currently identical to transferFromNFT; investigate the differences between the 2 functions
    function transferNFT(
        address token,
        address sender,
        address recipient,
        int64 serialNumber
    ) public noDelegateCall returns (int64 responseCode) {
        address spender = msg.sender;
        uint256 _serialNumber = uint64(serialNumber);
        bool isRequestFromOwner;

        (responseCode, isRequestFromOwner) = _precheckTransfer(token, spender, sender, recipient, _serialNumber);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            return responseCode;
        }

        responseCode = HederaNonFungibleToken(token).transferRequestFromHtsPrecompile(
            isRequestFromOwner,
            spender,
            sender,
            recipient,
            _serialNumber
        );

        _partialNonFungibleTokenInfos[token][serialNumber].ownerId = recipient;
        delete _partialNonFungibleTokenInfos[token][serialNumber].spenderId;

        return responseCode;
    }

    function transferNFTs(
        address token,
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
        address token,
        address sender,
        address recipient,
        int64 amount
    ) public noDelegateCall returns (int64 responseCode) {
        address spender = msg.sender;
        bool isRequestFromOwner;
        uint _amount = uint(int(amount));

        (responseCode, isRequestFromOwner) = _precheckTransfer(token, spender, sender, recipient, _amount);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            return responseCode;
        }

        responseCode = HederaFungibleToken(token).transferRequestFromHtsPrecompile(
            isRequestFromOwner,
            spender,
            sender,
            recipient,
            _amount
        );

        return responseCode;
    }

    function transferTokens(
        address token,
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

            responseCode = transferToken(token, spender, receiver, _amount);

            // TODO: instead of reverting return responseCode; this will require prechecks on each individual transfer before enacting the transfer of all NFTs
            // alternatively consider reverting but catch error and extract responseCode from the error and return the responseCode
            if (responseCode != HederaResponseCodes.SUCCESS) {
                revert HtsPrecompileError(responseCode);
            }
        }
    }

    // TODO
    function unfreezeToken(address token, address account) external noDelegateCall returns (int64 responseCode) {}

    // TODO
    function unpauseToken(address token) external noDelegateCall returns (int64 responseCode) {}

    // TODO
    function updateTokenExpiryInfo(
        address token,
        Expiry memory expiryInfo
    ) external noDelegateCall returns (int64 responseCode) {}

    // TODO
    function updateTokenInfo(
        address token,
        HederaToken memory tokenInfo
    ) external noDelegateCall returns (int64 responseCode) {}

    // TODO
    function updateTokenKeys(
        address token,
        TokenKey[] memory keys
    ) external noDelegateCall returns (int64 responseCode) {}

    // TODO
    function wipeTokenAccount(
        address token,
        address account,
        int64 amount
    ) external noDelegateCall returns (int64 responseCode) {}

    // TODO
    function wipeTokenAccountNFT(
        address token,
        address account,
        int64[] memory serialNumbers
    ) external noDelegateCall returns (int64 responseCode) {
        // TODO: NonFungibleToken
    }

    // TODO
    function redirectForToken(address token, bytes memory encodedFunctionSelector) external noDelegateCall {}

    // Additional(not in IHederaTokenService) public/external state-changing functions:
    function isAssociated(address account, address token) external view returns (bool associated) {
        associated = _association[token][account];
    }

    function getTreasuryAccount(address token) external view returns (address treasury) {
        return _getTreasuryAccount(token);
    }

    function _getStringLength(string memory _string) internal pure returns (uint length) {
        length = bytes(_string).length;
    }
}
