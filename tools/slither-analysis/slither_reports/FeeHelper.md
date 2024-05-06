Summary
 - [shadowing-local](#shadowing-local) (2 results) (Low)
 - [pragma](#pragma) (1 results) (Informational)
 - [dead-code](#dead-code) (34 results) (Informational)
 - [solc-version](#solc-version) (3 results) (Informational)
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


## pragma
Impact: Informational
Confidence: High
 - [ ] ID-2
Different versions of Solidity are used:
	- Version used: ['>=0.4.9<0.9.0', '>=0.5.0<0.9.0']
	- [>=0.4.9<0.9.0](test_contracts/hts-precompile/IHederaTokenService.sol#L2)
	- [>=0.5.0<0.9.0](test_contracts/hts-precompile/FeeHelper.sol#L2)
	- [ABIEncoderV2](test_contracts/hts-precompile/FeeHelper.sol#L3)
	- [ABIEncoderV2](test_contracts/hts-precompile/IHederaTokenService.sol#L3)

test_contracts/hts-precompile/IHederaTokenService.sol#L2


## dead-code
Impact: Informational
Confidence: Medium
 - [ ] ID-3
[FeeHelper.getEmptyFractionalFees()](test_contracts/hts-precompile/FeeHelper.sol#L392-L398) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L392-L398


 - [ ] ID-4
[FeeHelper.createSingleFixedFeeForHbars(int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L180-L191) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L180-L191


 - [ ] ID-5
[FeeHelper.createSingleFixedFeeWithTokenIdAndHbars(int64,address,address)](test_contracts/hts-precompile/FeeHelper.sol#L219-L232) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L219-L232


 - [ ] ID-6
[FeeHelper.createRoyaltyFeeWithoutFallback(int64,int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L94-L102) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L94-L102


 - [ ] ID-7
[FeeHelper.createSingleFixedFeeForToken(int64,address,address)](test_contracts/hts-precompile/FeeHelper.sol#L145-L157) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L145-L157


 - [ ] ID-8
[FeeHelper.createSingleRoyaltyFeeWithFallbackFee(int64,int64,int64,address,bool,address)](test_contracts/hts-precompile/FeeHelper.sol#L449-L473) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L449-L473


 - [ ] ID-9
[FeeHelper.createSingleRoyaltyFee(int64,int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L430-L447) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L430-L447


 - [ ] ID-10
[FeeHelper.createSingleFractionalFeeWithLimits(int64,int64,int64,int64,bool,address)](test_contracts/hts-precompile/FeeHelper.sol#L367-L390) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L367-L390


 - [ ] ID-11
[FeeHelper.createFixedFeesForToken(int64,address,address,address)](test_contracts/hts-precompile/FeeHelper.sol#L159-L178) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L159-L178


 - [ ] ID-12
[FeeHelper.createNAmountFixedFeesForHbars(uint8,int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L131-L143) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L131-L143


 - [ ] ID-13
[FeeHelper.createFixedFeeForToken(int64,address,address)](test_contracts/hts-precompile/FeeHelper.sol#L261-L269) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L261-L269


 - [ ] ID-14
[FeeHelper.createFixedFeeForHbars(int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L271-L279) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L271-L279


 - [ ] ID-15
[FeeHelper.createNAmountRoyaltyFees(uint8,int64,int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L400-L420) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L400-L420


 - [ ] ID-16
[FeeHelper.createFractionalFeeWithMinAndMax(int64,int64,int64,int64,bool,address)](test_contracts/hts-precompile/FeeHelper.sol#L54-L72) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L54-L72


 - [ ] ID-17
[FeeHelper.createFixedFeesWithAllTypes(int64,address,address)](test_contracts/hts-precompile/FeeHelper.sol#L234-L259) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L234-L259


 - [ ] ID-18
[FeeHelper.createSingleFixedFeeForCurrentToken(int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L193-L204) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L193-L204


 - [ ] ID-19
[FeeHelper.createRoyaltyFee(int64,int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L516-L524) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L516-L524


 - [ ] ID-20
[FeeHelper.createSingleFractionalFee(int64,int64,bool,address)](test_contracts/hts-precompile/FeeHelper.sol#L346-L365) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L346-L365


 - [ ] ID-21
[FeeHelper.createRoyaltyFeeWithHbarFallbackFee(int64,int64,int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L104-L115) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L104-L115


 - [ ] ID-22
[FeeHelper.createFractionalFee(int64,int64,bool,address)](test_contracts/hts-precompile/FeeHelper.sol#L38-L52) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L38-L52


 - [ ] ID-23
[FeeHelper.createRoyaltyFeeWithTokenDenominatedFallbackFee(int64,int64,int64,address,address)](test_contracts/hts-precompile/FeeHelper.sol#L117-L129) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L117-L129


 - [ ] ID-24
[FeeHelper.createFixedFeeForCurrentToken(int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L281-L289) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L281-L289


 - [ ] ID-25
[FeeHelper.createFixedHbarFee(int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L8-L16) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L8-L16


 - [ ] ID-26
[FeeHelper.createFractionalFeeWithLimits(int64,int64,int64,int64,bool,address)](test_contracts/hts-precompile/FeeHelper.sol#L74-L92) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L74-L92


 - [ ] ID-27
[FeeHelper.createFixedFeeWithTokenIdAndHbars(int64,address,address)](test_contracts/hts-precompile/FeeHelper.sol#L304-L313) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L304-L313


 - [ ] ID-28
[FeeHelper.createNAmountFractionalFees(uint8,int64,int64,bool,address)](test_contracts/hts-precompile/FeeHelper.sol#L321-L344) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L321-L344


 - [ ] ID-29
[FeeHelper.createRoyaltyFeeWithFallbackFee(int64,int64,int64,address,bool,address)](test_contracts/hts-precompile/FeeHelper.sol#L526-L540) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L526-L540


 - [ ] ID-30
[FeeHelper.getEmptyRoyaltyFees()](test_contracts/hts-precompile/FeeHelper.sol#L422-L428) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L422-L428


 - [ ] ID-31
[FeeHelper.createFixedSelfDenominatedFee(int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L28-L36) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L28-L36


 - [ ] ID-32
[FeeHelper.getEmptyFixedFees()](test_contracts/hts-precompile/FeeHelper.sol#L315-L319) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L315-L319


 - [ ] ID-33
[FeeHelper.createFixedTokenFee(int64,address,address)](test_contracts/hts-precompile/FeeHelper.sol#L18-L26) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L18-L26


 - [ ] ID-34
[FeeHelper.createFixedFeeWithInvalidFlags(int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L292-L301) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L292-L301


 - [ ] ID-35
[FeeHelper.createSingleFixedFeeWithInvalidFlags(int64,address)](test_contracts/hts-precompile/FeeHelper.sol#L206-L217) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L206-L217


 - [ ] ID-36
[FeeHelper.createRoyaltyFeesWithAllTypes(int64,int64,int64,address,address)](test_contracts/hts-precompile/FeeHelper.sol#L475-L514) is never used and should be removed

test_contracts/hts-precompile/FeeHelper.sol#L475-L514


## solc-version
Impact: Informational
Confidence: High
 - [ ] ID-37
solc-0.8.20 is not recommended for deployment

 - [ ] ID-38
Pragma version[>=0.4.9<0.9.0](test_contracts/hts-precompile/IHederaTokenService.sol#L2) is too complex

test_contracts/hts-precompile/IHederaTokenService.sol#L2


 - [ ] ID-39
Pragma version[>=0.5.0<0.9.0](test_contracts/hts-precompile/FeeHelper.sol#L2) is too complex

test_contracts/hts-precompile/FeeHelper.sol#L2


