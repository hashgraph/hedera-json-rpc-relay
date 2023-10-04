// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "./HederaTokenService.sol";
import { IHederaTokenService } from "./IHederaTokenService.sol";

contract TokenSend is HederaTokenService {
    address public tokenId;
    address payable public recipient;
    int64 internal storedAmount;

    constructor() {
        recipient = payable(msg.sender);
    }

    function loadFunds(int64 _amount) public payable{
        IHederaTokenService.TokenTransferList[] memory tokenTransferList = createTransferList(_amount);
        cryptoTransfer(tokenTransferList);
    }

    function createTransferList(int64 _amount) private view
    returns (IHederaTokenService.TokenTransferList[] memory)
    {
        IHederaTokenService.TokenTransferList[] memory tokenTransferListCollection = new IHederaTokenService.TokenTransferList[](1);
        IHederaTokenService.NftTransfer[] memory nftTransferList = new IHederaTokenService.NftTransfer[](0);
        IHederaTokenService.AccountAmount[] memory amountAccountList = new IHederaTokenService.AccountAmount[](1);
        amountAccountList[0] = IHederaTokenService.AccountAmount(recipient,  _amount != 0 ? _amount : storedAmount);
        tokenTransferListCollection[0] = IHederaTokenService.TokenTransferList(tokenId, amountAccountList, nftTransferList);

        return tokenTransferListCollection;
    }

    function storeAmount(int64 number) public {
        storedAmount = number;
    }

    function getAmount() public view 
    returns (int64) 
    {
        return storedAmount;
    }
}
