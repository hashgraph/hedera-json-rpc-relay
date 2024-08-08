// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.4.9 <0.9.0;

import "../precompile/hedera-token-service/IHRC719.sol";

interface IERCCommonToken {
    function balanceOf(address account) external view returns (uint256);
}

interface IHRCCommon is IHRC719, IERCCommonToken {
    // NOTE: can be moved into IHRC once implemented https://hips.hedera.com/hip/hip-719
    function isAssociated(address evmAddress) external view returns (bool);
}
