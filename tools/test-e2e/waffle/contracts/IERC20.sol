// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

/**
 * These events should be emitted by `transfer|transferFrom` and `approve` respectively.
 *
 * See https://ethereum.org/en/developers/docs/standards/tokens/erc-20/#events for more information.
 */
interface IERC20Events {
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
}

/**
 * No need to inherit `IERC20Events` here.
 * This interface is used to get the selectors and for testing.
 *
 * https://hips.hedera.com/hip/hip-218
 * https://hips.hedera.com/hip/hip-376
 */
interface IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);

    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}
