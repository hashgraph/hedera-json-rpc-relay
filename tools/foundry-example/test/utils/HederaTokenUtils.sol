// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import 'forge-std/Test.sol';

import '../mocks/hts-precompile/HtsPrecompileMock.sol';
import './CommonUtils.sol';

/// for testing actions common to both HTS token types i.e FUNGIBLE and NON_FUNGIBLE
/// also has common constants for both HTS token types
abstract contract HederaTokenUtils is Test, CommonUtils, Constants {

    HtsPrecompileMock htsPrecompile = HtsPrecompileMock(HTS_PRECOMPILE);

    function _setUpHtsPrecompileMock() internal {
        HtsPrecompileMock htsPrecompileMock = new HtsPrecompileMock();
        bytes memory code = address(htsPrecompileMock).code;
        vm.etch(HTS_PRECOMPILE, code);
    }

    function _getSimpleHederaToken(
        string memory name,
        string memory symbol,
        address treasury
    ) internal returns (IHederaTokenService.HederaToken memory token) {
        token.name = name;
        token.symbol = symbol;
        token.treasury = treasury;
    }

    function _doAssociateViaHtsPrecompile(
        address sender,
        address token
    ) internal setPranker(sender) returns (bool success) {
        bool isInitiallyAssociated = htsPrecompile.isAssociated(sender, token);
        int64 responseCode = htsPrecompile.associateToken(sender, token);
        success = responseCode == HederaResponseCodes.SUCCESS;

        int64 expectedResponseCode;

        if (isInitiallyAssociated) {
            expectedResponseCode = HederaResponseCodes.TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT;
        }

        if (!isInitiallyAssociated) {
            expectedResponseCode = HederaResponseCodes.SUCCESS;
        }

        bool isFinallyAssociated = htsPrecompile.isAssociated(sender, token);

        assertEq(responseCode, expectedResponseCode, 'expected response code does not match actual response code');
    }

    struct MintKeys {
        address supplyKey;
        address treasury;
    }

    struct MintInfo {
        uint256 totalSupply;
        uint256 treasuryBalance;
        bool isFungible;
        bool isNonFungible;
        uint256 mintAmountU256;
        int64 mintCount;
    }

    struct MintParams {
        address sender;
        address token;
        int64 mintAmount;
    }

    struct MintResponse {
        bool success;
        int64 responseCode;
        int64 serialId;
    }

    function _doMintViaHtsPrecompile(MintParams memory mintParams) internal setPranker(mintParams.sender) returns (MintResponse memory mintResponse) {

        HederaFungibleToken hederaFungibleToken = HederaFungibleToken(mintParams.token);
        HederaNonFungibleToken hederaNonFungibleToken = HederaNonFungibleToken(mintParams.token);

        bytes[] memory NULL_BYTES = new bytes[](1);

        int64 newTotalSupply;
        int64[] memory serialNumbers;
        int32 tokenType;

        int64 expectedResponseCode = HederaResponseCodes.SUCCESS; // assume SUCCESS initially and later overwrite error code accordingly

        MintKeys memory mintKeys = MintKeys({
            supplyKey: htsPrecompile.getKey(mintParams.token, KeyHelper.KeyType.SUPPLY),
            treasury: htsPrecompile.getTreasuryAccount(mintParams.token)
        });

        (mintResponse.responseCode, tokenType) = htsPrecompile.getTokenType(mintParams.token);

        mintResponse.success = mintResponse.responseCode == HederaResponseCodes.SUCCESS;

        if (tokenType == 1) {
            /// @dev since you can only mint one NFT at a time; also mintAmount is ONLY applicable to type FUNGIBLE
            mintParams.mintAmount = 1;
        }

        MintInfo memory preMintInfo = MintInfo({
            totalSupply: mintResponse.success ? (tokenType == 0 ? hederaFungibleToken.totalSupply() : hederaNonFungibleToken.totalSupply()) : 0,
            treasuryBalance: mintResponse.success ? (tokenType == 0 ? hederaFungibleToken.balanceOf(mintKeys.treasury) : hederaNonFungibleToken.totalSupply()) : 0,
            isFungible: tokenType == 0 ? true : false,
            isNonFungible: tokenType == 1 ? true : false,
            mintAmountU256: uint64(mintParams.mintAmount),
            mintCount: tokenType == 1 ? hederaNonFungibleToken.mintCount() : int64(0)
        });

        if (mintKeys.supplyKey != mintParams.sender) {
            expectedResponseCode = HederaResponseCodes.INVALID_SUPPLY_KEY;
        }

        if (mintKeys.supplyKey == ADDRESS_ZERO) {
            expectedResponseCode = HederaResponseCodes.TOKEN_HAS_NO_SUPPLY_KEY;
        }

        (mintResponse.responseCode, newTotalSupply, serialNumbers) = htsPrecompile.mintToken(mintParams.token, mintParams.mintAmount, NULL_BYTES);

        assertEq(expectedResponseCode, mintResponse.responseCode, 'expected response code does not equal actual response code');

        mintResponse.success = mintResponse.responseCode == HederaResponseCodes.SUCCESS;

        MintInfo memory postMintInfo = MintInfo({
            totalSupply: tokenType == 0 ? hederaFungibleToken.totalSupply() : hederaNonFungibleToken.totalSupply(),
            treasuryBalance: tokenType == 0 ? hederaFungibleToken.balanceOf(mintKeys.treasury) : hederaNonFungibleToken.totalSupply(),
            isFungible: tokenType == 0 ? true : false,
            isNonFungible: tokenType == 1 ? true : false,
            mintAmountU256: uint64(mintParams.mintAmount),
            mintCount: tokenType == 1 ? hederaNonFungibleToken.mintCount() : int64(0)
        });

        if (mintResponse.success) {

            assertEq(
                postMintInfo.totalSupply,
                uint64(newTotalSupply),
                'expected newTotalSupply to equal post mint totalSupply'
            );

            if (preMintInfo.isFungible) {

                assertEq(
                    preMintInfo.totalSupply + preMintInfo.mintAmountU256,
                    postMintInfo.totalSupply,
                    'expected total supply to increase by mint amount'
                );
                assertEq(
                    preMintInfo.treasuryBalance + preMintInfo.mintAmountU256,
                    postMintInfo.treasuryBalance,
                    'expected treasury balance to increase by mint amount'
                );
            }

            if (preMintInfo.isNonFungible) {
                assertEq(
                    preMintInfo.totalSupply + 1,
                    postMintInfo.totalSupply,
                    'expected total supply to increase by mint amount'
                );
                assertEq(
                    preMintInfo.treasuryBalance + 1,
                    postMintInfo.treasuryBalance,
                    'expected treasury balance to increase by mint amount'
                );

                assertEq(preMintInfo.mintCount + 1, postMintInfo.mintCount, "expected mintCount to increase by 1");
                assertEq(serialNumbers[0], postMintInfo.mintCount, "expected minted serialNumber to equal mintCount");

                mintResponse.serialId = serialNumbers[0];
            }
        }

        if (!mintResponse.success) {
            assertEq(
                preMintInfo.totalSupply,
                postMintInfo.totalSupply,
                'expected total supply to not change if failed'
            );
            assertEq(
                preMintInfo.treasuryBalance,
                postMintInfo.treasuryBalance,
                'expected treasury balance to not change if failed'
            );
        }
    }

    struct TransferParams {
        address sender;
        address token;
        address from;
        address to;
        uint256 amountOrSerialNumber; // amount for FUNGIBLE serialNumber for NON_FUNGIBLE
    }

    struct TransferInfo {
        // applicable to FUNGIBLE
        uint256 spenderAllowance;
        uint256 fromBalance;
        uint256 toBalance;
        // applicable to NON_FUNGIBLE
        address owner;
        address approvedId;
        bool isSenderOperator;
    }

    struct TransferChecks {
        bool isRecipientAssociated;
        bool isRequestFromOwner;
        int64 expectedResponseCode;
        bool isToken;
        int32 tokenType;
        bool isFungible;
        bool isNonFungible;
    }

    function _doTransferViaHtsPrecompile(
        TransferParams memory transferParams
    ) internal setPranker(transferParams.sender) returns (bool success, int64 responseCode) {
        HederaFungibleToken hederaFungibleToken = HederaFungibleToken(transferParams.token);
        HederaNonFungibleToken hederaNonFungibleToken = HederaNonFungibleToken(transferParams.token);

        TransferChecks memory transferChecks;
        TransferInfo memory preTransferInfo;

        transferChecks.expectedResponseCode = HederaResponseCodes.SUCCESS; // assume SUCCESS and overwrite with !SUCCESS where applicable

        (transferChecks.expectedResponseCode, transferChecks.tokenType) = htsPrecompile.getTokenType(transferParams.token);

        if (transferChecks.expectedResponseCode == HederaResponseCodes.SUCCESS) {
            transferChecks.isFungible = transferChecks.tokenType == 0 ? true : false;
            transferChecks.isNonFungible = transferChecks.tokenType == 1 ? true : false;
        }

        transferChecks.isRecipientAssociated = htsPrecompile.isAssociated(transferParams.to, transferParams.token);
        transferChecks.isRequestFromOwner = transferParams.sender == transferParams.from;

        if (transferChecks.isFungible) {
            preTransferInfo.spenderAllowance = hederaFungibleToken.allowance(transferParams.from, transferParams.sender);
            preTransferInfo.fromBalance = hederaFungibleToken.balanceOf(transferParams.from);
            preTransferInfo.toBalance = hederaFungibleToken.balanceOf(transferParams.to);
        }

        if (transferChecks.isNonFungible) {
            preTransferInfo.owner = hederaNonFungibleToken.ownerOf(transferParams.amountOrSerialNumber);
            preTransferInfo.approvedId = hederaNonFungibleToken.getApproved(transferParams.amountOrSerialNumber);
            preTransferInfo.isSenderOperator = hederaNonFungibleToken.isApprovedForAll(transferParams.from, transferParams.sender);
        }

        if (transferChecks.isRequestFromOwner) {
            if (transferChecks.isFungible) {
                if (preTransferInfo.fromBalance < transferParams.amountOrSerialNumber) {
                    transferChecks.expectedResponseCode = HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE;
                }
            }

            if (transferChecks.isNonFungible) {
                if (preTransferInfo.owner != transferParams.sender) {
                    transferChecks.expectedResponseCode = HederaResponseCodes.SENDER_DOES_NOT_OWN_NFT_SERIAL_NO;
                }
            }
        }

        if (!transferChecks.isRequestFromOwner) {
            if (transferChecks.isFungible) {
                if (preTransferInfo.spenderAllowance < transferParams.amountOrSerialNumber) {
                    transferChecks.expectedResponseCode = HederaResponseCodes.AMOUNT_EXCEEDS_ALLOWANCE;
                }
            }

            if (transferChecks.isNonFungible) {

                if (preTransferInfo.owner != transferParams.from) {
                    transferChecks.expectedResponseCode = HederaResponseCodes.INVALID_ALLOWANCE_OWNER_ID;
                }

                if (preTransferInfo.approvedId != transferParams.sender && !preTransferInfo.isSenderOperator) {
                    transferChecks.expectedResponseCode = HederaResponseCodes.SPENDER_DOES_NOT_HAVE_ALLOWANCE;
                }
            }
        }

        if (!transferChecks.isRecipientAssociated) {
            transferChecks.expectedResponseCode = HederaResponseCodes.TOKEN_NOT_ASSOCIATED_TO_ACCOUNT;
        }

        responseCode = htsPrecompile.transferFrom(
            transferParams.token,
            transferParams.from,
            transferParams.to,
            transferParams.amountOrSerialNumber
        );

        assertEq(
            transferChecks.expectedResponseCode,
            responseCode,
            'expected response code does not equal actual response code'
        );

        success = responseCode == HederaResponseCodes.SUCCESS;

        TransferInfo memory postTransferInfo;

        if (transferChecks.isFungible) {
            postTransferInfo.spenderAllowance = hederaFungibleToken.allowance(transferParams.from, transferParams.sender);
            postTransferInfo.fromBalance = hederaFungibleToken.balanceOf(transferParams.from);
            postTransferInfo.toBalance = hederaFungibleToken.balanceOf(transferParams.to);
        }

        if (transferChecks.isNonFungible) {
            postTransferInfo.owner = hederaNonFungibleToken.ownerOf(transferParams.amountOrSerialNumber);
            postTransferInfo.approvedId = hederaNonFungibleToken.getApproved(transferParams.amountOrSerialNumber);
            postTransferInfo.isSenderOperator = hederaNonFungibleToken.isApprovedForAll(transferParams.from, transferParams.sender);
        }

        if (success) {

            if (transferChecks.isFungible) {
                assertEq(
                    preTransferInfo.toBalance + transferParams.amountOrSerialNumber,
                    postTransferInfo.toBalance,
                    'to balance did not update correctly'
                );
                assertEq(
                    preTransferInfo.fromBalance - transferParams.amountOrSerialNumber,
                    postTransferInfo.fromBalance,
                    'from balance did not update correctly'
                );

                if (!transferChecks.isRequestFromOwner) {
                    assertEq(
                        preTransferInfo.spenderAllowance - transferParams.amountOrSerialNumber,
                        postTransferInfo.spenderAllowance,
                        'spender allowance did not update correctly'
                    );
                }
            }

            if (transferChecks.isNonFungible) {
                assertEq(postTransferInfo.owner, transferParams.to, "expected to to be new owner");
                assertEq(postTransferInfo.approvedId, ADDRESS_ZERO, "expected approvedId to be reset");
                assertEq(postTransferInfo.isSenderOperator, preTransferInfo.isSenderOperator, "operator should not have changed");
            }
        }

        if (!success) {

            if (transferChecks.isFungible) {
                assertEq(preTransferInfo.toBalance, postTransferInfo.toBalance, 'to balance changed unexpectedly');
                assertEq(preTransferInfo.fromBalance, postTransferInfo.fromBalance, 'from balance changed unexpectedly');

                if (!transferChecks.isRequestFromOwner) {
                    assertEq(
                        preTransferInfo.spenderAllowance,
                        postTransferInfo.spenderAllowance,
                        'spender allowance changed unexpectedly'
                    );
                }
            }

            if (transferChecks.isNonFungible) {
                assertEq(preTransferInfo.owner, postTransferInfo.owner, 'owner should not have changed on failure');
                assertEq(preTransferInfo.approvedId, postTransferInfo.approvedId, 'approvedId should not have changed on failure');
                assertEq(preTransferInfo.isSenderOperator, postTransferInfo.isSenderOperator, 'isSenderOperator should not have changed on failure');
            }
        }
    }

    function _doTransferDirectly(
        TransferParams memory transferParams
    ) internal setPranker(transferParams.sender) returns (bool success, int64 responseCode) {
        HederaFungibleToken hederaFungibleToken = HederaFungibleToken(transferParams.token);
        HederaNonFungibleToken hederaNonFungibleToken = HederaNonFungibleToken(transferParams.token);

        TransferChecks memory transferChecks;
        TransferInfo memory preTransferInfo;

        transferChecks.expectedResponseCode = HederaResponseCodes.SUCCESS; // assume SUCCESS and overwrite with !SUCCESS where applicable

        (transferChecks.expectedResponseCode, transferChecks.tokenType) = htsPrecompile.getTokenType(transferParams.token);

        if (transferChecks.expectedResponseCode == HederaResponseCodes.SUCCESS) {
            transferChecks.isFungible = transferChecks.tokenType == 0 ? true : false;
            transferChecks.isNonFungible = transferChecks.tokenType == 1 ? true : false;
        }

        transferChecks.isRecipientAssociated = htsPrecompile.isAssociated(transferParams.to, transferParams.token);
        transferChecks.isRequestFromOwner = transferParams.sender == transferParams.from;

        if (transferChecks.isFungible) {
            preTransferInfo.spenderAllowance = hederaFungibleToken.allowance(transferParams.from, transferParams.sender);
            preTransferInfo.fromBalance = hederaFungibleToken.balanceOf(transferParams.from);
            preTransferInfo.toBalance = hederaFungibleToken.balanceOf(transferParams.to);
        }

        if (transferChecks.isNonFungible) {
            preTransferInfo.owner = hederaNonFungibleToken.ownerOf(transferParams.amountOrSerialNumber);
            preTransferInfo.approvedId = hederaNonFungibleToken.getApproved(transferParams.amountOrSerialNumber);
            preTransferInfo.isSenderOperator = hederaNonFungibleToken.isApprovedForAll(transferParams.from, transferParams.sender);
        }

        if (transferChecks.isRequestFromOwner) {
            if (transferChecks.isFungible) {
                if (preTransferInfo.fromBalance < transferParams.amountOrSerialNumber) {
                    transferChecks.expectedResponseCode = HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE;
                }
            }

            if (transferChecks.isNonFungible) {
                if (preTransferInfo.owner != transferParams.sender) {
                    transferChecks.expectedResponseCode = HederaResponseCodes.SENDER_DOES_NOT_OWN_NFT_SERIAL_NO;
                }
            }
        }

        if (!transferChecks.isRequestFromOwner) {
            if (transferChecks.isFungible) {
                if (preTransferInfo.spenderAllowance < transferParams.amountOrSerialNumber) {
                    transferChecks.expectedResponseCode = HederaResponseCodes.AMOUNT_EXCEEDS_ALLOWANCE;
                }
            }

            if (transferChecks.isNonFungible) {

                if (preTransferInfo.owner != transferParams.from) {
                    transferChecks.expectedResponseCode = HederaResponseCodes.INVALID_ALLOWANCE_OWNER_ID;
                }

                if (preTransferInfo.approvedId != transferParams.sender && !preTransferInfo.isSenderOperator) {
                    transferChecks.expectedResponseCode = HederaResponseCodes.SPENDER_DOES_NOT_HAVE_ALLOWANCE;
                }
            }
        }

        if (!transferChecks.isRecipientAssociated) {
            transferChecks.expectedResponseCode = HederaResponseCodes.TOKEN_NOT_ASSOCIATED_TO_ACCOUNT;
        }

        if (transferChecks.expectedResponseCode != HederaResponseCodes.SUCCESS) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    HederaFungibleToken.HtsPrecompileError.selector,
                    transferChecks.expectedResponseCode
                )
            );
        }

        if (transferChecks.isRequestFromOwner) {
            if (transferChecks.isFungible) {
                hederaFungibleToken.transfer(transferParams.to, transferParams.amountOrSerialNumber);
            }
            if (transferChecks.isNonFungible) {
                hederaNonFungibleToken.transferFrom(transferParams.from, transferParams.to, transferParams.amountOrSerialNumber);
            }
        }

        if (!transferChecks.isRequestFromOwner) {
            if (transferChecks.isFungible) {
                hederaFungibleToken.transferFrom(transferParams.from, transferParams.to, transferParams.amountOrSerialNumber);
            }
            if (transferChecks.isNonFungible) {
                hederaNonFungibleToken.transferFrom(transferParams.from, transferParams.to, transferParams.amountOrSerialNumber);
            }
        }

        if (transferChecks.expectedResponseCode == HederaResponseCodes.SUCCESS) {
            success = true;
        }

        TransferInfo memory postTransferInfo;

        if (transferChecks.isFungible) {
            postTransferInfo.spenderAllowance = hederaFungibleToken.allowance(transferParams.from, transferParams.sender);
            postTransferInfo.fromBalance = hederaFungibleToken.balanceOf(transferParams.from);
            postTransferInfo.toBalance = hederaFungibleToken.balanceOf(transferParams.to);
        }

        if (transferChecks.isNonFungible) {
            postTransferInfo.owner = hederaNonFungibleToken.ownerOf(transferParams.amountOrSerialNumber);
            postTransferInfo.approvedId = hederaNonFungibleToken.getApproved(transferParams.amountOrSerialNumber);
            postTransferInfo.isSenderOperator = hederaNonFungibleToken.isApprovedForAll(transferParams.from, transferParams.sender);
        }

        if (success) {
            if (transferChecks.isFungible) {
                assertEq(
                    preTransferInfo.toBalance + transferParams.amountOrSerialNumber,
                    postTransferInfo.toBalance,
                    'to balance did not update correctly'
                );
                assertEq(
                    preTransferInfo.fromBalance - transferParams.amountOrSerialNumber,
                    postTransferInfo.fromBalance,
                    'from balance did not update correctly'
                );

                if (!transferChecks.isRequestFromOwner) {
                    assertEq(
                        preTransferInfo.spenderAllowance - transferParams.amountOrSerialNumber,
                        postTransferInfo.spenderAllowance,
                        'spender allowance did not update correctly'
                    );
                }
            }

            if (transferChecks.isNonFungible) {
                assertEq(postTransferInfo.owner, transferParams.to, "expected to to be new owner");
                assertEq(postTransferInfo.approvedId, ADDRESS_ZERO, "expected approvedId to be reset");
                assertEq(postTransferInfo.isSenderOperator, preTransferInfo.isSenderOperator, "operator should not have changed");
            }
        }

        if (!success) {
            if (transferChecks.isFungible) {
                assertEq(preTransferInfo.toBalance, postTransferInfo.toBalance, 'to balance changed unexpectedly');
                assertEq(preTransferInfo.fromBalance, postTransferInfo.fromBalance, 'from balance changed unexpectedly');

                if (!transferChecks.isRequestFromOwner) {
                    assertEq(
                        preTransferInfo.spenderAllowance,
                        postTransferInfo.spenderAllowance,
                        'spender allowance changed unexpectedly'
                    );
                }
            }

            if (transferChecks.isNonFungible) {
                assertEq(preTransferInfo.owner, postTransferInfo.owner, 'owner should not have changed on failure');
                assertEq(preTransferInfo.approvedId, postTransferInfo.approvedId, 'approvedId should not have changed on failure');
                assertEq(preTransferInfo.isSenderOperator, postTransferInfo.isSenderOperator, 'isSenderOperator should not have changed on failure');
            }
        }
    }

    struct BurnParams {
        address sender;
        address token;
        int64 amountOrSerialNumber;
    }

    struct BurnChecks {
        bool isToken;
        int32 tokenType;
        bool isFungible;
        bool isNonFungible;
        uint256 amountOrSerialNumberU256;
        int64 expectedResponseCode;
    }

    struct BurnInfo {
        address owner;
        uint256 totalSupply;
        uint256 treasuryBalance;
    }

    function _doBurnViaHtsPrecompile(BurnParams memory burnParams) internal setPranker(burnParams.sender) returns (bool success, int64 responseCode) {

        HederaFungibleToken hederaFungibleToken = HederaFungibleToken(burnParams.token);
        HederaNonFungibleToken hederaNonFungibleToken = HederaNonFungibleToken(burnParams.token);

        BurnChecks memory burnChecks;

        bytes[] memory NULL_BYTES = new bytes[](1);

        int64 newTotalSupply;
        int64[] memory serialNumbers = new int64[](1); // this test function currently only supports 1 NFT being burnt at a time

        burnChecks.amountOrSerialNumberU256 = uint64(burnParams.amountOrSerialNumber);
        burnChecks.expectedResponseCode = HederaResponseCodes.SUCCESS; // assume SUCCESS initially and later overwrite error code accordingly

        burnChecks.expectedResponseCode = HederaResponseCodes.SUCCESS; // assume SUCCESS and overwrite with !SUCCESS where applicable

        (burnChecks.expectedResponseCode, burnChecks.tokenType) = htsPrecompile.getTokenType(burnParams.token);

        if (burnChecks.expectedResponseCode == HederaResponseCodes.SUCCESS) {
            burnChecks.isFungible = burnChecks.tokenType == 0 ? true : false;
            burnChecks.isNonFungible = burnChecks.tokenType == 1 ? true : false;
        }

        address treasury = htsPrecompile.getTreasuryAccount(burnParams.token);

        BurnInfo memory preBurnInfo;

        preBurnInfo.totalSupply = hederaFungibleToken.totalSupply();
        preBurnInfo.treasuryBalance = hederaFungibleToken.balanceOf(treasury);

        if (burnChecks.isNonFungible) {
            // amount is only applicable to type FUNGIBLE
            serialNumbers[0] = burnParams.amountOrSerialNumber; // only burn 1 NFT at a time
            preBurnInfo.owner = hederaNonFungibleToken.ownerOf(burnChecks.amountOrSerialNumberU256);
            burnParams.amountOrSerialNumber = 0;

            if (burnParams.sender != preBurnInfo.owner) {
                burnChecks.expectedResponseCode = HederaResponseCodes.SENDER_DOES_NOT_OWN_NFT_SERIAL_NO;
            }
        }

        if (treasury != burnParams.sender) {
            burnChecks.expectedResponseCode = HederaResponseCodes.AUTHORIZATION_FAILED;
        }

        (responseCode, newTotalSupply) = htsPrecompile.burnToken(burnParams.token, burnParams.amountOrSerialNumber, serialNumbers);

        assertEq(burnChecks.expectedResponseCode, responseCode, 'expected response code does not equal actual response code');

        success = responseCode == HederaResponseCodes.SUCCESS;

        BurnInfo memory postBurnInfo;

        postBurnInfo.totalSupply = hederaFungibleToken.totalSupply();
        postBurnInfo.treasuryBalance = hederaFungibleToken.balanceOf(treasury);

        if (success) {
            if (burnChecks.isFungible) {
                assertEq(
                    preBurnInfo.totalSupply - burnChecks.amountOrSerialNumberU256,
                    postBurnInfo.totalSupply,
                    'expected total supply to decrease by burn amount'
                );
                assertEq(
                    preBurnInfo.treasuryBalance - burnChecks.amountOrSerialNumberU256,
                    postBurnInfo.treasuryBalance,
                    'expected treasury balance to decrease by burn amount'
                );
            }

            if (burnChecks.isNonFungible) {
                assertEq(
                    preBurnInfo.totalSupply - 1,
                    postBurnInfo.totalSupply,
                    'expected total supply to decrease by burn amount'
                );
                assertEq(
                    preBurnInfo.treasuryBalance - 1,
                    postBurnInfo.treasuryBalance,
                    'expected treasury balance to decrease by burn amount'
                );
            }
        }

        if (!success) {
            assertEq(
                preBurnInfo.totalSupply,
                postBurnInfo.totalSupply,
                'expected total supply to not change if failed'
            );
            assertEq(
                preBurnInfo.treasuryBalance,
                postBurnInfo.treasuryBalance,
                'expected treasury balance to not change if failed'
            );
        }
    }

}
