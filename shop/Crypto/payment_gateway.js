// Function to fetch and display wallet balance
async function get_balance() {
    const userID = await getCookie(); // Retrieve userID securely using auth.js
    try {
        // Fetch the wallet balance securely from the server
        const response = await fetch(`${API_URL_USER}/get-wallet-user?userID=${encodeURIComponent(userID)}`, {
            method: 'GET',
            credentials: 'include', // Include cookies for authentication
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const sanitizedWallet = sanitizeInput(data.wallet); // Sanitize the wallet amount
                document.getElementById('current-balance').textContent = `${parseFloat(sanitizedWallet).toLocaleString('en-US') || 0} CSP`;

                // Fetch transaction amount securely
                const transactionDetails = await fetch(`${API_URL}/get-transaction-details`, {
                    method: 'GET',
                    credentials: 'include',
                });

                if (transactionDetails.ok) {
                    const { transaction_amount } = await transactionDetails.json();
                    const sanitizedAmount = sanitizeInput(transaction_amount);
                    const formattedTotal = `${parseFloat(sanitizedAmount).toLocaleString('en-US') || 0} CSP`;
                    document.getElementById('current-payable').textContent = formattedTotal;
                } else {
                    console.error('Error fetching transaction details.');
                    document.getElementById('current-payable').textContent = 'Error loading transaction details';
                }
            } else {
                console.error('Error fetching wallet:', sanitizeInput(data.error));
                document.getElementById('current-balance').textContent = 'Error loading balance';
            }
        } else {
            console.error('Request failed:', response.status, response.statusText);
            document.getElementById('current-balance').textContent = 'Error loading balance';
        }
    } catch (error) {
        console.error('Error fetching wallet or transaction details:', error);
        document.getElementById('current-balance').textContent = 'Error loading balance';
        document.getElementById('current-payable').textContent = 'Error loading transaction details';
    }
}

// Redirect to the dashboard for wallet recharge
function redirectToDashboard() {
    window.location.href = sanitizeURL('/Dashboard/wallet.html');
}

// Confirm the payment
async function confirmPayment() {
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked');

    if (!paymentMethod) {
        alert('Please select a payment method.');
        return;
    }

    if (paymentMethod.value === 'csp') {
        window.location.href = sanitizeURL('/Crypto/crypto_pay.html');
        return;
    }

    try {
        // Fetch transaction details securely
        const transactionDetailsResponse = await fetch(`${API_URL}/get-transaction-details`, {
            method: 'GET',
            credentials: 'include', // Include cookies for authentication
        });

        if (!transactionDetailsResponse.ok) {
            throw new Error('Failed to fetch transaction details.');
        }

        const { transaction_amount } = await transactionDetailsResponse.json();
        const sanitizedAmount = sanitizeInput(transaction_amount);

        if (isNaN(sanitizedAmount) || sanitizedAmount <= 0) {
            alert('Invalid payment amount.');
            return;
        }
        const userID = await getCookie();
        // Process the payment
        const response = await fetch(`${API_URL_USER}/wallet-checkout-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userID: userID, amount: sanitizedAmount }),
            credentials: 'include', // Include cookies for authentication
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('Payment', 'wallet');
            alert('Payment successful!');
            window.location.href = sanitizeURL('/cart.html');
        } else {
            alert(sanitizeInput(result.message || 'Payment failed.'));
        }
    } catch (error) {
        console.error('Error during payment:', error);
        alert('An error occurred while processing the payment. Please try again.');
    }
}

// Handle the back button
function handleBack() {
    alert('Transaction canceled. Redirecting to cart...');
    window.location.href = sanitizeURL('/cart.html');
}

// Load the wallet balance on page load
document.addEventListener('DOMContentLoaded', get_balance);
