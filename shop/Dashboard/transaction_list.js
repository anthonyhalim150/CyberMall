let items = []; // Stores the transactions fetched from the server

async function fetch_products(sorted_items = null) {
    try {
        const userID = await getCookie(); // Retrieve userID from cookies

        const response = await fetch(`${API_URL}/transactions-user?userID=${encodeURIComponent(userID)}`, {
            method: 'GET',
            credentials: 'include', // Include cookies for authentication
        });

        const data = await response.json();

        if (Array.isArray(data)) { // Check if data is an array of transactions
            items = sorted_items || data; // Use sorted items if provided, otherwise use fetched data

            const productContainer = document.getElementById('product-container tbody');
            productContainer.innerHTML = items
                .map(transaction => {
                    const formattedAmount = parseFloat(transaction.total_amount).toLocaleString('en-US'); // Turn 7000 to 7,000
                    return `
                        <tr>
                            <td>${sanitizeInput(transaction.transaction_id)}</td>
                            <td>${sanitizeInput(transaction.username)}</td>
                            <td class="total-amount">$${formattedAmount}</td>
                            <td><pre>${sanitizeInput(transaction.description)}</pre></td>
                            <td class="created-at">${new Date(transaction.created_at).toLocaleString()}</td>
                        </tr>
                    `;
                })
                .join('');
        } else {
            console.error('Failed to fetch transactions: Invalid response format');
        }
    } catch (error) {
        console.error('Error fetching transactions:', error);
    }
}


function search_users() {
    const query = document.getElementById('search-bar').value.trim().toLowerCase();
    if (query === '') { // If the search bar is empty, reload the original list
        fetch_products();
        return;
    }

    // Filter and sort items based on the query
    const filteredItems = items
        .map(item => {
            // Calculate the match score based on the username, description, and date
            const usernameMatch = item.username.toLowerCase().includes(query) ? 1 : 0;
            const descriptionMatch = item.description.toLowerCase().includes(query) ? 1 : 0;
            const dateMatch = new Date(item.created_at).toLocaleString().toLowerCase().includes(query) ? 1 : 0;

            // Total match score
            const matchScore = usernameMatch + descriptionMatch + dateMatch;

            return { ...item, matchScore };
        })
        .filter(item => item.matchScore > 0) // Filter out items with no match
        .sort((a, b) => {
            // Sort primarily by match score (descending), then by username (ascending)
            if (b.matchScore !== a.matchScore) {
                return b.matchScore - a.matchScore;
            }
            return a.username.localeCompare(b.username);
        });

    // Render the filtered items
    fetch_products(filteredItems);
}


document.addEventListener('DOMContentLoaded', () => {
    fetch_products(); // Fetch and display transactions on page load
});

const searchBar = document.getElementById('search-bar');
if (searchBar) {
    searchBar.addEventListener('input', () => {
        search_users(); 
    });
}


let importanceSortOrder = 'desc'; // Default order for Importance Rating
let qualitySortOrder = 'desc'; // Default order for Quality Rating

function sort_transactions(criteria, sortOrder) {
    const sortedItems = [...items]; // Create a shallow copy of the items array to avoid modifying the original

    // Sort based on the criteria (date or total_amount)
    sortedItems.sort((a, b) => {
        let aValue, bValue;

        if (criteria === 'date') {
            aValue = new Date(a.created_at).getTime(); // Convert date to timestamp for comparison
            bValue = new Date(b.created_at).getTime();
        } else if (criteria === 'amount') {
            aValue = a.total_amount;
            bValue = b.total_amount;
        }

        // Compare values based on the sort order (asc or desc)
        if (sortOrder === 'asc') {
            return aValue - bValue;
        } else {
            return bValue - aValue;
        }
    });

    // After sorting, render the updated list
    fetch_products(sortedItems);
}

// Event listeners for sorting when column headers are clicked
let dateSortOrder = 'desc';
let amountSortOrder = 'desc';

// Sort by Date when the date column is clicked
const dateArrow = document.getElementById('date-arrow');
dateArrow.addEventListener('click', () => {
    dateSortOrder = dateSortOrder === 'asc' ? 'desc' : 'asc'; // Toggle sort order
    dateArrow.textContent = dateSortOrder === 'asc' ? '⬆' : '⬇'; // Change arrow direction
    sort_transactions('date', dateSortOrder); // Call sort function for date
});

// Sort by Total Amount when the amount column is clicked
const amountArrow = document.getElementById('amount-arrow');
amountArrow.addEventListener('click', () => {
    amountSortOrder = amountSortOrder === 'asc' ? 'desc' : 'asc'; // Toggle sort order
    amountArrow.textContent = amountSortOrder === 'asc' ? '⬆' : '⬇'; // Change arrow direction
    sort_transactions('amount', amountSortOrder); // Call sort function for amount
});