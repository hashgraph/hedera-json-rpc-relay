### Execution prompt:
```shell
root@676415c3db36:/manticore# manticore /examples/example_erc20.sol 
2024-04-17 14:16:44,217: [4647] m.main:INFO: Registered plugins: DetectReentrancySimple, DetectDelegatecall, DetectUnusedRetVal, DetectIntegerOverflow, DetectReentrancyAdvanced, DetectExternalCallAndLeak, DetectInvalid, DetectSuicidal, DetectEnvInstruction, DetectUninitializedStorage, DetectUninitializedMemory, DetectManipulableBalance
2024-04-17 14:16:44,220: [4647] m.main:INFO: Beginning analysis
2024-04-17 14:16:44,247: [4647] m.e.manticore:INFO: Starting symbolic create contract
2024-04-17 14:16:44,373: [4647] m.e.manticore:INFO: Failed to build contract None Errors : Invalid solc compilation /examples/openzeppelin/IERC20.sol:4:1: Error: Source file requires different compiler version (current compiler is 0.4.25+commit.59dbf8f1.Linux.g++ - note that nightly builds are considered to be strictly less than the released version
pragma solidity ^0.8.20;
^----------------------^
/examples/openzeppelin/extensions/IERC20Metadata.sol:4:1: Error: Source file requires different compiler version (current compiler is 0.4.25+commit.59dbf8f1.Linux.g++ - note that nightly builds are considered to be strictly less than the released version
pragma solidity ^0.8.20;
^----------------------^
/examples/example_erc20.sol:2:1: Error: Source file requires different compiler version (current compiler is 0.4.25+commit.59dbf8f1.Linux.g++ - note that nightly builds are considered to be strictly less than the released version
pragma solidity ^0.8.0;
^---------------------^
/examples/openzeppelin/extensions/IERC20Metadata.sol:11:29: Error: Interfaces cannot inherit.
interface IERC20Metadata is IERC20 {
                            ^----^
/examples/example_erc20.sol:46:9: Warning: Different number of components on the left hand side (2) than on the right hand side (1).
        (bool success, ) = address(IERC20(token)).delegatecall(abi.encodeWithSignature("transfer(address,uint256)", recipient, amount));
        ^-----------------------------------------------------------------------------------------------------------------------------^
/examples/example_erc20.sol:51:9: Warning: Different number of components on the left hand side (2) than on the right hand side (1).
        (bool success, ) = address(IERC20(token)).delegatecall(abi.encodeWithSignature("approve(address,uint256)", recipient, amount));
        ^----------------------------------------------------------------------------------------------------------------------------^
/examples/example_erc20.sol:56:9: Warning: Different number of components on the left hand side (2) than on the right hand side (1).
        (bool success, ) = address(IERC20(token)).delegatecall(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount));
        ^----------------------------------------------------------------------------------------------------------------------------------------^

. Solidity failed to generate bytecode for your contract. Check if all the abstract functions are implemented. 
2024-04-17 14:16:44,772: [4689] m.c.manticore:INFO: Generated testcase No. 0 - NO STATE RESULT (?)(0 txs)
2024-04-17 14:16:44,995: [4647] m.c.manticore:INFO: Results in /manticore/mcore_8ro64gxd

root@676415c3db36:/manticore# manticore /examples/example_prodigal.sol 
2024-04-17 14:17:58,461: [5167] m.main:INFO: Registered plugins: DetectReentrancySimple, DetectIntegerOverflow, DetectDelegatecall, DetectManipulableBalance, DetectUninitializedStorage, DetectExternalCallAndLeak, DetectUninitializedMemory, DetectUnusedRetVal, DetectEnvInstruction, DetectInvalid, DetectReentrancyAdvanced, DetectSuicidal
2024-04-17 14:17:58,463: [5167] m.main:INFO: Beginning analysis
2024-04-17 14:17:58,488: [5167] m.e.manticore:INFO: Starting symbolic create contract
2024-04-17 14:18:10,002: [5167] m.e.manticore:INFO: Failed to create contract: exception in constructor
2024-04-17 14:18:10,421: [6132] m.c.manticore:INFO: Generated testcase No. 0 - THROW(1 txs)
2024-04-17 14:18:10,475: [6124] m.c.manticore:INFO: Generated testcase No. 1 - REVERT(1 txs)
2024-04-17 14:18:10,945: [5167] m.c.manticore:INFO: Results in /manticore/mcore_i0h8qbkl
```
### Output files prompt: 
```shell
command.sh                           user_00000003.constraints  user_00000007.pkl          user_0000000b.trace        user_0000000f.tx.json      user_00000014.constraints  user_00000018.pkl          user_0000001c.summary
global.findings                      user_00000003.logs         user_00000007.summary      user_0000000b.tx           user_00000010.constraints  user_00000014.logs         user_00000018.summary      user_0000001c.trace
global.summary                       user_00000003.pkl          user_00000007.trace        user_0000000b.tx.json      user_00000010.logs         user_00000014.pkl          user_00000018.trace        user_0000001c.tx
global_SymExExample.init_asm         user_00000003.summary      user_00000007.tx           user_0000000c.constraints  user_00000010.pkl          user_00000014.summary      user_00000018.tx           user_0000001c.tx.json
global_SymExExample.init_visited     user_00000003.trace        user_00000007.tx.json      user_0000000c.logs         user_00000010.summary      user_00000014.trace        user_00000018.tx.json      user_0000001d.constraints
global_SymExExample.runtime_asm      user_00000003.tx           user_00000008.constraints  user_0000000c.pkl          user_00000010.trace        user_00000014.tx           user_00000019.constraints  user_0000001d.findings
global_SymExExample.runtime_visited  user_00000003.tx.json      user_00000008.logs         user_0000000c.summary      user_00000010.tx           user_00000014.tx.json      user_00000019.logs         user_0000001d.logs
global_SymExExample.sol              user_00000004.constraints  user_00000008.pkl          user_0000000c.trace        user_00000010.tx.json      user_00000015.constraints  user_00000019.pkl          user_0000001d.pkl
manticore.yml                        user_00000004.logs         user_00000008.summary      user_0000000c.tx           user_00000011.constraints  user_00000015.logs         user_00000019.summary      user_0000001d.summary
user_00000000.constraints            user_00000004.pkl          user_00000008.trace        user_0000000c.tx.json      user_00000011.logs         user_00000015.pkl          user_00000019.trace        user_0000001d.trace
user_00000000.logs                   user_00000004.summary      user_00000008.tx           user_0000000d.constraints  user_00000011.pkl          user_00000015.summary      user_00000019.tx           user_0000001d.tx
user_00000000.pkl                    user_00000004.trace        user_00000008.tx.json      user_0000000d.logs         user_00000011.summary      user_00000015.trace        user_00000019.tx.json      user_0000001d.tx.json
user_00000000.summary                user_00000004.tx           user_00000009.constraints  user_0000000d.pkl          user_00000011.trace        user_00000015.tx           user_0000001a.constraints  user_0000001e.constraints
user_00000000.trace                  user_00000004.tx.json      user_00000009.logs         user_0000000d.summary      user_00000011.tx           user_00000015.tx.json      user_0000001a.logs         user_0000001e.findings
user_00000000.tx                     user_00000005.constraints  user_00000009.pkl          user_0000000d.trace        user_00000011.tx.json      user_00000016.constraints  user_0000001a.pkl          user_0000001e.logs
user_00000000.tx.json                user_00000005.logs         user_00000009.summary      user_0000000d.tx           user_00000012.constraints  user_00000016.logs         user_0000001a.summary      user_0000001e.pkl
user_00000001.constraints            user_00000005.pkl          user_00000009.trace        user_0000000d.tx.json      user_00000012.logs         user_00000016.pkl          user_0000001a.trace        user_0000001e.summary
user_00000001.logs                   user_00000005.summary      user_00000009.tx           user_0000000e.constraints  user_00000012.pkl          user_00000016.summary      user_0000001a.tx           user_0000001e.trace
user_00000001.pkl                    user_00000005.trace        user_00000009.tx.json      user_0000000e.logs         user_00000012.summary      user_00000016.trace        user_0000001a.tx.json      user_0000001e.tx
user_00000001.summary                user_00000005.tx           user_0000000a.constraints  user_0000000e.pkl          user_00000012.trace        user_00000016.tx           user_0000001b.constraints  user_0000001e.tx.json
user_00000001.trace                  user_00000005.tx.json      user_0000000a.logs         user_0000000e.summary      user_00000012.tx           user_00000016.tx.json      user_0000001b.logs         user_0000001f.constraints
user_00000001.tx                     user_00000006.constraints  user_0000000a.pkl          user_0000000e.trace        user_00000012.tx.json      user_00000017.constraints  user_0000001b.pkl          user_0000001f.findings
user_00000001.tx.json                user_00000006.logs         user_0000000a.summary      user_0000000e.tx           user_00000013.constraints  user_00000017.logs         user_0000001b.summary      user_0000001f.logs
user_00000002.constraints            user_00000006.pkl          user_0000000a.trace        user_0000000e.tx.json      user_00000013.findings     user_00000017.pkl          user_0000001b.trace        user_0000001f.pkl
user_00000002.logs                   user_00000006.summary      user_0000000a.tx           user_0000000f.constraints  user_00000013.logs         user_00000017.summary      user_0000001b.tx           user_0000001f.summary
user_00000002.pkl                    user_00000006.trace        user_0000000a.tx.json      user_0000000f.logs         user_00000013.pkl          user_00000017.trace        user_0000001b.tx.json      user_0000001f.trace
user_00000002.summary                user_00000006.tx           user_0000000b.constraints  user_0000000f.pkl          user_00000013.summary      user_00000017.tx           user_0000001c.constraints  user_0000001f.tx
user_00000002.trace                  user_00000006.tx.json      user_0000000b.logs         user_0000000f.summary      user_00000013.trace        user_00000017.tx.json      user_0000001c.findings     user_0000001f.tx.json
user_00000002.tx                     user_00000007.constraints  user_0000000b.pkl          user_0000000f.trace        user_00000013.tx           user_00000018.constraints  user_0000001c.logs
user_00000002.tx.json                user_00000007.logs         user_0000000b.summary      user_0000000f.tx           user_00000013.tx.json      user_00000018.logs         user_0000001c.pkl
```
### Transaction routing example: 
```shell
Transactions No. 0
Type: CREATE (0)
From: owner(0x213a0738ab241747cb3001fb79dc9f532e7d14f2) 
To: contract0(0xd4a8f68534750318596cd9a395ee5d2468a8492d) 
Value: 0 (*)
Gas used: 230000 
Data: 0x608060405234801561001057600080fd5b50610129806100206000396000f300608060405260043610603f576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff1680637eda09e8146044575b600080fd5b348015604f57600080fd5b5060806004803603810190808035906020019092919080359060200190929190803590602001909291905050506082565b005b6000806000809250600091506000905060008614151560bf577ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe92505b600585121560e55760008614801560d7575060008414155b1560e057600191505b600290505b600381838501011415151560f557fe5b5050505050505600a165627a7a72305820603ff29af9dbac4a542a8d11e5994d824816320cfe37237eef6b4a5e622383b30029 
Return_data: 0x608060405260043610603f576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff1680637eda09e8146044575b600080fd5b348015604f57600080fd5b5060806004803603810190808035906020019092919080359060200190929190803590602001909291905050506082565b005b6000806000809250600091506000905060008614151560bf577ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe92505b600585121560e55760008614801560d7575060008414155b1560e057600191505b600290505b600381838501011415151560f557fe5b5050505050505600a165627a7a72305820603ff29af9dbac4a542a8d11e5994d824816320cfe37237eef6b4a5e622383b30029  (*)
Function call:
Constructor() -> RETURN 


Transactions No. 1
Type: CALL (0)
From: attacker(0x78ecfebcfe9302971be5e71a1e9b207749a86d03) 
To: contract0(0xd4a8f68534750318596cd9a395ee5d2468a8492d) 
Value: 0 (*)
Gas used: 230000 
Data: 0x7eda09e800ff0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005 (*)
Return_data: 0x () 

Function call:
test_me(450546001518488004043740862689444221536008393703282834321009581329618042880,5,0) -> STOP (*)

Transactions No. 2
Type: CALL (0)
From: attacker(0x78ecfebcfe9302971be5e71a1e9b207749a86d03) 
To: contract0(0xd4a8f68534750318596cd9a395ee5d2468a8492d) 
Value: 0 (*)
Gas used: 230000 
Data: 0x7eda09e8000000ff000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004 (*)
Return_data: 0x () 

Function call:
test_me(6874786400123413147640088847190005821777471827747845982681420613550080,4,0) -> STOP (*)

(*) Example solution given. Value is symbolic and may take other values
```
