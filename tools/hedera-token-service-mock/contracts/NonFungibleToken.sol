// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC721 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function setApprovalForAll(address operator, bool _approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

contract NonFungibleToken is IERC721 {
    string public name = "ArrayNFT";
    string public symbol = "ANFT";

    struct Token {
        uint256 id;
        address owner;
        address approved;
    }

    Token[] public tokens;
    address[] public operators;
    address[] public operatorAddresses;
    bool[] public operatorApproved;
    address[] public associatedAccounts;

    event Associated(address indexed account);
    event Dissociated(address indexed account);

    // Define balanceOf first
    function balanceOf(address owner) public view override returns (uint256 balance) {
        uint256 count = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i].owner == owner) {
                count++;
            }
        }
        return count;
    }

    function ownerOf(uint256 tokenId) external view override returns (address owner) {
        uint256 tokenIndex = findTokenIndex(tokenId);
        require(tokenIndex != type(uint256).max, "Token not found");
        return tokens[tokenIndex].owner;
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external override {
        transferFrom(from, to, tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) public override {
        uint256 tokenIndex = findTokenIndex(tokenId);
        require(tokenIndex != type(uint256).max, "Token not found");
        require(tokens[tokenIndex].owner == from, "Not token owner");
        require(msg.sender == from || msg.sender == tokens[tokenIndex].approved || isApprovedForAll(from, msg.sender), "Not approved");

        tokens[tokenIndex].owner = to;
        tokens[tokenIndex].approved = address(0);

        emit Transfer(from, to, tokenId);
    }

    function approve(address to, uint256 tokenId) external override {
        uint256 tokenIndex = findTokenIndex(tokenId);
        require(tokenIndex != type(uint256).max, "Token not found");
        require(tokens[tokenIndex].owner == msg.sender, "Not token owner");

        tokens[tokenIndex].approved = to;
        emit Approval(msg.sender, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view override returns (address operator) {
        uint256 tokenIndex = findTokenIndex(tokenId);
        require(tokenIndex != type(uint256).max, "Token not found");
        return tokens[tokenIndex].approved;
    }

    function setApprovalForAll(address operator, bool _approved) external override {
        uint256 index = findIndex(operator, operatorAddresses);
        if (index == type(uint256).max) {
            operatorAddresses.push(operator);
            operatorApproved.push(_approved);
        } else {
            operatorApproved[index] = _approved;
        }
        emit ApprovalForAll(msg.sender, operator, _approved);
    }

    function isApprovedForAll(address owner, address operator) public view override returns (bool) {
        uint256 index = findIndex(operator, operatorAddresses);
        if (index != type(uint256).max) {
            return operatorApproved[index];
        }
        return false;
    }

    // Define dissociate after balanceOf is available
    function associate() public {
        require(!isAssociated(msg.sender), "Already associated");
        associatedAccounts.push(msg.sender);
        emit Associated(msg.sender);
    }

    function dissociate() public {
        require(isAssociated(msg.sender), "Not associated");
        require(balanceOf(msg.sender) == 0, "Cannot dissociate with non-zero balance");

        uint256 index = findIndex(msg.sender, associatedAccounts);
        if (index != type(uint256).max) {
            associatedAccounts[index] = associatedAccounts[associatedAccounts.length - 1];
            associatedAccounts.pop();
        }

        emit Dissociated(msg.sender);
    }

    function isAssociated(address account) public view returns (bool) {
        return findIndex(account, associatedAccounts) != type(uint256).max;
    }

    function findTokenIndex(uint256 tokenId) internal view returns (uint256) {
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i].id == tokenId) {
                return i;
            }
        }
        return type(uint256).max;
    }

    // Helper function to find an address in an array
    function findIndex(address account, address[] storage list) internal view returns (uint256) {
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == account) {
                return i;
            }
        }
        return type(uint256).max;  // Max uint256 value as not found flag
    }
}
