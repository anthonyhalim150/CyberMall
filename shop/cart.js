let items = []; // Declare items globally

async function renderCart() {
    const cartContent = document.getElementById('cart-content');
    const userID = await getCookie(); // Securely fetch userID using await getCookie()

    if (!cartContent || !userID) {
        console.error("User not authenticated or cart element missing.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/cart-items?userID=${encodeURIComponent(userID)}`, {
            method: 'GET',
            credentials: 'include', // Ensure cookies are included in the request
        });

        const result = await response.json();

        if (!result.success || !result.cartItems || result.cartItems.length === 0) {
            cartContent.innerHTML = `
                <div class="empty-cart text-center">
                    <img src="icons/empty-cart.png" alt="Empty Cart" class="empty-cart">
                    <p>Your cart is empty!</p>
                </div>
            `;
            return;
        }

        // Store cart items globally
        items = result.cartItems;

        // Calculate total amount
        const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        // Render cart items
        cartContent.innerHTML = `
            <ul class="list-group">
                ${items.map(item => {
                    const formattedPrice = parseFloat(item.price).toLocaleString('en-US');
                    const sanitizedName = sanitizeInput(item.name);
                    const sanitizedImage = sanitizeInput(item.image);
                    return `
                    <div class="card" data-item-id="${sanitizeInput(item.id)}" onclick="showItemOverview('${sanitizeInput(item.id)}')">
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center">
                                <img src="${sanitizedImage}" alt="${sanitizedName}" class="img-thumbnail me-3" style="width: 50px; height: 50px;">
                                <div>
                                    <p class="mb-0"><strong>${sanitizedName}</strong></p>
                                    <small>Price: $${formattedPrice}</small>
                                </div>
                            </div>
                            <div class="d-flex align-items-center">
                                <div class="quantity-container me-3">
                                    <div class="quantity-control">
                                        <button class="btn btn-secondary" onclick="handleClick(event, '${sanitizeInput(item.id)}', -1, ${sanitizeInput(item.stock)})">-</button>
                                        <input type="number" id="quantity-${sanitizeInput(item.id)}" value="${sanitizeInput(item.quantity)}" min="0" max="${sanitizeInput(item.stock)}" 
                                            class="quantity-input" onclick="event.stopPropagation();" 
                                            onchange="updateQuantity('${sanitizeInput(item.id)}', ${sanitizeInput(item.stock)})">
                                        <button class="btn btn-secondary" onclick="handleClick(event, '${sanitizeInput(item.id)}', 1, ${sanitizeInput(item.stock)})">+</button>
                                    </div>
                                </div>
                                <div class="price-container me-3">
                                    <span class="price-text" onclick="event.stopPropagation();">
                                        $${(item.price * item.quantity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); removeItem('${sanitizeInput(item.id)}')">Remove All</button>
                            </div>
                        </li>
                    </div>
                    `;
                }).join('')}
            </ul>
            <div class="mt-3 text-end">
                <h4>Total: $${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                <button class="btn btn-warning me-3" onclick="clearCart()">Clear Cart</button>
                <button class="btn btn-success" onclick="checkout(${totalAmount})">Checkout</button>
            </div>
        `;
    } catch (error) {
        console.error('Error fetching cart:', error);
        cartContent.innerHTML = `<p class="text-danger">Failed to load cart. Please try again later.</p>`;
    }
}


let timeoutID = null;

function handleClick(event ,itemId, change, stock) {
    const button = event.target;
    event.stopPropagation();
    button.disabled = true;  // Disable the button

    // Clear any existing timeouts
    if (timeoutID) {
        clearTimeout(timeoutID);
    }

    // Schedule the changeQuantity function
    timeoutID = setTimeout(() => {
        changeQuantity(itemId, change, stock);
        button.disabled = false;  // Re-enable the button after the delay
    }, 1000);  // Delay of 1000 milliseconds (1 second)
}



