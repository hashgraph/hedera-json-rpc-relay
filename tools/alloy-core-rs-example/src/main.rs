use alloy::{
    network::EthereumWallet,
    providers::{Provider, ProviderBuilder},
    signers::local::PrivateKeySigner,
    sol,
};
use dotenv::dotenv;
use eyre::Result;
use std::env;
use std::str::FromStr;

const INITIAL_GREET: &str = "Hello world!";
const NEW_GREET: &str = "Hello world 2!";

// Check README to see how to compile this artifact
sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    Greeter,
    "contract/out/Greeter.sol/Greeter.json"
);

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let operator_private_key = env::var("OPERATOR_PRIVATE_KEY").unwrap();
    let relay_endpoint = env::var("RELAY_ENDPOINT").unwrap();

    let rpc_url: reqwest::Url = relay_endpoint.parse().unwrap();
    let pk: PrivateKeySigner =
        PrivateKeySigner::from_str(&operator_private_key).expect("INVALID PK");

    let address = pk.address();
    let wallet = EthereumWallet::from(pk);

    // Create a provider with the wallet.
    let provider = ProviderBuilder::new()
        .with_recommended_fillers()
        .wallet(wallet)
        .on_http(rpc_url);

    // Check address balance
    let balance = provider.get_balance(address).await.unwrap();
    println!("Address {address} balance: {balance}");

    // Deploy the contract.
    let greeter_contract = Greeter::deploy(&provider, INITIAL_GREET.to_string()).await?;
    println!(
        "Deployed contract at address: {:?}",
        greeter_contract.address()
    );

    // Call view method
    let greeting = greeter_contract.greet().call().await.unwrap();
    println!("Retrieved greet: {}", greeting._0);

    // Change greet value
    let receipt = greeter_contract
        .setGreeting(NEW_GREET.to_string())
        .send()
        .await?
        .get_receipt()
        .await?;
    println!("Change greeting tx_hash: {:?}", receipt.transaction_hash);

    // Call view method to see is value changed
    let greeting = greeter_contract.greet().call().await.unwrap();
    println!("After change retrieved greet: {}", greeting._0);

    Ok(())
}
