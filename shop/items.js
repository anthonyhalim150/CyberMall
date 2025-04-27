let items = [];
let cartItems = {};  // To store the quantities of items in the cart
let likedItems = [];


// Fetch items from the backend
async function fetchItems() {
    const userID = await getCookie(); // Get userID from cookies

    try {
        const response = await fetch(`${API_URL}/items?userID=${encodeURIComponent(userID)}`, {
            method: "GET",
            credentials: "include", // Include cookies with the request
        });
        const data = await response.json();

        if (data.success && data.items) {
            items = data.items; // Store items from the response
            await fetchCartItems(userID); // Fetch cart items after fetching shop items
            renderItems(); // Render items after they are fetched
        } else {
            console.error('Failed to fetch items:', data.error);
        }
    } catch (error) {
        console.error('Error fetching items:', error);
    }
}

// Fetch cart items to keep track of quantities
async function fetchCartItems(userID) {
    try {
        const response = await fetch(`${API_URL}/cart-items?userID=${encodeURIComponent(userID)}`, {
            method: "GET",
            credentials: "include", // Include cookies with the request
        });        
        const data = await response.json();

        if (data.success && data.cartItems) {
            // Update the cartItems object with quantities
            cartItems = {};
            data.cartItems.forEach(item => {
                cartItems[item.item_id] = item.quantity;
            });
        } else {
            console.error('Failed to fetch cart items:', data.error);
        }
    } catch (error) {
        console.error('Error fetching cart items:', error);
    }
}

// Add item to cart
async function addToCart(itemID) {
    const userID = await getCookie(); // Get userID from cookies
    const quantityInput = document.getElementById(`quantity-${itemID}`);
    const quantity = parseInt(quantityInput.value, 10);
    const item = items.find(i => i.id === itemID);

    if (quantity > item.stock - (cartItems[itemID] || 0)) {
        alert('Insufficient stock available.');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userID, itemID, quantity }),
            credentials: "include",
        });

        const result = await response.json();
        if (result.success) {
            cartItems[itemID] = (cartItems[itemID] || 0) + quantity; // Update cart quantity
            alert(`${item.name} added to cart.`);
            location.reload();
        } else {
            alert('Failed to add item to cart. Please try again.');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        alert('An error occurred. Please try again later.');
    }
}

function searchItems() {
    const query = document.getElementById('search-bar').value.trim().toLowerCase();
    let desc_match = 0;
    let category_match = 0;
    if (query === ''){//Biar kalo ga ada search barnya, itemnya ga ke sort lgi
        renderItems();
        return;
    }
    const heading = document.querySelector('h2');
    let searched_items = [];
    searched_items = Array.from(items);
    if (heading.textContent == 'Liked Items') {
        searched_items = Array.from(likedItems);
    }
    // Filter and sort items based on the query
    const filteredItems = searched_items
        .map(item => {
            // Calculate the match score based on the name and description
            const nameMatch = (item.name.toLowerCase().includes(query) ? 1 : 0);
            if (item.description !== null){
                desc_match = (item.description.toLowerCase().includes(query) ? 1 : 0);
            }
            if (item.category !== null){
                category_match = (item.category.toLowerCase().includes(query) ? 1 : 0);
            }

            // Total match score
            const matchScore = nameMatch + desc_match + category_match;

            return { ...item, matchScore };
        })
        .filter(item => item.matchScore > 0) // Filter out items with no match
        .sort((a, b) => {
            // Sort primarily by match score (descending), then by name (ascending)
            if (b.matchScore !== a.matchScore) {
                return b.matchScore - a.matchScore;
            }
            return a.name.localeCompare(b.name);
        });

    // Render the filtered items
    renderItems(filteredItems);
}

