use std::str::FromStr;
use alloy::{
    hex,
    network::{EthereumWallet, ReceiptResponse, TransactionBuilder},
    primitives::U256,
    providers::{Provider, ProviderBuilder},
    rpc::types::TransactionRequest,
    signers::local::PrivateKeySigner,
    sol,
};
use eyre::Result;
use std::env;
use dotenv::dotenv;

sol! {
    #[allow(missing_docs)]
    #[sol(rpc)]
    contract Counter {
        uint256 public number;

        function setNumber(uint256 newNumber) public {
            number = newNumber;
        }

        function increment() public {
            number++;
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let operator_private_key= env::var("OPERATOR_PRIVATE_KEY").unwrap();
    let relay_endpoint = env::var("RELAY_ENDPOINT").unwrap();

    let rpc_url: reqwest::Url =  relay_endpoint.parse().unwrap();
    let pk: PrivateKeySigner = PrivateKeySigner::from_str(&operator_private_key).expect("INVALID PK");

    let address = pk.address();
    let wallet = EthereumWallet::from(pk);

    // Create a provider with the wallet.
    let provider =
        ProviderBuilder::new().with_recommended_fillers().wallet(wallet).on_http(rpc_url);

    let balance = provider.get_balance(address).await.unwrap();
    println!("Address {address} balance: {balance}");

    // Deploy the `Counter` contract from bytecode at runtime.
    let bytecode = hex::decode(
        // solc v0.8.26; solc Counter.sol --via-ir --optimize --bin
        "6080806040523460135760df908160198239f35b600080fdfe6080806040526004361015601257600080fd5b60003560e01c9081633fb5c1cb1460925781638381f58a146079575063d09de08a14603c57600080fd5b3460745760003660031901126074576000546000198114605e57600101600055005b634e487b7160e01b600052601160045260246000fd5b600080fd5b3460745760003660031901126074576020906000548152f35b34607457602036600319011260745760043560005500fea2646970667358221220e978270883b7baed10810c4079c941512e93a7ba1cd1108c781d4bc738d9090564736f6c634300081a0033"
    )?;
    let tx = TransactionRequest::default().with_deploy_code(bytecode);

    // Deploy the contract.
    let receipt = provider.send_transaction(tx).await?.get_receipt().await?;

    let contract_address = receipt.contract_address().expect("Failed to get contract address");
    let contract = Counter::new(contract_address, &provider);
    println!("Deployed contract at address: {}", contract.address());

    // Set number
    let builder = contract.setNumber(U256::from(42));
    let tx_hash = builder.send().await?.watch().await?;

    println!("Set number to 42: {tx_hash}");

    // Increment the number to 43.
    let builder = contract.increment();
    let tx_hash = builder.send().await?.watch().await?;

    println!("Incremented number: {tx_hash}");

    // Retrieve the number, which should be 43.
    let builder = contract.number();
    let number = builder.call().await?.number.to_string();

    println!("Retrieved number: {number}");

    Ok(())
}