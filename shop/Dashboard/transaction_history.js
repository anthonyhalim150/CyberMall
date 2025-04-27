let transactions = []; // Store fetched transactions

// Fetch transactions from the server
async function fetchTransactions(sortedTransactions = null) {
    try {
        const userID = await getCookie(); // Securely retrieve user ID
        const response = await fetch(`${API_URL}/transaction-history-user?userID=${encodeURIComponent(userID)}`, {
            method: 'GET',
            credentials: 'include',
        });
        const data = await response.json();

        if (Array.isArray(data)) {
            transactions = sortedTransactions || data;
            const transactionContainer = document.querySelector('#product-container tbody');
            transactionContainer.innerHTML = transactions.map(transaction => `
                <tr>
                    <td>${sanitizeInput(transaction.transaction_id)}</td>
                    <td>${sanitizeInput(transaction.username)}</td>
                    <td>$${parseFloat(transaction.total_amount).toLocaleString('en-US')}</td>
                    <td><pre>${sanitizeInput(transaction.description)}</pre></td>
                    <td>${new Date(transaction.created_at).toLocaleString()}</td>
                </tr>
            `).join('');
        } else {
            console.error('Failed to fetch transactions: Invalid response format');
        }
    } catch (error) {
        console.error('Error fetching transactions:', error);
    }
}

function searchTransactions() {
    const query = document.getElementById('search-bar').value.trim().toLowerCase();

    if (!query) {
        // If the search bar is empty, reload the original list
        fetchTransactions();
        return;
    }

    // Filter and sort transactions based on the query
    const filteredTransactions = transactions
        .map(transaction => {
            // Calculate the match score based on description and date
            const descriptionMatch = transaction.description.toLowerCase().includes(query) ? 1 : 0;
            const dateMatch = new Date(transaction.created_at).toLocaleString().toLowerCase().includes(query) ? 1 : 0;

            // Total match score
            const matchScore = descriptionMatch + dateMatch;

            return { ...transaction, matchScore };
        })
        .filter(transaction => transaction.matchScore > 0) // Only include items with a match
        .sort((a, b) => {
            // Sort primarily by match score (descending), then by date (newest first)
            if (b.matchScore !== a.matchScore) {
                return b.matchScore - a.matchScore;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

    // Render the filtered transactions
    fetchTransactions(filteredTransactions);
}


// Sort transactions based on the selected criteria
function sortTransactions(criteria, sortOrder) {
    const sortedTransactions = [...transactions].sort((a, b) => {
        const aValue = criteria === 'date' ? new Date(a.created_at).getTime() : a.total_amount;
        const bValue = criteria === 'date' ? new Date(b.created_at).getTime() : b.total_amount;
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
    fetchTransactions(sortedTransactions);
}

// Initialize sorting order
let sortOrders = { date: 'desc', amount: 'desc' };

// Toggle sorting order for a given criteria
function toggleSortOrder(criteria) {
    sortOrders[criteria] = sortOrders[criteria] === 'asc' ? 'desc' : 'asc';
    return sortOrders[criteria];
}

// Add event listeners after DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
    fetchTransactions();

    document.getElementById('search-bar').addEventListener('input', searchTransactions);

    document.getElementById('date-arrow').addEventListener('click', () => {
        const sortOrder = toggleSortOrder('date');
        document.getElementById('date-arrow').textContent = sortOrder === 'asc' ? '⬆' : '⬇';
        sortTransactions('date', sortOrder);
    });

    document.getElementById('amount-arrow').addEventListener('click', () => {
        const sortOrder = toggleSortOrder('amount');
        document.getElementById('amount-arrow').textContent = sortOrder === 'asc' ? '⬆' : '⬇';
        sortTransactions('amount', sortOrder);
    });
});
