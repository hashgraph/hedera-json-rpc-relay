import { Button, Chip, Grid, TextField, Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import { ethers } from "ethers";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import AccountActivationForm from "./components/AccountActivationForm";
import useHederaSdkClient from "./hooks/useHederaSdkClient";
const contractAbi = [
  {
    'inputs': [
      {
        'internalType': 'string',
        'name': '_greeting',
        'type': 'string'
      }
    ],
    'stateMutability': 'nonpayable',
    'type': 'constructor'
  },
  {
    'inputs': [],
    'name': 'greet',
    'outputs': [
      {
        'internalType': 'string',
        'name': '',
        'type': 'string'
      }
    ],
    'stateMutability': 'view',
    'type': 'function'
  },
  {
    'inputs': [
      {
        'internalType': 'string',
        'name': '_greeting',
        'type': 'string'
      }
    ],
    'name': 'setGreeting',
    'outputs': [],
    'stateMutability': 'nonpayable',
    'type': 'function'
  }
];
const contractBytecode = '608060405234801561001057600080fd5b5060405161054e38038061054e83398101604081905261002f916100e2565b8051610042906000906020840190610049565b5050610202565b828054610055906101b1565b90600052602060002090601f01602090048101928261007757600085556100bd565b82601f1061009057805160ff19168380011785556100bd565b828001600101855582156100bd579182015b828111156100bd5782518255916020019190600101906100a2565b506100c99291506100cd565b5090565b5b808211156100c957600081556001016100ce565b600060208083850312156100f557600080fd5b82516001600160401b038082111561010c57600080fd5b818501915085601f83011261012057600080fd5b815181811115610132576101326101ec565b604051601f8201601f19908116603f0116810190838211818310171561015a5761015a6101ec565b81604052828152888684870101111561017257600080fd5b600093505b828410156101945784840186015181850187015292850192610177565b828411156101a55760008684830101525b98975050505050505050565b600181811c908216806101c557607f821691505b602082108114156101e657634e487b7160e01b600052602260045260246000fd5b50919050565b634e487b7160e01b600052604160045260246000fd5b61033d806102116000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063a41368621461003b578063cfae321714610050575b600080fd5b61004e6100493660046101b0565b61006e565b005b610058610085565b6040516100659190610261565b60405180910390f35b8051610081906000906020840190610117565b5050565b606060008054610094906102b6565b80601f01602080910402602001604051908101604052809291908181526020018280546100c0906102b6565b801561010d5780601f106100e25761010080835404028352916020019161010d565b820191906000526020600020905b8154815290600101906020018083116100f057829003601f168201915b5050505050905090565b828054610123906102b6565b90600052602060002090601f016020900481019282610145576000855561018b565b82601f1061015e57805160ff191683800117855561018b565b8280016001018555821561018b579182015b8281111561018b578251825591602001919060010190610170565b5061019792915061019b565b5090565b5b80821115610197576000815560010161019c565b6000602082840312156101c257600080fd5b813567ffffffffffffffff808211156101da57600080fd5b818401915084601f8301126101ee57600080fd5b813581811115610200576102006102f1565b604051601f8201601f19908116603f01168101908382118183101715610228576102286102f1565b8160405282815287602084870101111561024157600080fd5b826020860160208301376000928101602001929092525095945050505050565b600060208083528351808285015260005b8181101561028e57858101830151858201604001528201610272565b818111156102a0576000604083870101525b50601f01601f1916929092016040019392505050565b600181811c908216806102ca57607f821691505b602082108114156102eb57634e487b7160e01b600052602260045260246000fd5b50919050565b634e487b7160e01b600052604160045260246000fdfea264697066735822122042af8304571a0f9b2cc08d3e5951fdcfa969a53ae4775fe09a3e754faedff4ac64736f6c63430008070033';
const ERC20ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_spender",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_from",
        "type": "address"
      },
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "name": "",
        "type": "uint8"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "name": "balance",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      },
      {
        "name": "_spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "payable": true,
    "stateMutability": "payable",
    "type": "fallback"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "spender",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  }
];

