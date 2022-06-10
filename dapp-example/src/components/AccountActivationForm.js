import { Box, Button, InputAdornment, TextField, Typography } from "@mui/material"
import { useCallback, useState } from "react";
import useHederaSdk from "../hooks/useHederaSdkClient";


const AccountActivationForm = ({ toAccountId, isActive, evmAddress }) => {
    const [mainAccountId, setMainAccountId] = useState('');
    const [mainPrivateKey, setMainPrivateKey] = useState('');
    const [amount, setAmount] = useState(0);

    const { transferHbarsToAccount, getAccountInfo } = useHederaSdk();

    const transferHbarHandler = useCallback(async () => {
        try {
            if (!toAccountId || !mainAccountId || !mainPrivateKey || !amount) return;

            await transferHbarsToAccount(mainAccountId, mainPrivateKey, Number(amount), toAccountId);

            const info = await getAccountInfo(evmAddress);

            console.log(info.accountId, info.contractAccountId, info.balance.toString())
            console.log(`Transferred ${amount} Hbar to ${evmAddress}`);
        } catch (error) {
            console.error(error);
        }
    }, [mainAccountId, mainPrivateKey, amount, evmAddress]);

    return (
        <>
            {isActive
                ? null
                : <Typography variant="h6" style={{ wordBreak: 'break-word' }} color='orange'>
                    Your hedera account is not active yet. Please use the form below to send Hbar tokens to your hedera alias in order to activate your account.
                </Typography>
            }

            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                <TextField
                    fullWidth
                    label="Account Id"
                    sx={{ m: 1 }}
                    variant="standard"
                    value={mainAccountId}
                    onChange={(e) => setMainAccountId(e.target.value)}
                />
                <TextField
                    fullWidth
                    label="Private key"
                    sx={{ m: 1 }}
                    variant="standard"
                    value={mainPrivateKey}
                    onChange={(e) => setMainPrivateKey(e.target.value)}
                />
                <TextField
                    fullWidth
                    label="Amount"
                    type='number'
                    sx={{ m: 1 }}
                    InputProps={{
                        endAdornment: <InputAdornment position="end">hbar</InputAdornment>,
                    }}
                    variant="standard"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                />
                <TextField
                    fullWidth
                    label="To Alias"
                    sx={{ m: 1 }}
                    variant="standard"
                    value={toAccountId.toString()}
                />

                <Button onClick={transferHbarHandler} size="medium" variant="contained" color="primary">
                    Transfer
                </Button>
            </Box>
        </>
    )
}

export default AccountActivationForm;