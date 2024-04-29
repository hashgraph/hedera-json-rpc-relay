```
ERROR:SlitherSolcParsing:crytic-compile returned an empty AST. If you are trying to analyze a contract from etherscan or similar make sure it has source code available.
Traceback (most recent call last):
  File "/home/coredumped7893/.local/bin/slither-read-storage", line 8, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/coredumped7893/.local/lib/python3.11/site-packages/slither/tools/read_storage/__main__.py", line 128, in main
    slither = Slither(target, **vars(args))
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/coredumped7893/.local/lib/python3.11/site-packages/slither/slither.py", line 115, in __init__
    self.add_source_code(path)
  File "/home/coredumped7893/.local/lib/python3.11/site-packages/slither/core/slither_core.py", line 172, in add_source_code
    with open(path, encoding="utf8", newline="") as f:
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: ''
```