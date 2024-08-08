// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import '../precompile/HederaResponseCodes.sol';
import '../HederaFungibleToken.sol';
import '../HederaNonFungibleToken.sol';
import '../interfaces/IHtsPrecompileMock.sol';

library HederaTokenValidation {

    /// checks if token exists and has not been deleted and returns appropriate response code
    function _validateToken(
        bool storage _tokenDeleted,
        bool storage _isFungible,
        bool storage _isNonFungible
    ) internal view returns (bool success, int64 responseCode) {

        if (_tokenDeleted) {
            return (false, HederaResponseCodes.TOKEN_WAS_DELETED);
        }

        if (!_isFungible && !_isNonFungible) {
            return (false, HederaResponseCodes.INVALID_TOKEN_ID);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateIsFungible(
        bool storage _isFungible
    ) internal view returns (bool success, int64 responseCode) {

        if (!_isFungible) {
            return (false, HederaResponseCodes.INVALID_TOKEN_ID);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateIsNonFungible(
        address token,
        mapping(address => bool) storage _isNonFungible
    ) internal view returns (bool success, int64 responseCode) {
        if (!_isNonFungible) {
            return (false, HederaResponseCodes.INVALID_TOKEN_ID);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateAdminKey(bool validKey, bool noKey) internal pure returns (bool success, int64 responseCode) {
        if (noKey) {
            return (false, HederaResponseCodes.TOKEN_IS_IMMUTABLE);
        }

        if (!validKey) {
            return (false, HederaResponseCodes.INVALID_ADMIN_KEY);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateFreezeKey(bool validKey, bool noKey) internal pure returns (bool success, int64 responseCode) {

        if (noKey) {
            return (false, HederaResponseCodes.TOKEN_HAS_NO_FREEZE_KEY);
        }

        if (!validKey) {
            return (false, HederaResponseCodes.INVALID_FREEZE_KEY);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validatePauseKey(bool validKey, bool noKey) internal pure returns (bool success, int64 responseCode) {
        if (noKey) {
            return (false, HederaResponseCodes.TOKEN_HAS_NO_PAUSE_KEY);
        }

        if (!validKey) {
            return (false, HederaResponseCodes.INVALID_PAUSE_KEY);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateKycKey(bool validKey, bool noKey) internal pure returns (bool success, int64 responseCode) {
        if (noKey) {
            return (false, HederaResponseCodes.TOKEN_HAS_NO_KYC_KEY);
        }

        if (!validKey) {
            return (false, HederaResponseCodes.INVALID_KYC_KEY);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateSupplyKey(bool validKey, bool noKey) internal pure returns (bool success, int64 responseCode) {
        if (noKey) {
            return (false, HederaResponseCodes.TOKEN_HAS_NO_SUPPLY_KEY);
        }

        if (!validKey) {
            return (false, HederaResponseCodes.INVALID_SUPPLY_KEY);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateTreasuryKey(bool validKey, bool noKey) internal pure returns (bool success, int64 responseCode) {
        if (noKey) {
            return (false, HederaResponseCodes.AUTHORIZATION_FAILED);
        }

        if (!validKey) {
            return (false, HederaResponseCodes.AUTHORIZATION_FAILED);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateWipeKey(bool validKey, bool noKey) internal pure returns (bool success, int64 responseCode) {
        if (noKey) {
            return (false, HederaResponseCodes.TOKEN_HAS_NO_WIPE_KEY);
        }

        if (!validKey) {
            return (false, HederaResponseCodes.INVALID_WIPE_KEY);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateAccountKyc(bool kycPass) internal pure returns (bool success, int64 responseCode) {

        if (!kycPass) {
            return (false, HederaResponseCodes.ACCOUNT_KYC_NOT_GRANTED_FOR_TOKEN);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;

    }

    function _validateAccountFrozen(bool frozenPass) internal pure returns (bool success, int64 responseCode) {

        if (!frozenPass) {
            return (false, HederaResponseCodes.ACCOUNT_FROZEN_FOR_TOKEN);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;

    }

    function _validateNftOwnership(
        address expectedOwner,
        uint serialNumber,
        bool storage _isNonFungible,
        mapping(int64 => IHtsPrecompileMock.PartialNonFungibleTokenInfo) storage _partialNonFungibleTokenInfos
    ) internal view returns (bool success, int64 responseCode) {
        if (_isNonFungible) {
            int64 _serialNumber = int64(uint64(serialNumber));
            IHtsPrecompileMock.PartialNonFungibleTokenInfo memory partialNonFungibleTokenInfo = _partialNonFungibleTokenInfos[_serialNumber];

            if (partialNonFungibleTokenInfo.ownerId != expectedOwner) {
                return (false, HederaResponseCodes.SENDER_DOES_NOT_OWN_NFT_SERIAL_NO);
            }
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateFungibleBalance(
        address owner,
        uint amount,
        mapping(address => bool) storage _isFungible
    ) internal view returns (bool success, int64 responseCode) {
        if (_isFungible) {
            HederaFungibleToken hederaFungibleToken = HederaFungibleToken();

            bool sufficientBalance = hederaFungibleToken.balanceOf(owner) >= uint64(amount);

            if (!sufficientBalance) {
                return (false, HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE);
            }
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateEmptyFungibleBalance(
        address owner,
        mapping(address => bool) storage _isFungible
    ) internal view returns (bool success, int64 responseCode) {
        if (_isFungible) {
            HederaFungibleToken hederaFungibleToken = HederaFungibleToken();

            bool emptyBalance = hederaFungibleToken.balanceOf(owner) == 0;

            if (!emptyBalance) {
                return (false, HederaResponseCodes.TRANSACTION_REQUIRES_ZERO_TOKEN_BALANCES);
            }
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateEmptyNonFungibleBalance(
        address owner,
        mapping(address => bool) storage _isNonFungible
    ) internal view returns (bool success, int64 responseCode) {
        if (_isNonFungible) {
            HederaNonFungibleToken hederaNonFungibleToken = HederaNonFungibleToken();

            bool emptyBalance = hederaNonFungibleToken.balanceOf(owner) == 0;

            if (!emptyBalance) {
                return (false, HederaResponseCodes.TRANSACTION_REQUIRES_ZERO_TOKEN_BALANCES);
            }
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateTokenSufficiency(
        address owner,
        int64 amount,
        int64 serialNumber,
        bool storage _isFungible,
        bool storage _isNonFungible,
        IHtsPrecompileMock.PartialNonFungibleTokenInfo[] storage _partialNonFungibleTokenInfos
    ) internal view returns (bool success, int64 responseCode) {

        uint256 amountU256 = uint64(amount);
        uint256 serialNumberU256 = uint64(serialNumber);
        return _validateTokenSufficiency(owner, amountU256, serialNumberU256, _isFungible, _isNonFungible, _partialNonFungibleTokenInfos);
    }

    function _validateTokenSufficiency(
        address owner,
        uint256 amount,
        uint256 serialNumber,
        bool storage _isFungible,
        bool storage _isNonFungible,
        IHtsPrecompileMock.PartialNonFungibleTokenInfo[] storage _partialNonFungibleTokenInfos
    ) internal view returns (bool success, int64 responseCode) {

        if (_isFungible) {
            return _validateFungibleBalance(owner, amount, _isFungible);
        }

        if (_isNonFungible) {
            return _validateNftOwnership(owner, serialNumber, _isNonFungible, _partialNonFungibleTokenInfos);
        }
    }

    function _validateFungibleApproval(
        address spender,
        address from,
        uint256 amount,
        mapping(address => bool) storage _isFungible
    ) internal view returns (bool success, int64 responseCode) {
        if (_isFungible) {

            uint256 allowance = HederaFungibleToken().allowance(from, spender);

            // TODO: do validation for other allowance response codes such as SPENDER_DOES_NOT_HAVE_ALLOWANCE and MAX_ALLOWANCES_EXCEEDED
            if (allowance < amount) {
                return (false, HederaResponseCodes.AMOUNT_EXCEEDS_ALLOWANCE);
            }
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateNftApproval(
        address owner,
        address spender,
        uint256 serialNumber,
        mapping(address => bool) storage _isNonFungible
    ) internal view returns (bool success, int64 responseCode) {

        if (_isNonFungible) {
            bool canSpendToken = HederaNonFungibleToken().isApprovedOrOwner(owner, spender, serialNumber);
            if (!canSpendToken) {
                return (false, HederaResponseCodes.INSUFFICIENT_ACCOUNT_BALANCE);
            }
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateApprovalSufficiency(
        address spender,
        address from,
        uint256 amountOrSerialNumber,
        mapping(address => bool) storage _isFungible,
        mapping(address => bool) storage _isNonFungible
    ) internal view returns (bool success, int64 responseCode) {

        if (_isFungible) {
            return _validateFungibleApproval(spender, from, amountOrSerialNumber, _isFungible);
        }

        if (_isNonFungible) {
            return _validateNftApproval(from, spender, amountOrSerialNumber, _isNonFungible);
        }
    }

    function _validBurnInput(
        mapping(address => bool) storage _isFungible,
        mapping(address => bool) storage _isNonFungible,
        int64 amount,
        int64[] memory serialNumbers
    ) internal view returns (bool success, int64 responseCode) {

        if (_isFungible && serialNumbers.length > 0) {
            return (false, HederaResponseCodes.INVALID_TOKEN_ID);
        }

        if (_isNonFungible && amount > 0) {
            return (false, HederaResponseCodes.INVALID_TOKEN_ID);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateTokenAssociation(
        address account,
        mapping(address => mapping(address => bool)) storage _association
    ) internal view returns (bool success, int64 responseCode) {
        if (!_association[account]) {
            return (false, HederaResponseCodes.TOKEN_NOT_ASSOCIATED_TO_ACCOUNT);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }

    function _validateTokenDissociation(
        address account,
        mapping(address => mapping(address => bool)) storage _association,
        mapping(address => bool) storage _isFungible,
        mapping(address => bool) storage _isNonFungible
    ) internal view returns (bool success, int64 responseCode) {

        if (_isFungible) {
            return _validateEmptyFungibleBalance(account, _isFungible);
        }

        if (_isNonFungible) {
            return _validateEmptyNonFungibleBalance(account, _isNonFungible);
        }

        success = true;
        responseCode = HederaResponseCodes.SUCCESS;
    }
}
