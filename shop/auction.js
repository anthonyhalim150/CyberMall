let auctionItems = []; // Array to store auction items
let filteredItems = []; // Array to store filtered items
let timerIntervals = []; // Store timers for auction items


const fetchAuctionItems = async () => {
  try {
      const userID = await getCookie(); // Securely fetch userID using await getCookie()

      const encodedUserID = encodeURIComponent(sanitizeInput(userID)); // Sanitize and encode userID
      const response = await fetch(`${API_URL}/auction?userID=${encodedUserID}`, {
          method: 'GET',
          credentials: 'include', // Include cookies with the request
      });

      const data = await response.json();

      if (data && data.items) {
          auctionItems = data.items.map(item => ({
              id: sanitizeInput(item.id),
              name: sanitizeInput(item.item_name),
              stock: sanitizeInput(item.stock),
              description: sanitizeInput(item.description),
              category: sanitizeInput(item.category),
              image: sanitizeInput(item.image),
              startingPrice: sanitizeInput(item.starting_price),
              duration: sanitizeInput(item.duration),
              startingTime: new Date(item.starting_time), // Convert to Date object
          }));

          // Initialize filtered items with all auction items
          filteredItems = [...auctionItems];

          renderAuctionItems();
      } else {
          console.error("Failed to fetch auction items: Invalid data structure.");
      }
  } catch (error) {
      console.error("Error fetching auction items:", error);
  }
};

const fetchHighestBid = async (itemId) => {
  try {
      const sanitizedItemId = sanitizeInput(itemId); // Sanitize itemId
      const response = await fetch(`${API_URL}/highest-bid?auction_item_id=${encodeURIComponent(sanitizedItemId)}`, {
          method: 'GET',
          credentials: 'include', // Include cookies with the request
      });

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
          return {
              bid_amount: sanitizeInput(data[0].bid_amount),
              username: sanitizeInput(data[0].username),
          };
      }

      return { bid_amount: 0, username: null }; // Default object if no data
  } catch (error) {
      console.error("Error fetching highest bid:", error);
      return { bid_amount: 0, username: null }; // Default object for error handling
  }
};


// Place a bid
const placeBid = async (itemId, bidAmount) => {
  const userId = await getCookie(); // Securely fetch userID using await getCookie()

  try {
      const sanitizedItemId = sanitizeInput(itemId); // Sanitize itemId
      const sanitizedBidAmount = parseFloat(bidAmount); // Parse and sanitize bid amount

      if (isNaN(sanitizedBidAmount) || sanitizedBidAmount <= 0) {
          alert("Invalid bid amount. Please enter a valid number.");
          return;
      }

      const response = await fetch(`${API_URL}/bids`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              auction_item_id: sanitizedItemId,
              user_id: sanitizeInput(userId),
              bid_amount: sanitizedBidAmount,
          }),
          credentials: "include", // Ensure cookies are sent with the request
      });

      const data = await response.json();

      if (response.ok) {
          alert("Bid placed successfully!");
          await get_balance(); // Update user balance
          await fetchAuctionItems(); // Re-fetch and re-render auction items
      } else {
          alert(sanitizeInput(data.message) || "Failed to place bid.");
      }
  } catch (error) {
      console.error("Error placing bid:", error);
      alert("An error occurred while placing the bid. Please try again later.");
  }
};

