function check_address_form() {
    const address_form = document.getElementById('address-form');
    if (address_form) {
        address_form.addEventListener('submit', async function (event) {
            event.preventDefault(); // Prevent the default form submission

            const walletAddress = sanitizeInput(document.getElementById('crypto-wallet').value.trim());
            const userID = await getCookie(); // Securely retrieve userID

            // Validate the input
            if (!walletAddress) {
                alert('Please enter your wallet address.');
                return;
            }

            try {
                const response = await fetch(`${API_URL_USER}/update-address-user`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ userID, walletAddress }),
                    credentials: 'include', // Include cookies for authentication
                });

                const result = await response.json();

                if (result.success) {
                    alert('Wallet address updated successfully!');
                    get_address(); // Update wallet address on the frontend
                } else {
                    alert(`Failed to update wallet address: ${sanitizeInput(result.error)}`);
                }
            } catch (error) {
                console.error('Error updating wallet address:', error);
                alert('An error occurred. Please try again.');
            }
        });
    }
}

function check_deposit_form() {
    const deposit_form = document.getElementById('deposit-form');
    if (deposit_form) {
        deposit_form.addEventListener('submit', async function (event) {
            event.preventDefault();

            const deposit_amount = parseFloat(
                sanitizeInput(document.getElementById('deposit-amount').value.replace(/,/g, '').trim())
            );
            const userID = await getCookie(); // Securely retrieve userID

            if (!deposit_amount) {
                alert('Please enter how much you want to deposit!');
                return;
            }

            const serverSecret = "OneTwoThreeOneTwoThrees";
            const currentTime = new Date().toISOString();
            const note = btoa(`${userID}:${serverSecret}:${currentTime}`);
            const owner_address = "AHBYUBQCHEMEFS3FGV57MGLHNXTLN2SAFFYGEDB2ZVEAOT3MA5KFSA7WEU";

            try {
                // Store the deposit transaction securely in cookies
                const response = await fetch(`${API_URL}/start-transaction`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        address: sanitizeInput(owner_address),
                        transaction_amount: deposit_amount,
                        note: sanitizeInput(note),
                    }),
                    credentials: 'include', // Include cookies
                });

                const result = await response.json();

                if (result.success) {
                    sessionStorage.setItem('type', 'deposit');
                    window.location.href = sanitizeURL("/Crypto/crypto_pay"); // Redirect safely
                } else {
                    alert(`Failed to initiate transaction: ${sanitizeInput(result.error)}`);
                }
            } catch (error) {
                console.error('Error initiating transaction:', error);
                alert('An error occurred. Please try again.');
            }
        });
    }
}

function check_withdraw_form() {
    const withdraw_form = document.getElementById('withdraw-form');
    if (withdraw_form) {
        withdraw_form.addEventListener('submit', async function (event) {
            event.preventDefault();

            const withdraw_amount = parseFloat(
                sanitizeInput(document.getElementById('withdraw-amount').value.replace(/,/g, '').trim())
            );

            if (!withdraw_amount || withdraw_amount <= 0) {
                alert('Please enter a valid amount!');
                return;
            }

            const userID = await getCookie(); // Securely retrieve userID

            try {
                const response = await fetch(`${API_URL_USER}/withdraw-user`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userID,
                        amount: withdraw_amount,
                    }),
                    credentials: 'include', // Include cookies for authentication
                });

                const result = await response.json();
                if (response.ok && result.message === 'Withdrawal successful.') {
                    alert('Withdrawal Successful!');
                    get_balance(); // Update wallet balance
                } else {
                    alert(`Withdrawal failed: ${sanitizeInput(result.error || result.message)}`);
                }
            } catch (error) {
                console.error('Error during withdrawal:', error);
                alert('An error occurred. Please try again.');
            }
        });
    }
}

