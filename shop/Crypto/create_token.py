from algosdk import account, mnemonic
from algosdk.transaction import AssetConfigTxn
from algosdk.v2client import algod
import time

# Connect to Algorand TestNet
algod_address = "https://testnet-api.4160.nodely.dev"  # Free service endpoint
algod_token = ""  # No token needed for this free service
algod_client = algod.AlgodClient(algod_token, algod_address)

# Create a new account (private key and public address)
mnemonic_phrase = "quick supply prize soft image avoid that artefact tooth recipe good emerge burden hair profit awake deer path maximum hope cross frog describe abstract december"
private_key = mnemonic.to_private_key(mnemonic_phrase)  # Convert mnemonic to private key
public_address = "AHBYUBQCHEMEFS3FGV57MGLHNXTLN2SAFFYGEDB2ZVEAOT3MA5KFSA7WEU"  # Convert mnemonic to public address

# Print the address for verification
print(f"Public Address: {public_address}")

# Ensure your public address has TestNet funds. Use an Algorand faucet to fund your address.
print("Fund your address using the TestNet faucet if needed.")

# Asset parameters (define your new cryptocurrency details)
params = algod_client.suggested_params()
total_supply = 10000000  # Total supply of your new cryptocurrency
asset_name = "CryptoShop"  # Name of your cryptocurrency
unit_name = "CSP"  # Short symbol for your cryptocurrency (e.g., "MTK")
decimals = 2  # Number of decimals for the cryptocurrency

# Create the asset configuration transaction
txn = AssetConfigTxn(
    sender=public_address,
    sp=params,
    total=total_supply,
    default_frozen=False,
    unit_name=unit_name,
    asset_name=asset_name,
    manager=public_address,  # Address that manages the asset
    reserve=public_address,  # Optional; set to None if no reserve address is needed
    freeze=None,  # Optional; set to None if no freezing is required
    clawback=None,  # Optional; set to None if no clawback is needed
    decimals=decimals,
    strict_empty_address_check=False
)

def wait_for_confirmation(client, txid, timeout=10):
    """
    Wait until the transaction is confirmed or timeout is reached.
    """
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            pending_txn = client.pending_transaction_info(txid)
            if pending_txn.get("confirmed-round", 0) > 0:
                return pending_txn
        except Exception as e:
            print(f"Error while waiting for confirmation: {e}")
        time.sleep(1)
    raise Exception("Transaction not confirmed within timeout.")
# Sign and send the transaction
signed_txn = txn.sign(private_key)

try:
    # Send the transaction to the Algorand network
    txid = algod_client.send_transaction(signed_txn)
    print(f"Transaction ID: {txid}")

    # Wait for confirmation of the transaction
    confirmed_txn = wait_for_confirmation(algod_client, txid)
    print("Transaction confirmed in round:", confirmed_txn['confirmed-round'])
    asset_id = confirmed_txn['asset-index']
    print(f"Asset ID: {asset_id}")


except Exception as e:
    print(f"Failed to create cryptocurrency: {e}")