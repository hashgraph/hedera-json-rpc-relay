Summary
 - [arbitrary-send-eth](#arbitrary-send-eth) (1 results) (High)
 - [divide-before-multiply](#divide-before-multiply) (2 results) (Medium)
 - [tautology](#tautology) (1 results) (Medium)
 - [missing-zero-check](#missing-zero-check) (1 results) (Low)
 - [solc-version](#solc-version) (2 results) (Informational)
 - [reentrancy-unlimited-gas](#reentrancy-unlimited-gas) (1 results) (Informational)
 - [too-many-digits](#too-many-digits) (3 results) (Informational)
 - [constable-states](#constable-states) (1 results) (Optimization)
## arbitrary-send-eth
Impact: High
Confidence: Medium
 - [ ] ID-0
[Adoption.returnEth(address,uint256)](test_contracts/example_prodigal.sol#L20-L22) sends eth to arbitrary user
	Dangerous calls:
	- [oldOwner.transfer(price)](test_contracts/example_prodigal.sol#L21)

test_contracts/example_prodigal.sol#L20-L22


## divide-before-multiply
Impact: Medium
Confidence: Medium
 - [ ] ID-1
[Adoption.adopt(uint256)](test_contracts/example_prodigal.sol#L28-L42) performs a multiplication on the result of a division:
	- [gimmeTendies(ceoAddress,(data[pepeId].price / 10) * (1))](test_contracts/example_prodigal.sol#L38)

test_contracts/example_prodigal.sol#L28-L42


 - [ ] ID-2
[Adoption.adopt(uint256)](test_contracts/example_prodigal.sol#L28-L42) performs a multiplication on the result of a division:
	- [returnEth(data[pepeId].owner,(data[pepeId].price / 10) * (9))](test_contracts/example_prodigal.sol#L37)

test_contracts/example_prodigal.sol#L28-L42


## tautology
Impact: Medium
Confidence: High
 - [ ] ID-3
[Adoption.adopt(uint256)](test_contracts/example_prodigal.sol#L28-L42) contains a tautology or contradiction:
	- [require(bool)(pepeId >= 0 && pepeId <= 15)](test_contracts/example_prodigal.sol#L29)

test_contracts/example_prodigal.sol#L28-L42


## missing-zero-check
Impact: Low
Confidence: Medium
 - [ ] ID-4
[Adoption.returnEth(address,uint256).oldOwner](test_contracts/example_prodigal.sol#L20) lacks a zero-check on :
		- [oldOwner.transfer(price)](test_contracts/example_prodigal.sol#L21)

test_contracts/example_prodigal.sol#L20


## solc-version
Impact: Informational
Confidence: High
 - [ ] ID-5
solc-0.4.19 is not recommended for deployment

 - [ ] ID-6
Pragma version[^0.4.19](test_contracts/example_prodigal.sol#L1) allows old versions

test_contracts/example_prodigal.sol#L1


## reentrancy-unlimited-gas
Impact: Informational
Confidence: Medium
 - [ ] ID-7
Reentrancy in [Adoption.adopt(uint256)](test_contracts/example_prodigal.sol#L28-L42):
	External calls:
	- [returnEth(data[pepeId].owner,(data[pepeId].price / 10) * (9))](test_contracts/example_prodigal.sol#L37)
		- [oldOwner.transfer(price)](test_contracts/example_prodigal.sol#L21)
	- [gimmeTendies(ceoAddress,(data[pepeId].price / 10) * (1))](test_contracts/example_prodigal.sol#L38)
		- [ceoAddress.transfer(price)](test_contracts/example_prodigal.sol#L25)
	State variables written after the call(s):
	- [data[pepeId].owner = msg.sender](test_contracts/example_prodigal.sol#L39)

test_contracts/example_prodigal.sol#L28-L42


## too-many-digits
Impact: Informational
Confidence: Medium
 - [ ] ID-8
[Adoption.adopt(uint256)](test_contracts/example_prodigal.sol#L28-L42) uses literals with too many digits:
	- [data[pepeId].price == 10000000000000000](test_contracts/example_prodigal.sol#L30)

test_contracts/example_prodigal.sol#L28-L42


 - [ ] ID-9
[Adoption.adopt(uint256)](test_contracts/example_prodigal.sol#L28-L42) uses literals with too many digits:
	- [data[pepeId].price = 20000000000000000](test_contracts/example_prodigal.sol#L31)

test_contracts/example_prodigal.sol#L28-L42


 - [ ] ID-10
[Adoption.Adoption()](test_contracts/example_prodigal.sol#L12-L18) uses literals with too many digits:
	- [data[i].price = 10000000000000000](test_contracts/example_prodigal.sol#L15)

test_contracts/example_prodigal.sol#L12-L18


## constable-states
Impact: Optimization
Confidence: High
 - [ ] ID-11
[Adoption.ceoAddress](test_contracts/example_prodigal.sol#L3) should be constant 

test_contracts/example_prodigal.sol#L3


