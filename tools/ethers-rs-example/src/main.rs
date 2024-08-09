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

const INITIAL_GREET: &str = "Hello world!";
const NEW_GREET: &str = "Hello world 2!";

// Check README to see how to compile this artifact
abigen!(Greeter, "contract/out/Greeter.sol/Greeter.json",);

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let operator_private_key= env::var("OPERATOR_PRIVATE_KEY").unwrap();
    let relay_endpoint = env::var("RELAY_ENDPOINT").unwrap();

    let client = init_client(&operator_private_key, &relay_endpoint).await?;

    // Show account balance
    let address = client.address();
    let balance = client.provider().get_balance(address, None).await.unwrap();
    println!("Address {address:?} balance: {balance}");

    // Deploy contract
    let greeter_contract = deploy_contract(client.clone(), INITIAL_GREET.to_string()).await?;
    println!("Deployed contract at address: {:?}", greeter_contract.address());

    // Call view method
    let greeting = get_greeting(&greeter_contract).await?;
    println!("Retrieved greet: {}", greeting);

    // Change greet value
    let receipt = set_greeting(&greeter_contract, NEW_GREET.to_string()).await?;
    println!("Change greeting tx_hash: {:?}", receipt.transaction_hash);

    // Call view method to see if value changed
    let greeting = get_greeting(&greeter_contract).await?;
    println!("After change retrieved greet: {}", greeting);

    Ok(())
}

async fn init_client(operator_private_key: &str, relay_endpoint: &str) -> Result<Arc<SignerMiddleware<Provider<Http>, LocalWallet>>> {
    let provider = Provider::<Http>::try_from(relay_endpoint)?;
    let wallet: LocalWallet = operator_private_key.parse().unwrap();

    let chain_id: u64 = provider.get_chainid().await.unwrap().as_u64();
    let client = Arc::new(SignerMiddleware::new(provider, wallet.with_chain_id(chain_id)));

    Ok(client)
}

async fn deploy_contract(client: Arc<SignerMiddleware<Provider<Http>, LocalWallet>>, initial_greet: String) -> Result<Greeter<SignerMiddleware<Provider<Http>, LocalWallet>>> {
    let greeter_contract = Greeter::deploy(client, initial_greet)?.send().await?;
    Ok(greeter_contract)
}

async fn get_greeting(greeter_contract: &Greeter<SignerMiddleware<Provider<Http>, LocalWallet>>) -> Result<String> {
    let greeting = greeter_contract.greet().call().await?;
    Ok(greeting)
}

async fn set_greeting(greeter_contract: &Greeter<SignerMiddleware<Provider<Http>, LocalWallet>>, new_greet: String) -> Result<ethers::types::TransactionReceipt> {
    let receipt = greeter_contract.set_greeting(new_greet).send().await?.await?.unwrap();
    Ok(receipt)
}