// Function to change quantity (triggered by + / - buttons)
async function changeQuantity(itemID, delta, stock) {
    try {
        const quantityInput = document.getElementById(`quantity-${sanitizeInput(itemID)}`);
        const newQuantity = parseInt(quantityInput.value) + delta;

        // Validate new quantity
        if (isNaN(newQuantity) || newQuantity < 0 || newQuantity > stock) return;

        quantityInput.value = newQuantity;

        if (newQuantity === 0) {
            const removed = await removeItem(itemID); // Remove item if quantity is 0
            if (!removed) {
                quantityInput.value = 1; // Reset to 1 if removal fails
            }
        } else {
            await updateCart(itemID, newQuantity); // Update cart with new quantity
        }
    } catch (error) {
        console.error("Error in changeQuantity:", error);
    }
}

// Function to update quantity (triggered by manual input change)
async function updateQuantity(itemID, stock) {
    try {
        const quantityInput = document.getElementById(`quantity-${sanitizeInput(itemID)}`);
        const newQuantity = parseInt(quantityInput.value);

        // Validate new quantity
        if (isNaN(newQuantity) || newQuantity < 0) {
            quantityInput.value = 1; // Reset to 1 for invalid input
            return;
        }

        if (newQuantity > stock) {
            quantityInput.value = stock; // Reset to max stock if input exceeds stock
            return;
        }

        if (newQuantity === 0) {
            const removed = await removeItem(itemID); // Remove item if quantity is 0
            if (!removed) {
                quantityInput.value = 1; // Reset to 1 if removal fails
            }
        } else {
            await updateCart(itemID, newQuantity); // Update cart with new quantity
        }
    } catch (error) {
        console.error("Error in updateQuantity:", error);
    }
}

async function updateCart(itemID, newQuantity) {
    const userID = await getCookie(); // Securely fetch userID using await getCookie()

    try {
        const response = await fetch(`${API_URL}/update-cart-item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userID: sanitizeInput(userID),
                itemID: sanitizeInput(itemID),
                quantity: sanitizeInput(newQuantity),
            }),
            credentials: "include",
        });

        const result = await response.json();

        if (!result.success) {
            alert('Failed to update cart. Please try again.');
        } else {
            renderCart(); // Refresh cart
        }
    } catch (error) {
        console.error('Error updating cart:', error);
        alert('An error occurred. Please try again.');
    }
}

async function removeItem(itemID) {
    const userID = await getCookie(); // Securely fetch userID using await getCookie()

    let user_response = confirm('Are you sure to remove this item?');
    if (!user_response) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/remove-cart-item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userID: sanitizeInput(userID),
                itemID: sanitizeInput(itemID),
            }),
            credentials: "include",
        });

        const result = await response.json();

        if (result.success) {
            alert('Item removed from cart.');
            renderCart(); // Refresh cart
        } else {
            alert('Failed to remove item. Please try again.');
        }
    } catch (error) {
        console.error('Error removing item:', error);
        alert('An error occurred. Please try again.');
    }
}


async function clearCart() {
    const userID = await getCookie();
    try {
        const response = await fetch(`${API_URL}/clear-cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userID }),
            credentials: "include",
        });
        const result = await response.json();

        if (result.success) {
            alert('Cart cleared successfully.');
            renderCart(); // Refresh cart
        } else {
            alert('Failed to clear cart. Please try again.');
        }
    } catch (error) {
        console.error('Error clearing cart:', error);
        alert('An error occurred. Please try again.');
    }
}

