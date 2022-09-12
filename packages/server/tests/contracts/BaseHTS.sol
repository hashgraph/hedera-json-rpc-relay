// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./FeeHelper.sol";

contract BaseHTS is FeeHelper {

    string name = "tokenName";
    string symbol = "tokenSymbol";
    string memo = "memo";
    uint64 initialTotalSupply = 1000;
    int64 maxSupply = 1000;
    uint32 decimals = 8;
    bool freezeDefaultStatus = false;

    event CreatedToken(address tokenAddress);
    event DefaultFreezeStatusChanged(bool freezeStatus);
    event AllowanceValue(uint256 amount);
    event ResponseCode(int responseCode);
    event ApprovedAddress(address approved);
    event Approved(bool approved);
    event FungibleTokenInfo(IHederaTokenService.FungibleTokenInfo tokenInfo);
    event TokenInfo(IHederaTokenService.TokenInfo tokenInfo);
    event NonFungibleTokenInfo(IHederaTokenService.NonFungibleTokenInfo tokenInfo);
    event MintedToken(uint64 newTotalSupply, int64[] serialNumbers);
    event Frozen(bool frozen);
    event PausedToken(bool paused);
    event UnpausedToken(bool unpaused);
    event TokenCustomFees(IHederaTokenService.FixedFee[] fixedFees, IHederaTokenService.FractionalFee[] fractionalFees, IHederaTokenService.RoyaltyFee[] royaltyFees);
    event TokenDefaultFreezeStatus(bool defaultFreezeStatus);
    event TokenDefaultKycStatus(bool defaultKycStatus);
    event KycGranted(bool kycGranted);
    event TokenExpiryInfo(IHederaTokenService.Expiry expiryInfo);

    function createFungibleTokenPublic(
        address treasury
    ) public payable {
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](4);
        keys[0] = getSingleKey(0, 6, 1, bytes(""));
        keys[1] = getSingleKey(1, 1, bytes(""));
        keys[2] = getSingleKey(2, 1, bytes(""));
        keys[3] = getSingleKey(3, 1, bytes(""));

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

    function createNonFungibleTokenPublic(
        address treasury
    ) public payable {
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](5);
        keys[0] = getSingleKey(0, 6, 1, bytes(""));
        keys[1] = getSingleKey(1, 1, bytes(""));
        keys[2] = getSingleKey(2, 1, bytes(""));
        keys[3] = getSingleKey(4, 1, bytes(""));
        keys[4] = getSingleKey(3, 1, bytes(""));

        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, treasury, 8000000
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, treasury, memo, true, maxSupply, freezeDefaultStatus, keys, expiry
        );

        (int responseCode, address tokenAddress) =
        HederaTokenService.createNonFungibleToken(token);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }

        emit CreatedToken(tokenAddress);
    }

    function setFreezeDefaultStatus(bool newFreezeStatus) public {
        freezeDefaultStatus = newFreezeStatus;

        emit DefaultFreezeStatusChanged(freezeDefaultStatus);
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

    function approveNFTPublic(address token, address approved, uint256 serialNumber) public returns (int responseCode)
    {
        responseCode = HederaTokenService.approveNFT(token, approved, serialNumber);

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

    function cryptoTransferTokenPublic(address account, address token, int64 amount) public returns (int responseCode) {
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

    function transferTokenPublic(address token, address sender, address receiver, int64 amount) public returns (int responseCode) {
        responseCode = HederaTokenService.transferToken(token, sender, receiver, amount);
        emit ResponseCode(responseCode);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }
    }

    function cryptoTransferPublic(IHederaTokenService.TokenTransferList[] calldata tokenTransferList) public returns (int responseCode) {
        responseCode = HederaTokenService.cryptoTransfer(tokenTransferList);
        emit ResponseCode(responseCode);
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

    function wipeTokenAccountPublic(address token, address account, uint32 amount) public returns (int responseCode)
    {
        responseCode = HederaTokenService.wipeTokenAccount(token, account, amount);
        emit ResponseCode(responseCode);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
    }

    function wipeTokenAccountNFTPublic(address token, address account, int64[] memory serialNumbers) public
    returns (int responseCode)
    {
        responseCode = HederaTokenService.wipeTokenAccountNFT(token, account, serialNumbers);
        emit ResponseCode(responseCode);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
    }

    function transferNFTPublic(address token, address sender, address receiver, int64 serialNumber) public
    returns (int responseCode)
    {
        responseCode = HederaTokenService.transferNFT(token, sender, receiver, serialNumber);
        emit ResponseCode(responseCode);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
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

    function freezeTokenPublic(address token, address account) public returns (int responseCode) {
        responseCode = HederaTokenService.freezeToken(token, account);
        emit ResponseCode(responseCode);
        if(responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }
    }

    function unfreezeTokenPublic(address token, address account) public returns (int responseCode) {
        responseCode = HederaTokenService.unfreezeToken(token, account);
        emit ResponseCode(responseCode);
        if(responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }
    }

    function isFrozenPublic(address token, address account) public returns (int responseCode, bool frozen) {
        (responseCode, frozen) = HederaTokenService.isFrozen(token, account);
        emit ResponseCode(responseCode);
        if(responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }
        emit Frozen(frozen);
    }

    function pauseTokenPublic(address token) public returns (int responseCode) {
        responseCode = this.pauseToken(token);

        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit PausedToken(true);
    }

    function unpauseTokenPublic(address token) public returns (int responseCode) {
        responseCode = this.unpauseToken(token);

        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit UnpausedToken(true);
    }

    function createFungibleTokenWithCustomFeesPublic(
        address treasury,
        address fixedFeeTokenAddress
    ) public payable {
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = getSingleKey(0, 0, 1, bytes(""));

        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, treasury, 8000000
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, treasury, memo, true, maxSupply, false, keys, expiry
        );

        IHederaTokenService.FixedFee[] memory fixedFees = new IHederaTokenService.FixedFee[](1);
        fixedFees[0] = IHederaTokenService.FixedFee(1, fixedFeeTokenAddress, false, false, treasury);

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

    function getTokenCustomFeesPublic(address token) public returns (
        int64 responseCode,
        IHederaTokenService.FixedFee[] memory fixedFees,
        IHederaTokenService.FractionalFee[] memory fractionalFees,
        IHederaTokenService.RoyaltyFee[] memory royaltyFees) {
        (responseCode, fixedFees, fractionalFees, royaltyFees) = HederaTokenService.getTokenCustomFees(token);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit TokenCustomFees(fixedFees, fractionalFees, royaltyFees);
    }

    function getTokenDefaultFreezeStatusPublic(address token) public returns (int responseCode, bool defaultFreezeStatus) {
        (responseCode, defaultFreezeStatus) = HederaTokenService.getTokenDefaultFreezeStatus(token);

        emit ResponseCode(responseCode);

        if(responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit TokenDefaultFreezeStatus(defaultFreezeStatus);
    }

    function deleteTokenPublic(address token) public returns (int responseCode) {
        responseCode = HederaTokenService.deleteToken(token);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }
    }

    function getTokenDefaultKycStatusPublic(address token) public returns (int responseCode, bool defaultKycStatus) {
        (responseCode, defaultKycStatus) = HederaTokenService.getTokenDefaultKycStatus(token);

        emit ResponseCode(responseCode);

        if(responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit TokenDefaultKycStatus(defaultKycStatus);
    }

    function isKycPublic(address token, address account)external returns (int64 responseCode, bool kycGranted){
        (responseCode, kycGranted) = this.isKyc(token, account);

        emit ResponseCode(responseCode);

        if(responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit KycGranted(kycGranted);
    }

    function grantTokenKycPublic(address token, address account)external returns (int64 responseCode){
        (responseCode) = this.grantTokenKyc(token, account);

        emit ResponseCode(responseCode);

        if(responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }
    }

    function revokeTokenKycPublic(address token, address account)external returns (int64 responseCode){
        (responseCode) = this.revokeTokenKyc(token, account);

        emit ResponseCode(responseCode);

        if(responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }
    }

    function getTokenExpiryInfoPublic(address token)external returns (int responseCode, IHederaTokenService.Expiry memory expiryInfo){
        (responseCode, expiryInfo) = this.getTokenExpiryInfo(token);

        emit ResponseCode(responseCode);

        if(responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit TokenExpiryInfo(expiryInfo);
    }

    function updateTokenExpiryInfoPublic(address token, IHederaTokenService.Expiry memory expiryInfo)external returns (int responseCode){
        (responseCode) = this.updateTokenExpiryInfo(token, expiryInfo);

        emit ResponseCode(responseCode);

        if(responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }
    }
}