// Render auction items to the page
const renderAuctionItems = async (items = filteredItems) => {
  const auctionContainer = document.getElementById("auction-items");
  auctionContainer.innerHTML = ""; // Clear existing items

  for (const item of items) {
      try {
          // Fetch the highest bid securely
          const data = await fetchHighestBid(sanitizeInput(item.id));
          const highestBid = parseFloat(data.bid_amount || 0);
          const user = sanitizeInput(data.username || "None"); // Sanitize username
          const formattedBid = highestBid.toLocaleString("en-US"); // Format bid amount
          const highestBidText =
              highestBid > 0
                  ? `$${formattedBid}<br>Submitted by ${user}`
                  : "No bids yet";

          const startingPrice = parseFloat(item.startingPrice || 0);
          const formattedPrice = startingPrice.toLocaleString("en-US"); // Format starting price

          // Create auction item element
          const itemElement = document.createElement("div");
          itemElement.classList.add("auction-item");
          itemElement.innerHTML = `
              <img src="${sanitizeInput(item.image)}" alt="${sanitizeInput(item.name)}" class="item-image">
              <h3>${sanitizeInput(item.name)}</h3>
              <p>Starting Price: $${formattedPrice}</p>
              <p>Current Highest Bid: ${highestBidText}</p>
              <p class="timer" id="timer-${sanitizeInput(item.id)}"></p>
              <button class="bid-btn" id="bid-btn-${sanitizeInput(item.id)}">Place Bid</button>
          `;

          auctionContainer.appendChild(itemElement);

          // Start countdown timer for the item
          startItemTimer(item);

          // Add event listener to bid button
          const bidButton = document.getElementById(`bid-btn-${sanitizeInput(item.id)}`);
          if (bidButton) {
              bidButton.addEventListener("click", (event) => {
                  event.stopPropagation();

                  // Calculate remaining auction time
                  const endTime = new Date(item.startingTime.getTime() + item.duration * 1000);
                  const currentTime = new Date();
                  const timeLeft = Math.max(0, Math.floor((endTime - currentTime) / 1000));

                  if (timeLeft < 1) {
                      alert("Auction has already ended! Cannot place a bid!");
                      return;
                  }

                  // Prompt user for bid amount
                  const bidAmount = prompt("Enter your bid amount:");
                  const sanitizedBidAmount = parseFloat(bidAmount);

                  // Validate bid amount
                  if (isNaN(sanitizedBidAmount)) {
                      alert("Invalid bid amount. Please enter a valid number.");
                      return;
                  }

                  if (sanitizedBidAmount > 499999999999.99) {
                      alert("Bid amount too high! Please enter a number below 500 billion!");
                      return;
                  }

                  if (
                      sanitizedBidAmount > highestBid &&
                      sanitizedBidAmount > startingPrice
                  ) {
                      placeBid(item.id, sanitizedBidAmount); // Place the bid securely
                  } else {
                      alert("Bid amount must be higher than the current highest bid and starting price.");
                  }
              });
          }

          // Add event listener to display product overview
          itemElement.addEventListener("click", () =>
              showProductOverview(item, highestBid, user)
          );
      } catch (error) {
          console.error(`Error rendering item ${item.id}:`, error);
      }
  }
};

// Start timer for a specific auction item

const startItemTimer = (item) => {
  const timerElement = document.getElementById(`timer-${sanitizeInput(item.id)}`); // Sanitize item ID
  const endTime = new Date(item.startingTime.getTime() + item.duration * 1000); // Calculate end time

  const interval = setInterval(() => {
      try {
          const currentTime = new Date();
          const timeLeft = Math.max(0, Math.floor((endTime - currentTime) / 1000)); // Calculate remaining time

          if (timeLeft <= 0) {
              clearInterval(interval);
              timerElement.textContent = "Auction ended";
              fetchAuctionItems(); // Re-fetch auction items
          } else {
              const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
              const seconds = (timeLeft % 60).toString().padStart(2, "0");
              timerElement.textContent = `${minutes}:${seconds}`; // Update timer display
          }
      } catch (error) {
          console.error(`Error updating timer for item ${item.id}:`, error);
          clearInterval(interval); // Stop the timer if an error occurs
      }
  }, 1000);

  timerIntervals.push(interval); // Track the interval for cleanup
};

// Show product overview in a popup
// Show product overview in a popup
const showProductOverview = (item, highestBid, user) => {
  const overviewSection = document.getElementById("product-overview");
  overviewSection.style.display = "block";

  // Sanitize and populate product details
  document.getElementById("product-name").value = sanitizeInput(item.name);
  const startingPrice = parseFloat(item.startingPrice || 0);
  const formattedPrice = startingPrice.toLocaleString("en-US"); // Format starting price
  document.getElementById("product-price").value = formattedPrice;
  document.getElementById("product-stock").value = sanitizeInput(item.stock);
  document.getElementById("product-description").value = sanitizeInput(item.description);
  document.getElementById("product-category").value = sanitizeInput(item.category);

  // Handle product image
  const productImage = document.getElementById("product-image");
  productImage.src = sanitizeInput(item.image || "placeholder.jpg");

  // Create and append highest bid information
  const highestBidElement = document.createElement("p");
  const formattedBid = parseFloat(highestBid || 0).toLocaleString("en-US");
  const sanitizedUser = sanitizeInput(user || "No username"); // Sanitize username
  const highestBidText = formattedBid > 0
      ? `$${formattedBid} by ${sanitizedUser}`
      : "No bids yet";

  highestBidElement.textContent = `Current Highest Bid: ${highestBidText}`;
  highestBidElement.style.marginTop = "10px";

  const detailsSection = document.querySelector(".details");
  detailsSection.appendChild(highestBidElement);

  // Handle close button click
  const closeButton = document.querySelector(".close-btn");
  closeButton.addEventListener("click", () => {
      overviewSection.style.display = "none";
      highestBidElement.remove(); // Remove dynamically created element
  });
};