async function checkout(transactionAmount) {
    const userID = await getCookie(); // Retrieve user ID securely
    const serverSecret = "OneTwoThreeOneTwoThrees"; // Replace with your server's secret
    const currentTime = new Date().toISOString();
    const sanitizedTransactionAmount = sanitizeInput(transactionAmount); // Sanitize input
    const note = btoa(`${userID}:${serverSecret}:${currentTime}`); // Base64 encoding for note
    const owner_address = "AHBYUBQCHEMEFS3FGV57MGLHNXTLN2SAFFYGEDB2ZVEAOT3MA5KFSA7WEU";

    try {
        // Start the transaction by sending data to the backend
        const response = await fetch(`${API_URL}/start-transaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                address: sanitizeInput(owner_address), // Sanitize address
                transaction_amount: sanitizedTransactionAmount,
                note: sanitizeInput(note), // Sanitize note
            }),
            credentials: "include", // Include cookies for authentication
        });

        const result = await response.json();

        if (result.success) {
            // Store the 'cart' type in sessionStorage
            sessionStorage.setItem('type', 'cart');
            window.location.href = sanitizeURL("/Crypto/index"); // Redirect safely
        } else {
            alert(`Failed to initiate transaction: ${sanitizeInput(result.error)}`);
        }
    } catch (error) {
        console.error("Error during transaction initiation:", error);
        alert("An error occurred while starting the transaction. Please try again.");
    }
}

async function confirm_payment_status() {
    try {
        // Fetch transaction details from the server
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
            alert('Missing required transaction details.');
            return;
        }



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
        return data;
    } catch (error) {
        return;
    }
}
async function monitorWalletPayment() {
    try {
        const response = await fetch(`${API_URL}/validate-transaction`, {
            method: 'POST',
            credentials: 'include', // Include cookies in the request
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
            confirm_checkout();
            renderCart();
        } else {
            console.error('Validation failed:', data.error);
        }
    } catch (error) {
        console.error('Error during validation:', error.message || error);
    }
}


async function monitorPaymentStatus() {
    const payment_method = localStorage.getItem('Payment');
    if (payment_method === 'CSP'){
        try {//put if
            const result = await confirm_payment_status();
            if (!result){
                return;
            }
            if (result.completed) {
                confirm_checkout();
                renderCart();
            }
        } catch (error) {
            console.error("Error monitoring payment status:", error);
        }
    }
    else if (payment_method === 'wallet'){
        await monitorWalletPayment();
    }
}

async function confirm_checkout() {
    const userID = await getCookie(); // Retrieve user ID securely
    try {
        const response = await fetch(`${API_URL}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userID: sanitizeInput(userID) }), // Sanitize userID
            credentials: "include",
        });
        const result = await response.json();
        if (result.success) {
            localStorage.clear();
            alert("Checkout Successful!");
            renderCart(); // Update cart UI
        } else {
            alert(`Checkout failed: ${sanitizeInput(result.error)}`);
        }
    } catch (error) {
        console.error("Error during checkout:", error);
        alert("An error occurred during checkout. Please try again.");
    }
}
function showItemOverview(itemId) {
    const item = items.find(i => i.id === Number(itemId)); // Ensure numeric comparison
    if (!item) {
        console.error('Item not found for ID:', itemId);
        return;
    }

    const overviewContainer = document.getElementById('item-overview');
    if (!overviewContainer) {
        console.error('Overview container not found in the DOM.');
        return;
    }

    const sanitizedName = sanitizeInput(item.name);
    const sanitizedImage = sanitizeInput(item.image);
    const sanitizedDescription = sanitizeInput(item.description);
    const sanitizedPrice = parseFloat(item.price).toLocaleString('en-US');
    const sanitizedStock = sanitizeInput(item.stock);
    const sanitizedCategory = sanitizeInput(item.category || 'N/A');

    overviewContainer.innerHTML = `
        <h3>${sanitizedName}</h3>
        <img src="${sanitizedImage}" alt="${sanitizedName}" style="width: 180px; height: 180px; margin-bottom: 15px;">
        <p class="item-description"><strong>Description:</strong> ${sanitizedDescription}</p>
        <p class="item-description"><strong>Price:</strong> $${sanitizedPrice}</p>
        <p class="item-description"><strong>Stock:</strong> ${sanitizedStock}</p>
        <p class="item-description"><strong>Category:</strong> ${sanitizedCategory}</p>
        <button class="close-btn" onclick="closeItemOverview()">Close</button>
    `;
    overviewContainer.style.display = 'block';
}


document.addEventListener('click', (event) => {
    const overviewSection = document.getElementById('item-overview');
    const isInsideOverview = overviewSection && overviewSection.contains(event.target);
    const isCloseButton = event.target.closest('.close-btn');
    const isTriggerElement = event.target.closest('.card'); // Adjust trigger as needed

    if (isTriggerElement) {
        const itemId = isTriggerElement.dataset.itemId; // Get the item ID from the attribute
        showItemOverview(itemId);
    } else if (!isInsideOverview || isCloseButton) {
        closeItemOverview();
    }
});


function closeItemOverview() {
    const overviewContainer = document.getElementById('item-overview');
    if (overviewContainer) {
        overviewContainer.style.display = 'none';
    }
}



document.addEventListener('DOMContentLoaded', () => {
    monitorPaymentStatus();
    renderCart();
});
