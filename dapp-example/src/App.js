import { Button, Chip, Grid, Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import { ethers } from "ethers";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import useHederaSdkClient from "./useHederaSdkClient";

function App() {
  const [errorMessage, setErrorMessage] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [accountAlias, setAccountAlias] = useState(null);

  const { recoveredPublicKeyToAccountId } = useHederaSdkClient();

  useEffect(() => {
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');

      setSigner(provider.getSigner());

      window.ethereum.on("accountsChanged", changeConnectedAccount);
      window.ethereum.on("chainChanged", () => {
        setErrorMessage(null);
        setAccount(null);
        setBalance(null);
        setAccountAlias(null);
      });
    }
  }, []);

  const isConnected = useMemo(() => {
    return !!signer && !!account;
  }, [signer, account]);

  const isAccountActivated = useMemo(() => {
    return account && Number(balance) > 0;
  }, [account, balance]);

  const changeConnectedAccount = async (newAccount) => {
    try {
      const balance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [newAccount.toString(), "latest"],
      });
      setBalance(ethers.utils.formatEther(balance));
      setAccount(newAccount);
      setAccountAlias(null);
    } catch (err) {
      console.error(err);
      setErrorMessage("There was a problem connecting to MetaMask");
    }
  };

  const connectAccountHandler = useCallback(async () => {
    if (window.ethereum) {
      try {
        const res = await window.ethereum.request({
          method: "eth_requestAccounts",
        });

        const address = await signer.getAddress();

        await changeConnectedAccount(address);
      } catch (err) {
        console.error(err);
        setErrorMessage("There was a problem connecting to MetaMask");
      }
    } else {
      setErrorMessage("Install MetaMask");
    }
  }, [signer]);

  const showAccountAliasHandler = useCallback(async () => {
    const message = 'Welcome to Hedera';
    const msgHash = ethers.utils.hashMessage(message);
    const msgHashBytes = ethers.utils.arrayify(msgHash);

    const signature = await signer.signMessage(message);

    const recoveredPubKey = ethers.utils.recoverPublicKey(msgHashBytes, signature);
    const accountAlias = recoveredPublicKeyToAccountId(recoveredPubKey).toString();

    setAccountAlias(accountAlias);
  }, [signer]);

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
        <Grid item md={6}>
          <Typography variant="h5" sx={{ textDecoration: 'underline' }}> Setup Account </Typography>
          <Typography variant="h6"> Account: {account} </Typography>
          <Typography variant="h6">
            Balance: {balance ? balance + " HBAR" : null}
          </Typography>
          <Typography variant="h6" style={{ wordBreak: 'break-word' }}>
            Status: {isConnected ? <Chip label={isAccountActivated ? "Active" : 'Inactive'} color={isAccountActivated ? 'success' : 'error'} /> : null}
          </Typography>
          <br />
          <Button onClick={showAccountAliasHandler} disabled={!isConnected} size="medium" variant="contained" color="primary">
            Show alias
          </Button>
          <Typography variant="h6" style={{ wordBreak: 'break-word' }}>
            {accountAlias}
          </Typography>

        </Grid>
      </Grid>
    </Container>
  );
}

export default App;
