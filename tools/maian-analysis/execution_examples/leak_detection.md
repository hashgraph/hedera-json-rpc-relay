```shell
[ ] Compiling Solidity contract from the file example_contracts/example_prodigal.sol ...  Done
[ ] Connecting to PRIVATE blockchain emptychain  ... ESTABLISHED
[ ] Sending Ether to contract 0x9e536236abf2288a7864c6a1afaa4cb98d464306  ... tx[0] mined  Sent!
[ ] Deploying contract ............ confirmed at address: 0x9E536236ABF2288a7864C6A1AfaA4Cb98D464306
[ ] Contract code length on the blockchain :    7754  : 0x6060604052600436106100d05760...
[ ] Contract address saved in file: ./out/KAI.address
[ ] The contract balance: 44   Positive balance
[ ] Check if contract is PRODIGAL

[ ] Contract address   : 0x9E536236ABF2288a7864C6A1AfaA4Cb98D464306
[ ] Contract bytecode  : 6060604052600436106100d0576000357c0100000000000000...
[ ] Bytecode length    : 7752
[ ] Blockchain contract: True
[ ] Debug              : False

[ ] Search with call depth: 1   : 1111111
[ ] Search with call depth: 2   : 11222222211122222212222

[-] Leak vulnerability found!

    The following 2 transaction(s) will trigger the contract to leak:
    -Tx[1] :0bb5e62b
    -Tx[2] :41c0e1b5

    The transactions correspond to the functions:
    -EGC()
    -kill()

[ ] Confirming leak vulnerability on private chain ... ......................... tx[0] mined ....................... tx[1] mined
    Confirmed ! The contract is prodigal !
```
