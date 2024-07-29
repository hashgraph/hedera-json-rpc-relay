# Web3py example
Example scripts for basic operations

### How to start
1. **Set up a clean environment (with virtual env)**

```bash
# Install pip if it is not available:
$ which pip || curl https://bootstrap.pypa.io/get-pip.py | python

# Install virtualenv if it is not available:
$ which virtualenv || pip install --upgrade virtualenv

# *If* the above command displays an error, you can try installing as root:
$ sudo pip install virtualenv

# Create a virtual environment:
$ virtualenv -p python3 ~/.venv-py3

# Activate your new virtual environment:
$ source ~/.venv-py3/bin/activate

# With virtualenv active, make sure you have the latest packaging tools
$ pip install --upgrade pip setuptools

# Now we can install web3.py...
$ pip install --upgrade web3

# Install python-dotenv
$ pip install python-dotenv

# Install py-solc-x
$ pip install py-solc-x
```

Remember that each new terminal session requires you to reactivate your virtualenv, like: 
```bash
$ source ~/.venv-py3/bin/activate
```

2. **Create and complete `.env` file from `.env.example`**

3. **Run script**
```bash
python scripts/test.py
```
