// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "./IERC20.sol";
import {IERC721} from "./IERC721.sol";

contract HtsSystemContract {
    string public tokenType; // IERC20 | IERC721

    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    address[] public holders;
    uint256[] public balances;
    address[] public allowancesOwners;
    address[] public allowancesSpenders;
    uint256[] public allowancesAmounts;
    address[] public associatedAccounts;

    uint256[] public tokenIds;
    address[] public owners;
    address[] public approvals;
    address[] public operatorAddresses;
    bool[] public operatorApproved;

    event Associated(address indexed account);
    event Dissociated(address indexed account);

    event Transfer(address indexed from, address indexed to, uint256 valueOrTokenId);
    event Approval(address indexed owner, address indexed spender, uint256 valueOrTokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function _isERC20() private view returns (bool) {
        return keccak256(bytes(tokenType)) == keccak256(bytes("FUNGIBLE_COMMON"));
    }

    function _isERC721() private view returns (bool) {
        return keccak256(bytes(tokenType)) == keccak256(bytes("NON_FUNGIBLE_UNIQUE"));
    }

    function balanceOf(address account) public view returns (uint256) {
        if (_isERC20()) {
            for (uint256 i = 0; i < holders.length; i++) {
                if (holders[i] == account) {
                    return balances[i];
                }
            }
            return 0;
        }
        if (_isERC721()) {
            uint256 count = 0;
            for (uint256 i = 0; i < owners.length; i++) {
                if (owners[i] == account) {
                    count++;
                }
            }
            return 0;
        }
        revert("Token type is not supported");
    }

    function transfer(address recipient, uint256 amountOrTokenId) public returns (bool) {
        if (_isERC20()) {
            uint256 senderIndex = findIndex(msg.sender, holders);
            require(senderIndex != type(uint256).max, "Sender not found");
            require(balances[senderIndex] >= amountOrTokenId, "Insufficient balance");
            uint256 recipientIndex = findIndex(recipient, allowancesOwners);
            if (recipientIndex == type(uint256).max) {
                holders.push(recipient);
                balances.push(amountOrTokenId);
            } else {
                balances[recipientIndex] += amountOrTokenId;
            }

            balances[senderIndex] -= amountOrTokenId;
            emit Transfer(msg.sender, recipient, amountOrTokenId);
            return true;
        }
        if (_isERC721()) {
            uint256 tokenIndex = findTokenIndex(amountOrTokenId);
            require(tokenIndex != type(uint256).max, "Token not found");
            require(owners[tokenIndex] == msg.sender, "Not token owner");
            require(msg.sender == approvals[tokenIndex] || isApprovedForAll(msg.sender, msg.sender), "Not approved");

            owners[tokenIndex] = recipient;
            approvals[tokenIndex] = address(0);

            emit Transfer(msg.sender, recipient, amountOrTokenId);

            return true;
        }
        revert("Token type is not supported");
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        for (uint256 i = 0; i < allowancesOwners.length; i++) {
            if (allowancesOwners[i] == owner && allowancesSpenders[i] == spender) {
                return allowancesAmounts[i];
            }
        }
        return 0;
    }

    function approve(address spender, uint256 amountOrTokenType) public returns (bool) {
        if (_isERC20()) {
            uint256 ownerIndex = findIndex(msg.sender, allowancesOwners);
            uint256 spenderIndex = findIndex(spender, allowancesSpenders);

            if (ownerIndex != type(uint256).max && spenderIndex != type(uint256).max) {
                allowancesAmounts[ownerIndex] = amountOrTokenType;
            } else {
                allowancesOwners.push(msg.sender);
                allowancesSpenders.push(spender);
                allowancesAmounts.push(amountOrTokenType);
            }

            emit Approval(msg.sender, spender, amountOrTokenType);
            return true;
        }
        if (_isERC721()) {
            uint256 tokenIndex = findTokenIndex(amountOrTokenType);
            require(tokenIndex != type(uint256).max, "Token not found");
            require(owners[tokenIndex] == msg.sender, "Not token owner");

            approvals[tokenIndex] = spender;
            emit Approval(msg.sender, spender, amountOrTokenType);
        }
        revert("Token type is not supported");
    }

    function transferFrom(address sender, address recipient, uint256 amountOrTokenId) public returns (bool) {
        if (_isERC20()) {
            uint256 senderIndex = findIndex(sender, holders);
            uint256 spenderIndex = findIndex(msg.sender, allowancesSpenders);
            require(senderIndex != type(uint256).max, "Sender not found");
            require(allowancesOwners[spenderIndex] == sender, "Sender not authorized");
            require(balances[senderIndex] >= amountOrTokenId, "Insufficient balance");
            require(allowancesAmounts[spenderIndex] >= amountOrTokenId, "Allowance exceeded");

            balances[senderIndex] -= amountOrTokenId;
            allowancesAmounts[spenderIndex] -= amountOrTokenId;

            uint256 recipientIndex = findIndex(recipient, holders);
            if (recipientIndex == type(uint256).max) {
                holders.push(recipient);
                balances.push(amountOrTokenId);
            } else {
                balances[recipientIndex] += amountOrTokenId;
            }

            emit Transfer(sender, recipient, amountOrTokenId);
            return true;
        }
        if (_isERC721()) {
            uint256 tokenIndex = findTokenIndex(amountOrTokenId);
            require(tokenIndex != type(uint256).max, "Token not found");
            require(owners[tokenIndex] == msg.sender, "Not token owner");
            require(msg.sender == approvals[tokenIndex], "Not approved");

            owners[tokenIndex] = recipient;
            approvals[tokenIndex] = address(0);

            emit Transfer(sender, recipient, amountOrTokenId);

            return true;
        }
        revert("Token type is not supported");
    }

    function findIndex(address account, address[] storage list) internal view returns (uint256) {
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == account) {
                return i;
            }
        }
        return type(uint256).max;  // Max uint256 value as not found flag
    }


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

    fallback (bytes calldata) external returns (bytes memory) {
        uint256 selector = uint32(bytes4(msg.data[0:4]));
        address token = address(bytes20(msg.data[4:24]));
        bytes memory args = msg.data[24:];
        if (selector == 0x618dc65e) {
            return __redirectForToken(token, args);
        }

        revert ("Not supported");
    }

    function __redirectForToken(address token, bytes memory encodedFunctionSelector) internal returns (bytes memory) {
        bytes4 selector = bytes4(msg.data[24:28]);

        if (selector == bytes4(keccak256("name()"))) {
            return abi.encode(name);
        } else if (selector == bytes4(keccak256("decimals()"))) {
            return abi.encode(decimals);
        } else if (selector == IERC20.totalSupply.selector) {
            return abi.encode(totalSupply);
        } else if (selector == bytes4(keccak256("symbol()"))) {
            return abi.encode(symbol);
        } else if (selector == bytes4(keccak256("tokenType()"))) {
            return abi.encode(tokenType);
        } else if (selector == bytes4(keccak256("balanceOf(address)"))) {
            address account = address(bytes20(msg.data[40:60]));
            return abi.encode(balanceOf(account));
        } else if (selector == bytes4(keccak256("transfer(address,uint256)"))) {
            address account = address(bytes20(msg.data[40:60]));
            uint256 amount = abi.decode(msg.data[60:92], (uint256));
            return abi.encode(transfer(account, amount));
        } else if (selector == bytes4(keccak256("approve(address,uint256)"))) {
            address account = address(bytes20(msg.data[40:60]));
            uint256 amount = abi.decode(msg.data[60:92], (uint256));
            return abi.encode(approve(account, amount));
        } else if (selector == bytes4(keccak256("allowance(address,address)"))) {
            address from = address(bytes20(msg.data[40:60]));
            uint256 to = uint160(address(bytes20(msg.data[60:80])));
            return abi.encode(approve(from, to));
            // } else if (selector == bytes4(keccak256("associate()"))) {
            //     return abi.encode(associate());
            // } else if (selector == bytes4(keccak256("dissociate()"))) {
            //     return abi.encode(dissociate());
        } else if (selector == bytes4(keccak256("isAssociated(address)"))) {
            address account = address(bytes20(msg.data[40:60]));
            return abi.encode(isAssociated(account));
            // } else if (selector == bytes4(keccak256("transferFrom(address,address,uint256)"))) {
            //     address from = address(bytes20(msg.data[40:60]));
            //     uint256 to = address(bytes20(msg.data[60:80]));
            //     uint256 amount = abi.decode(msg.data[80:112], (uint256));
            //     return abi.encode(transferFrom(from, to));
        }
        return "";
    }

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        uint256 tokenIndex = findTokenIndex(tokenId);
        require(tokenIndex != type(uint256).max, "Token not found");
        return owners[tokenIndex];
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address operator) {
        uint256 tokenIndex = findTokenIndex(tokenId);
        require(tokenIndex != type(uint256).max, "Token not found");
        return approvals[tokenIndex];
    }

    function setApprovalForAll(address operator, bool _approved) external {
        uint256 index = findIndex(operator, operatorAddresses);
        if (index == type(uint256).max) {
            operatorAddresses.push(operator);
            operatorApproved.push(_approved);
        } else {
            operatorApproved[index] = _approved;
        }
        emit ApprovalForAll(msg.sender, operator, _approved);
    }

    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        if (operator == owner) {
            return true;
        }
        uint256 index = findIndex(operator, operatorAddresses);
        if (index != type(uint256).max) {
            return operatorApproved[index];
        }
        return false;
    }

    function findTokenIndex(uint256 tokenId) internal view returns (uint256) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokenIds[i] == tokenId) {
                return i;
            }
        }
        return type(uint256).max;
    }
}