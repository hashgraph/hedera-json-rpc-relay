// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./FeeHelper.sol";

contract BaseHTS is FeeHelper {

    string name = "tokenName";
    string symbol = "tokenSymbol";
    string memo = "memo";
    uint initialTotalSupply = 1000;
    uint32 maxSupply = 1000;
    uint decimals = 8;

    event CreatedToken(address tokenAddress);
    event AllowanceValue(uint256 amount);
    event ResponseCode(int responseCode);
    event ApprovedAddress(address approved);
    event Approved(bool approved);
    event FungibleTokenInfo(IHederaTokenService.FungibleTokenInfo tokenInfo);
    event TokenInfo(IHederaTokenService.TokenInfo tokenInfo);
    event NonFungibleTokenInfo(IHederaTokenService.NonFungibleTokenInfo tokenInfo);
    event MintedToken(uint64 newTotalSupply, int64[] serialNumbers);

    function createFungibleTokenPublic(
        address treasury
    ) public payable {
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = getSingleKey(0, 0, 1, bytes(""));

        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, treasury, 8000000
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, treasury, memo, true, maxSupply, false, keys, expiry
        );

        (int responseCode, address tokenAddress) =
        HederaTokenService.createFungibleToken(token, initialTotalSupply, decimals);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }

        emit CreatedToken(tokenAddress);
    }

    function createNonFungibleTokenPublic(
        address treasury
    ) public payable {
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);
        keys[0] = getSingleKey(0, 0, 1, bytes(""));
        keys[1] = getSingleKey(4, 1, bytes(""));

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

    function associateTokenPublic(address account, address token) public returns (int responseCode) {
        responseCode = HederaTokenService.associateToken(account, token);
        emit ResponseCode(responseCode);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
    }

    function approvePublic(address token, address spender, uint256 amount) public returns (int responseCode) {
        responseCode = HederaTokenService.approve(token, spender, amount);
        emit ResponseCode(responseCode);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
    }

    function allowancePublic(address token, address owner, address spender) public returns (int responseCode, uint256 amount) {
        (responseCode, amount) = HederaTokenService.allowance(token, owner, spender);
        emit ResponseCode(responseCode);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
        emit AllowanceValue(amount);
    }

    function transferTokenPublic(address account, address token, int64 amount) public returns (int responseCode) {
        IHederaTokenService.NftTransfer[] memory nftTransfers = new IHederaTokenService.NftTransfer[](0);

        IHederaTokenService.AccountAmount memory accountAmountNegative =
        IHederaTokenService.AccountAmount(msg.sender, - amount);
        IHederaTokenService.AccountAmount memory accountAmountPositive =
        IHederaTokenService.AccountAmount(account, amount);
        IHederaTokenService.AccountAmount[] memory transfers = new IHederaTokenService.AccountAmount[](2);
        transfers[0] = accountAmountNegative;
        transfers[1] = accountAmountPositive;

        IHederaTokenService.TokenTransferList memory tokenTransfer =
        IHederaTokenService.TokenTransferList(token, transfers, nftTransfers);
        IHederaTokenService.TokenTransferList[] memory tokenTransferList = new IHederaTokenService.TokenTransferList[](1);
        tokenTransferList[0] = tokenTransfer;

        responseCode = HederaTokenService.cryptoTransfer(tokenTransferList);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }
    }

    function getApprovedPublic(address token, uint256 serialNumber) public returns (int responseCode, address approved)
    {
        (responseCode, approved) = HederaTokenService.getApproved(token, serialNumber);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit ApprovedAddress(approved);
    }

    function setApprovalForAllPublic(address token, address operator, bool approved) public returns (int responseCode)
    {
        responseCode = HederaTokenService.setApprovalForAll(token, operator, approved);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }
    }

    function mintTokenPublic(address token, uint64 amount, bytes[] memory metadata) public
    returns (int responseCode, uint64 newTotalSupply, int64[] memory serialNumbers) {
        (responseCode, newTotalSupply, serialNumbers) = HederaTokenService.mintToken(token, amount, metadata);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit MintedToken(newTotalSupply, serialNumbers);
    }

    function isApprovedForAllPublic(address token, address owner, address operator) public returns (int responseCode, bool approved)
    {
        (responseCode, approved) = HederaTokenService.isApprovedForAll(token, owner, operator);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit Approved(approved);
    }

    function getFungibleTokenInfoPublic(address token) public returns (int responseCode, IHederaTokenService.FungibleTokenInfo memory tokenInfo) {
        (responseCode, tokenInfo) = HederaTokenService.getFungibleTokenInfo(token);

        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit FungibleTokenInfo(tokenInfo);
    }

    function getTokenInfoPublic(address token) public returns (int responseCode, IHederaTokenService.TokenInfo memory tokenInfo) {
        (responseCode, tokenInfo) = HederaTokenService.getTokenInfo(token);

        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit TokenInfo(tokenInfo);
    }

    function getNonFungibleTokenInfoPublic(address token, int64 serialNumber) public returns (int responseCode, IHederaTokenService.NonFungibleTokenInfo memory tokenInfo) {
        (responseCode, tokenInfo) = HederaTokenService.getNonFungibleTokenInfo(token, serialNumber);

        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit NonFungibleTokenInfo(tokenInfo);
    }
}
