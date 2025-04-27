const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Endpoint to check transaction status
app.post('/check-transaction', async (req, res) => {
  const { txid, amount, assetId, recipientAddress, orderId } = req.body; // Receive details from the frontend

  if (!txid || !amount || !assetId || !recipientAddress || !orderId) {
    return res.status(400).json({ error: "Transaction ID, amount, asset ID, note and recipient address are required." });
  }

  try {
    // Query the Nodely Indexer API for transaction information
    const response = await fetch(`https://testnet-idx.4160.nodely.dev/v2/transactions/${txid}`);
    const txnInfo = await response.json();

    if (!txnInfo || txnInfo.error) {
      return res.status(500).json({ error: "Error fetching transaction info." });
    }

    if (txnInfo.transaction && txnInfo.transaction['confirmed-round'] > 0) {
      // Validate transaction details
      const payment = txnInfo.transaction['asset-transfer-transaction']; // Asset transfer details
      const transactionNote = Buffer.from(txnInfo.transaction.note, 'base64').toString();

      if (
        payment.receiver === recipientAddress &&
        payment['asset-id'] === assetId &&
        payment.amount === amount &&
        transactionNote === `order_${orderId} DO NOT CHANGE THIS AS IT CONFIRMS YOUR TRANSACTION!` // Validate against the expected order ID
      ) {
        return res.json({
          completed: true,
          confirmedRound: txnInfo.transaction['confirmed-round'],
          sender: txnInfo.transaction.sender,
          amount: payment.amount,
          assetId: payment['asset-id'],
        });
      } else {
        return res.json({
          completed: false,
          error: "Transaction details do not match the expected values.",
        });
      }
    } else {
      return res.json({ completed: false });
    }
    
  } catch (error) {
    console.error("Error checking transaction:", error);
    return res.status(500).json({ error: "Error verifying transaction. Please try again." });
  }
});

// Start the server
app.listen(port, () => {
});
