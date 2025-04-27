// Import QRCode library
const qrCodeCanvas = document.getElementById("qr-code");
const transactionStatus = document.getElementById("transaction-status");
const backToHomeButton = document.getElementById("back-to-home");


// Function to fetch transaction details and generate QR code
async function fetchTransactionDetails() {
  try {
      const response = await fetch(`${API_URL}/get-transaction-details`, {
          method: "GET",
          credentials: "include", // Include cookies in the request
      });

      if (!response.ok) {
          throw new Error("Failed to fetch transaction details.");
      }

      const { recipientAddress, transaction_amount, note } = await response.json();
      generateQRCode(recipientAddress, transaction_amount, note);

  } catch (error) {
      console.error("Error fetching transaction details:", error);
      alert("Failed to retrieve transaction details. Please try again.");
  }
}

// Function to generate a QR code with payment details
// Helper function for URL-safe Base64 encoding
function toBase64UrlSafe(input) {
    return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Function to generate a QR code with payment details
function generateQRCode(address, amount, note) {
    try {
        const sanitizedAddress = sanitizeInput(address);
        const sanitizedNote = sanitizeInput(note);

        // Generate URL-safe Base64 encoding for the note
        const base64Note = toBase64UrlSafe(sanitizedNote);

        const paymentDetails = {
            recipient: sanitizedAddress,
            assetID: 732664447,
            amount_in: parseFloat(amount) * Math.pow(10, 2),
            note: `order_${base64Note}_DO_NOT_CHANGE_THIS_AS_IT_CONFIRMS_YOUR_TRANSACTION!`,
        };

        // Construct the QR code data
        const qrCodeData = `algorand://${paymentDetails.recipient}?amount=${paymentDetails.amount_in}&asset=${paymentDetails.assetID}&note=${encodeURIComponent(paymentDetails.note)}`;

        // Generate the QR code
        const qr = new QRious({
            element: qrCodeCanvas,
            size: 200,
            value: qrCodeData,
        });

        if (qr) {
            transactionStatus.textContent = "Scan the QR code to pay.";
        } else {
            transactionStatus.textContent = "Failed to generate QR code. Please try again.";
        }
    } catch (error) {
        console.error("Error generating QR code:", error);
        transactionStatus.textContent = "Error generating QR code. Please try again.";
    }
}


// Function to monitor the transaction status
async function monitorTransaction(txid) {
    try {
        // Fetch transaction details
        const transactionDetailsResponse = await fetch(`${API_URL}/get-transaction-details`, {
            method: "GET",
            credentials: "include", // Include cookies in the request
        });

        if (!transactionDetailsResponse.ok) {
            return;
        }

        const { recipientAddress, transaction_amount, note } = await transactionDetailsResponse.json();
        const amount = parseFloat(transaction_amount) * Math.pow(10, 2);
        const base64Note = toBase64UrlSafe(sanitizeInput(note));


        // Check transaction status
        const response = await fetch(`${API_URL}/check-transaction`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                txid,
                amount,
                assetId: 732664447,
                recipientAddress: sanitizeInput(recipientAddress),
                orderId: `order_${base64Note}_DO_NOT_CHANGE_THIS_AS_IT_CONFIRMS_YOUR_TRANSACTION!`,
            }),
            credentials: "include",
        });

        const data = await response.json();

        if (data.completed) {
            localStorage.setItem('Payment', 'CSP');
            transactionStatus.textContent = `Transaction confirmed! Amount: ${amount / Math.pow(10, 2)} CSP. Redirecting...`;
            transactionStatus.classList.add("success");
            const homeButton = document.getElementById("back-to-home");

            const type = sanitizeInput(sessionStorage.getItem('type')); 
            sessionStorage.clear();
            if (type === "cart") {
                if (homeButton) homeButton.style.display = "none";
                window.location.href = sanitizeURL("/cart.html");
            } else if (type === "deposit") {
                if (homeButton) homeButton.style.display = "none";
                window.location.href = sanitizeURL("/Dashboard/wallet.html");
            }
        } else if (data.error === "Transaction details do not match the expected values.") {
            transactionStatus.textContent = "Waiting for payment...";
        } else {
            transactionStatus.textContent = "Waiting for payment...";
        }
    } catch (error) {
        console.error("Error checking transaction status:", error);
        transactionStatus.textContent = "Error verifying transaction. Please try again.";
    }
}




// Function to fetch the latest transaction ID
async function getLatestTransactionId() {
  try {
      // Fetch transaction details
      const transactionDetailsResponse = await fetch(`${API_URL}/get-transaction-details`, {
          method: "GET",
          credentials: "include", // Include cookies in the request
      });

      const { recipientAddress } = await transactionDetailsResponse.json();
      const sanitizedAddress = sanitizeInput(recipientAddress);

      const indexerUrl = "https://testnet-idx.4160.nodely.dev/v2/accounts";

      // Fetch the latest transaction for the recipient address
      const response = await fetch(`${indexerUrl}/${sanitizedAddress}/transactions?limit=1`, {
          method: "GET",
      });

      if (!response.ok) {
          return;
      }

      const data = await response.json();

      if (data.transactions && data.transactions.length > 0) {
          const latestTransaction = data.transactions[0];
          return latestTransaction.id; // Return the transaction ID
      } else {
          console.warn("No transactions found for the recipient address.");
          return null;
      }
  } catch (error) {
      console.error("Error fetching the latest transaction ID:", error);
      return null;
  }
}

// Function to poll for transaction status every 5 seconds
async function startTransactionMonitoring() {
  try {
      const txid = await getLatestTransactionId();
      if (txid) {
          await monitorTransaction(txid);
      } else {
          console.warn("Transaction ID not available. Waiting for transactions...");
      }
  } catch (error) {
      console.error("Error monitoring transaction:", error);
  }
}

// Call the monitoring function at a 5-second interval
setInterval(startTransactionMonitoring, 3000);



// Redirect to home when button is clicked
backToHomeButton.addEventListener("click", () => {
    const type = sanitizeInput(sessionStorage.getItem('type')); 
    confirm("Are you sure to cancel payment? If you have just paid, do not leave the page and wait to be redirected!");
    if (type === 'cart'){
        window.location.href = sanitizeURL("/cart.html");;
    }
    else if (type === 'deposit'){
        window.location.href = sanitizeURL("/Dashboard/wallet.html");
    }
    });

document.addEventListener("DOMContentLoaded", fetchTransactionDetails);
