Summary
 - [uninitialized-local](#uninitialized-local) (8 results) (Medium)
 - [shadowing-local](#shadowing-local) (2 results) (Low)
 - [missing-zero-check](#missing-zero-check) (7 results) (Low)
 - [reentrancy-events](#reentrancy-events) (1 results) (Low)
 - [pragma](#pragma) (1 results) (Informational)
 - [dead-code](#dead-code) (45 results) (Informational)
 - [solc-version](#solc-version) (4 results) (Informational)
 - [low-level-calls](#low-level-calls) (48 results) (Informational)
 - [naming-convention](#naming-convention) (2 results) (Informational)
## uninitialized-local
Impact: Medium
Confidence: Medium
 - [ ] ID-0
[HederaTokenService.getTokenCustomFees(address).defaultFixedFees](test_contracts/hts-precompile/HederaTokenService.sol#L253) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L253


 - [ ] ID-1
[HederaTokenService.getTokenInfo(address).defaultTokenInfo](test_contracts/hts-precompile/HederaTokenService.sol#L228) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L228


 - [ ] ID-2
[HederaTokenService.getTokenCustomFees(address).defaultRoyaltyFees](test_contracts/hts-precompile/HederaTokenService.sol#L255) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L255


 - [ ] ID-3
[HederaTokenService.getTokenCustomFees(address).defaultFractionalFees](test_contracts/hts-precompile/HederaTokenService.sol#L254) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L254


 - [ ] ID-4
[HederaTokenService.getNonFungibleTokenInfo(address,int64).defaultTokenInfo](test_contracts/hts-precompile/HederaTokenService.sol#L237) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L237


 - [ ] ID-5
[HederaTokenService.getTokenExpiryInfo(address).defaultExpiryInfo](test_contracts/hts-precompile/HederaTokenService.sol#L637) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L637


 - [ ] ID-6
[HederaTokenService.getFungibleTokenInfo(address).defaultTokenInfo](test_contracts/hts-precompile/HederaTokenService.sol#L219) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L219


 - [ ] ID-7
[HederaTokenService.getTokenKey(address,uint256).defaultKeyValueInfo](test_contracts/hts-precompile/HederaTokenService.sol#L605) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L605


## shadowing-local
Impact: Low
Confidence: High
 - [ ] ID-8
[IHederaTokenService.isToken(address).isToken](test_contracts/hts-precompile/IHederaTokenService.sol#L788) shadows:
	- [IHederaTokenService.isToken(address)](test_contracts/hts-precompile/IHederaTokenService.sol#L786-L788) (function)

test_contracts/hts-precompile/IHederaTokenService.sol#L788


 - [ ] ID-9
[IHederaTokenService.allowance(address,address,address).allowance](test_contracts/hts-precompile/IHederaTokenService.sol#L545) shadows:
	- [IHederaTokenService.allowance(address,address,address)](test_contracts/hts-precompile/IHederaTokenService.sol#L541-L545) (function)

test_contracts/hts-precompile/IHederaTokenService.sol#L545


## missing-zero-check
Impact: Low
Confidence: Medium
 - [ ] ID-10
[HederaTokenService.redirectForToken(address,bytes).token](test_contracts/hts-precompile/HederaTokenService.sol#L665) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.redirectForToken.selector,token,encodedFunctionSelector))](test_contracts/hts-precompile/HederaTokenService.sol#L666-L668)

test_contracts/hts-precompile/HederaTokenService.sol#L665


 - [ ] ID-11
[HederaTokenService.transferFrom(address,address,address,uint256).from](test_contracts/hts-precompile/HederaTokenService.sol#L285) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFrom.selector,token,from,to,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L287-L289)

test_contracts/hts-precompile/HederaTokenService.sol#L285


 - [ ] ID-12
[HederaTokenService.transferFromNFT(address,address,address,uint256).token](test_contracts/hts-precompile/HederaTokenService.sol#L300) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFromNFT.selector,token,from,to,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L302-L304)

test_contracts/hts-precompile/HederaTokenService.sol#L300


 - [ ] ID-13
[HederaTokenService.transferFromNFT(address,address,address,uint256).from](test_contracts/hts-precompile/HederaTokenService.sol#L300) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFromNFT.selector,token,from,to,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L302-L304)

test_contracts/hts-precompile/HederaTokenService.sol#L300


 - [ ] ID-14
[HederaTokenService.transferFromNFT(address,address,address,uint256).to](test_contracts/hts-precompile/HederaTokenService.sol#L300) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFromNFT.selector,token,from,to,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L302-L304)

test_contracts/hts-precompile/HederaTokenService.sol#L300


 - [ ] ID-15
[HederaTokenService.transferFrom(address,address,address,uint256).to](test_contracts/hts-precompile/HederaTokenService.sol#L285) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFrom.selector,token,from,to,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L287-L289)

test_contracts/hts-precompile/HederaTokenService.sol#L285


 - [ ] ID-16
[HederaTokenService.transferFrom(address,address,address,uint256).token](test_contracts/hts-precompile/HederaTokenService.sol#L285) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFrom.selector,token,from,to,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L287-L289)

test_contracts/hts-precompile/HederaTokenService.sol#L285


## reentrancy-events
Impact: Low
Confidence: Medium
 - [ ] ID-17
Reentrancy in [HederaTokenService.redirectForToken(address,bytes)](test_contracts/hts-precompile/HederaTokenService.sol#L665-L672):
	External calls:
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.redirectForToken.selector,token,encodedFunctionSelector))](test_contracts/hts-precompile/HederaTokenService.sol#L666-L668)
	Event emitted after the call(s):
	- [CallResponseEvent(success,result)](test_contracts/hts-precompile/HederaTokenService.sol#L670)

test_contracts/hts-precompile/HederaTokenService.sol#L665-L672


## pragma
Impact: Informational
Confidence: High
 - [ ] ID-18
Different versions of Solidity are used:
	- Version used: ['>=0.4.9<0.9.0', '>=0.5.0<0.9.0']
	- [>=0.4.9<0.9.0](test_contracts/hts-precompile/HederaResponseCodes.sol#L2)
	- [>=0.4.9<0.9.0](test_contracts/hts-precompile/IHederaTokenService.sol#L2)
	- [>=0.5.0<0.9.0](test_contracts/hts-precompile/HederaTokenService.sol#L2)
	- [ABIEncoderV2](test_contracts/hts-precompile/HederaTokenService.sol#L3)
	- [ABIEncoderV2](test_contracts/hts-precompile/IHederaTokenService.sol#L3)

test_contracts/hts-precompile/HederaResponseCodes.sol#L2


## dead-code
Impact: Informational
Confidence: Medium
 - [ ] ID-19
[HederaTokenService.transferNFTs(address,address[],address[],int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L489-L496) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L489-L496


 - [ ] ID-20
[HederaTokenService.freezeToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L379-L383) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L379-L383


 - [ ] ID-21
[HederaTokenService.mintToken(address,int64,bytes[])](test_contracts/hts-precompile/HederaTokenService.sol#L48-L58) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L48-L58


 - [ ] ID-22
[HederaTokenService.getNonFungibleTokenInfo(address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L234-L239) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L234-L239


 - [ ] ID-23
[HederaTokenService.getTokenInfo(address)](test_contracts/hts-precompile/HederaTokenService.sol#L225-L230) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L225-L230


 - [ ] ID-24
[HederaTokenService.dissociateToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L137-L142) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L137-L142


 - [ ] ID-25
[HederaTokenService.transferTokens(address,address[],int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L475-L482) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L475-L482


 - [ ] ID-26
[HederaTokenService.updateTokenInfo(address,IHederaTokenService.HederaToken)](test_contracts/hts-precompile/HederaTokenService.sol#L654-L658) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L654-L658


 - [ ] ID-27
[HederaTokenService.approve(address,address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L269-L275) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L269-L275


 - [ ] ID-28
[HederaTokenService.createFungibleToken(IHederaTokenService.HederaToken,int64,int32)](test_contracts/hts-precompile/HederaTokenService.sol#L151-L162) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L151-L162


 - [ ] ID-29
[HederaTokenService.isToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L614-L618) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L614-L618


 - [ ] ID-30
[HederaTokenService.pauseToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L533-L538) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L533-L538


 - [ ] ID-31
[HederaTokenService.createFungibleTokenWithCustomFees(IHederaTokenService.HederaToken,int64,int32,IHederaTokenService.FixedFee[],IHederaTokenService.FractionalFee[])](test_contracts/hts-precompile/HederaTokenService.sol#L173-L184) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L173-L184


 - [ ] ID-32
[HederaTokenService.getTokenCustomFees(address)](test_contracts/hts-precompile/HederaTokenService.sol#L247-L260) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L247-L260


 - [ ] ID-33
[HederaTokenService.cryptoTransfer(IHederaTokenService.TransferList,IHederaTokenService.TokenTransferList[])](test_contracts/hts-precompile/HederaTokenService.sol#L29-L35) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L29-L35


 - [ ] ID-34
[HederaTokenService.transferNFT(address,address,address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L521-L528) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L521-L528


 - [ ] ID-35
[HederaTokenService.wipeTokenAccount(address,address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L555-L560) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L555-L560


 - [ ] ID-36
[HederaTokenService.approveNFT(address,address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L328-L334) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L328-L334


 - [ ] ID-37
[HederaTokenService.setApprovalForAll(address,address,bool)](test_contracts/hts-precompile/HederaTokenService.sol#L421-L427) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L421-L427


 - [ ] ID-38
[HederaTokenService.getTokenDefaultKycStatus(address)](test_contracts/hts-precompile/HederaTokenService.sol#L461-L465) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L461-L465


 - [ ] ID-39
[HederaTokenService.grantTokenKyc(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L399-L403) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L399-L403


 - [ ] ID-40
[HederaTokenService.getTokenExpiryInfo(address)](test_contracts/hts-precompile/HederaTokenService.sol#L634-L639) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L634-L639


 - [ ] ID-41
[HederaTokenService.updateTokenExpiryInfo(address,IHederaTokenService.Expiry)](test_contracts/hts-precompile/HederaTokenService.sol#L644-L648) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L644-L648


 - [ ] ID-42
[HederaTokenService.unfreezeToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L389-L393) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L389-L393


 - [ ] ID-43
[HederaTokenService.createNonFungibleTokenWithCustomFees(IHederaTokenService.HederaToken,IHederaTokenService.FixedFee[],IHederaTokenService.RoyaltyFee[])](test_contracts/hts-precompile/HederaTokenService.sol#L203-L212) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L203-L212


 - [ ] ID-44
[HederaTokenService.wipeTokenAccountNFT(address,address,int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L567-L573) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L567-L573


 - [ ] ID-45
[HederaTokenService.burnToken(address,int64,int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L69-L79) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L69-L79


 - [ ] ID-46
[HederaTokenService.getApproved(address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L342-L351) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L342-L351


 - [ ] ID-47
[HederaTokenService.isKyc(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L369-L373) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L369-L373


 - [ ] ID-48
[HederaTokenService.dissociateTokens(address,address[])](test_contracts/hts-precompile/HederaTokenService.sol#L130-L135) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L130-L135


 - [ ] ID-49
[HederaTokenService.getFungibleTokenInfo(address)](test_contracts/hts-precompile/HederaTokenService.sol#L216-L221) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L216-L221


 - [ ] ID-50
[HederaTokenService.allowance(address,address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L314-L320) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L314-L320


 - [ ] ID-51
[HederaTokenService.getTokenType(address)](test_contracts/hts-precompile/HederaTokenService.sol#L624-L628) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L624-L628


 - [ ] ID-52
[HederaTokenService.unpauseToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L543-L548) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L543-L548


 - [ ] ID-53
[HederaTokenService.deleteToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L578-L583) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L578-L583


 - [ ] ID-54
[HederaTokenService.associateToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L105-L110) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L105-L110


 - [ ] ID-55
[HederaTokenService.updateTokenKeys(address,IHederaTokenService.TokenKey[])](test_contracts/hts-precompile/HederaTokenService.sol#L589-L594) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L589-L594


 - [ ] ID-56
[HederaTokenService.transferToken(address,address,address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L505-L512) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L505-L512


 - [ ] ID-57
[HederaTokenService.isFrozen(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L358-L362) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L358-L362


 - [ ] ID-58
[HederaTokenService.getTokenDefaultFreezeStatus(address)](test_contracts/hts-precompile/HederaTokenService.sol#L451-L455) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L451-L455


 - [ ] ID-59
[HederaTokenService.associateTokens(address,address[])](test_contracts/hts-precompile/HederaTokenService.sol#L98-L103) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L98-L103


 - [ ] ID-60
[HederaTokenService.revokeTokenKyc(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L409-L413) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L409-L413


 - [ ] ID-61
[HederaTokenService.getTokenKey(address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L601-L607) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L601-L607


 - [ ] ID-62
[HederaTokenService.createNonFungibleToken(IHederaTokenService.HederaToken)](test_contracts/hts-precompile/HederaTokenService.sol#L190-L195) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L190-L195


 - [ ] ID-63
[HederaTokenService.isApprovedForAll(address,address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L436-L445) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L436-L445


## solc-version
Impact: Informational
Confidence: High
 - [ ] ID-64
Pragma version[>=0.4.9<0.9.0](test_contracts/hts-precompile/HederaResponseCodes.sol#L2) is too complex

test_contracts/hts-precompile/HederaResponseCodes.sol#L2


 - [ ] ID-65
Pragma version[>=0.5.0<0.9.0](test_contracts/hts-precompile/HederaTokenService.sol#L2) is too complex

test_contracts/hts-precompile/HederaTokenService.sol#L2


 - [ ] ID-66
solc-0.8.20 is not recommended for deployment

 - [ ] ID-67
Pragma version[>=0.4.9<0.9.0](test_contracts/hts-precompile/IHederaTokenService.sol#L2) is too complex

test_contracts/hts-precompile/IHederaTokenService.sol#L2


## low-level-calls
Impact: Informational
Confidence: High
 - [ ] ID-68
Low level call in [HederaTokenService.wipeTokenAccountNFT(address,address,int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L567-L573):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.wipeTokenAccountNFT.selector,token,account,serialNumbers))](test_contracts/hts-precompile/HederaTokenService.sol#L570-L571)

test_contracts/hts-precompile/HederaTokenService.sol#L567-L573


 - [ ] ID-69
Low level call in [HederaTokenService.unpauseToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L543-L548):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.unpauseToken.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L545-L546)

test_contracts/hts-precompile/HederaTokenService.sol#L543-L548


 - [ ] ID-70
Low level call in [HederaTokenService.getTokenKey(address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L601-L607):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenKey.selector,token,keyType))](test_contracts/hts-precompile/HederaTokenService.sol#L603-L604)

test_contracts/hts-precompile/HederaTokenService.sol#L601-L607


 - [ ] ID-71
Low level call in [HederaTokenService.deleteToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L578-L583):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.deleteToken.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L580-L581)

test_contracts/hts-precompile/HederaTokenService.sol#L578-L583


 - [ ] ID-72
Low level call in [HederaTokenService.redirectForToken(address,bytes)](test_contracts/hts-precompile/HederaTokenService.sol#L665-L672):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.redirectForToken.selector,token,encodedFunctionSelector))](test_contracts/hts-precompile/HederaTokenService.sol#L666-L668)

test_contracts/hts-precompile/HederaTokenService.sol#L665-L672


 - [ ] ID-73
Low level call in [HederaTokenService.createNonFungibleToken(IHederaTokenService.HederaToken)](test_contracts/hts-precompile/HederaTokenService.sol#L190-L195):
	- [(success,result) = precompileAddress.call{value: msg.value}(abi.encodeWithSelector(IHederaTokenService.createNonFungibleToken.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L192-L193)

test_contracts/hts-precompile/HederaTokenService.sol#L190-L195


 - [ ] ID-74
Low level call in [HederaTokenService.allowance(address,address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L314-L320):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.allowance.selector,token,owner,spender))](test_contracts/hts-precompile/HederaTokenService.sol#L316-L318)

test_contracts/hts-precompile/HederaTokenService.sol#L314-L320


 - [ ] ID-75
Low level call in [HederaTokenService.freezeToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L379-L383):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.freezeToken.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L380-L381)

test_contracts/hts-precompile/HederaTokenService.sol#L379-L383


 - [ ] ID-76
Low level call in [HederaTokenService.createFungibleToken(IHederaTokenService.HederaToken,int64,int32)](test_contracts/hts-precompile/HederaTokenService.sol#L151-L162):
	- [(success,result) = precompileAddress.call{value: msg.value}(abi.encodeWithSelector(IHederaTokenService.createFungibleToken.selector,token,initialTotalSupply,decimals))](test_contracts/hts-precompile/HederaTokenService.sol#L156-L158)

test_contracts/hts-precompile/HederaTokenService.sol#L151-L162


 - [ ] ID-77
Low level call in [HederaTokenService.approveNFT(address,address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L328-L334):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.approveNFT.selector,token,approved,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L330-L332)

test_contracts/hts-precompile/HederaTokenService.sol#L328-L334


 - [ ] ID-78
Low level call in [HederaTokenService.updateTokenExpiryInfo(address,IHederaTokenService.Expiry)](test_contracts/hts-precompile/HederaTokenService.sol#L644-L648):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.updateTokenExpiryInfo.selector,token,expiryInfo))](test_contracts/hts-precompile/HederaTokenService.sol#L645-L646)

test_contracts/hts-precompile/HederaTokenService.sol#L644-L648


 - [ ] ID-79
Low level call in [HederaTokenService.transferToken(address,address,address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L505-L512):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferToken.selector,token,sender,receiver,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L508-L510)

test_contracts/hts-precompile/HederaTokenService.sol#L505-L512


 - [ ] ID-80
Low level call in [HederaTokenService.getTokenCustomFees(address)](test_contracts/hts-precompile/HederaTokenService.sol#L247-L260):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenCustomFees.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L251-L252)

test_contracts/hts-precompile/HederaTokenService.sol#L247-L260


 - [ ] ID-81
Low level call in [HederaTokenService.cryptoTransfer(IHederaTokenService.TransferList,IHederaTokenService.TokenTransferList[])](test_contracts/hts-precompile/HederaTokenService.sol#L29-L35):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.cryptoTransfer.selector,transferList,tokenTransfers))](test_contracts/hts-precompile/HederaTokenService.sol#L32-L33)

test_contracts/hts-precompile/HederaTokenService.sol#L29-L35


 - [ ] ID-82
Low level call in [HederaTokenService.grantTokenKyc(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L399-L403):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.grantTokenKyc.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L400-L401)

test_contracts/hts-precompile/HederaTokenService.sol#L399-L403


 - [ ] ID-83
Low level call in [HederaTokenService.dissociateTokens(address,address[])](test_contracts/hts-precompile/HederaTokenService.sol#L130-L135):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.dissociateTokens.selector,account,tokens))](test_contracts/hts-precompile/HederaTokenService.sol#L131-L133)

test_contracts/hts-precompile/HederaTokenService.sol#L130-L135


 - [ ] ID-84
Low level call in [HederaTokenService.isToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L614-L618):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.isToken.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L615-L616)

test_contracts/hts-precompile/HederaTokenService.sol#L614-L618


 - [ ] ID-85
Low level call in [HederaTokenService.setApprovalForAll(address,address,bool)](test_contracts/hts-precompile/HederaTokenService.sol#L421-L427):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.setApprovalForAll.selector,token,operator,approved))](test_contracts/hts-precompile/HederaTokenService.sol#L423-L425)

test_contracts/hts-precompile/HederaTokenService.sol#L421-L427


 - [ ] ID-86
Low level call in [HederaTokenService.getFungibleTokenInfo(address)](test_contracts/hts-precompile/HederaTokenService.sol#L216-L221):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getFungibleTokenInfo.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L217-L218)

test_contracts/hts-precompile/HederaTokenService.sol#L216-L221


 - [ ] ID-87
Low level call in [HederaTokenService.isApprovedForAll(address,address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L436-L445):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.isApprovedForAll.selector,token,owner,operator))](test_contracts/hts-precompile/HederaTokenService.sol#L438-L440)

test_contracts/hts-precompile/HederaTokenService.sol#L436-L445


 - [ ] ID-88
Low level call in [HederaTokenService.updateTokenInfo(address,IHederaTokenService.HederaToken)](test_contracts/hts-precompile/HederaTokenService.sol#L654-L658):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.updateTokenInfo.selector,token,tokenInfo))](test_contracts/hts-precompile/HederaTokenService.sol#L655-L656)

test_contracts/hts-precompile/HederaTokenService.sol#L654-L658


 - [ ] ID-89
Low level call in [HederaTokenService.mintToken(address,int64,bytes[])](test_contracts/hts-precompile/HederaTokenService.sol#L48-L58):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.mintToken.selector,token,amount,metadata))](test_contracts/hts-precompile/HederaTokenService.sol#L51-L53)

test_contracts/hts-precompile/HederaTokenService.sol#L48-L58


 - [ ] ID-90
Low level call in [HederaTokenService.transferTokens(address,address[],int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L475-L482):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferTokens.selector,token,accountIds,amounts))](test_contracts/hts-precompile/HederaTokenService.sol#L478-L480)

test_contracts/hts-precompile/HederaTokenService.sol#L475-L482


 - [ ] ID-91
Low level call in [HederaTokenService.getTokenType(address)](test_contracts/hts-precompile/HederaTokenService.sol#L624-L628):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenType.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L625-L626)

test_contracts/hts-precompile/HederaTokenService.sol#L624-L628


 - [ ] ID-92
Low level call in [HederaTokenService.dissociateToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L137-L142):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.dissociateToken.selector,account,token))](test_contracts/hts-precompile/HederaTokenService.sol#L138-L140)

test_contracts/hts-precompile/HederaTokenService.sol#L137-L142


 - [ ] ID-93
Low level call in [HederaTokenService.getApproved(address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L342-L351):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getApproved.selector,token,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L344-L346)

test_contracts/hts-precompile/HederaTokenService.sol#L342-L351


 - [ ] ID-94
Low level call in [HederaTokenService.getTokenDefaultKycStatus(address)](test_contracts/hts-precompile/HederaTokenService.sol#L461-L465):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenDefaultKycStatus.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L462-L463)

test_contracts/hts-precompile/HederaTokenService.sol#L461-L465


 - [ ] ID-95
Low level call in [HederaTokenService.associateToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L105-L110):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.associateToken.selector,account,token))](test_contracts/hts-precompile/HederaTokenService.sol#L106-L108)

test_contracts/hts-precompile/HederaTokenService.sol#L105-L110


 - [ ] ID-96
Low level call in [HederaTokenService.isFrozen(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L358-L362):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.isFrozen.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L359-L360)

test_contracts/hts-precompile/HederaTokenService.sol#L358-L362


 - [ ] ID-97
Low level call in [HederaTokenService.isKyc(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L369-L373):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.isKyc.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L370-L371)

test_contracts/hts-precompile/HederaTokenService.sol#L369-L373


 - [ ] ID-98
Low level call in [HederaTokenService.wipeTokenAccount(address,address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L555-L560):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.wipeTokenAccount.selector,token,account,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L557-L558)

test_contracts/hts-precompile/HederaTokenService.sol#L555-L560


 - [ ] ID-99
Low level call in [HederaTokenService.createFungibleTokenWithCustomFees(IHederaTokenService.HederaToken,int64,int32,IHederaTokenService.FixedFee[],IHederaTokenService.FractionalFee[])](test_contracts/hts-precompile/HederaTokenService.sol#L173-L184):
	- [(success,result) = precompileAddress.call{value: msg.value}(abi.encodeWithSelector(IHederaTokenService.createFungibleTokenWithCustomFees.selector,token,initialTotalSupply,decimals,fixedFees,fractionalFees))](test_contracts/hts-precompile/HederaTokenService.sol#L180-L182)

test_contracts/hts-precompile/HederaTokenService.sol#L173-L184


 - [ ] ID-100
Low level call in [HederaTokenService.pauseToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L533-L538):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.pauseToken.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L535-L536)

test_contracts/hts-precompile/HederaTokenService.sol#L533-L538


 - [ ] ID-101
Low level call in [HederaTokenService.updateTokenKeys(address,IHederaTokenService.TokenKey[])](test_contracts/hts-precompile/HederaTokenService.sol#L589-L594):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.updateTokenKeys.selector,token,keys))](test_contracts/hts-precompile/HederaTokenService.sol#L591-L592)

test_contracts/hts-precompile/HederaTokenService.sol#L589-L594


 - [ ] ID-102
Low level call in [HederaTokenService.revokeTokenKyc(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L409-L413):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.revokeTokenKyc.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L410-L411)

test_contracts/hts-precompile/HederaTokenService.sol#L409-L413


 - [ ] ID-103
Low level call in [HederaTokenService.transferNFT(address,address,address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L521-L528):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferNFT.selector,token,sender,receiver,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L524-L526)

test_contracts/hts-precompile/HederaTokenService.sol#L521-L528


 - [ ] ID-104
Low level call in [HederaTokenService.unfreezeToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L389-L393):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.unfreezeToken.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L390-L391)

test_contracts/hts-precompile/HederaTokenService.sol#L389-L393


 - [ ] ID-105
Low level call in [HederaTokenService.getTokenDefaultFreezeStatus(address)](test_contracts/hts-precompile/HederaTokenService.sol#L451-L455):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenDefaultFreezeStatus.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L452-L453)

test_contracts/hts-precompile/HederaTokenService.sol#L451-L455


 - [ ] ID-106
Low level call in [HederaTokenService.transferFromNFT(address,address,address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L300-L306):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFromNFT.selector,token,from,to,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L302-L304)

test_contracts/hts-precompile/HederaTokenService.sol#L300-L306


 - [ ] ID-107
Low level call in [HederaTokenService.transferNFTs(address,address[],address[],int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L489-L496):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferNFTs.selector,token,sender,receiver,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L492-L494)

test_contracts/hts-precompile/HederaTokenService.sol#L489-L496


 - [ ] ID-108
Low level call in [HederaTokenService.associateTokens(address,address[])](test_contracts/hts-precompile/HederaTokenService.sol#L98-L103):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.associateTokens.selector,account,tokens))](test_contracts/hts-precompile/HederaTokenService.sol#L99-L101)

test_contracts/hts-precompile/HederaTokenService.sol#L98-L103


 - [ ] ID-109
Low level call in [HederaTokenService.getTokenInfo(address)](test_contracts/hts-precompile/HederaTokenService.sol#L225-L230):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenInfo.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L226-L227)

test_contracts/hts-precompile/HederaTokenService.sol#L225-L230


 - [ ] ID-110
Low level call in [HederaTokenService.burnToken(address,int64,int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L69-L79):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.burnToken.selector,token,amount,serialNumbers))](test_contracts/hts-precompile/HederaTokenService.sol#L72-L74)

test_contracts/hts-precompile/HederaTokenService.sol#L69-L79


 - [ ] ID-111
Low level call in [HederaTokenService.getNonFungibleTokenInfo(address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L234-L239):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getNonFungibleTokenInfo.selector,token,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L235-L236)

test_contracts/hts-precompile/HederaTokenService.sol#L234-L239


 - [ ] ID-112
Low level call in [HederaTokenService.createNonFungibleTokenWithCustomFees(IHederaTokenService.HederaToken,IHederaTokenService.FixedFee[],IHederaTokenService.RoyaltyFee[])](test_contracts/hts-precompile/HederaTokenService.sol#L203-L212):
	- [(success,result) = precompileAddress.call{value: msg.value}(abi.encodeWithSelector(IHederaTokenService.createNonFungibleTokenWithCustomFees.selector,token,fixedFees,royaltyFees))](test_contracts/hts-precompile/HederaTokenService.sol#L208-L210)

test_contracts/hts-precompile/HederaTokenService.sol#L203-L212


 - [ ] ID-113
Low level call in [HederaTokenService.transferFrom(address,address,address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L285-L291):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFrom.selector,token,from,to,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L287-L289)

test_contracts/hts-precompile/HederaTokenService.sol#L285-L291


 - [ ] ID-114
Low level call in [HederaTokenService.approve(address,address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L269-L275):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.approve.selector,token,spender,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L271-L273)

test_contracts/hts-precompile/HederaTokenService.sol#L269-L275


 - [ ] ID-115
Low level call in [HederaTokenService.getTokenExpiryInfo(address)](test_contracts/hts-precompile/HederaTokenService.sol#L634-L639):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenExpiryInfo.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L635-L636)

test_contracts/hts-precompile/HederaTokenService.sol#L634-L639


## naming-convention
Impact: Informational
Confidence: High
 - [ ] ID-116
Constant [HederaTokenService.defaultAutoRenewPeriod](test_contracts/hts-precompile/HederaTokenService.sol#L11) is not in UPPER_CASE_WITH_UNDERSCORES

test_contracts/hts-precompile/HederaTokenService.sol#L11


 - [ ] ID-117
Constant [HederaTokenService.precompileAddress](test_contracts/hts-precompile/HederaTokenService.sol#L9) is not in UPPER_CASE_WITH_UNDERSCORES

test_contracts/hts-precompile/HederaTokenService.sol#L9


