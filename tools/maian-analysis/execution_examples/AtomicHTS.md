```shell

====================================================================================================
[ ] Compiling Solidity contract from the file /examples/hts-precompile/AtomicHTS.sol ...  Done 
/usr/local/lib/python2.7/dist-packages/web3/main.py:130: DeprecationWarning: Python 2 support is ending! Please upgrade to Python 3 promptly. Support will end at the beginning of 2018.
  category=DeprecationWarning,
/usr/local/lib/python2.7/dist-packages/web3/main.py:130: DeprecationWarning: Python 2 support is ending! Please upgrade to Python 3 promptly. Support will end at the beginning of 2018.
  category=DeprecationWarning,
[ ] Connecting to PRIVATE blockchain emptychain  ... ESTABLISHED 
[ ] Deploying contract ........... confirmed at address: 0x9E536236ABF2288a7864C6A1AfaA4Cb98D464306 
[ ] Contract code length on the blockchain :    2  : 0x... 
[ ] Contract address saved in file: ./out/AtomicHTS.address 
[ ] Check if contract is SUICIDAL

[ ] Contract address   : 0x9E536236ABF2288a7864C6A1AfaA4Cb98D464306
[ ] Contract bytecode  : ...
[ ] Bytecode length    : 0
[ ] Blockchain contract: True
[ ] Debug              : False

[-] The code does not contain SUICIDE instructions, hence it is not vulnerable
```

```shell
root@194c8c7535a2:/MAIAN/tool# python2 maian.py -s /examples/hts-precompile/AtomicHTS.sol AtomicHTS -c 1

====================================================================================================
[ ] Compiling Solidity contract from the file /examples/hts-precompile/AtomicHTS.sol ...  Done 
/usr/local/lib/python2.7/dist-packages/web3/main.py:130: DeprecationWarning: Python 2 support is ending! Please upgrade to Python 3 promptly. Support will end at the beginning of 2018.
  category=DeprecationWarning,
/usr/local/lib/python2.7/dist-packages/web3/main.py:130: DeprecationWarning: Python 2 support is ending! Please upgrade to Python 3 promptly. Support will end at the beginning of 2018.
  category=DeprecationWarning,
[ ] Connecting to PRIVATE blockchain emptychain  ... ESTABLISHED 
[ ] Sending Ether to contract 0x9e536236abf2288a7864c6a1afaa4cb98d464306  ... tx[0] mined  Sent! 
[ ] Deploying contract .......................... confirmed at address: 0x9E536236ABF2288a7864C6A1AfaA4Cb98D464306 
[ ] Contract code length on the blockchain :    2  : 0x... 
[ ] Contract address saved in file: ./out/AtomicHTS.address 
[ ] The contract balance: 44   Positive balance
[ ] Check if contract is PRODIGAL

[ ] Contract address   : 0x9E536236ABF2288a7864C6A1AfaA4Cb98D464306
[ ] Contract bytecode  : ...
[ ] Bytecode length    : 0
[ ] Blockchain contract: True
[ ] Debug              : False
[+] The code does not have CALL/SUICIDE, hence it is not prodigal
```

```shell
root@194c8c7535a2:/MAIAN/tool# python2 maian.py -s /examples/hts-precompile/AtomicHTS.sol AtomicHTS -c 2

====================================================================================================
[ ] Compiling Solidity contract from the file /examples/hts-precompile/AtomicHTS.sol ...  Done 
/usr/local/lib/python2.7/dist-packages/web3/main.py:130: DeprecationWarning: Python 2 support is ending! Please upgrade to Python 3 promptly. Support will end at the beginning of 2018.
  category=DeprecationWarning,
/usr/local/lib/python2.7/dist-packages/web3/main.py:130: DeprecationWarning: Python 2 support is ending! Please upgrade to Python 3 promptly. Support will end at the beginning of 2018.
  category=DeprecationWarning,
[ ] Connecting to PRIVATE blockchain emptychain  ... ESTABLISHED 
[ ] Deploying contract ............. confirmed at address: 0x9E536236ABF2288a7864C6A1AfaA4Cb98D464306 
[ ] Contract code length on the blockchain :    2  : 0x... 
[ ] Contract address saved in file: ./out/AtomicHTS.address 
[ ] Check if contract is GREEDY

[ ] Contract address   : 0x9E536236ABF2288a7864C6A1AfaA4Cb98D464306
[ ] Contract bytecode  : ...
[ ] Bytecode length    : 0
[ ] Debug              : False
[-] Contract can receive Ether

[-] No lock vulnerability found because the contract cannot receive Ether 
```