function App() {
  const [errorMessage, setErrorMessage] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [contractAddress, setContractAddress] = useState(null);
  const [isLoading, setIsLoading] = useState(null);
  const [deployContractMsg, setDeployContractMsg] = useState(null);
  const [contractCallViewMsg, setContractCallViewMsg] = useState(null);
  const [contractCallUpdateMsg, setContractCallUpdateMsg] = useState(null);
  const [htsTokenAddress, setHtsTokenAddress] = useState('');
  const [htsTokenReceiverAddress, setHtsTokenReceiverAddress] = useState('');
  const [htsTokenAmount, setHtsTokenAmount] = useState();
  const [htsTokenMsg, setHtsTokenMsg] = useState(null);

  const { recoveredPublicKeyToAccountId, getAccountInfo } = useHederaSdkClient();

  useEffect(() => {
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');

      setSigner(provider.getSigner());

      window.ethereum.on("accountsChanged", changeConnectedAccount);
      window.ethereum.on("chainChanged", () => {
        setErrorMessage(null);
        setAddress(null);
        setBalance(null);
        setAccountId(null);
        setContractAddress(null);
        setIsLoading(null);
        setDeployContractMsg(null);
        setContractCallViewMsg(null);
        setContractCallUpdateMsg(null);
        setHtsTokenAddress(null);
        setHtsTokenReceiverAddress(null);
        setHtsTokenAmount(null);
        setHtsTokenMsg(null);
      });
    }
  }, []);

  const isConnected = useMemo(() => {
    return !!signer && !!address;
  }, [signer, address]);

  const isAccountActivated = useMemo(() => {
    return address && Number(balance) > 0;
  }, [address, balance]);

  const fetchAccountBalance = async (address) => {
    try {
      // 
      const balance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [address.toString(), "latest"],
      });
      setBalance(ethers.utils.formatEther(balance));

      // get account balance from SDK()
      // const info = await getAccountInfo(address);

      // setBalance(info.balance.toBigNumber().toNumber())
    } catch (error) {
      console.log(error);
    }
  };

  const changeConnectedAccount = async (newAddress) => {
    try {
      newAddress = Array.isArray(newAddress) ? newAddress[0] : newAddress;

      await fetchAccountBalance(newAddress);

      setAddress(newAddress);
      setAccountId(null);
    } catch (err) {
      console.error(err);
      setErrorMessage("There was a problem connecting to MetaMask");
    }
  };

  const connectAccountHandler = useCallback(async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });

        await changeConnectedAccount(accounts[0]);
      } catch (err) {
        console.error(err);
        setErrorMessage("There was a problem connecting to MetaMask");
      }
    } else {
      setErrorMessage("Install MetaMask");
    }
  }, []);

  const showAccountIdHandler = useCallback(async () => {
    const message = 'Welcome to Hedera';
    const msgHash = ethers.utils.hashMessage(message);
    const msgHashBytes = ethers.utils.arrayify(msgHash);

    const signature = await signer.signMessage(message);

    const recoveredPubKey = ethers.utils.recoverPublicKey(msgHashBytes, signature);
    const accountId = recoveredPublicKeyToAccountId(recoveredPubKey);

    setAccountId(accountId);
  }, [signer, address]);

  const deployContractHandler = useCallback(async () => {
    setIsLoading(true);
    setDeployContractMsg('Loading...');

    const contractFactory = new ethers.ContractFactory(contractAbi, contractBytecode, signer);
    const contract = await contractFactory.deploy('initial_msg');
    const receipt = await contract.deployTransaction.wait();
    setContractAddress(receipt.contractAddress);

    setIsLoading(false);
    setDeployContractMsg('Addr: ' + receipt.contractAddress);
  }, [signer, address, isLoading]);

  const contractCallViewHandler = useCallback(async () => {
    setIsLoading(true);
    setContractCallViewMsg('Loading...');

    const contract = new ethers.Contract(contractAddress, contractAbi, signer);
    const call = await contract.greet();

    setContractCallViewMsg('Result: ' + call);
    setIsLoading(false);
  }, [signer, address, contractAddress, isLoading]);

  const contractCallUpdateHandler = useCallback(async () => {
    setIsLoading(true);
    setContractCallUpdateMsg('Loading...');

    const contract = new ethers.Contract(contractAddress, contractAbi, signer);
    const updatedMsg = 'updated_msg_' + (new Date()).getTime();
    const tx = await contract.setGreeting(updatedMsg);

    setContractCallUpdateMsg('Updated text: ' + updatedMsg);
    setIsLoading(false);
  }, [signer, address, contractAddress, isLoading]);

  const htsTokenTransfer = useCallback(async () => {
    setIsLoading(true);
    setHtsTokenMsg('Loading...');

    const contract = new ethers.Contract(htsTokenAddress, ERC20ABI, signer);
    const call = await contract.transfer(htsTokenReceiverAddress, htsTokenAmount);

    setHtsTokenMsg('Done');
    setIsLoading(false);
  }, [signer, htsTokenAddress, htsTokenReceiverAddress, htsTokenAmount, isLoading]);

  return (
    <Container>
      {errorMessage ? (
        <Typography variant="body1" color="red">
          Error: {errorMessage}
        </Typography>
      ) : null}
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        paddingTop={10}
        paddingBottom={10}
      >
        <Button onClick={connectAccountHandler} disabled={isConnected} size="large" variant="contained" color="primary">
          {isConnected ? 'Connected' : 'Connect Account'}
        </Button>
      </Box>

      {/* Account Section */}
      <Grid container spacing={2} justifyContent="center">
        <Grid item md={8}>
          <Typography variant="h5" sx={{ textDecoration: 'underline' }}> Setup Account </Typography>
          <Typography variant="h6"> Address: {address} </Typography>
          <Typography variant="h6">
            Balance: {balance ? balance + " HBAR" : null}
          </Typography>
          <Typography variant="h6" style={{ wordBreak: 'break-word' }}>
            Status: {isConnected ? <Chip label={isAccountActivated ? "Active" : 'Inactive'} color={isAccountActivated ? 'success' : 'error'} /> : null}
          </Typography>
          <br />
          <Button onClick={showAccountIdHandler} disabled={!isConnected} size="medium" variant="contained" color="primary">
            Show alias
          </Button>
          <Typography variant="h6" style={{ wordBreak: 'break-word' }}>
            {accountId && accountId.toString()}
          </Typography>
          <br />

          {
            isConnected && accountId
              ? <AccountActivationForm toAccountId={accountId} isActive={isAccountActivated} evmAddress={address} fetchAccountBalance={fetchAccountBalance} />
              : null
          }
          <br />
          <Button onClick={deployContractHandler} disabled={!isConnected || isLoading} size="medium" variant="contained" color="primary">
            Deploy contract
          </Button>
          <br />
          <Typography variant="h6"> {deployContractMsg} </Typography>
          <br />
          <br />
          <Button onClick={contractCallViewHandler} disabled={!isConnected || isLoading} size="medium" variant="contained" color="primary">
            Contract call view
          </Button>
          <br />
          <Typography variant="h6"> {contractCallViewMsg} </Typography>
          <br />
          <br />
          <Button onClick={contractCallUpdateHandler} disabled={!isConnected || isLoading} size="medium" variant="contained" color="primary">
            Contract call update
          </Button>
          <br />
          <Typography variant="h6"> {contractCallUpdateMsg} </Typography>
          <br />
          <br />
          <Typography variant="h5" sx={{ textDecoration: 'underline' }}> HTS Tokens </Typography>
          <br />
          <TextField
            fullWidth
            label="Token address"
            sx={{ m: 1 }}
            variant="standard"
            value={htsTokenAddress}
            onChange={(e) => setHtsTokenAddress(e.target.value)}
          />
          <br />
          <TextField
            fullWidth
            label="Receiver address"
            sx={{ m: 1 }}
            variant="standard"
            value={htsTokenReceiverAddress}
            onChange={(e) => setHtsTokenReceiverAddress(e.target.value)}
          />
          <br />
          <TextField
            fullWidth
            label="Amount"
            sx={{ m: 1 }}
            variant="standard"
            value={htsTokenAmount}
            onChange={(e) => setHtsTokenAmount(e.target.value)}
          />
          <br />
          <Button onClick={htsTokenTransfer} disabled={!isConnected || isLoading} size="medium" variant="contained" color="primary">
            Transfer
          </Button>
          <br />
          <Typography variant="h6"> {htsTokenMsg} </Typography>
        </Grid>
      </Grid>
    </Container>
  );
}

export default App;
