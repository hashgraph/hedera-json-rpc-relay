import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Chip, Grid, Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import { ethers } from "ethers";

import useHederaSdkClient from "./hooks/useHederaSdkClient";

import AccountActivationForm from "./components/AccountActivationForm";
import ContractInteractions from "./components/ContractInteractions";
import TransferHTSTokensForm from './components/TransferHTSTokensForm';

function App() {
  const [errorMessage, setErrorMessage] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState(null);
  const [chain, setChain] = useState(null);
  const [alias, setAlias] = useState('');
  const [balance, setBalance] = useState(null);
  const [accountId, setAccountId] = useState(null);

  const { recoveredPublicKeyToAccountId } = useHederaSdkClient();

  useEffect(() => {
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');

      setSigner(provider.getSigner());

      window.ethereum.on("accountsChanged", changeConnectedAccount);
      window.ethereum.on("chainChanged", (chainId) => {
        setErrorMessage(null);
        setAddress(null);
        setBalance(null);
        setAlias('')
        setAccountId(null);
        setChain(chainId)
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
      const balance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [address.toString(), "latest"],
      });
      setBalance(ethers.utils.formatEther(balance));
    } catch (error) {
      console.log(error);
    }
  };

  const changeConnectedAccount = async (newAddress) => {
    try {
      newAddress = Array.isArray(newAddress) ? newAddress[0] : newAddress;

      await fetchAccountBalance(newAddress);

      setAddress(newAddress);
      setErrorMessage(null);
      setAccountId(null);
      setAlias('')
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
    try {
      const message = address + '_' + Date.now();
      const msgHash = ethers.utils.hashMessage(message);
      const msgHashBytes = ethers.utils.arrayify(msgHash);

      const signature = await signer.signMessage(message);

      const recoveredPubKey = ethers.utils.recoverPublicKey(msgHashBytes, signature);
      const accountId = recoveredPublicKeyToAccountId(recoveredPubKey);

      setAccountId(accountId);
      setAlias(accountId.aliasKey.toStringRaw());
    } catch (error) {
      console.error(error.message);
    }
  }, [signer, address]);

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


      <Grid container spacing={2} justifyContent="center">
        <Grid item md={8}>
          {/* Account Section */}
          <Typography variant="h5" sx={{ textDecoration: 'underline' }}> Setup Account </Typography>
          <Typography variant="h6"> Address: {address} </Typography>
          <Typography variant="h6">
            Balance: {balance ? balance + " HBAR" : null}
          </Typography>
          <Typography variant="h6" style={{ wordBreak: 'break-word' }}>
            Status: {isConnected ? <Chip label={isAccountActivated ? "Account is active" : 'Account not created yet'} color={isAccountActivated ? 'success' : 'error'} /> : null}
          </Typography>
          <br />
          <Button onClick={showAccountIdHandler} disabled={!isConnected} size="medium" variant="contained" color="primary">
            Show alias
          </Button>
          <Typography variant="h6" style={{ wordBreak: 'break-word' }}>
            {alias}
          </Typography>

          {/* <Box sx={{ mt: '2em', mb: '2em' }}>
            <AccountActivationForm isConnected={isConnected} toAccountId={accountId} alias={alias} isActive={isAccountActivated} evmAddress={address} fetchAccountBalance={fetchAccountBalance} />
          </Box> */}

          {/* Contracts Section */}
          <Box sx={{ mt: '2em', mb: '2em' }}>
            <ContractInteractions isConnected={isConnected} signer={signer} chain={chain} address={address} />
          </Box>
          <Box sx={{ mt: '2em', mb: '2em' }}>
            <TransferHTSTokensForm isConnected={isConnected} signer={signer} chain={chain} address={address} />
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

export default App;
