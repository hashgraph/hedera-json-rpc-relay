// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import 'openzeppelin-contracts/contracts/token/ERC20/ERC20.sol';

import 'hedera-smart-contracts/hts-precompile/HederaResponseCodes.sol';
import 'hedera-smart-contracts/hts-precompile/IHederaTokenService.sol';
import './HtsPrecompileMock.sol';
import '../../libraries/Constants.sol';

contract HederaFungibleToken is ERC20, Constants {
    error HtsPrecompileError(int64 responseCode);
    HtsPrecompileMock internal constant HtsPrecompile = HtsPrecompileMock(HTS_PRECOMPILE);

    bool public constant IS_FUNGIBLE = true; /// @dev if HederaNonFungibleToken then false
    uint8 internal immutable _decimals;

    constructor(
        IHederaTokenService.FungibleTokenInfo memory _fungibleTokenInfo
    ) ERC20(_fungibleTokenInfo.tokenInfo.token.name, _fungibleTokenInfo.tokenInfo.token.symbol) {
        HtsPrecompile.registerHederaFungibleToken(msg.sender, _fungibleTokenInfo);
        _decimals = uint8(uint32(_fungibleTokenInfo.decimals));
        address treasury = _fungibleTokenInfo.tokenInfo.token.treasury;
        _mint(treasury, uint(uint64(_fungibleTokenInfo.tokenInfo.totalSupply)));
    }

    /// @dev the HtsPrecompileMock should do precheck validation before calling any function with this modifier
    ///      the HtsPrecompileMock has priveleged access to do certain operations
    modifier onlyHtsPrecompile() {
        require(msg.sender == HTS_PRECOMPILE, 'NOT_HTS_PRECOMPILE');
        _;
    }

    // public/external state-changing functions:
    // onlyHtsPrecompile functions:
    /// @dev mints "amount" to treasury
    function mintRequestFromHtsPrecompile(int64 amount) external onlyHtsPrecompile {
        (, IHederaTokenService.FungibleTokenInfo memory fungibleTokenInfo) = HtsPrecompile.getFungibleTokenInfo(
            address(this)
        );
        address treasury = fungibleTokenInfo.tokenInfo.token.treasury;
        _mint(treasury, uint64(amount));
    }

    /// @dev burns "amount" from treasury
    function burnRequestFromHtsPrecompile(int64 amount) external onlyHtsPrecompile {
        (, IHederaTokenService.FungibleTokenInfo memory fungibleTokenInfo) = HtsPrecompile.getFungibleTokenInfo(
            address(this)
        );
        address treasury = fungibleTokenInfo.tokenInfo.token.treasury;
        _burn(treasury, uint64(amount));
    }

    /// @dev transfers "amount" from "from" to "to"
    function transferRequestFromHtsPrecompile(bool isRequestFromOwner, address spender, address from, address to, uint256 amount) external onlyHtsPrecompile returns (int64 responseCode) {
        if (!isRequestFromOwner) {
            _spendAllowance(from, spender, amount);
        }
        _transfer(from, to, amount);

        return HederaResponseCodes.SUCCESS;
    }

    /// @dev gives "spender" an allowance of "amount" for "account"
    function approveRequestFromHtsPrecompile(
        address account,
        address spender,
        uint256 amount
    ) external onlyHtsPrecompile {
        _approve(account, spender, amount);
    }

    // standard ERC20 functions overriden for HtsPrecompileMock prechecks:
    function approve(address spender, uint256 amount) public override returns (bool) {
        int64 responseCode = HtsPrecompile.preApprove(msg.sender, spender, amount);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert HtsPrecompileError(responseCode);
        }
        return super.approve(spender, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        int64 responseCode = HtsPrecompile.preTransfer(msg.sender, from, to, amount);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert HtsPrecompileError(responseCode);
        }
        return super.transferFrom(from, to, amount);
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        int64 responseCode = HtsPrecompile.preTransfer(ADDRESS_ZERO, msg.sender, to, amount);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert HtsPrecompileError(responseCode);
        }
        return super.transfer(to, amount);
    }

    // standard ERC20 overriden functions
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
