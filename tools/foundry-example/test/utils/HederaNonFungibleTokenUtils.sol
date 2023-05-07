// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import 'hedera-smart-contracts/hts-precompile/IHederaTokenService.sol';
import 'hedera-smart-contracts/hts-precompile/HederaResponseCodes.sol';

import '../mocks/hts-precompile/HederaFungibleToken.sol';

import "./CommonUtils.sol";
import "./HederaTokenUtils.sol";

contract HederaNonFungibleTokenUtils is CommonUtils, HederaTokenUtils {

    function _getSimpleHederaNftTokenInfo(
        string memory name,
        string memory symbol,
        address treasury
    ) internal returns (IHederaTokenService.TokenInfo memory tokenInfo) {
        IHederaTokenService.HederaToken memory token = _getSimpleHederaToken(name, symbol, treasury);
        tokenInfo.token = token;
    }

    function _doCreateHederaNonFungibleTokenViaHtsPrecompile(
        address sender,
        string memory name,
        string memory symbol,
        address treasury
    ) internal setPranker(sender) returns (bool success, address tokenAddress) {

        int64 expectedResponseCode = HederaResponseCodes.SUCCESS;
        int64 responseCode;

        if (sender != treasury) {
            expectedResponseCode = HederaResponseCodes.AUTHORIZATION_FAILED;
        }

        IHederaTokenService.HederaToken memory token = _getSimpleHederaToken(name, symbol, treasury);
        (responseCode, tokenAddress) = htsPrecompile.createNonFungibleToken(token);

        assertEq(expectedResponseCode, responseCode, "response code does not equal expected response code");

        success = responseCode == HederaResponseCodes.SUCCESS;

        if (success) {
            int32 tokenType;
            bool isToken;
            (, isToken) = htsPrecompile.isToken(tokenAddress);
            (responseCode, tokenType) = htsPrecompile.getTokenType(tokenAddress);

            HederaNonFungibleToken hederaNonFungibleToken = HederaNonFungibleToken(tokenAddress);

            assertEq(responseCode, HederaResponseCodes.SUCCESS, 'Failed to createNonFungibleToken');

            assertEq(responseCode, HederaResponseCodes.SUCCESS, 'Did not set is{}Token correctly');
            assertEq(tokenType, 1, 'Did not set isNonFungible correctly');

            assertEq(token.name, hederaNonFungibleToken.name(), 'Did not set name correctly');
            assertEq(token.symbol, hederaNonFungibleToken.symbol(), 'Did not set symbol correctly');
            assertEq(
                hederaNonFungibleToken.totalSupply(),
                hederaNonFungibleToken.balanceOf(token.treasury),
                'Did not mint initial supply to treasury'
            );
        }

    }

    function _doCreateHederaNonFungibleTokenDirectly(
        address sender,
        string memory name,
        string memory symbol,
        address treasury,
        IHederaTokenService.TokenKey[] memory keys
    ) internal setPranker(sender) returns (bool success, address tokenAddress) {

        int64 expectedResponseCode = HederaResponseCodes.SUCCESS;
        int64 responseCode;

        IHederaTokenService.TokenInfo memory nftTokenInfo = _getSimpleHederaNftTokenInfo(
            name,
            symbol,
            treasury
        );

        nftTokenInfo.token.tokenKeys = keys;

        IHederaTokenService.HederaToken memory token = nftTokenInfo.token;

        if (sender != treasury) {
            expectedResponseCode = HederaResponseCodes.AUTHORIZATION_FAILED;
        }

        if (expectedResponseCode != HederaResponseCodes.SUCCESS) {
            vm.expectRevert(bytes("PRECHECK_FAILED"));
        }

        /// @dev no need to register newly created HederaNonFungibleToken in this context as the constructor will call HtsPrecompileMock#registerHederaNonFungibleToken
        HederaNonFungibleToken hederaNonFungibleToken = new HederaNonFungibleToken(nftTokenInfo);

        if (expectedResponseCode == HederaResponseCodes.SUCCESS) {
            success = true;
        }

        if (success) {

            tokenAddress = address(hederaNonFungibleToken);

            (int64 responseCode, int32 tokenType) = htsPrecompile.getTokenType(tokenAddress);

            assertEq(responseCode, HederaResponseCodes.SUCCESS, 'Did not set is{}Token correctly');
            assertEq(tokenType, 1, 'Did not set isNonFungible correctly');

            assertEq(token.name, hederaNonFungibleToken.name(), 'Did not set name correctly');
            assertEq(token.symbol, hederaNonFungibleToken.symbol(), 'Did not set symbol correctly');
            assertEq(
                hederaNonFungibleToken.totalSupply(),
                hederaNonFungibleToken.balanceOf(token.treasury),
                'Did not mint initial supply to treasury'
            );

        }

    }

    function _createSimpleMockNonFungibleToken(
        address sender,
        IHederaTokenService.TokenKey[] memory keys
    ) internal returns (address tokenAddress) {

        string memory name = 'NFT A';
        string memory symbol = 'NFT-A';
        address treasury = sender;

        (, tokenAddress) = _doCreateHederaNonFungibleTokenDirectly(sender, name, symbol, treasury, keys);
    }

    struct ApproveNftParams {
        address sender;
        address token;
        address spender;
        int64 serialId;
    }

    struct ApproveNftInfo {
        address owner;
        address spender;
        uint256 serialIdU256;
    }

    function _doApproveNftViaHtsPrecompile(ApproveNftParams memory approveNftParams) internal setPranker(approveNftParams.sender) returns (bool success) {

        int64 expectedResponseCode = HederaResponseCodes.SUCCESS;
        int64 responseCode;

        ApproveNftInfo memory approveNftInfo;

        HederaNonFungibleToken hederaNonFungibleToken = HederaNonFungibleToken(approveNftParams.token);

        approveNftInfo.serialIdU256 = uint64(approveNftParams.serialId);
        approveNftInfo.owner = hederaNonFungibleToken.ownerOf(approveNftInfo.serialIdU256);

        if (approveNftParams.sender != approveNftInfo.owner) {
            expectedResponseCode = HederaResponseCodes.SENDER_DOES_NOT_OWN_NFT_SERIAL_NO;
        }

        responseCode = htsPrecompile.approveNFT(approveNftParams.token, approveNftParams.spender, approveNftInfo.serialIdU256);

        assertEq(responseCode, expectedResponseCode, "expected response code does not equal actual response code");

        success = responseCode == HederaResponseCodes.SUCCESS;

        approveNftInfo.spender = hederaNonFungibleToken.getApproved(approveNftInfo.serialIdU256);

        if (success) {
            assertEq(approveNftInfo.spender, approveNftParams.spender, "spender was not correctly updated");
        }

    }

    function _doApproveNftDirectly(ApproveNftParams memory approveNftParams) internal setPranker(approveNftParams.sender) returns (bool success) {

        int64 expectedResponseCode = HederaResponseCodes.SUCCESS;
        int64 responseCode;

        ApproveNftInfo memory approveNftInfo;

        HederaNonFungibleToken hederaNonFungibleToken = HederaNonFungibleToken(approveNftParams.token);

        approveNftInfo.serialIdU256 = uint64(approveNftParams.serialId);
        approveNftInfo.owner = hederaNonFungibleToken.ownerOf(approveNftInfo.serialIdU256);

        if (approveNftParams.sender != approveNftInfo.owner) {
            expectedResponseCode = HederaResponseCodes.SENDER_DOES_NOT_OWN_NFT_SERIAL_NO;
        }

        if (expectedResponseCode != HederaResponseCodes.SUCCESS) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    HederaFungibleToken.HtsPrecompileError.selector,
                    expectedResponseCode
                )
            );
        }

        hederaNonFungibleToken.approve(approveNftParams.spender, approveNftInfo.serialIdU256);

        if (expectedResponseCode == HederaResponseCodes.SUCCESS) {
            success = true;
        }

        approveNftInfo.spender = hederaNonFungibleToken.getApproved(approveNftInfo.serialIdU256);

        if (success) {
            assertEq(approveNftInfo.spender, approveNftParams.spender, "spender was not correctly updated");
        }

    }

}
