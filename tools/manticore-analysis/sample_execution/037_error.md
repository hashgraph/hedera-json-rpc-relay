```shell
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