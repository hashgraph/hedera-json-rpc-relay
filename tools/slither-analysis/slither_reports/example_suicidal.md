Summary
 - [erc20-interface](#erc20-interface) (6 results) (Medium)
 - [shadowing-builtin](#shadowing-builtin) (1 results) (Low)
 - [events-access](#events-access) (1 results) (Low)
 - [missing-zero-check](#missing-zero-check) (1 results) (Low)
 - [dead-code](#dead-code) (6 results) (Informational)
 - [deprecated-standards](#deprecated-standards) (6 results) (Informational)
 - [solc-version](#solc-version) (2 results) (Informational)
 - [naming-convention](#naming-convention) (11 results) (Informational)
## erc20-interface
Impact: Medium
Confidence: High
 - [ ] ID-0
[KAI](test_contracts/example_suicidal.sol#L112-L142) has incorrect ERC20 function interface:[StandardToken.approve(address,uint256)](test_contracts/example_suicidal.sol#L101-L105)

test_contracts/example_suicidal.sol#L112-L142


 - [ ] ID-1
[KAI](test_contracts/example_suicidal.sol#L112-L142) has incorrect ERC20 function interface:[ERC20Basic.transfer(address,uint256)](test_contracts/example_suicidal.sol#L54)

test_contracts/example_suicidal.sol#L112-L142


 - [ ] ID-2
[KAI](test_contracts/example_suicidal.sol#L112-L142) has incorrect ERC20 function interface:[ERC20.approve(address,uint256)](test_contracts/example_suicidal.sol#L61)

test_contracts/example_suicidal.sol#L112-L142


 - [ ] ID-3
[KAI](test_contracts/example_suicidal.sol#L112-L142) has incorrect ERC20 function interface:[StandardToken.transferFrom(address,address,uint256)](test_contracts/example_suicidal.sol#L93-L99)

test_contracts/example_suicidal.sol#L112-L142


 - [ ] ID-4
[KAI](test_contracts/example_suicidal.sol#L112-L142) has incorrect ERC20 function interface:[BasicToken.transfer(address,uint256)](test_contracts/example_suicidal.sol#L77-L81)

test_contracts/example_suicidal.sol#L112-L142


 - [ ] ID-5
[KAI](test_contracts/example_suicidal.sol#L112-L142) has incorrect ERC20 function interface:[ERC20.transferFrom(address,address,uint256)](test_contracts/example_suicidal.sol#L60)

test_contracts/example_suicidal.sol#L112-L142


## shadowing-builtin
Impact: Low
Confidence: High
 - [ ] ID-6
[SafeMath.assert(bool)](test_contracts/example_suicidal.sol#L44-L48) (function) shadows built-in symbol"

test_contracts/example_suicidal.sol#L44-L48


## events-access
Impact: Low
Confidence: Medium
 - [ ] ID-7
[KAI.changeOwner(address)](test_contracts/example_suicidal.sol#L129-L131) should emit an event for: 
	- [owner = newOwner](test_contracts/example_suicidal.sol#L130) 

test_contracts/example_suicidal.sol#L129-L131


## missing-zero-check
Impact: Low
Confidence: Medium
 - [ ] ID-8
[KAI.changeOwner(address).newOwner](test_contracts/example_suicidal.sol#L129) lacks a zero-check on :
		- [owner = newOwner](test_contracts/example_suicidal.sol#L130)

test_contracts/example_suicidal.sol#L129


## dead-code
Impact: Informational
Confidence: Medium
 - [ ] ID-9
[SafeMath.mul(uint256,uint256)](test_contracts/example_suicidal.sol#L4-L8) is never used and should be removed

test_contracts/example_suicidal.sol#L4-L8


 - [ ] ID-10
[SafeMath.min256(uint256,uint256)](test_contracts/example_suicidal.sol#L40-L42) is never used and should be removed

test_contracts/example_suicidal.sol#L40-L42


 - [ ] ID-11
[SafeMath.max256(uint256,uint256)](test_contracts/example_suicidal.sol#L36-L38) is never used and should be removed

test_contracts/example_suicidal.sol#L36-L38


 - [ ] ID-12
[SafeMath.div(uint256,uint256)](test_contracts/example_suicidal.sol#L10-L15) is never used and should be removed

test_contracts/example_suicidal.sol#L10-L15


 - [ ] ID-13
[SafeMath.min64(uint64,uint64)](test_contracts/example_suicidal.sol#L32-L34) is never used and should be removed

test_contracts/example_suicidal.sol#L32-L34


 - [ ] ID-14
[SafeMath.max64(uint64,uint64)](test_contracts/example_suicidal.sol#L28-L30) is never used and should be removed

test_contracts/example_suicidal.sol#L28-L30


## deprecated-standards
Impact: Informational
Confidence: High
 - [ ] ID-15
Deprecated standard detected [THROW](test_contracts/example_suicidal.sol#L72):
	- Usage of "throw" should be replaced with "revert()"

test_contracts/example_suicidal.sol#L72


 - [ ] ID-16
Deprecated standard detected [THROW](test_contracts/example_suicidal.sol#L46):
	- Usage of "throw" should be replaced with "revert()"

test_contracts/example_suicidal.sol#L46


 - [ ] ID-17
Deprecated standard detected [THROW](test_contracts/example_suicidal.sol#L102):
	- Usage of "throw" should be replaced with "revert()"

test_contracts/example_suicidal.sol#L102


 - [ ] ID-18
Deprecated standard detected [suicide(address)(owner)](test_contracts/example_suicidal.sol#L139):
	- Usage of "suicide()" should be replaced with "selfdestruct()"

test_contracts/example_suicidal.sol#L139


 - [ ] ID-19
Deprecated standard detected [THROW](test_contracts/example_suicidal.sol#L120):
	- Usage of "throw" should be replaced with "revert()"

test_contracts/example_suicidal.sol#L120


 - [ ] ID-20
Deprecated standard detected [THROW](test_contracts/example_suicidal.sol#L135):
	- Usage of "throw" should be replaced with "revert()"

test_contracts/example_suicidal.sol#L135


## solc-version
Impact: Informational
Confidence: High
 - [ ] ID-21
solc-0.4.11 is not recommended for deployment

 - [ ] ID-22
Pragma version[^0.4.11](test_contracts/example_suicidal.sol#L1) allows old versions

test_contracts/example_suicidal.sol#L1


## naming-convention
Impact: Informational
Confidence: High
 - [ ] ID-23
Parameter [StandardToken.allowance(address,address)._spender](test_contracts/example_suicidal.sol#L107) is not in mixedCase

test_contracts/example_suicidal.sol#L107


 - [ ] ID-24
Parameter [StandardToken.approve(address,uint256)._value](test_contracts/example_suicidal.sol#L101) is not in mixedCase

test_contracts/example_suicidal.sol#L101


 - [ ] ID-25
Parameter [BasicToken.transfer(address,uint256)._value](test_contracts/example_suicidal.sol#L77) is not in mixedCase

test_contracts/example_suicidal.sol#L77


 - [ ] ID-26
Parameter [StandardToken.allowance(address,address)._owner](test_contracts/example_suicidal.sol#L107) is not in mixedCase

test_contracts/example_suicidal.sol#L107


 - [ ] ID-27
Parameter [StandardToken.transferFrom(address,address,uint256)._from](test_contracts/example_suicidal.sol#L93) is not in mixedCase

test_contracts/example_suicidal.sol#L93


 - [ ] ID-28
Function [KAI.EGC()](test_contracts/example_suicidal.sol#L123-L127) is not in mixedCase

test_contracts/example_suicidal.sol#L123-L127


 - [ ] ID-29
Parameter [StandardToken.transferFrom(address,address,uint256)._to](test_contracts/example_suicidal.sol#L93) is not in mixedCase

test_contracts/example_suicidal.sol#L93


 - [ ] ID-30
Parameter [StandardToken.approve(address,uint256)._spender](test_contracts/example_suicidal.sol#L101) is not in mixedCase

test_contracts/example_suicidal.sol#L101


 - [ ] ID-31
Parameter [BasicToken.transfer(address,uint256)._to](test_contracts/example_suicidal.sol#L77) is not in mixedCase

test_contracts/example_suicidal.sol#L77


 - [ ] ID-32
Parameter [BasicToken.balanceOf(address)._owner](test_contracts/example_suicidal.sol#L83) is not in mixedCase

test_contracts/example_suicidal.sol#L83


 - [ ] ID-33
Parameter [StandardToken.transferFrom(address,address,uint256)._value](test_contracts/example_suicidal.sol#L93) is not in mixedCase

test_contracts/example_suicidal.sol#L93


