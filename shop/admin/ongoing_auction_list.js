let items = [];

// Fetch ongoing auction products and render them
async function fetch_products(sorted_items = null) {
    try {
        const response = await fetch(`${API_URL}/all-ongoing-auction`, {
            method: "GET",
            credentials: "include", // Include cookies for authentication
        });

        const data = await response.json();
        if (data.success && data.items) {
            items = data.items.map(item => ({
                id: sanitizeInput(item.id),
                item_name: sanitizeInput(item.item_name),
                starting_price: parseFloat(item.starting_price || 0),
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
                console.error("Product container element not found.");
                return;
            }

            productContainer.innerHTML = items.map(product => {
                const formattedStartingTime = product.starting_time ? formatDateTime(product.starting_time) : "N/A";
                const formattedPrice = product.starting_price.toLocaleString("en-US");

                return `
                <tr data-id="${product.id}">
                    <td>
                        <img src="${product.image}" alt="Not Found!" 
                        original-image="${product.image}" class="product-image">
                    </td>
                    <td>${product.item_name}</td>
                    <td>$${formattedPrice}</td>
                    <td>${product.stock}</td>
                    <td>${product.description}</td>
                    <td>${product.category}</td>
                    <td>${product.duration}</td>
                    <td>${formattedStartingTime}</td>
                    <td>
                        <a href="/admin/bid_history?product_id=${product.id}" class="picture-link">
                            <img src="../Icons/bid-history.png" alt="View Bid History" class="button-image">
                        </a>
                    </td>
                </tr>`;
            }).join('');
        } else {
            console.error('Failed to fetch products:', data.error);
        }
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

// Search through items based on user query
function searchItems() {
    const searchBar = document.getElementById('search-bar');
    if (!searchBar) {
        console.error("Search bar element not found.");
        return;
    }

    const query = sanitizeInput(searchBar.value.trim().toLowerCase());
    if (query === '') {
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
        .filter(item => item.matchScore > 0) // Keep items with positive match scores
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
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true, // Use AM/PM format
    };

    return date.toLocaleString("en-US", options).replace(',', '');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    fetch_products(); // Fetch initial list on page load
    sanitizeAllLinks();
});

const searchBar = document.getElementById("search-bar");
if (searchBar) {
    searchBar.addEventListener("input", () => {
        searchItems();
    });
}
