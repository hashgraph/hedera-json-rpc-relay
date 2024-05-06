```shell
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