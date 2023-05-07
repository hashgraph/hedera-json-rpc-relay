// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import 'openzeppelin-contracts/contracts/token/ERC721/ERC721.sol';

import 'hedera-smart-contracts/hts-precompile/HederaResponseCodes.sol';
import 'hedera-smart-contracts/hts-precompile/IHederaTokenService.sol';
import './HtsPrecompileMock.sol';
import '../../libraries/Constants.sol';

contract HederaNonFungibleToken is ERC721, Constants {
    error HtsPrecompileError(int64 responseCode);

    HtsPrecompileMock internal constant HtsPrecompile = HtsPrecompileMock(HTS_PRECOMPILE);

    bool public constant IS_FUNGIBLE = false; /// @dev if HederaFungibleToken then true

    struct NFTCounter {
        int64 minted;
        int64 burned;
    }

    NFTCounter internal nftCount;

    /// @dev NonFungibleTokenInfo is for each NFT(with a unique serial number) that is minted; however TokenInfo covers the common token info across all instances
    constructor(
        IHederaTokenService.TokenInfo memory _nftTokenInfo
    ) ERC721(_nftTokenInfo.token.name, _nftTokenInfo.token.symbol) {
        address sender = msg.sender;
        HtsPrecompile.registerHederaNonFungibleToken(sender, _nftTokenInfo);
    }

    /// @dev the HtsPrecompileMock should do precheck validation before calling any function with this modifier
    ///      the HtsPrecompileMock has priveleged access to do certain operations
    modifier onlyHtsPrecompile() {
        require(msg.sender == HTS_PRECOMPILE, 'NOT_HTS_PRECOMPILE');
        _;
    }

    // public/external state-changing functions:
    // onlyHtsPrecompile functions:
    function mintRequestFromHtsPrecompile(
        bytes[] memory metadata
    ) external onlyHtsPrecompile returns (int64 newTotalSupply, int64 serialNumber) {
        (, IHederaTokenService.TokenInfo memory nftTokenInfo) = HtsPrecompile.getTokenInfo(
            address(this)
        );
        address treasury = nftTokenInfo.token.treasury;

        serialNumber = ++nftCount.minted; // the first nft that is minted has serialNumber: 1
        _mint(treasury, uint64(serialNumber));

        newTotalSupply = int64(int256(totalSupply()));
    }

    function burnRequestFromHtsPrecompile(
        int64[] calldata tokenIds
    ) external onlyHtsPrecompile returns (int64 newTotalSupply) {
        int64 burnCount = int64(uint64(tokenIds.length));
        nftCount.burned = nftCount.burned + burnCount;

        for (uint256 i = 0; i < uint64(burnCount); i++) {
            uint256 tokenId = uint64(tokenIds[i]);
            _burn(tokenId);
        }

        newTotalSupply = int64(int256(totalSupply()));
    }

    /// @dev transfers "amount" from "from" to "to"
    function transferRequestFromHtsPrecompile(
        bool isRequestFromOwner,
        address spender,
        address from,
        address to,
        uint256 tokenId
    ) external onlyHtsPrecompile returns (int64 responseCode) {
        bool isSpenderApproved = _isApprovedOrOwner(spender, tokenId);
        if (!isSpenderApproved) {
            return HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE;
        }

        _transfer(from, to, tokenId);
        responseCode = HederaResponseCodes.SUCCESS;
        // if (getApproved(tokenId) == spender) {
        //     _transfer(from, to, tokenId);
        //     responseCode = HederaResponseCodes.SUCCESS;
        // } else {
        //     responseCode = HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE;
        // }
    }

    /// @dev unlike fungible/ERC20 tokens this only allows for a single spender to be approved at any one time
    function approveRequestFromHtsPrecompile(address spender, int64 tokenId) external onlyHtsPrecompile {
        _approve(spender, uint64(tokenId));
    }

    function setApprovalForAllFromHtsPrecompile(
        address owner,
        address operator,
        bool approved
    ) external onlyHtsPrecompile {
        _setApprovalForAll(owner, operator, approved);
    }

    // standard ERC721 functions overriden for HtsPrecompileMock prechecks:
    function approve(address to, uint256 tokenId) public override {
        address sender = msg.sender;
        address spender = to;
        int64 responseCode = HtsPrecompile.preApprove(sender, spender, tokenId);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert HtsPrecompileError(responseCode);
        }

        // TODO: do checks on approval prior to calling approval to avoid reverting with the OpenZeppelin error strings
        // this checks can be done in the HtsPrecompile.pre{Action} functions and ultimately in the _precheck{Action} internal functions
        return super.approve(to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) public override {
        address sender = msg.sender;
        int64 responseCode = HtsPrecompile.preSetApprovalForAll(sender, operator, approved);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert HtsPrecompileError(responseCode);
        }
        return super.setApprovalForAll(operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public override {
        address sender = msg.sender;
        int64 responseCode = HtsPrecompile.preTransfer(sender, from, to, tokenId);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert HtsPrecompileError(responseCode);
        }
        return super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public override {
        address sender = msg.sender;
        int64 responseCode = HtsPrecompile.preTransfer(sender, from, to, tokenId);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert HtsPrecompileError(responseCode);
        }
        return super.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override {
        address sender = msg.sender;
        int64 responseCode = HtsPrecompile.preTransfer(sender, from, to, tokenId);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert HtsPrecompileError(responseCode);
        }
        return super.safeTransferFrom(from, to, tokenId, data);
    }

    // Additional(not in IHederaTokenService or in IERC721) public/external view functions:
    function totalSupply() public view returns (uint256) {
        return uint64(nftCount.minted - nftCount.burned);
    }

    function isApprovedOrOwner(address spender, uint256 tokenId) external view returns (bool) {
        return _isApprovedOrOwner(spender, tokenId);
    }

    function mintCount() external view returns (int64 minted) {
        minted = nftCount.minted;
    }

    function burnCount() external view returns (int64 burned) {
        burned = nftCount.burned;
    }

}
