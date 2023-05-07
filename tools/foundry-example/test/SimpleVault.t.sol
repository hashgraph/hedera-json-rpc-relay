// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import 'openzeppelin-contracts/contracts/token/ERC20/ERC20.sol';

import "../src/SimpleVault.sol";
import { ExchangeRateUtils } from './utils/ExchangeRateUtils.sol';
import { HederaTokenUtils } from './utils/HederaTokenUtils.sol';
import { HederaFungibleTokenUtils } from './utils/HederaFungibleTokenUtils.sol';

contract SimpleVaultTest is HederaFungibleTokenUtils, ExchangeRateUtils {

    SimpleVault public simpleVault;
    address public simpleVaultAddress;
    address tokenA;
    address tokenB;

    // setUp is executed before each and every test function
    function setUp() public {
        _setUpHtsPrecompileMock();
        _setUpExchangeRatePrecompileMock();
        _setUpAccounts();

        simpleVault = new SimpleVault();
        simpleVaultAddress = address(simpleVault);

        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](0);
        tokenA = _createSimpleMockFungibleToken(alice, keys);
        tokenB = _createSimpleMockFungibleToken(alice, keys);
    }

    function _depositToSimpleVault(address sender, address token, uint64 amount) internal {

        vm.startPrank(sender, sender);

        uint amountU256 = uint(amount);

        ERC20 erc20Token = ERC20(token);

        uint senderStartingTokenBalance = erc20Token.balanceOf(sender);
        uint senderStartingVaultBalance = simpleVault.vaultBalances(token, sender);

        simpleVault.deposit{value: 2e8}(token, amount);

        uint senderFinalTokenBalance = erc20Token.balanceOf(sender);
        uint senderFinalVaultBalance = simpleVault.vaultBalances(token, sender);

        assertEq(senderStartingTokenBalance - amountU256, senderFinalTokenBalance, "expected spender token balance to decrease after deposit");
        assertEq(senderStartingVaultBalance + amountU256, senderFinalVaultBalance, "expected spender vault balance to increase after deposit");

        vm.stopPrank();

    }

    function _withdrawFromSimpleVault(address sender, address token, uint64 amount) internal {

        vm.startPrank(sender, sender);

        uint amountU256 = uint(amount);

        ERC20 erc20Token = ERC20(token);

        uint senderStartingTokenBalance = erc20Token.balanceOf(sender);
        uint senderStartingVaultBalance = simpleVault.vaultBalances(token, sender);

        simpleVault.withdraw{value: 1e8}(token, amount);

        uint senderFinalTokenBalance = erc20Token.balanceOf(sender);
        uint senderFinalVaultBalance = simpleVault.vaultBalances(token, sender);

        assertEq(senderStartingTokenBalance + amountU256, senderFinalTokenBalance, "expected spender token balance to increase after withdraw");
        assertEq(senderStartingVaultBalance - amountU256, senderFinalVaultBalance, "expected spender vault balance to decrease after withdraw");

        vm.stopPrank();

    }

    struct DepositAndWithdrawParams {
        address sender;
        address depositToken;
        uint64 depositAmount;
        address withdrawToken;
        uint64 withdrawAmount;
    }

    function _depositAndWithdraw(DepositAndWithdrawParams memory depositAndWithdrawParams) internal {

        vm.startPrank(depositAndWithdrawParams.sender, depositAndWithdrawParams.sender);

        uint depositAmountU256 = uint(depositAndWithdrawParams.depositAmount);
        uint withdrawAmountU256 = uint(depositAndWithdrawParams.withdrawAmount);

        ERC20 erc20DepositToken = ERC20(depositAndWithdrawParams.depositToken);
        ERC20 erc20WithdrawToken = ERC20(depositAndWithdrawParams.withdrawToken);

        uint senderStartingDepositTokenBalance = erc20DepositToken.balanceOf(depositAndWithdrawParams.sender);
        uint senderStartingDepositVaultBalance = simpleVault.vaultBalances(depositAndWithdrawParams.depositToken, depositAndWithdrawParams.sender);

        uint senderStartingWithdrawTokenBalance = erc20WithdrawToken.balanceOf(depositAndWithdrawParams.sender);
        uint senderStartingWithdrawVaultBalance = simpleVault.vaultBalances(depositAndWithdrawParams.withdrawToken, depositAndWithdrawParams.sender);

        simpleVault.depositAndWithdraw{value: 3e8}(depositAndWithdrawParams.depositToken, depositAndWithdrawParams.depositAmount, depositAndWithdrawParams.withdrawToken, depositAndWithdrawParams.withdrawAmount);

        uint senderFinalDepositTokenBalance = erc20DepositToken.balanceOf(depositAndWithdrawParams.sender);
        uint senderFinalDepositVaultBalance = simpleVault.vaultBalances(depositAndWithdrawParams.depositToken, depositAndWithdrawParams.sender);

        uint senderFinalWithdrawTokenBalance = erc20WithdrawToken.balanceOf(depositAndWithdrawParams.sender);
        uint senderFinalWithdrawVaultBalance = simpleVault.vaultBalances(depositAndWithdrawParams.withdrawToken, depositAndWithdrawParams.sender);

        assertEq(senderStartingDepositTokenBalance - depositAmountU256, senderFinalDepositTokenBalance, "expected spender token balance to decrease after deposit");
        assertEq(senderStartingDepositVaultBalance + depositAmountU256, senderFinalDepositVaultBalance, "expected spender vault balance to increase after deposit");

        assertEq(senderStartingWithdrawTokenBalance + withdrawAmountU256, senderFinalWithdrawTokenBalance, "expected spender token balance to increase after withdraw");
        assertEq(senderStartingWithdrawVaultBalance - withdrawAmountU256, senderFinalWithdrawVaultBalance, "expected spender vault balance to decrease after withdraw");

        vm.stopPrank();

    }

    // positive cases:
    function test_Deposit() public {

        address token = tokenA;
        _doAssociateViaHtsPrecompile(bob, token);

        uint amount = 1e6;

        TransferParams memory transferParams;

        transferParams = TransferParams({
            sender: alice,
            token: token,
            from: alice,
            to: bob,
            amountOrSerialNumber: amount
        });

        _doTransferDirectly(transferParams);

        _doAssociateViaHtsPrecompile(simpleVaultAddress, token);

        _doApproveDirectly(bob, token, simpleVaultAddress, amount);

        amount = 1e4;
        _depositToSimpleVault(bob, token, uint64(amount));

    }

    function test_Withdraw() public {
        address token = tokenA;

        _doAssociateViaHtsPrecompile(bob, token);

        uint amount = 1e6;
        TransferParams memory transferParams;

        transferParams = TransferParams({
            sender: alice,
            token: token,
            from: alice,
            to: bob,
            amountOrSerialNumber: amount
        });

        _doTransferDirectly(transferParams);

        _doAssociateViaHtsPrecompile(simpleVaultAddress, token);

        _doApproveDirectly(bob, token, simpleVaultAddress, amount);

        _depositToSimpleVault(bob, token, uint64(amount)); // first deposit before withdraw

        uint withdrawAmount = 1e4;

        _withdrawFromSimpleVault(bob, token, uint64(withdrawAmount));
    }

    function test_DepositAndWithdraw() public {
        address depositToken = tokenA;
        address withdrawToken = tokenB;

        _doAssociateViaHtsPrecompile(bob, depositToken);
        _doAssociateViaHtsPrecompile(bob, withdrawToken);

        uint amount = 1e6;

        TransferParams memory transferParams;

        transferParams = TransferParams({
            sender: alice,
            token: depositToken,
            from: alice,
            to: bob,
            amountOrSerialNumber: amount
        });

        _doTransferDirectly(transferParams);

        transferParams = TransferParams({
            sender: alice,
            token: withdrawToken,
            from: alice,
            to: bob,
            amountOrSerialNumber: amount
        });

        _doTransferDirectly(transferParams);

        _doAssociateViaHtsPrecompile(simpleVaultAddress, depositToken);
        _doAssociateViaHtsPrecompile(simpleVaultAddress, withdrawToken);

        _doApproveDirectly(bob, depositToken, simpleVaultAddress, 1e18);
        _doApproveDirectly(bob, withdrawToken, simpleVaultAddress, 1e18);

        _depositToSimpleVault(bob, withdrawToken, uint64(amount)); // first deposit before withdraw

        uint depositAmount = 1e4;
        uint withdrawAmount = 1e4;
        DepositAndWithdrawParams memory depositAndWithdrawParams = DepositAndWithdrawParams({
            sender: bob,
            depositToken: depositToken,
            depositAmount: uint64(depositAmount),
            withdrawToken: withdrawToken,
            withdrawAmount: uint64(withdrawAmount)
        });

        _depositAndWithdraw(depositAndWithdrawParams);
    }

    // negative cases:
    function test_CannotDepositIfNotAssociated() public {
    }

    function test_CannotWithdrawIfNotAssociated() public {
    }
}

// forge test --match-contract SimpleVaultTest --match-test test_Withdraw -vv