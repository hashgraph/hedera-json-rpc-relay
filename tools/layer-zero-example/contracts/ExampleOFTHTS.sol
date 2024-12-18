// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./hts/HederaTokenService.sol";
import "./hts/IHederaTokenService.sol";
import "./hts/KeyHelper.sol";
import "./hts/ExpiryHelper.sol";
import "./BaseHTSOFT.sol";

contract ExampleOFTHTS is Ownable, KeyHelper, ExpiryHelper, HederaTokenService, BaseHTSOFT {
    address public htsTokenAddress;

    event CreatedToken(address tokenAddress);

    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) payable BaseHTSOFT(_name, _symbol, _lzEndpoint, _delegate) Ownable(_delegate) {
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);
        keys[0] = getSingleKey(
            KeyType.ADMIN,
            KeyType.PAUSE,
            KeyValueType.INHERIT_ACCOUNT_KEY,
            bytes("")
        );
        keys[1] = getSingleKey(
            KeyType.SUPPLY,
            KeyValueType.INHERIT_ACCOUNT_KEY,
            bytes("")
        );

        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(0, address(this), 8000000);
        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            _name, _symbol, address(this), "memo", true, 5000, false, keys, expiry
        );

        (int responseCode, address tokenAddress) = HederaTokenService.createFungibleToken(
            token, 1000, int32(int256(uint256(8)))
        );
        require(responseCode == HederaResponseCodes.SUCCESS, "Failed to create HTS token");

        int256 transferResponse = HederaTokenService.transferToken(tokenAddress, address(this), msg.sender, 1000);
        require(transferResponse == HederaResponseCodes.SUCCESS, "HTS: Transfer failed");

        htsTokenAddress = tokenAddress;

        emit CreatedToken(tokenAddress);
    }

    /**
     * @dev Burns tokens from the sender's specified balance.
     * @param _from The address to debit the tokens from.
     * @param _amountLD The amount of tokens to send in local decimals.
     * @param _minAmountLD The minimum amount to send in local decimals.
     * @param _dstEid The destination chain ID.
     * @return amountSentLD The amount sent in local decimals.
     * @return amountReceivedLD The amount received in local decimals on the remote.
     */
    function _debit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    ) internal virtual override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        (amountSentLD, amountReceivedLD) = _debitView(_amountLD, _minAmountLD, _dstEid);

        int256 transferResponse = HederaTokenService.transferToken(htsTokenAddress, _from, address(this), int64(uint64(_amountLD)));
        require(transferResponse == HederaResponseCodes.SUCCESS, "HTS: Transfer failed");

        (int256 response,) = HederaTokenService.burnToken(htsTokenAddress, int64(uint64(amountSentLD)), new int64[](0));
        require(response == HederaResponseCodes.SUCCESS, "HTS: Burn failed");
    }

    /**
     * @dev Credits tokens to the specified address.
     * @param _to The address to credit the tokens to.
     * @param _amountLD The amount of tokens to credit in local decimals.
     * @dev _srcEid The source chain ID.
     * @return amountReceivedLD The amount of tokens ACTUALLY received in local decimals.
     */
    function _credit(
        address _to,
        uint256 _amountLD,
        uint32 /*_srcEid*/
    ) internal virtual override returns (uint256) {
        (int256 response, ,) = HederaTokenService.mintToken(htsTokenAddress, int64(uint64(_amountLD)), new bytes[](0));
        require(response == HederaResponseCodes.SUCCESS, "HTS: Mint failed");

        int256 transferResponse = HederaTokenService.transferToken(htsTokenAddress, address(this), _to, int64(uint64(_amountLD)));
        require(transferResponse == HederaResponseCodes.SUCCESS, "HTS: Transfer failed");

        return _amountLD;
    }
}
