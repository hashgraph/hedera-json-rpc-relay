**THIS CHECKLIST IS NOT COMPLETE**. Use `--show-ignored-findings` to show all the results.
Summary
 - [uninitialized-local](#uninitialized-local) (11 results) (Medium)
 - [shadowing-local](#shadowing-local) (3 results) (Low)
 - [missing-zero-check](#missing-zero-check) (7 results) (Low)
 - [reentrancy-events](#reentrancy-events) (7 results) (Low)
 - [pragma](#pragma) (1 results) (Informational)
 - [dead-code](#dead-code) (37 results) (Informational)
 - [solc-version](#solc-version) (6 results) (Informational)
 - [low-level-calls](#low-level-calls) (48 results) (Informational)
 - [naming-convention](#naming-convention) (2 results) (Informational)
## uninitialized-local
Impact: Medium
Confidence: Medium
 - [ ] ID-0
[AtomicHTS.batchWipeMintTransfer(address,address,address,int64,int64,int64).metadata](test_contracts/hts-precompile/AtomicHTS.sol#L121) is a local variable never initialized

test_contracts/hts-precompile/AtomicHTS.sol#L121


 - [ ] ID-1
[AtomicHTS.batchMintUnfreezeGrantKYCTransferFreeze(address,address,address,int64,int64).metadata](test_contracts/hts-precompile/AtomicHTS.sol#L139) is a local variable never initialized

test_contracts/hts-precompile/AtomicHTS.sol#L139


 - [ ] ID-2
[HederaTokenService.getTokenCustomFees(address).defaultFixedFees](test_contracts/hts-precompile/HederaTokenService.sol#L253) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L253


 - [ ] ID-3
[HederaTokenService.getTokenInfo(address).defaultTokenInfo](test_contracts/hts-precompile/HederaTokenService.sol#L228) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L228


 - [ ] ID-4
[HederaTokenService.getTokenCustomFees(address).defaultRoyaltyFees](test_contracts/hts-precompile/HederaTokenService.sol#L255) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L255


 - [ ] ID-5
[HederaTokenService.getTokenCustomFees(address).defaultFractionalFees](test_contracts/hts-precompile/HederaTokenService.sol#L254) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L254


 - [ ] ID-6
[AtomicHTS.batchAssociateMintGrantTransfer(address,address,address,int64).metadata](test_contracts/hts-precompile/AtomicHTS.sol#L170) is a local variable never initialized

test_contracts/hts-precompile/AtomicHTS.sol#L170


 - [ ] ID-7
[HederaTokenService.getNonFungibleTokenInfo(address,int64).defaultTokenInfo](test_contracts/hts-precompile/HederaTokenService.sol#L237) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L237


 - [ ] ID-8
[HederaTokenService.getTokenExpiryInfo(address).defaultExpiryInfo](test_contracts/hts-precompile/HederaTokenService.sol#L637) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L637


 - [ ] ID-9
[HederaTokenService.getFungibleTokenInfo(address).defaultTokenInfo](test_contracts/hts-precompile/HederaTokenService.sol#L219) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L219


 - [ ] ID-10
[HederaTokenService.getTokenKey(address,uint256).defaultKeyValueInfo](test_contracts/hts-precompile/HederaTokenService.sol#L605) is a local variable never initialized

test_contracts/hts-precompile/HederaTokenService.sol#L605


## shadowing-local
Impact: Low
Confidence: High
 - [ ] ID-11
[IHederaTokenService.isToken(address).isToken](test_contracts/hts-precompile/IHederaTokenService.sol#L788) shadows:
	- [IHederaTokenService.isToken(address)](test_contracts/hts-precompile/IHederaTokenService.sol#L786-L788) (function)

test_contracts/hts-precompile/IHederaTokenService.sol#L788


 - [ ] ID-12
[AtomicHTS.batchApproveAssociateGrantKYCTransferFrom(address,address,address,int64,uint256).allowance](test_contracts/hts-precompile/AtomicHTS.sol#L57) shadows:
	- [HederaTokenService.allowance(address,address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L314-L320) (function)

test_contracts/hts-precompile/AtomicHTS.sol#L57


 - [ ] ID-13
[IHederaTokenService.allowance(address,address,address).allowance](test_contracts/hts-precompile/IHederaTokenService.sol#L545) shadows:
	- [IHederaTokenService.allowance(address,address,address)](test_contracts/hts-precompile/IHederaTokenService.sol#L541-L545) (function)

test_contracts/hts-precompile/IHederaTokenService.sol#L545


## missing-zero-check
Impact: Low
Confidence: Medium
 - [ ] ID-14
[HederaTokenService.redirectForToken(address,bytes).token](test_contracts/hts-precompile/HederaTokenService.sol#L665) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.redirectForToken.selector,token,encodedFunctionSelector))](test_contracts/hts-precompile/HederaTokenService.sol#L666-L668)

test_contracts/hts-precompile/HederaTokenService.sol#L665


 - [ ] ID-15
[HederaTokenService.transferFrom(address,address,address,uint256).from](test_contracts/hts-precompile/HederaTokenService.sol#L285) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFrom.selector,token,from,to,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L287-L289)

test_contracts/hts-precompile/HederaTokenService.sol#L285


 - [ ] ID-16
[HederaTokenService.transferFromNFT(address,address,address,uint256).token](test_contracts/hts-precompile/HederaTokenService.sol#L300) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFromNFT.selector,token,from,to,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L302-L304)

test_contracts/hts-precompile/HederaTokenService.sol#L300


 - [ ] ID-17
[HederaTokenService.transferFromNFT(address,address,address,uint256).from](test_contracts/hts-precompile/HederaTokenService.sol#L300) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFromNFT.selector,token,from,to,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L302-L304)

test_contracts/hts-precompile/HederaTokenService.sol#L300


 - [ ] ID-18
[HederaTokenService.transferFromNFT(address,address,address,uint256).to](test_contracts/hts-precompile/HederaTokenService.sol#L300) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFromNFT.selector,token,from,to,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L302-L304)

test_contracts/hts-precompile/HederaTokenService.sol#L300


 - [ ] ID-19
[HederaTokenService.transferFrom(address,address,address,uint256).to](test_contracts/hts-precompile/HederaTokenService.sol#L285) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFrom.selector,token,from,to,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L287-L289)

test_contracts/hts-precompile/HederaTokenService.sol#L285


 - [ ] ID-20
[HederaTokenService.transferFrom(address,address,address,uint256).token](test_contracts/hts-precompile/HederaTokenService.sol#L285) lacks a zero-check on :
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFrom.selector,token,from,to,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L287-L289)

test_contracts/hts-precompile/HederaTokenService.sol#L285


## reentrancy-events
Impact: Low
Confidence: Medium
 - [ ] ID-21
Reentrancy in [AtomicHTS.batchMintUnfreezeGrantKYCTransferFreeze(address,address,address,int64,int64)](test_contracts/hts-precompile/AtomicHTS.sol#L138-L156):
	External calls:
	- [(mintTokenResponseCode) = HederaTokenService.mintToken(token,mintAmount,metadata)](test_contracts/hts-precompile/AtomicHTS.sol#L140)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.mintToken.selector,token,amount,metadata))](test_contracts/hts-precompile/HederaTokenService.sol#L51-L53)
	- [unfreezeTokenResponseCode = HederaTokenService.unfreezeToken(token,receiver)](test_contracts/hts-precompile/AtomicHTS.sol#L143)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.unfreezeToken.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L390-L391)
	- [grantKYCResponseCode = HederaTokenService.grantTokenKyc(token,receiver)](test_contracts/hts-precompile/AtomicHTS.sol#L146)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.grantTokenKyc.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L400-L401)
	- [transferTokenResponseCode = HederaTokenService.transferToken(token,sender,receiver,transferAmount)](test_contracts/hts-precompile/AtomicHTS.sol#L149)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferToken.selector,token,sender,receiver,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L508-L510)
	- [freezeTokenResponseCode = HederaTokenService.freezeToken(token,receiver)](test_contracts/hts-precompile/AtomicHTS.sol#L152)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.freezeToken.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L380-L381)
	Event emitted after the call(s):
	- [BatchMintUnfreezeGrantKYCTransferFreeze(mintTokenResponseCode,unfreezeTokenResponseCode,grantKYCResponseCode,freezeTokenResponseCode)](test_contracts/hts-precompile/AtomicHTS.sol#L155)

test_contracts/hts-precompile/AtomicHTS.sol#L138-L156


 - [ ] ID-22
Reentrancy in [HederaTokenService.redirectForToken(address,bytes)](test_contracts/hts-precompile/HederaTokenService.sol#L665-L672):
	External calls:
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.redirectForToken.selector,token,encodedFunctionSelector))](test_contracts/hts-precompile/HederaTokenService.sol#L666-L668)
	Event emitted after the call(s):
	- [CallResponseEvent(success,result)](test_contracts/hts-precompile/HederaTokenService.sol#L670)

test_contracts/hts-precompile/HederaTokenService.sol#L665-L672


 - [ ] ID-23
Reentrancy in [AtomicHTS.batchAssociateMintGrantTransfer(address,address,address,int64)](test_contracts/hts-precompile/AtomicHTS.sol#L162-L181):
	External calls:
	- [associateResponseCode = HederaTokenService.associateToken(receiver,token)](test_contracts/hts-precompile/AtomicHTS.sol#L163)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.associateToken.selector,account,token))](test_contracts/hts-precompile/HederaTokenService.sol#L106-L108)
	- [(mintTokenResponseCode) = HederaTokenService.mintToken(token,amount,metadata)](test_contracts/hts-precompile/AtomicHTS.sol#L171)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.mintToken.selector,token,amount,metadata))](test_contracts/hts-precompile/HederaTokenService.sol#L51-L53)
	- [grantKYCResponseCode = HederaTokenService.grantTokenKyc(token,receiver)](test_contracts/hts-precompile/AtomicHTS.sol#L174)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.grantTokenKyc.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L400-L401)
	- [transferTokenResponseCode = HederaTokenService.transferToken(token,sender,receiver,amount)](test_contracts/hts-precompile/AtomicHTS.sol#L177)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferToken.selector,token,sender,receiver,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L508-L510)
	Event emitted after the call(s):
	- [BatchAssociateMintGrantTransfer(associateResponseCode,mintTokenResponseCode,grantKYCResponseCode,transferTokenResponseCode)](test_contracts/hts-precompile/AtomicHTS.sol#L180)

test_contracts/hts-precompile/AtomicHTS.sol#L162-L181


 - [ ] ID-24
Reentrancy in [AtomicHTS.batchWipeMintTransfer(address,address,address,int64,int64,int64)](test_contracts/hts-precompile/AtomicHTS.sol#L120-L132):
	External calls:
	- [wipeTokenResponseCode = HederaTokenService.wipeTokenAccount(token,owner,wipedAmount)](test_contracts/hts-precompile/AtomicHTS.sol#L122)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.wipeTokenAccount.selector,token,account,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L557-L558)
	- [(mintTokenResponseCode) = HederaTokenService.mintToken(token,mintAmount,metadata)](test_contracts/hts-precompile/AtomicHTS.sol#L125)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.mintToken.selector,token,amount,metadata))](test_contracts/hts-precompile/HederaTokenService.sol#L51-L53)
	- [transferTokenResponseCode = HederaTokenService.transferToken(token,treasury,owner,transferAmount)](test_contracts/hts-precompile/AtomicHTS.sol#L128)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferToken.selector,token,sender,receiver,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L508-L510)
	Event emitted after the call(s):
	- [BatchWipeMintTransfer(wipeTokenResponseCode,mintTokenResponseCode,transferTokenResponseCode)](test_contracts/hts-precompile/AtomicHTS.sol#L131)

test_contracts/hts-precompile/AtomicHTS.sol#L120-L132


 - [ ] ID-25
Reentrancy in [AtomicHTS.batchApproveAssociateGrantKYCTransferFrom(address,address,address,int64,uint256)](test_contracts/hts-precompile/AtomicHTS.sol#L57-L94):
	External calls:
	- [associateContractResponseCode = HederaTokenService.associateToken(spender,token)](test_contracts/hts-precompile/AtomicHTS.sol#L62)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.associateToken.selector,account,token))](test_contracts/hts-precompile/HederaTokenService.sol#L106-L108)
	- [grantKYCContractResponseCode = HederaTokenService.grantTokenKyc(token,spender)](test_contracts/hts-precompile/AtomicHTS.sol#L69)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.grantTokenKyc.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L400-L401)
	- [transferTokenResponseCode = HederaTokenService.transferToken(token,owner,spender,transferAmount)](test_contracts/hts-precompile/AtomicHTS.sol#L72)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferToken.selector,token,sender,receiver,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L508-L510)
	- [approveResponseCode = HederaTokenService.approve(token,spender,allowance)](test_contracts/hts-precompile/AtomicHTS.sol#L77)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.approve.selector,token,spender,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L271-L273)
	- [associateResponseCode = HederaTokenService.associateToken(receipient,token)](test_contracts/hts-precompile/AtomicHTS.sol#L80)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.associateToken.selector,account,token))](test_contracts/hts-precompile/HederaTokenService.sol#L106-L108)
	- [grantKYCResponseCode = HederaTokenService.grantTokenKyc(token,receipient)](test_contracts/hts-precompile/AtomicHTS.sol#L87)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.grantTokenKyc.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L400-L401)
	- [transferFromResponseCode = this.transferFrom(token,spender,receipient,allowance)](test_contracts/hts-precompile/AtomicHTS.sol#L90)
	Event emitted after the call(s):
	- [BatchApproveAssociateGrantKYCTransferFrom(transferTokenResponseCode,approveResponseCode,associateResponseCode,grantKYCResponseCode,transferFromResponseCode)](test_contracts/hts-precompile/AtomicHTS.sol#L93)

test_contracts/hts-precompile/AtomicHTS.sol#L57-L94


 - [ ] ID-26
Reentrancy in [AtomicHTS.batchUnfreezeGrantKYCTransferFreeze(address,address,address,int64)](test_contracts/hts-precompile/AtomicHTS.sol#L100-L114):
	External calls:
	- [unfreezeTokenResponseCode = HederaTokenService.unfreezeToken(token,receiver)](test_contracts/hts-precompile/AtomicHTS.sol#L101)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.unfreezeToken.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L390-L391)
	- [grantKYCResponseCode = HederaTokenService.grantTokenKyc(token,receiver)](test_contracts/hts-precompile/AtomicHTS.sol#L104)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.grantTokenKyc.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L400-L401)
	- [transferTokenResponseCode = HederaTokenService.transferToken(token,sender,receiver,amount)](test_contracts/hts-precompile/AtomicHTS.sol#L107)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferToken.selector,token,sender,receiver,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L508-L510)
	- [freezeTokenResponseCode = HederaTokenService.freezeToken(token,receiver)](test_contracts/hts-precompile/AtomicHTS.sol#L110)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.freezeToken.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L380-L381)
	Event emitted after the call(s):
	- [BatchUnfreezeGrantKYCTransferFreeze(unfreezeTokenResponseCode,grantKYCResponseCode,transferTokenResponseCode,freezeTokenResponseCode)](test_contracts/hts-precompile/AtomicHTS.sol#L113)

test_contracts/hts-precompile/AtomicHTS.sol#L100-L114


 - [ ] ID-27
Reentrancy in [AtomicHTS.batchAssociateGrantKYCTransfer(address,address,address,int64)](test_contracts/hts-precompile/AtomicHTS.sol#L29-L45):
	External calls:
	- [associateResponseCode = HederaTokenService.associateToken(receiver,token)](test_contracts/hts-precompile/AtomicHTS.sol#L30)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.associateToken.selector,account,token))](test_contracts/hts-precompile/HederaTokenService.sol#L106-L108)
	- [grantKYCResponseCode = HederaTokenService.grantTokenKyc(token,receiver)](test_contracts/hts-precompile/AtomicHTS.sol#L38)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.grantTokenKyc.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L400-L401)
	- [transferTokenResponseCode = HederaTokenService.transferToken(token,sender,receiver,amount)](test_contracts/hts-precompile/AtomicHTS.sol#L41)
		- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferToken.selector,token,sender,receiver,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L508-L510)
	Event emitted after the call(s):
	- [BatchAssociateGrantKYCTransfer(associateResponseCode,grantKYCResponseCode,transferTokenResponseCode)](test_contracts/hts-precompile/AtomicHTS.sol#L44)

test_contracts/hts-precompile/AtomicHTS.sol#L29-L45


## pragma
Impact: Informational
Confidence: High
 - [ ] ID-28
Different versions of Solidity are used:
	- Version used: ['>=0.4.9<0.9.0', '>=0.5.0<0.9.0', '^0.8.20']
	- [>=0.4.9<0.9.0](test_contracts/hts-precompile/HederaResponseCodes.sol#L2)
	- [>=0.4.9<0.9.0](test_contracts/hts-precompile/IHRC.sol#L2)
	- [>=0.4.9<0.9.0](test_contracts/hts-precompile/IHederaTokenService.sol#L2)
	- [>=0.5.0<0.9.0](test_contracts/hts-precompile/HederaTokenService.sol#L2)
	- [ABIEncoderV2](test_contracts/hts-precompile/HederaTokenService.sol#L3)
	- [ABIEncoderV2](test_contracts/hts-precompile/IHederaTokenService.sol#L3)
	- [^0.8.20](test_contracts/hts-precompile/AtomicHTS.sol#L2)

test_contracts/hts-precompile/HederaResponseCodes.sol#L2


## dead-code
Impact: Informational
Confidence: Medium
 - [ ] ID-29
[HederaTokenService.transferNFTs(address,address[],address[],int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L489-L496) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L489-L496


 - [ ] ID-30
[HederaTokenService.getNonFungibleTokenInfo(address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L234-L239) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L234-L239


 - [ ] ID-31
[HederaTokenService.getTokenInfo(address)](test_contracts/hts-precompile/HederaTokenService.sol#L225-L230) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L225-L230


 - [ ] ID-32
[HederaTokenService.dissociateToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L137-L142) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L137-L142


 - [ ] ID-33
[HederaTokenService.transferTokens(address,address[],int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L475-L482) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L475-L482


 - [ ] ID-34
[HederaTokenService.updateTokenInfo(address,IHederaTokenService.HederaToken)](test_contracts/hts-precompile/HederaTokenService.sol#L654-L658) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L654-L658


 - [ ] ID-35
[HederaTokenService.createFungibleToken(IHederaTokenService.HederaToken,int64,int32)](test_contracts/hts-precompile/HederaTokenService.sol#L151-L162) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L151-L162


 - [ ] ID-36
[HederaTokenService.isToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L614-L618) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L614-L618


 - [ ] ID-37
[HederaTokenService.pauseToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L533-L538) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L533-L538


 - [ ] ID-38
[HederaTokenService.createFungibleTokenWithCustomFees(IHederaTokenService.HederaToken,int64,int32,IHederaTokenService.FixedFee[],IHederaTokenService.FractionalFee[])](test_contracts/hts-precompile/HederaTokenService.sol#L173-L184) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L173-L184


 - [ ] ID-39
[HederaTokenService.getTokenCustomFees(address)](test_contracts/hts-precompile/HederaTokenService.sol#L247-L260) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L247-L260


 - [ ] ID-40
[HederaTokenService.cryptoTransfer(IHederaTokenService.TransferList,IHederaTokenService.TokenTransferList[])](test_contracts/hts-precompile/HederaTokenService.sol#L29-L35) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L29-L35


 - [ ] ID-41
[HederaTokenService.transferNFT(address,address,address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L521-L528) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L521-L528


 - [ ] ID-42
[HederaTokenService.approveNFT(address,address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L328-L334) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L328-L334


 - [ ] ID-43
[HederaTokenService.setApprovalForAll(address,address,bool)](test_contracts/hts-precompile/HederaTokenService.sol#L421-L427) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L421-L427


 - [ ] ID-44
[HederaTokenService.getTokenDefaultKycStatus(address)](test_contracts/hts-precompile/HederaTokenService.sol#L461-L465) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L461-L465


 - [ ] ID-45
[HederaTokenService.getTokenExpiryInfo(address)](test_contracts/hts-precompile/HederaTokenService.sol#L634-L639) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L634-L639


 - [ ] ID-46
[HederaTokenService.updateTokenExpiryInfo(address,IHederaTokenService.Expiry)](test_contracts/hts-precompile/HederaTokenService.sol#L644-L648) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L644-L648


 - [ ] ID-47
[HederaTokenService.createNonFungibleTokenWithCustomFees(IHederaTokenService.HederaToken,IHederaTokenService.FixedFee[],IHederaTokenService.RoyaltyFee[])](test_contracts/hts-precompile/HederaTokenService.sol#L203-L212) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L203-L212


 - [ ] ID-48
[HederaTokenService.wipeTokenAccountNFT(address,address,int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L567-L573) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L567-L573


 - [ ] ID-49
[HederaTokenService.burnToken(address,int64,int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L69-L79) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L69-L79


 - [ ] ID-50
[HederaTokenService.getApproved(address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L342-L351) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L342-L351


 - [ ] ID-51
[HederaTokenService.isKyc(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L369-L373) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L369-L373


 - [ ] ID-52
[HederaTokenService.dissociateTokens(address,address[])](test_contracts/hts-precompile/HederaTokenService.sol#L130-L135) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L130-L135


 - [ ] ID-53
[HederaTokenService.getFungibleTokenInfo(address)](test_contracts/hts-precompile/HederaTokenService.sol#L216-L221) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L216-L221


 - [ ] ID-54
[HederaTokenService.allowance(address,address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L314-L320) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L314-L320


 - [ ] ID-55
[HederaTokenService.getTokenType(address)](test_contracts/hts-precompile/HederaTokenService.sol#L624-L628) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L624-L628


 - [ ] ID-56
[HederaTokenService.unpauseToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L543-L548) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L543-L548


 - [ ] ID-57
[HederaTokenService.deleteToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L578-L583) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L578-L583


 - [ ] ID-58
[HederaTokenService.updateTokenKeys(address,IHederaTokenService.TokenKey[])](test_contracts/hts-precompile/HederaTokenService.sol#L589-L594) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L589-L594


 - [ ] ID-59
[HederaTokenService.isFrozen(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L358-L362) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L358-L362


 - [ ] ID-60
[HederaTokenService.getTokenDefaultFreezeStatus(address)](test_contracts/hts-precompile/HederaTokenService.sol#L451-L455) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L451-L455


 - [ ] ID-61
[HederaTokenService.associateTokens(address,address[])](test_contracts/hts-precompile/HederaTokenService.sol#L98-L103) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L98-L103


 - [ ] ID-62
[HederaTokenService.revokeTokenKyc(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L409-L413) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L409-L413


 - [ ] ID-63
[HederaTokenService.getTokenKey(address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L601-L607) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L601-L607


 - [ ] ID-64
[HederaTokenService.createNonFungibleToken(IHederaTokenService.HederaToken)](test_contracts/hts-precompile/HederaTokenService.sol#L190-L195) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L190-L195


 - [ ] ID-65
[HederaTokenService.isApprovedForAll(address,address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L436-L445) is never used and should be removed

test_contracts/hts-precompile/HederaTokenService.sol#L436-L445


## solc-version
Impact: Informational
Confidence: High
 - [ ] ID-66
Pragma version[>=0.4.9<0.9.0](test_contracts/hts-precompile/HederaResponseCodes.sol#L2) is too complex

test_contracts/hts-precompile/HederaResponseCodes.sol#L2


 - [ ] ID-67
Pragma version[>=0.5.0<0.9.0](test_contracts/hts-precompile/HederaTokenService.sol#L2) is too complex

test_contracts/hts-precompile/HederaTokenService.sol#L2


 - [ ] ID-68
Pragma version[^0.8.20](test_contracts/hts-precompile/AtomicHTS.sol#L2) necessitates a version too recent to be trusted. Consider deploying with 0.8.18.

test_contracts/hts-precompile/AtomicHTS.sol#L2


 - [ ] ID-69
solc-0.8.20 is not recommended for deployment

 - [ ] ID-70
Pragma version[>=0.4.9<0.9.0](test_contracts/hts-precompile/IHederaTokenService.sol#L2) is too complex

test_contracts/hts-precompile/IHederaTokenService.sol#L2


 - [ ] ID-71
Pragma version[>=0.4.9<0.9.0](test_contracts/hts-precompile/IHRC.sol#L2) is too complex

test_contracts/hts-precompile/IHRC.sol#L2


## low-level-calls
Impact: Informational
Confidence: High
 - [ ] ID-72
Low level call in [HederaTokenService.wipeTokenAccountNFT(address,address,int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L567-L573):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.wipeTokenAccountNFT.selector,token,account,serialNumbers))](test_contracts/hts-precompile/HederaTokenService.sol#L570-L571)

test_contracts/hts-precompile/HederaTokenService.sol#L567-L573


 - [ ] ID-73
Low level call in [HederaTokenService.unpauseToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L543-L548):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.unpauseToken.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L545-L546)

test_contracts/hts-precompile/HederaTokenService.sol#L543-L548


 - [ ] ID-74
Low level call in [HederaTokenService.getTokenKey(address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L601-L607):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenKey.selector,token,keyType))](test_contracts/hts-precompile/HederaTokenService.sol#L603-L604)

test_contracts/hts-precompile/HederaTokenService.sol#L601-L607


 - [ ] ID-75
Low level call in [HederaTokenService.deleteToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L578-L583):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.deleteToken.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L580-L581)

test_contracts/hts-precompile/HederaTokenService.sol#L578-L583


 - [ ] ID-76
Low level call in [HederaTokenService.redirectForToken(address,bytes)](test_contracts/hts-precompile/HederaTokenService.sol#L665-L672):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.redirectForToken.selector,token,encodedFunctionSelector))](test_contracts/hts-precompile/HederaTokenService.sol#L666-L668)

test_contracts/hts-precompile/HederaTokenService.sol#L665-L672


 - [ ] ID-77
Low level call in [HederaTokenService.createNonFungibleToken(IHederaTokenService.HederaToken)](test_contracts/hts-precompile/HederaTokenService.sol#L190-L195):
	- [(success,result) = precompileAddress.call{value: msg.value}(abi.encodeWithSelector(IHederaTokenService.createNonFungibleToken.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L192-L193)

test_contracts/hts-precompile/HederaTokenService.sol#L190-L195


 - [ ] ID-78
Low level call in [HederaTokenService.allowance(address,address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L314-L320):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.allowance.selector,token,owner,spender))](test_contracts/hts-precompile/HederaTokenService.sol#L316-L318)

test_contracts/hts-precompile/HederaTokenService.sol#L314-L320


 - [ ] ID-79
Low level call in [HederaTokenService.freezeToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L379-L383):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.freezeToken.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L380-L381)

test_contracts/hts-precompile/HederaTokenService.sol#L379-L383


 - [ ] ID-80
Low level call in [HederaTokenService.createFungibleToken(IHederaTokenService.HederaToken,int64,int32)](test_contracts/hts-precompile/HederaTokenService.sol#L151-L162):
	- [(success,result) = precompileAddress.call{value: msg.value}(abi.encodeWithSelector(IHederaTokenService.createFungibleToken.selector,token,initialTotalSupply,decimals))](test_contracts/hts-precompile/HederaTokenService.sol#L156-L158)

test_contracts/hts-precompile/HederaTokenService.sol#L151-L162


 - [ ] ID-81
Low level call in [HederaTokenService.approveNFT(address,address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L328-L334):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.approveNFT.selector,token,approved,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L330-L332)

test_contracts/hts-precompile/HederaTokenService.sol#L328-L334


 - [ ] ID-82
Low level call in [HederaTokenService.updateTokenExpiryInfo(address,IHederaTokenService.Expiry)](test_contracts/hts-precompile/HederaTokenService.sol#L644-L648):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.updateTokenExpiryInfo.selector,token,expiryInfo))](test_contracts/hts-precompile/HederaTokenService.sol#L645-L646)

test_contracts/hts-precompile/HederaTokenService.sol#L644-L648


 - [ ] ID-83
Low level call in [HederaTokenService.transferToken(address,address,address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L505-L512):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferToken.selector,token,sender,receiver,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L508-L510)

test_contracts/hts-precompile/HederaTokenService.sol#L505-L512


 - [ ] ID-84
Low level call in [HederaTokenService.getTokenCustomFees(address)](test_contracts/hts-precompile/HederaTokenService.sol#L247-L260):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenCustomFees.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L251-L252)

test_contracts/hts-precompile/HederaTokenService.sol#L247-L260


 - [ ] ID-85
Low level call in [HederaTokenService.cryptoTransfer(IHederaTokenService.TransferList,IHederaTokenService.TokenTransferList[])](test_contracts/hts-precompile/HederaTokenService.sol#L29-L35):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.cryptoTransfer.selector,transferList,tokenTransfers))](test_contracts/hts-precompile/HederaTokenService.sol#L32-L33)

test_contracts/hts-precompile/HederaTokenService.sol#L29-L35


 - [ ] ID-86
Low level call in [HederaTokenService.grantTokenKyc(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L399-L403):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.grantTokenKyc.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L400-L401)

test_contracts/hts-precompile/HederaTokenService.sol#L399-L403


 - [ ] ID-87
Low level call in [HederaTokenService.dissociateTokens(address,address[])](test_contracts/hts-precompile/HederaTokenService.sol#L130-L135):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.dissociateTokens.selector,account,tokens))](test_contracts/hts-precompile/HederaTokenService.sol#L131-L133)

test_contracts/hts-precompile/HederaTokenService.sol#L130-L135


 - [ ] ID-88
Low level call in [HederaTokenService.isToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L614-L618):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.isToken.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L615-L616)

test_contracts/hts-precompile/HederaTokenService.sol#L614-L618


 - [ ] ID-89
Low level call in [HederaTokenService.setApprovalForAll(address,address,bool)](test_contracts/hts-precompile/HederaTokenService.sol#L421-L427):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.setApprovalForAll.selector,token,operator,approved))](test_contracts/hts-precompile/HederaTokenService.sol#L423-L425)

test_contracts/hts-precompile/HederaTokenService.sol#L421-L427


 - [ ] ID-90
Low level call in [HederaTokenService.getFungibleTokenInfo(address)](test_contracts/hts-precompile/HederaTokenService.sol#L216-L221):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getFungibleTokenInfo.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L217-L218)

test_contracts/hts-precompile/HederaTokenService.sol#L216-L221


 - [ ] ID-91
Low level call in [HederaTokenService.isApprovedForAll(address,address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L436-L445):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.isApprovedForAll.selector,token,owner,operator))](test_contracts/hts-precompile/HederaTokenService.sol#L438-L440)

test_contracts/hts-precompile/HederaTokenService.sol#L436-L445


 - [ ] ID-92
Low level call in [HederaTokenService.updateTokenInfo(address,IHederaTokenService.HederaToken)](test_contracts/hts-precompile/HederaTokenService.sol#L654-L658):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.updateTokenInfo.selector,token,tokenInfo))](test_contracts/hts-precompile/HederaTokenService.sol#L655-L656)

test_contracts/hts-precompile/HederaTokenService.sol#L654-L658


 - [ ] ID-93
Low level call in [HederaTokenService.mintToken(address,int64,bytes[])](test_contracts/hts-precompile/HederaTokenService.sol#L48-L58):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.mintToken.selector,token,amount,metadata))](test_contracts/hts-precompile/HederaTokenService.sol#L51-L53)

test_contracts/hts-precompile/HederaTokenService.sol#L48-L58


 - [ ] ID-94
Low level call in [HederaTokenService.transferTokens(address,address[],int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L475-L482):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferTokens.selector,token,accountIds,amounts))](test_contracts/hts-precompile/HederaTokenService.sol#L478-L480)

test_contracts/hts-precompile/HederaTokenService.sol#L475-L482


 - [ ] ID-95
Low level call in [HederaTokenService.getTokenType(address)](test_contracts/hts-precompile/HederaTokenService.sol#L624-L628):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenType.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L625-L626)

test_contracts/hts-precompile/HederaTokenService.sol#L624-L628


 - [ ] ID-96
Low level call in [HederaTokenService.dissociateToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L137-L142):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.dissociateToken.selector,account,token))](test_contracts/hts-precompile/HederaTokenService.sol#L138-L140)

test_contracts/hts-precompile/HederaTokenService.sol#L137-L142


 - [ ] ID-97
Low level call in [HederaTokenService.getApproved(address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L342-L351):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getApproved.selector,token,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L344-L346)

test_contracts/hts-precompile/HederaTokenService.sol#L342-L351


 - [ ] ID-98
Low level call in [HederaTokenService.getTokenDefaultKycStatus(address)](test_contracts/hts-precompile/HederaTokenService.sol#L461-L465):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenDefaultKycStatus.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L462-L463)

test_contracts/hts-precompile/HederaTokenService.sol#L461-L465


 - [ ] ID-99
Low level call in [HederaTokenService.associateToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L105-L110):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.associateToken.selector,account,token))](test_contracts/hts-precompile/HederaTokenService.sol#L106-L108)

test_contracts/hts-precompile/HederaTokenService.sol#L105-L110


 - [ ] ID-100
Low level call in [HederaTokenService.isFrozen(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L358-L362):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.isFrozen.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L359-L360)

test_contracts/hts-precompile/HederaTokenService.sol#L358-L362


 - [ ] ID-101
Low level call in [HederaTokenService.isKyc(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L369-L373):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.isKyc.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L370-L371)

test_contracts/hts-precompile/HederaTokenService.sol#L369-L373


 - [ ] ID-102
Low level call in [HederaTokenService.wipeTokenAccount(address,address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L555-L560):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.wipeTokenAccount.selector,token,account,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L557-L558)

test_contracts/hts-precompile/HederaTokenService.sol#L555-L560


 - [ ] ID-103
Low level call in [HederaTokenService.createFungibleTokenWithCustomFees(IHederaTokenService.HederaToken,int64,int32,IHederaTokenService.FixedFee[],IHederaTokenService.FractionalFee[])](test_contracts/hts-precompile/HederaTokenService.sol#L173-L184):
	- [(success,result) = precompileAddress.call{value: msg.value}(abi.encodeWithSelector(IHederaTokenService.createFungibleTokenWithCustomFees.selector,token,initialTotalSupply,decimals,fixedFees,fractionalFees))](test_contracts/hts-precompile/HederaTokenService.sol#L180-L182)

test_contracts/hts-precompile/HederaTokenService.sol#L173-L184


 - [ ] ID-104
Low level call in [HederaTokenService.pauseToken(address)](test_contracts/hts-precompile/HederaTokenService.sol#L533-L538):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.pauseToken.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L535-L536)

test_contracts/hts-precompile/HederaTokenService.sol#L533-L538


 - [ ] ID-105
Low level call in [HederaTokenService.updateTokenKeys(address,IHederaTokenService.TokenKey[])](test_contracts/hts-precompile/HederaTokenService.sol#L589-L594):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.updateTokenKeys.selector,token,keys))](test_contracts/hts-precompile/HederaTokenService.sol#L591-L592)

test_contracts/hts-precompile/HederaTokenService.sol#L589-L594


 - [ ] ID-106
Low level call in [HederaTokenService.revokeTokenKyc(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L409-L413):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.revokeTokenKyc.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L410-L411)

test_contracts/hts-precompile/HederaTokenService.sol#L409-L413


 - [ ] ID-107
Low level call in [HederaTokenService.transferNFT(address,address,address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L521-L528):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferNFT.selector,token,sender,receiver,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L524-L526)

test_contracts/hts-precompile/HederaTokenService.sol#L521-L528


 - [ ] ID-108
Low level call in [HederaTokenService.unfreezeToken(address,address)](test_contracts/hts-precompile/HederaTokenService.sol#L389-L393):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.unfreezeToken.selector,token,account))](test_contracts/hts-precompile/HederaTokenService.sol#L390-L391)

test_contracts/hts-precompile/HederaTokenService.sol#L389-L393


 - [ ] ID-109
Low level call in [HederaTokenService.getTokenDefaultFreezeStatus(address)](test_contracts/hts-precompile/HederaTokenService.sol#L451-L455):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenDefaultFreezeStatus.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L452-L453)

test_contracts/hts-precompile/HederaTokenService.sol#L451-L455


 - [ ] ID-110
Low level call in [HederaTokenService.transferFromNFT(address,address,address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L300-L306):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFromNFT.selector,token,from,to,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L302-L304)

test_contracts/hts-precompile/HederaTokenService.sol#L300-L306


 - [ ] ID-111
Low level call in [HederaTokenService.transferNFTs(address,address[],address[],int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L489-L496):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferNFTs.selector,token,sender,receiver,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L492-L494)

test_contracts/hts-precompile/HederaTokenService.sol#L489-L496


 - [ ] ID-112
Low level call in [HederaTokenService.associateTokens(address,address[])](test_contracts/hts-precompile/HederaTokenService.sol#L98-L103):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.associateTokens.selector,account,tokens))](test_contracts/hts-precompile/HederaTokenService.sol#L99-L101)

test_contracts/hts-precompile/HederaTokenService.sol#L98-L103


 - [ ] ID-113
Low level call in [HederaTokenService.getTokenInfo(address)](test_contracts/hts-precompile/HederaTokenService.sol#L225-L230):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenInfo.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L226-L227)

test_contracts/hts-precompile/HederaTokenService.sol#L225-L230


 - [ ] ID-114
Low level call in [HederaTokenService.burnToken(address,int64,int64[])](test_contracts/hts-precompile/HederaTokenService.sol#L69-L79):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.burnToken.selector,token,amount,serialNumbers))](test_contracts/hts-precompile/HederaTokenService.sol#L72-L74)

test_contracts/hts-precompile/HederaTokenService.sol#L69-L79


 - [ ] ID-115
Low level call in [HederaTokenService.getNonFungibleTokenInfo(address,int64)](test_contracts/hts-precompile/HederaTokenService.sol#L234-L239):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getNonFungibleTokenInfo.selector,token,serialNumber))](test_contracts/hts-precompile/HederaTokenService.sol#L235-L236)

test_contracts/hts-precompile/HederaTokenService.sol#L234-L239


 - [ ] ID-116
Low level call in [HederaTokenService.createNonFungibleTokenWithCustomFees(IHederaTokenService.HederaToken,IHederaTokenService.FixedFee[],IHederaTokenService.RoyaltyFee[])](test_contracts/hts-precompile/HederaTokenService.sol#L203-L212):
	- [(success,result) = precompileAddress.call{value: msg.value}(abi.encodeWithSelector(IHederaTokenService.createNonFungibleTokenWithCustomFees.selector,token,fixedFees,royaltyFees))](test_contracts/hts-precompile/HederaTokenService.sol#L208-L210)

test_contracts/hts-precompile/HederaTokenService.sol#L203-L212


 - [ ] ID-117
Low level call in [HederaTokenService.transferFrom(address,address,address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L285-L291):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.transferFrom.selector,token,from,to,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L287-L289)

test_contracts/hts-precompile/HederaTokenService.sol#L285-L291


 - [ ] ID-118
Low level call in [HederaTokenService.approve(address,address,uint256)](test_contracts/hts-precompile/HederaTokenService.sol#L269-L275):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.approve.selector,token,spender,amount))](test_contracts/hts-precompile/HederaTokenService.sol#L271-L273)

test_contracts/hts-precompile/HederaTokenService.sol#L269-L275


 - [ ] ID-119
Low level call in [HederaTokenService.getTokenExpiryInfo(address)](test_contracts/hts-precompile/HederaTokenService.sol#L634-L639):
	- [(success,result) = precompileAddress.call(abi.encodeWithSelector(IHederaTokenService.getTokenExpiryInfo.selector,token))](test_contracts/hts-precompile/HederaTokenService.sol#L635-L636)

test_contracts/hts-precompile/HederaTokenService.sol#L634-L639


## naming-convention
Impact: Informational
Confidence: High
 - [ ] ID-120
Constant [HederaTokenService.defaultAutoRenewPeriod](test_contracts/hts-precompile/HederaTokenService.sol#L11) is not in UPPER_CASE_WITH_UNDERSCORES

test_contracts/hts-precompile/HederaTokenService.sol#L11


 - [ ] ID-121
Constant [HederaTokenService.precompileAddress](test_contracts/hts-precompile/HederaTokenService.sol#L9) is not in UPPER_CASE_WITH_UNDERSCORES

test_contracts/hts-precompile/HederaTokenService.sol#L9


