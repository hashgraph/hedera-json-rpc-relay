// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';

import './precompile/HederaResponseCodes.sol';
import './precompile/hedera-token-service/IHederaTokenService.sol';
import './precompile/hedera-token-service/IHRC719.sol';
import './HtsSystemContractMock.sol';
import './libraries/Constants.sol';

contract HederaNonFungibleToken is IHRC719, ERC721, Constants {
    error HtsPrecompileError(int64 responseCode);

    HtsSystemContractMock internal constant HtsPrecompile = HtsSystemContractMock(HTS_PRECOMPILE);

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

    /// @dev the HtsSystemContractMock should do precheck validation before calling any function with this modifier
    ///      the HtsSystemContractMock has priveleged access to do certain operations
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
    ) public onlyHtsPrecompile returns (int64 newTotalSupply) {
        int64 burnCount = int64(uint64(tokenIds.length));
        nftCount.burned = nftCount.burned + burnCount;

        for (uint256 i = 0; i < uint64(burnCount); i++) {
            uint256 tokenId = uint64(tokenIds[i]);
            _burn(tokenId);
        }

        newTotalSupply = int64(int256(totalSupply()));
    }

    function wipeRequestFromHtsPrecompile(
        int64[] calldata tokenIds
    ) external onlyHtsPrecompile {
        burnRequestFromHtsPrecompile(tokenIds); // implementation happens to coincide with burnRequestFromHtsPrecompile unlike in HederaFungibleToken
    }

    /// @dev transfers "amount" from "from" to "to"
    function transferRequestFromHtsPrecompile(
        bool isRequestFromOwner,
        address spender,
        address from,
        address to,
        uint256 tokenId
    ) external onlyHtsPrecompile returns (int64 responseCode) {
        bool isSpenderApproved = _isAuthorized(from, spender, tokenId);
        if (!isSpenderApproved) {
            return HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE;
        }

        _transfer(from, to, tokenId);
        responseCode = HederaResponseCodes.SUCCESS;
    }

    /// @dev unlike fungible/ERC20 tokens this only allows for a single spender to be approved at any one time
    /// @notice The `auth` argument is optional. If the value passed is non 0, then this function will check that `auth` is
    ///         either the owner of the token, or approved to operate on all tokens held by this owner.
    ///         https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/token/ERC721/ERC721.sol#L400
    function approveRequestFromHtsPrecompile(address spender, int64 tokenId, address auth) external onlyHtsPrecompile {
        _approve(spender, uint64(tokenId), auth);
    }

    function setApprovalForAllFromHtsPrecompile(
        address owner,
        address operator,
        bool approved
    ) external onlyHtsPrecompile {
        _setApprovalForAll(owner, operator, approved);
    }

    // standard ERC721 functions overriden for HtsSystemContractMock prechecks:
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

    function isApprovedOrOwner(address owner, address spender, uint256 tokenId) external view returns (bool) {
        return _isAuthorized(owner, spender, tokenId);
    }

    function mintCount() external view returns (int64 minted) {
        minted = nftCount.minted;
    }

    function burnCount() external view returns (int64 burned) {
        burned = nftCount.burned;
    }

    // IHRC719 setters:

    function associate() external returns (uint256 responseCode) {
        responseCode = uint64(HtsPrecompile.preAssociate(msg.sender));
    }

    function dissociate() external returns (uint256 responseCode) {
        responseCode = uint64(HtsPrecompile.preDissociate(msg.sender));
    }

    // IHRC719 getters:

    function isAssociated(address evmAddress) external view returns (bool) {
        return HtsPrecompile.isAssociated(evmAddress, address(this));
    }

}
