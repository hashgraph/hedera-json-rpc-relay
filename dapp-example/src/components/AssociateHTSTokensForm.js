import React, { useState, useCallback, useEffect } from 'react'
import { Button, TextField, Typography } from "@mui/material";
import { Contract, ethers } from 'ethers';
import IHRCabi from '../contracts/IHRC.json'
import bootstrapInfo from '../contracts/.bootstrapInfo.json'

const AssociateHTSTokensForm = ({ signer, isConnected, chain, address }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [htsTokenAddress, setHtsTokenAddress] = useState('');
    const [htsTokenAssociateMsg, setHtsTokenAssocaiteMsg] = useState(null);

    // clear state vars on a chain or address have changed
    useEffect(() => {
        setIsLoading(false);
        setHtsTokenAddress(bootstrapInfo.HTS_SECOND_ADDRESS);
        setHtsTokenAssocaiteMsg(null);
    }, [chain, address])

    const htsTokenAssociate = useCallback(async () => {
      const IHRC = new ethers.utils.Interface(IHRCabi);
      try {
        setIsLoading(true);
        setHtsTokenAssocaiteMsg('Loading...');
        // create a contract object for the token
        const hrcToken = new Contract(htsTokenAddress, IHRC, await signer);
        const tx = await hrcToken.associate({ gasLimit: 1_000_0000 });

        const receipt = await tx.wait();

        setHtsTokenAssocaiteMsg(receipt.status === 1 ? 'Done' : 'There was an error.');
        setIsLoading(false);

      } catch (e) {
        console.error(e);
        setHtsTokenAssocaiteMsg('There was an error.');
        setIsLoading(false);
      }
    }, [signer, htsTokenAddress]);

    return (
        <>
            <Typography variant="h5" sx={{ textDecoration: 'underline' }}> Associate HTS Tokens </Typography>
            <br />
            <TextField
                id="htsTokenAddressField"
                fullWidth
                label="Token address"
                sx={{ m: 1 }}
                variant="standard"
                value={htsTokenAddress}
                onChange={(e) => setHtsTokenAddress(e.target.value)}
            />
            <br />
            <Button id="htsTokenAssociateBtn" onClick={htsTokenAssociate} disabled={!isConnected || isLoading} size="medium" variant="contained" color="primary">
                Associate
            </Button>
            <br />
            <Typography id="htsTokenAssociateMsg" variant="h6"> {htsTokenAssociateMsg} </Typography>
        </>
    )
}

export default AssociateHTSTokensForm;