// Apply search and sort together
const applySearchAndSort = () => {
  const searchInputElement = document.getElementById("search-input");
  const sortSelectElement = document.getElementById("sort-select");

  if (!searchInputElement || !sortSelectElement) {
      console.error("Search input or sort select element is missing.");
      return;
  }

  // Retrieve and sanitize user input
  const searchInput = sanitizeInput(searchInputElement.value.toLowerCase());
  const sortCriteria = sanitizeInput(sortSelectElement.value);

  // Filter auction items based on sanitized search input
  filteredItems = auctionItems.filter(item => {
      const sanitizedItemName = sanitizeInput(item.name.toLowerCase());
      const sanitizedItemDescription = sanitizeInput(item.description.toLowerCase());
      return (
          sanitizedItemName.includes(searchInput) ||
          sanitizedItemDescription.includes(searchInput)
      );
  });

  // Sort filtered items based on sanitized sort criteria
  switch (sortCriteria) {
      case "price-asc":
          filteredItems.sort((a, b) => a.startingPrice - b.startingPrice);
          break;
      case "price-desc":
          filteredItems.sort((a, b) => b.startingPrice - a.startingPrice);
          break;
      case "name-asc":
          filteredItems.sort((a, b) => a.name.localeCompare(b.name));
          break;
      case "name-desc":
          filteredItems.sort((a, b) => b.name.localeCompare(a.name));
          break;
      default:
          console.error(`Unknown sort criteria: ${sortCriteria}`);
  }

  // Re-render auction items with filtered and sorted results
  renderAuctionItems();
};


// Attach event listeners for search and sort
const attachEventListeners = () => {
  document.getElementById("search-input").addEventListener("input", applySearchAndSort);
  document.getElementById("sort-select").addEventListener("change", applySearchAndSort);
};
async function get_balance() {
  const userID = await getCookie(); // Securely fetch userID using await getCookie()

  if (!userID) {
      console.error("User not authenticated.");
      document.getElementById('current-balance').textContent = 'Error loading balance';
      return;
  }

  try {
      const response = await fetch(`${API_URL_USER}/get-wallet-user?userID=${encodeURIComponent(sanitizeInput(userID))}`, {
          method: 'GET',
          credentials: 'include', // Ensure cookies are included in the request
      });

      if (response.ok) {
          const data = await response.json();
          if (data.success) {
              const sanitizedBalance = sanitizeInput(data.wallet || 0);
              const balanceElement = document.getElementById('current-balance');

              if (balanceElement) {
                  balanceElement.textContent = `${sanitizedBalance} CSP`;
              } else {
                  console.error("Balance element not found in the DOM.");
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
      console.error('Error fetching wallet:', error);
      document.getElementById('current-balance').textContent = 'Error loading balance';
  }
}

async function customer_support(){
  customer_support_button = document.getElementById('customer-support');
  if (customer_support_button){
      customer_support_button.addEventListener('click', function () {
          // Check if the script is already loaded
          if (!document.getElementById('tawk-script')) {
              // Dynamically create the script element
              var s1 = document.createElement("script");
              s1.async = true;
              s1.src = 'https://embed.tawk.to/675fd299af5bfec1dbdc8347/1if74tanu';
              s1.id = 'tawk-script'; // Add an ID to prevent duplicate loading
              s1.setAttribute('crossorigin', '*');
              document.body.appendChild(s1);
          } else {
              // If the script is already loaded, toggle the widget
              if (typeof Tawk_API !== 'undefined') {
                  Tawk_API.toggle();
              }
          }
      }
      )  
  }  
}

document.addEventListener('DOMContentLoaded', () => {
  get_balance();
  fetchAuctionItems();
  attachEventListeners();
  customer_support();
});
