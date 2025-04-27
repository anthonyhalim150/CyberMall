let bids = [];

// Fetch bid history for a specific auction item
async function fetch_bid_history(auction_item_id, sorted_bids = null) {
    try {
        const sanitizedAuctionItemId = sanitizeInput(auction_item_id); // Sanitize input
        const response = await fetch(`${API_URL}/bid-list?auction_item_id=${encodeURIComponent(sanitizedAuctionItemId)}`, {
            method: "GET",
            credentials: "include", // Include cookies for authentication
        });

        const data = await response.json();

        if (data.success && data.bids) {
            bids = data.bids;

            // If sorted bids are provided, override the fetched bids
            if (sorted_bids !== null) {
                bids = sorted_bids;
            }

            const bidContainer = document.getElementById("product-container-tbody");
            if (bidContainer) {
                bidContainer.innerHTML = bids.map(bid => {
                    const formattedBidTime = bid.bid_time ? formatDateTime(bid.bid_time) : "N/A";
                    const formattedBidAmount = parseFloat(bid.bid_amount).toLocaleString("en-US");

                    return `
                    <tr data-id="${sanitizeInput(bid.id)}">
                        <td>${sanitizeInput(bid.username)}</td>
                        <td>$${formattedBidAmount}</td>
                        <td>${formattedBidTime}</td>
                    </tr>`;
                }).join("");
            }
        } else {
            console.error("No bids found");
        }
    } catch (error) {
        console.error("Error fetching bid history:", error);
    }
}

// Search through bids based on username
function searchBids() {
    const query = sanitizeInput(document.getElementById("search-bar").value.trim().toLowerCase());

    if (query === "") {
        const urlParams = new URLSearchParams(window.location.search);
        const auction_item_id = sanitizeInput(urlParams.get("product_id"));
        fetch_bid_history(auction_item_id); // Reset to the original list if no query
        return;
    }

    const filteredBids = bids
        .map(bid => {
            const usernameMatch = bid.username.toLowerCase().includes(query) ? 1 : 0;
            const matchScore = usernameMatch;
            return { ...bid, matchScore };
        })
        .filter(bid => bid.matchScore > 0)
        .sort((a, b) => {
            if (b.matchScore !== a.matchScore) {
                return b.matchScore - a.matchScore;
            }
            return a.username.localeCompare(b.username);
        });

    fetch_bid_history(null, filteredBids); // Use the filtered and sorted bids
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

// Fetch bid history when the page loads
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const auction_item_id = sanitizeInput(urlParams.get("product_id"));

    if (auction_item_id) {
        fetch_bid_history(auction_item_id);
    } else {
        console.error("Auction item ID is missing");
    }
});

// Add event listener for search input
const searchBar = document.getElementById("search-bar");
if (searchBar) {
    searchBar.addEventListener("input", () => {
        searchBids();
    });
}
