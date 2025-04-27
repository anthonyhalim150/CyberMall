let items = [];

// Fetch users and render them in the table
async function fetch_products(sorted_items = null) {
    try {
        const response = await fetch(`${API_URL}/users`, {
            method: "GET",
            credentials: "include", // Include cookies for authentication
        });
        const data = await response.json();

        if (data.success && data.items) {
            items = data.items.map(item => ({
                id: sanitizeInput(item.id),
                username: sanitizeInput(item.username),
                email: sanitizeInput(item.email),
                role: sanitizeInput(item.role),
            }));

            if (sorted_items !== null) {
                items = sorted_items;
            }

            const productContainer = document.getElementById('product-container-tbody');
            if (!productContainer) {
                return;
            }

            productContainer.innerHTML = items.map(product => {
                return `
                <tr>
                    <td>${product.id}</td>
                    <td>${product.username}</td>
                    <td>${product.email}</td>
                    <td>${product.role}</td>
                </tr>
                `;
            }).join('');
        } else {
            console.error('Failed to fetch users:', data.error);
        }
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

// Search users based on username
function search_users() {
    const searchBar = document.getElementById('search-bar');
    if (!searchBar) {
        console.error("Search bar element is missing.");
        return;
    }

    const query = sanitizeInput(searchBar.value.trim().toLowerCase());
    if (query === '') { // If the search query is empty, reset to the full list
        fetch_products();
        return;
    }

    // Filter and sort items based on the query
    const filteredItems = items
        .map(item => {
            // Calculate the match score based on username
            const nameMatch = item.username.toLowerCase().includes(query) ? 1 : 0;
            const matchScore = nameMatch;

            return { ...item, matchScore };
        })
        .filter(item => item.matchScore > 0) // Filter out items with no match
        .sort((a, b) => {
            // Sort by match score (descending), then by username (ascending)
            if (b.matchScore !== a.matchScore) {
                return b.matchScore - a.matchScore;
            }
            return a.username.localeCompare(b.username);
        });

    // Render the filtered items
    fetch_products(filteredItems);
}

// Initialize event listeners and fetch data
document.addEventListener('DOMContentLoaded', () => {
    fetch_products(); // Initial fetch to populate the user list

    const searchBar = document.getElementById('search-bar');
    if (searchBar) {
        searchBar.addEventListener('input', () => {
            search_users();
        });
    }
});
