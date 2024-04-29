```Shell
Traceback (most recent call last):
File "/Users/jasuwienas/Projects/blockchain/evm/MAIAN/tool/maian.py", line 24, in <module>
from web3 import Web3, KeepAliveRPCProvider, IPCProvider
File "/opt/homebrew/lib/python3.11/site-packages/web3/__init__.py", line 7, in <module>
from eth_account import Account  # noqa: E402
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
File "/opt/homebrew/lib/python3.11/site-packages/eth_account/__init__.py", line 1, in <module>
from eth_account.account import Account  # noqa: F401
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
File "/opt/homebrew/lib/python3.11/site-packages/eth_account/account.py", line 1, in <module>
from collections import (
ImportError: cannot import name 'Mapping' from 'collections' (/opt/homebrew/Cellar/python@3.11/3.11.7_1/Frameworks/Python.framework/Versions/3.11/lib/python3.11/collections/__init__.py)
```
