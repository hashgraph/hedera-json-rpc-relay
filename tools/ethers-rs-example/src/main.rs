use ethers::{
    contract::abigen,
    middleware::SignerMiddleware,
    providers::{Http, Provider},
    signers::{LocalWallet, Signer},
};
use eyre::Result;
use std::{sync::Arc};
use ethers::middleware::Middleware;
use std::env;
use dotenv::dotenv;

abigen!(Greeter, "src/greeter.json",);

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let operator_private_key= env::var("OPERATOR_PRIVATE_KEY").unwrap();
    let relay_endpoint = env::var("RELAY_ENDPOINT").unwrap();

    let provider = Provider::<Http>::try_from(relay_endpoint)?;
    let wallet: LocalWallet = operator_private_key.parse().unwrap();

    let address = wallet.address();

    let chain_id: u64 = provider.get_chainid().await.unwrap().as_u64();
    let client = Arc::new(SignerMiddleware::new(provider.clone(),  wallet.with_chain_id(chain_id)));

    // Show account balance
    let balance = provider.get_balance(address, None).await.unwrap();
    println!("Address {address:?} balance: {balance}");

    // Deploy contract
    let greeter_contract =
        Greeter::deploy(client, "Hello World!".to_string()).unwrap().send().await.unwrap();
    println!("Deployed contract at address: {:?}", greeter_contract.address());

    // Call view method
    let greeting = greeter_contract.greet().call().await.unwrap();
    println!("Retrieved: {greeting}");

    Ok(())
}