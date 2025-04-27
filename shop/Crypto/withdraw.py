from algosdk import account, mnemonic
from algosdk.future.transaction import PaymentTxn, AssetTransferTxn
from flask import Flask, request, jsonify
from algosdk.v2client import algod


app = Flask(__name__)



# Mnemonic (replace with your actual mnemonic phrase)
MNEMONIC_PHRASE = "quick supply prize soft image avoid that artefact tooth recipe good emerge burden hair profit awake deer path maximum hope cross frog describe abstract december"


# Convert mnemonic to private key and public address
PRIVATE_KEY = mnemonic.to_private_key(MNEMONIC_PHRASE)
PUBLIC_ADDRESS = "AHBYUBQCHEMEFS3FGV57MGLHNXTLN2SAFFYGEDB2ZVEAOT3MA5KFSA7WEU"


algod_address = "https://testnet-api.4160.nodely.dev" 
algod_token = ""  
algod_client = algod.AlgodClient(algod_token, algod_address)

ASSET_ID = 732664447 
ASSET_DECIMALS = 2   

@app.route('/withdraw', methods=['POST'])
def process_asset_withdrawal():
    try:
        data = request.json
        recipient_address = data.get("address")
        amount = data.get("amount")  # Amount of the asset to withdraw

        if not recipient_address or not amount:
            return jsonify({"message": "Address and amount are required."}), 400

        # Convert amount to appropriate unit (handle decimals)
        asset_amount = int(float(amount) * (10 ** ASSET_DECIMALS))

        # Get suggested transaction parameters
        params = algod_client.suggested_params()

        # Create an asset transfer transaction
        txn = AssetTransferTxn(
            sender=PUBLIC_ADDRESS,  # Sender's address
            sp=params,              # Transaction parameters
            receiver=recipient_address,  # Receiver's address
            amt=asset_amount,       # Amount to transfer
            index=ASSET_ID          # Asset ID of the custom cryptocurrency
        )

        # Sign the transaction
        signed_txn = txn.sign(PRIVATE_KEY)

        # Send the transaction
        txid = algod_client.send_transaction(signed_txn)
        print(f"Transaction sent with ID: {txid}")

        # Wait for confirmation
        confirmation = wait_for_confirmation(algod_client, txid)

        return jsonify({
            "status": "success",
            "transaction_id": txid,
            "confirmed_round": confirmation.get("confirmed-round"),
        })
    except Exception as e:
        print(f"Error in asset withdrawal: {e}")
        return jsonify({"error": str(e)}), 500




def wait_for_confirmation(client, txid):
    """Utility function to wait for transaction confirmation."""
    last_round = client.status().get("last-round")
    while True:
        try:
            tx_info = client.pending_transaction_info(txid)
            if tx_info.get("confirmed-round"):
                return tx_info
            print("Waiting for confirmation...")
            client.status_after_block(last_round + 1)
        except Exception as e:
            print(f"Error waiting for confirmation: {e}")
            raise

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)