async function renderItems(filteredItems = null) {
    const itemsToRender = filteredItems || items; // Use filtered items if provided, otherwise render all items
    const itemsContainer = document.getElementById('items');
    if (!itemsContainer) return;

    itemsContainer.innerHTML = itemsToRender.map(item => {
        const cartQuantity = cartItems[item.id] || 0; // Quantity of the item in the cart
        const availableStock = item.stock - cartQuantity; // Stock available after subtracting cart quantity

        // Sanitize dynamic content to prevent XSS using sanitizeInput from auth.js
        const sanitizedItemName = sanitizeInput(item.name);
        const formattedPrice = parseFloat(item.price).toLocaleString('en-US');

        // Check if the item is liked (use `likedItems` to track liked items)
        const isLiked = likedItems.some(liked => liked.id === item.id); // `likedItems` is a Set of liked item IDs

        return `
            <div class="col-md-4 mb-4">
                <div class="card" onclick="showItemOverview(${item.id})">
                    <div class="like-icon" onclick="event.stopPropagation(); toggleLike(${item.id})">
                        <img src="${isLiked ? 'Icons/red-heart.png' : 'Icons/white-heart.png'}" alt="Like" />
                    </div>
                    <img src="${sanitizeInput(item.image)}" class="card-img-top" alt="${sanitizedItemName}">
                    <div class="card-body text-center">
                        <h5 class="card-title">${sanitizedItemName}</h5>
                        <p class="card-text">$${formattedPrice}</p>
                        <p class="card-text">Stock: ${availableStock}</p>
                        <div class="quantity-control">
                            <button class="btn btn-secondary" onclick="event.stopPropagation(); changeQuantity(${item.id}, -1)">-</button>
                            <input type="number" id="quantity-${item.id}" value="1" min="1" max="${availableStock}" class="quantity-input" onchange="updateQuantity('${item.id}', ${availableStock})" onclick="event.stopPropagation();">
                            <button class="btn btn-secondary" onclick="event.stopPropagation(); changeQuantity(${item.id}, 1)">+</button>
                        </div>
                        <button class="btn btn-primary mt-2" onclick="event.stopPropagation(); addToCart(${item.id})">Add to Cart</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Function to update the quantity of an item
async function updateQuantity(itemID, stock) {
    const quantityInput = document.getElementById(`quantity-${itemID}`);
    const newQuantity = parseInt(quantityInput.value);

    if (newQuantity < 1 || newQuantity > stock) {
        quantityInput.value = stock; // Reset to max if invalid
        return;
    }
}

// Adjust the quantity value in the input field
function changeQuantity(itemId, delta) {
    const quantityInput = document.getElementById(`quantity-${itemId}`);
    const currentQuantity = parseInt(quantityInput.value, 10);
    const item = items.find(i => i.id === itemId);
    const cartQuantity = cartItems[itemId] || 0;
    const availableStock = item.stock - cartQuantity;
    const newQuantity = currentQuantity + delta;

    if (newQuantity >= 1 && newQuantity <= availableStock) {
        quantityInput.value = newQuantity;
    }
}

// Function to show item overview, sanitized to prevent XSS
function showItemOverview(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const overviewContainer = document.getElementById('item-overview');

    // Sanitize dynamic content before rendering
    const sanitizedItemName = sanitizeInput(item.name);
    const sanitizedItemDescription = sanitizeInput(item.description);
    const sanitizedItemCategory = sanitizeInput(item.category || 'N/A'); // Default 'N/A' if category is not available
    const formattedPrice = parseFloat(item.price).toLocaleString('en-US');
    
    // Render sanitized content
    overviewContainer.innerHTML = `
        <h3>${sanitizedItemName}</h3>
        <img src="${sanitizeInput(item.image)}" alt="${sanitizedItemName}" style="width: 180px; height: 180px; margin-bottom: 15px;">
        <p class="item-description"><strong>Description:</strong> ${sanitizedItemDescription}</p>
        <p class="item-description"><strong>Price:</strong> $${formattedPrice}</p>
        <p class="item-description"><strong>Stock:</strong> ${item.stock}</p>
        <p class="item-description"><strong>Category:</strong> ${sanitizedItemCategory}</p>
        <button class="close-btn" onclick="closeItemOverview()">Close</button>
    `;
    overviewContainer.style.display = 'block';
}


function handleDocumentClick(event) {
    const overviewSection = document.getElementById('item-overview');
    const isInsideOverview = overviewSection && overviewSection.contains(event.target);
    const isCloseButton = event.target.closest('.close-btn');
    const isTriggerElement = event.target.closest('.card'); // Adjust trigger as needed

    if (isTriggerElement) {
        const itemId = parseInt(isTriggerElement.dataset.itemId, 10);
        showItemOverview(itemId);
    } else if (!isInsideOverview || isCloseButton) {
        closeItemOverview();
    }
}

// Attach the function to the 'click' event


function closeItemOverview() {
    const overviewContainer = document.getElementById('item-overview');
    if (overviewContainer){
        overviewContainer.style.display = 'none';
    }
}



// Initial rendering of items and cart
document.addEventListener('DOMContentLoaded', async () => {
    await fetchLikedItems(); //To show whats liked and whats not
    await fetchItems(); // Fetch items when page loads
    if (window.location.pathname.includes('like')) {
        await renderItems(likedItems);
    }
    else{
        await renderItems();
    }
    document.addEventListener('click', handleDocumentClick);
    setup_search_like();
});

function setup_search_like(){
    const searchBar = document.getElementById('search-bar');
    if (searchBar) {
        searchBar.addEventListener('input', (event) => {
            searchItems(); 
        });
    } 

    // Event listener for 'Likes'
    const likesNav = document.getElementById('likes_nav');
    if (likesNav) {
        likesNav.addEventListener('click', (event) => {
            event.preventDefault(); 
            renderItems(likedItems);
            window.location.href = sanitizeURL("/like");
        });
    }
}


// Fetch liked items on page load
async function fetchLikedItems() {
    const currentUserID = await getCookie(); // Use getCookie to fetch userID
    if (!currentUserID) {
        console.error("User not logged in.");
        return;
    }

    try {
        // Ensure the userID is encoded before inserting it into the URL
        const encodedUserID = encodeURIComponent(currentUserID); 

        const response = await fetch(`${API_URL}/like-list?userID=${encodedUserID}`, {
            method: "GET",
            credentials: "include", // Include cookies with the request for authentication
        });        
        const data = await response.json();
        if (data.success) {
            likedItems = data.likedItems.map(item => ({
                ...item,
                name: sanitizeInput(item.name), // Sanitize item name
                description: sanitizeInput(item.description), // Sanitize item description
                category: sanitizeInput(item.category), // Sanitize category
            }));
        }
    } catch (error) {
        console.error('Error fetching liked items:', error);
    }
}


async function toggleLike(itemID) {
    const isLiked = likedItems.some(item => item.id === itemID);
    const currentUserID = await getCookie(); // Use getCookie for user authentication

    // Sanitize the itemID to ensure it's safe
    const sanitizedItemID = sanitizeInput(itemID); // Sanitize itemID before making API calls

    try {
        if (isLiked) {
            // Unlike the item
            const response = await fetch(`${API_URL}/delete-like`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userID: currentUserID, itemID: sanitizedItemID }),
                credentials: "include",
            });

            const data = await response.json();
            if (data.success) {
                if (likedItems.length == 1) {
                    location.reload();
                } else {
                    likedItems = likedItems.filter(item => item.id !== sanitizedItemID); // Remove item with matching ID
                }
            } else {
                console.error(data.error);
            }
        } else {
            // Like the item
            const response = await fetch(`${API_URL}/add-like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userID: currentUserID, itemID: sanitizedItemID }),
                credentials: "include",
            });

            const data = await response.json();
            if (data.success) {
                likedItems.push({ id: sanitizedItemID });
                await fetchLikedItems(); // Fetch liked items after liking the item
            } else {
                console.error(data.error);
            }
        }

        // Re-render items to update like icons
        renderItems();
    } catch (error) {
        console.error('Error toggling like:', error);
    }
}