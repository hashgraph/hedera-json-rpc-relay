// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "../../HederaTokenService.sol";
import "../../ExpiryHelper.sol";
import "../../KeyHelper.sol";

contract TokenCreateCustomContract is HederaTokenService, ExpiryHelper, KeyHelper {

    event ResponseCode(int responseCode);
    event CreatedToken(address tokenAddress);
    event TransferToken(address tokenAddress, address receiver, int64 amount);
    event MintedToken(int64 newTotalSupply, int64[] serialNumbers);

    function createFungibleTokenPublic(
        string memory name,
        string memory symbol,
        string memory memo,
        int64 initialTotalSupply,
        int64 maxSupply,
        int32 decimals,
        bool freezeDefaultStatus,
        address treasury,
        IHederaTokenService.TokenKey[] memory keys
    ) public payable {
        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, treasury, 8000000
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, treasury, memo, true, maxSupply, freezeDefaultStatus, keys, expiry
        );
        
        (int responseCode, address tokenAddress) =
        HederaTokenService.createFungibleToken(token, initialTotalSupply, decimals);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
        emit CreatedToken(tokenAddress);
    }

    function createFungibleTokenWithCustomFeesPublic(
        address treasury,
        address fixedFeeTokenAddress,
        string memory name,
        string memory symbol,
        string memory memo,
        int64 initialTotalSupply,
        int64 maxSupply,
        int32 decimals,
        int64 feeAmount,
        IHederaTokenService.TokenKey[] memory keys
    ) public payable {
        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, treasury, 8000000
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, treasury, memo, true, maxSupply, false, keys, expiry
        );

        IHederaTokenService.FixedFee[] memory fixedFees = new IHederaTokenService.FixedFee[](1);
        fixedFees[0] = IHederaTokenService.FixedFee(feeAmount, fixedFeeTokenAddress, false, false, treasury);

        IHederaTokenService.FractionalFee[] memory fractionalFees = new IHederaTokenService.FractionalFee[](1);
        fractionalFees[0] = IHederaTokenService.FractionalFee(4, 5, 10, 30, false, treasury);

        (int responseCode, address tokenAddress) =
        HederaTokenService.createFungibleTokenWithCustomFees(token, initialTotalSupply, decimals, fixedFees, fractionalFees);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }

        emit CreatedToken(tokenAddress);
    }

    function createNonFungibleTokenPublic(
        string memory name,
        string memory symbol,
        string memory memo,
        int64 maxSupply,
        address treasury,
        IHederaTokenService.TokenKey[] memory keys
    ) public payable {
        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, treasury, 8000000
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, treasury, memo, true, maxSupply, false, keys, expiry
        );

        (int responseCode, address tokenAddress) =
        HederaTokenService.createNonFungibleToken(token);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }

        emit CreatedToken(tokenAddress);
    }

    function createNonFungibleTokenWithCustomFeesPublic(
        address treasury,
        address fixedFeeTokenAddress,
        string memory name,
        string memory symbol,
        string memory memo,
        int64 maxSupply,
        int64 feeAmount,
        IHederaTokenService.TokenKey[] memory keys
    ) public payable {
        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, treasury, 8000000
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, treasury, memo, true, maxSupply, false, keys, expiry
        );

        IHederaTokenService.FixedFee[] memory fixedFees = new IHederaTokenService.FixedFee[](1);
        fixedFees[0] = IHederaTokenService.FixedFee(feeAmount, fixedFeeTokenAddress, false, false, treasury);

        IHederaTokenService.RoyaltyFee[] memory royaltyFees = new IHederaTokenService.RoyaltyFee[](1);
        royaltyFees[0] = IHederaTokenService.RoyaltyFee(4, 5, 10, fixedFeeTokenAddress, false, treasury);

        (int responseCode, address tokenAddress) =
        HederaTokenService.createNonFungibleTokenWithCustomFees(token, fixedFees, royaltyFees);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }

        emit CreatedToken(tokenAddress);
    }

    function mintTokenPublic(address token, int64 amount, bytes[] memory metadata) public
    returns (int responseCode, int64 newTotalSupply, int64[] memory serialNumbers)  {
        (responseCode, newTotalSupply, serialNumbers) = HederaTokenService.mintToken(token, amount, metadata);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit MintedToken(newTotalSupply, serialNumbers);
    }

    function mintTokenToAddressPublic(address token, address receiver, int64 amount, bytes[] memory metadata) public
    returns (int responseCode, int64 newTotalSupply, int64[] memory serialNumbers)  {
        (responseCode, newTotalSupply, serialNumbers) = mintTokenPublic(token, amount, metadata);

        HederaTokenService.transferToken(token, address(this), receiver, amount);
        emit TransferToken(token, receiver, amount);
    }

    function mintNonFungibleTokenToAddressPublic(address token, address receiver, int64 amount, bytes[] memory metadata) public
    returns (int responseCode, int64 newTotalSupply, int64[] memory serialNumbers)  {
        (responseCode, newTotalSupply, serialNumbers) = mintTokenPublic(token, amount, metadata);

        HederaTokenService.transferNFT(token, address(this), receiver, serialNumbers[0]);
        emit TransferToken(token, receiver, amount);
    }

    function associateTokensPublic(address account, address[] memory tokens) external returns (int256 responseCode) {
        (responseCode) = HederaTokenService.associateTokens(account, tokens);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
    }

    function associateTokenPublic(address account, address token) public returns (int responseCode) {
        responseCode = HederaTokenService.associateToken(account, token);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
    }

    function grantTokenKycPublic(address token, address account) external returns (int64 responseCode) {
        (responseCode) = HederaTokenService.grantTokenKyc(token, account);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }
    }
}
