// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import 'hedera-smart-contracts/hts-precompile/IHederaTokenService.sol';
import 'hedera-smart-contracts/hts-precompile/HederaResponseCodes.sol';

import '../mocks/hts-precompile/HederaFungibleToken.sol';

import "./CommonUtils.sol";
import "./HederaTokenUtils.sol";

contract HederaFungibleTokenUtils is CommonUtils, HederaTokenUtils {

    function _getSimpleHederaFungibleTokenInfo(
        string memory name,
        string memory symbol,
        address treasury,
        int64 initialTotalSupply,
        int32 decimals
    ) internal returns (IHederaTokenService.FungibleTokenInfo memory fungibleTokenInfo) {
        IHederaTokenService.TokenInfo memory tokenInfo;

        IHederaTokenService.HederaToken memory token = _getSimpleHederaToken(name, symbol, treasury);

        tokenInfo.token = token;
        tokenInfo.totalSupply = initialTotalSupply;

        fungibleTokenInfo.decimals = decimals;
        fungibleTokenInfo.tokenInfo = tokenInfo;
    }

    function _doCreateHederaFungibleTokenViaHtsPrecompile(
        address sender,
        string memory name,
        string memory symbol,
        address treasury,
        int64 initialTotalSupply,
        int32 decimals
    ) internal setPranker(sender) returns (address tokenAddress) {
        bool isToken;
        assertTrue(isToken == false);
        IHederaTokenService.HederaToken memory token = _getSimpleHederaToken(name, symbol, treasury);

        int64 responseCode;
        (responseCode, tokenAddress) = htsPrecompile.createFungibleToken(token, initialTotalSupply, decimals);

        int32 tokenType;
        (, isToken) = htsPrecompile.isToken(tokenAddress);
        (responseCode, tokenType) = htsPrecompile.getTokenType(tokenAddress);

        HederaFungibleToken hederaFungibleToken = HederaFungibleToken(tokenAddress);

        assertEq(responseCode, HederaResponseCodes.SUCCESS, 'Failed to createFungibleToken');

        assertEq(responseCode, HederaResponseCodes.SUCCESS, 'Did not set is{}Token correctly');
        assertEq(tokenType, 0, 'Did not set isFungible correctly');

        assertEq(uint64(initialTotalSupply), hederaFungibleToken.totalSupply(), 'Did not set initial supply correctly');
        assertEq(token.name, hederaFungibleToken.name(), 'Did not set name correctly');
        assertEq(token.symbol, hederaFungibleToken.symbol(), 'Did not set symbol correctly');
        assertEq(
            hederaFungibleToken.totalSupply(),
            hederaFungibleToken.balanceOf(token.treasury),
            'Did not mint initial supply to treasury'
        );
    }

    function _doCreateHederaFungibleTokenDirectly(
        address sender,
        string memory name,
        string memory symbol,
        address treasury,
        int64 initialTotalSupply,
        int32 decimals,
        IHederaTokenService.TokenKey[] memory keys
    ) internal setPranker(sender) returns (address tokenAddress) {
        IHederaTokenService.FungibleTokenInfo memory fungibleTokenInfo = _getSimpleHederaFungibleTokenInfo(
            name,
            symbol,
            sender,
            initialTotalSupply,
            decimals
        );

        fungibleTokenInfo.tokenInfo.token.tokenKeys = keys;

        IHederaTokenService.HederaToken memory token = fungibleTokenInfo.tokenInfo.token;

        /// @dev no need to register newly created HederaFungibleToken in this context as the constructor will call HtsPrecompileMock#registerHederaFungibleToken
        HederaFungibleToken hederaFungibleToken = new HederaFungibleToken(fungibleTokenInfo);
        tokenAddress = address(hederaFungibleToken);

        (int64 responseCode, int32 tokenType) = htsPrecompile.getTokenType(tokenAddress);

        assertEq(responseCode, HederaResponseCodes.SUCCESS, 'Did not set is{}Token correctly');
        assertEq(tokenType, 0, 'Did not set isFungible correctly');

        assertEq(uint64(initialTotalSupply), hederaFungibleToken.totalSupply(), 'Did not set initial supply correctly');
        assertEq(token.name, hederaFungibleToken.name(), 'Did not set name correctly');
        assertEq(token.symbol, hederaFungibleToken.symbol(), 'Did not set symbol correctly');
        assertEq(
            hederaFungibleToken.totalSupply(),
            hederaFungibleToken.balanceOf(token.treasury),
            'Did not mint initial supply to treasury'
        );
    }

    function _createSimpleMockFungibleToken(
        address sender,
        IHederaTokenService.TokenKey[] memory keys
    ) internal returns (address tokenAddress) {
        string memory name = 'Token A';
        string memory symbol = 'TA';
        address treasury = sender;
        int64 initialTotalSupply = 1e16;
        int32 decimals = 8;

        tokenAddress = _doCreateHederaFungibleTokenDirectly(
            sender,
            name,
            symbol,
            treasury,
            initialTotalSupply,
            decimals,
            keys
        );
    }

    function _doApproveViaHtsPrecompile(
        address sender,
        address token,
        address spender,
        uint allowance
    ) internal setPranker(sender) returns (bool success) {
        HederaFungibleToken hederaFungibleToken = HederaFungibleToken(token);
        uint spenderStartingAllowance = hederaFungibleToken.allowance(sender, spender);
        int64 responseCode = htsPrecompile.approve(token, spender, allowance);
        assertEq(
            responseCode,
            HederaResponseCodes.SUCCESS,
            "expected spender to be given token allowance to sender's account"
        );

        uint spenderFinalAllowance = hederaFungibleToken.allowance(sender, spender);

        assertEq(spenderFinalAllowance, allowance, "spender's expected allowance not set correctly");
    }

    function _doApproveDirectly(
        address sender,
        address token,
        address spender,
        uint allowance
    ) internal setPranker(sender) returns (bool success) {
        HederaFungibleToken hederaFungibleToken = HederaFungibleToken(token);
        uint spenderStartingAllowance = hederaFungibleToken.allowance(sender, spender);
        success = hederaFungibleToken.approve(spender, allowance);
        assertEq(success, true, 'expected successful approval');
        uint spenderFinalAllowance = hederaFungibleToken.allowance(sender, spender);
        assertEq(spenderFinalAllowance, allowance, "spender's expected allowance not set correctly");
    }
}
