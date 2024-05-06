### PIP instalation:
```Shell
File ".../manticore-env/bin/manticore", line 5, in <module>
    from manticore.__main__ import main
  File ".../manticore-env/lib/python3.9/site-packages/manticore/__init__.py", line 10, in <module>
    from .ethereum.manticore import ManticoreEVM
  File ".../manticore-env/lib/python3.9/site-packages/manticore/ethereum/__init__.py", line 3, in <module>
    from .manticore import ManticoreEVM, config
  File ".../manticore-env/lib/python3.9/site-packages/manticore/ethereum/manticore.py", line 15, in <module>
    from ..core.manticore import ManticoreBase, ManticoreError
  File ".../manticore-env/lib/python3.9/site-packages/manticore/core/manticore.py", line 29, in <module>
    from .worker import (
  File ".../manticore-env/lib/python3.9/site-packages/manticore/core/worker.py", line 4, in <module>
    from .state_pb2 import StateList, MessageList, State, LogMessage
  File ".../manticore-env/lib/python3.9/site-packages/manticore/core/state_pb2.py", line 32, in <module>
    _descriptor.EnumValueDescriptor(
  File ".../manticore-env/lib/python3.9/site-packages/google/protobuf/descriptor.py", line 755, in __new__
    _message.Message._CheckCalledFromGeneratedFile()
TypeError: Descriptors cannot not be created directly.
If this call came from a _pb2.py file, your generated code is out of date and must be regenerated with protoc >= 3.19.0.
If you cannot immediately regenerate your protos, some other possible workarounds are:
 1. Downgrade the protobuf package to 3.20.x or lower.
 5. Set PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python (but this will use pure-Python parsing and will be much slower).
```
### Docker: v3.7 and :latest: 
```Shell
$ manticore --solc-remaps='@openzeppelin/contracts/utils/Context.sol=../../node_modules/@openzeppelin/contracts/utils/Context.sol @zk-kit/incremental-merkle-tree.sol/IncrementalBinaryTree.sol=../../node_modules/@zk-kit/incremental-merkle-tree.sol/IncrementalBinaryTree.sol' --contract=Semaphore ./contracts/Semaphore.sol
2022-09-30 04:11:12,828: [5105] m.main:INFO: Registered plugins: IntrospectionAPIPlugin, <class 'manticore.ethereum.plugins.SkipRevertBasicBlocks'>, <class 'manticore.ethereum.plugins.FilterFunctions'>
2022-09-30 04:11:12,828: [5105] m.main:INFO: Beginning analysis
2022-09-30 04:11:12,830: [5105] m.e.manticore:INFO: Starting symbolic create contract
Process Process-1:
Traceback (most recent call last):
File "/usr/lib/python3.8/multiprocessing/process.py", line 315, in _bootstrap
self.run()
File "/usr/lib/python3.8/multiprocessing/process.py", line 108, in run
self._target(*self._args, **self._kwargs)
File "/home/ubuntu/.local/lib/python3.8/site-packages/manticore/ethereum/manticore.py", line 1766, in worker_finalize
finalizer(q.get_nowait())
File "/home/ubuntu/.local/lib/python3.8/site-packages/manticore/ethereum/manticore.py", line 1757, in finalizer
if only_alive_states and last_tx.result in {"REVERT", "THROW", "TXERROR"}:
AttributeError: 'NoneType' object has no attribute 'result'
```
### Docker: v3.6

```Shell
2024-04-18 06:48:25,221: [84] m.main:INFO: Registered plugins: IntrospectionAPIPlugin, <class 'manticore.ethereum.plugins.SkipRevertBasicBlocks'>, <class 'manticore.ethereum.plugins.FilterFunctions'>
2024-04-18 06:48:25,223: [84] m.main:INFO: Beginning analysis
2024-04-18 06:48:25,242: [84] m.e.manticore:INFO: Starting symbolic create contract
2024-04-18 06:48:27,423: [84] m.e.manticore:INFO: Starting symbolic transaction: 0
2024-04-18 06:48:30,698: [84] m.c.worker:ERROR: Exception in state 7: ManticoreError('Forking on unfeasible constraint set',)
Traceback (most recent call last):
  File "/usr/local/lib/python3.6/dist-packages/manticore/core/worker.py", line 132, in run
    current_state.execute()
  File "/usr/local/lib/python3.6/dist-packages/manticore/ethereum/state.py", line 8, in execute
    return self._platform.execute()
  File "/usr/local/lib/python3.6/dist-packages/manticore/platforms/evm.py", line 3106, in execute
    self.current_vm.execute()
  File "/usr/local/lib/python3.6/dist-packages/manticore/platforms/evm.py", line 1322, in execute
    raise Concretize("Symbolic PC", expression=expression, setstate=setstate, policy="ALL")
manticore.core.state.Concretize

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/usr/local/lib/python3.6/dist-packages/manticore/core/worker.py", line 153, in run
    m._fork(current_state, exc.expression, exc.policy, exc.setstate)
  File "/usr/local/lib/python3.6/dist-packages/manticore/core/manticore.py", line 516, in _fork
    raise ManticoreError("Forking on unfeasible constraint set")
manticore.exceptions.ManticoreError: Forking on unfeasible constraint set
 
2024-04-18 06:48:30,737: [84] m.e.manticore:INFO: 0 alive states, 1 terminated states
2024-04-18 06:48:31,102: [84] m.c.manticore:INFO: Results in /manticore/mcore_nr9y98__
2024-04-18 06:48:31,104: [84] m.c.manticore:INFO: Total time: 3.663041591644287
```
