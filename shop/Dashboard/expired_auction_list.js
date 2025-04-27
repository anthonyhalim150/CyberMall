let items = [];

async function fetch_products(sorted_items = null) {
    try {
        const userID = await getCookie(); // Retrieve userID from localStorage

        const encodedUserID = encodeURIComponent(userID); // Ensure the userID is safely encoded
        const response = await fetch(`${API_URL}/expired-auction-user?userID=${encodedUserID}`, {
            method: 'GET',
            credentials: 'include', // Include cookies with the request
        })
        const data = await response.json();

        if (data.success && data.items) {
            items = data.items.map(item => ({
                ...item,
                id: sanitizeInput(item.id),
                item_name: sanitizeInput(item.item_name),
                starting_price: parseFloat(item.starting_price),
                stock: sanitizeInput(item.stock),
                description: sanitizeInput(item.description || "N/A"),
                category: sanitizeInput(item.category || "N/A"),
                duration: sanitizeInput(item.duration || "N/A"),
                starting_time: sanitizeInput(item.starting_time),
                image: sanitizeInput(item.image || "placeholder.jpg"),
            }));

            if (sorted_items !== null) {
                items = sorted_items;
            }

            const productContainer = document.getElementById("product-container-tbody");
            if (!productContainer) {
                console.error("Product container element is missing.");
                return;
            }
            productContainer.innerHTML = ""; // Clear existing content

            // Loop through each product and await the highest bid for each
            for (const product of items) {
                const highestBid = await fetchHighestBid(product.id);
                const formattedStartingTime = product.starting_time ? formatDateTime(product.starting_time) : "N/A";
                const formattedPrice = product.starting_price.toLocaleString("en-US");
                const formattedBid = highestBid.toLocaleString("en-US");
                const highestBidText = highestBid > 0 ? `$${formattedBid}` : "No Bids";

                productContainer.innerHTML += `
                    <tr data-id="${product.id}">
                        <td>
                            <img src="${product.image}" alt="Not Found!" class="product-image">
                        </td>
                        <td>${product.item_name}</td>
                        <td>$${formattedPrice}</td>
                        <td>${product.stock}</td>
                        <td>${product.description}</td>
                        <td>${product.category}</td>
                        <td>${product.duration}</td>
                        <td>${formattedStartingTime}</td>
                        <td>${highestBidText}</td>
                        <td>
                            <a href="/Dashboard/bid_history?product_id=${product.id}" class="picture-link">
                                <img src="../Icons/bid-history.png" alt="View Bid History" class="button-image">
                            </a>
                        </td>
                    </tr>`;
                    sanitizeAllLinks();

            }
        } else {
            console.error("No products found or data retrieval failed.");
        }
    } catch (error) {
        console.error("Error fetching products:", error);
    }
}

// Fetch the highest bid for a specific product
async function fetchHighestBid(itemId) {
    try {
        const response = await fetch(`${API_URL}/highest-bid?auction_item_id=${encodeURIComponent(sanitizeInput(itemId))}`, {
            method: "GET",
            credentials: "include",
        });
        const data = await response.json();
        return data.bid_amount || 0;
    } catch (error) {
        console.error("Error fetching highest bid:", error);
        return 0;
    }
}

// Search through items based on user query
function searchItems() {
    const searchBar = document.getElementById("search-bar");
    if (!searchBar) {
        console.error("Search bar element is missing.");
        return;
    }

    const query = sanitizeInput(searchBar.value.trim().toLowerCase());
    if (query === "") {
        fetch_products(); // Reset to full product list if query is empty
        return;
    }

    const filteredItems = items
        .map(item => {
            const nameMatch = item.item_name.toLowerCase().includes(query) ? 1 : 0;
            const descMatch = item.description.toLowerCase().includes(query) ? 1 : 0;
            const categoryMatch = item.category.toLowerCase().includes(query) ? 1 : 0;

            const matchScore = nameMatch + descMatch + categoryMatch;
            return { ...item, matchScore };
        })
        .filter(item => item.matchScore > 0)
        .sort((a, b) => {
            if (b.matchScore !== a.matchScore) {
                return b.matchScore - a.matchScore;
            }
            return a.item_name.localeCompare(b.item_name);
        });

    fetch_products(filteredItems); // Render filtered items
}

// Format datetime for display
function formatDateTime(dateTime) {
    const date = new Date(dateTime);

    const options = {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true, // Use AM/PM format
    };

    return date.toLocaleString("en-US", options).replace(",", "");
}

// Existing event listeners remain unchanged
document.addEventListener('DOMContentLoaded', () => {
    fetch_products();
});

const searchBar = document.getElementById('search-bar');
if (searchBar) {
    searchBar.addEventListener('input', () => {
        searchItems();
    });
}