async function confirm_deposit() {
    const status = localStorage.getItem('Payment');
    if (status === 'CSP'){
        try {
            // Fetch all transaction details from the backend
            const transactionDetailsResponse = await fetch(`${API_URL}/get-all-transactions`, {
                method: 'GET',
                credentials: 'include', // Include cookies for authentication
            });

            if (!transactionDetailsResponse.ok) {
                return;
            }

            // Parse response to extract all required variables
            const { txid, amount, assetId, recipientAddress, note } = await transactionDetailsResponse.json();


            // Validate required fields
            if (!txid || !amount || !assetId || !recipientAddress || !note) {
                return;
            }

            const asset_decimal = 2; // Assuming CSP uses 2 decimals

            // Validate the transaction server-side
            const response = await fetch(`${API_URL}/check-transaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    txid,
                    amount: amount,
                    assetId,
                    recipientAddress,
                    orderId: sanitizeInput(note),
                }),
                credentials: 'include', // Include cookies for authentication
            });

            const data = await response.json();

            if (data.completed) {
                const userID = await getCookie(); // Securely retrieve userID
                const convertedAmount = parseFloat(amount) / Math.pow(10, asset_decimal);

                // Update the user's wallet on success
                const walletResponse = await fetch(`${API_URL_USER}/update-wallet-user`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userID, amount: convertedAmount }),
                    credentials: 'include', // Include cookies for authentication
                });

                const result = await walletResponse.json();

                if (walletResponse.ok && result.success) {
                    localStorage.clear();
                    alert('Deposit Successful!');
                    get_balance(); // Update the user's balance
                } else {
                    alert(`Deposit failed: ${sanitizeInput(result.error)}`);
                }
            } else {
            return;
            }
        } catch (error) {
            return;
        }
    }
}


// Function to fetch and update wallet balance
async function get_balance() {
    const userID = await getCookie(); // Securely retrieve userID

    try {
        const response = await fetch(`${API_URL_USER}/get-wallet-user?userID=${encodeURIComponent(userID)}`, {
            method: 'GET',
            credentials: 'include', // Include cookies for authentication
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const sanitizedBalance = parseFloat(data.wallet).toLocaleString('en-US') || '0';
                document.getElementById('current-balance').textContent = `${sanitizedBalance} CSP`;
                return parseFloat(data.wallet);
            } else {
                console.error('Error fetching wallet:', data.error);
                document.getElementById('current-balance').textContent = 'Error loading balance';
            }
        } else {
            console.error('Request failed:', response.status, response.statusText);
            document.getElementById('current-balance').textContent = 'Error loading balance';
        }
    } catch (error) {
        console.error('Error fetching wallet:', error);
        document.getElementById('current-balance').textContent = 'Error loading balance';
    }
}

// Function to fetch and update wallet address
async function get_address() {
    const userID = await getCookie(); // Securely retrieve userID

    try {
        const response = await fetch(`${API_URL_USER}/get-address-user?userID=${encodeURIComponent(userID)}`, {
            method: 'GET',
            credentials: 'include', // Include cookies for authentication
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const sanitizedAddress = sanitizeInput(data.address || 'Not available');
                document.getElementById('current-address').textContent = sanitizedAddress;
                return sanitizedAddress;
            } else {
                console.error('Error fetching address:', data.error);
                document.getElementById('current-address').textContent = 'Error loading address';
            }
        } else {
            console.error('Request failed:', response.status, response.statusText);
            document.getElementById('current-address').textContent = 'Error loading address';
        }
    } catch (error) {
        console.error('Error fetching address:', error);
        document.getElementById('current-address').textContent = 'Error loading address';
    }
}

// Function to format deposit and withdrawal amounts with commas and decimals
function format_amount() {
    const depositInput = document.getElementById('deposit-amount');
    const withdrawInput = document.getElementById('withdraw-amount');

    const formatWithCommas = (value) => value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    const handleInput = (event) => {
        let value = event.target.value.replace(/,/g, ''); // Remove commas
        if (!isNaN(value) && value !== '') {
            event.target.value = formatWithCommas(value); // Add commas back
        }
    };

    const handleBlur = (event) => {
        let value = event.target.value.replace(/,/g, ''); // Remove commas for processing
        if (value === '' || isNaN(value)) {
            event.target.value = ''; // Clear invalid input
        } else {
            event.target.value = parseFloat(value).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
        }
    };

    if (depositInput) {
        depositInput.addEventListener('input', handleInput);
        depositInput.addEventListener('blur', handleBlur);
    }

    if (withdrawInput) {
        withdrawInput.addEventListener('input', handleInput);
        withdrawInput.addEventListener('blur', handleBlur);
    }
}



document.addEventListener('DOMContentLoaded', () => {
    get_balance();
    get_address();
    check_address_form();
    check_deposit_form();
    check_withdraw_form();
    format_amount();
    confirm_deposit();
});
