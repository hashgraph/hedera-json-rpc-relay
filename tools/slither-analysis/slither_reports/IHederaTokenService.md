Summary
 - [shadowing-local](#shadowing-local) (2 results) (Low)
 - [solc-version](#solc-version) (2 results) (Informational)
## shadowing-local
Impact: Low
Confidence: High
 - [ ] ID-0
[IHederaTokenService.isToken(address).isToken](test_contracts/hts-precompile/IHederaTokenService.sol#L788) shadows:
	- [IHederaTokenService.isToken(address)](test_contracts/hts-precompile/IHederaTokenService.sol#L786-L788) (function)

test_contracts/hts-precompile/IHederaTokenService.sol#L788


 - [ ] ID-1
[IHederaTokenService.allowance(address,address,address).allowance](test_contracts/hts-precompile/IHederaTokenService.sol#L545) shadows:
	- [IHederaTokenService.allowance(address,address,address)](test_contracts/hts-precompile/IHederaTokenService.sol#L541-L545) (function)

test_contracts/hts-precompile/IHederaTokenService.sol#L545


## solc-version
Impact: Informational
Confidence: High
 - [ ] ID-2
solc-0.8.20 is not recommended for deployment

 - [ ] ID-3
Pragma version[>=0.4.9<0.9.0](test_contracts/hts-precompile/IHederaTokenService.sol#L2) is too complex

test_contracts/hts-precompile/IHederaTokenService.sol#L2


