// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SimpleTokenWallet {
    address public owner;
    mapping(address => mapping(address => uint256)) public balances; // Token address -> owner address -> balance

    event Deposited(address indexed token, address indexed from, uint256 amount);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action.");
        _;
    }

    function depositTokens(address token, uint256 amount) public {
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Token transfer failed.");
        balances[token][msg.sender] += amount;
        emit Deposited(token, msg.sender, amount);
    }

    function withdrawTokens(address token, uint256 amount) public {
        require(balances[token][msg.sender] >= amount, "Insufficient balance.");
        balances[token][msg.sender] -= amount;
        require(IERC20(token).transfer(msg.sender, amount), "Token transfer failed.");
        emit Withdrawn(token, msg.sender, amount);
    }

    function getBalance(address token, address user) public view returns (uint256) {
        return balances[token][user];
    }
}