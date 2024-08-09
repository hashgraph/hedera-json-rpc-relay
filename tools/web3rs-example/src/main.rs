use web3::contract::{Contract, Options};
use web3::types::{U256};
use web3::signing::{Key, SecretKey, SecretKeyRef};
use std::str::FromStr;
use std::time::Duration;
use std::env;
use dotenv::dotenv;
use web3::futures::SinkExt;

#[tokio::main]
async fn main() -> web3::contract::Result<()> {
    dotenv().ok();
    let operator_private_key= env::var("OPERATOR_PRIVATE_KEY").unwrap();
    let relay_endpoint = env::var("RELAY_ENDPOINT").unwrap();

    let operator_private_key = operator_private_key.strip_prefix("0x").unwrap();

    let transport = web3::transports::Http::new(&relay_endpoint)?;
    let web3 = web3::Web3::new(transport);

    let private_key = SecretKey::from_str(&operator_private_key).unwrap();
    let address = SecretKeyRef::new(&private_key).address();

    // Check balance
    let balance = web3.eth().balance(address, None).await?;
    println!("Address {address:?} balance: {balance}");

    // Deploy contract
    let bytecode = include_str!("SimpleStorage.bin");
    let contract = Contract::deploy(web3.eth(), include_bytes!("SimpleStorage.abi"))?
        .confirmations(1)
        .poll_interval(Duration::from_secs(10))
        .options(Options::with(|opt| opt.gas = Some(3_000_000.into())))
        .sign_with_key_and_execute(bytecode, (), &private_key, None)
        .await?;
    println!("Deployed contract at address: {:?}", contract.address());

    let result = contract.query("get", (), None, Options::default(), None);
    let storage: U256 = result.await?;
    println!("Retrieved: {storage}");

    Ok(())
}