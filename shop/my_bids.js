let auctionItems = []; // Array to store auction items
let filteredItems = []; // Array to store filtered items
let timerIntervals = []; // Store timers for auction items

// Fetch auction items from the server
const fetchAuctionItems = async () => {
    try {
        // Retrieve the userID from cookies
        const userID = await getCookie();

        // Fetch the auction items for the logged-in user
        const response = await fetch(`${API_URL}/get-bid-by-user`, {
            method: "GET",
            credentials: "include", // Ensure cookies are sent with the request
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch auction items: ${response.statusText}`);
        }

        const data = await response.json();

        // Sanitize and store auction items
        auctionItems = data.map(item => ({
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
    } catch (error) {
        console.error("Error fetching auction items:", error);
    }
};


const fetchHighestBid = async (itemId) => {
  try {
        const response = await fetch(`${API_URL}/highest-bid?auction_item_id=${encodeURIComponent(itemId)}`, {
            method: "GET",
            credentials: "include", // Ensures cookies are included in the request
        });
    
      if (!response.ok) {
          throw new Error(`Failed to fetch highest bid: ${response.statusText}`);
      }
      const data = await response.json();
      return data && data.bid_amount ? data : { bid_amount: 0, username: null }; // Return bid data or a default object
  } catch (error) {
      console.error("Error fetching highest bid:", error);
      return { bid_amount: 0, username: null };
  }
};

// Place a bid
const placeBid = async (itemId, bidAmount) => {
  try {
      // Use getCookie to securely fetch the user ID
      const userId = await getCookie();
      if (!userId) {
          alert("You must be logged in to bid!");
          return;
      }

      // Validate inputs
      const sanitizedItemId = sanitizeInput(itemId);
      const sanitizedBidAmount = parseFloat(bidAmount);
      if (isNaN(sanitizedBidAmount) || sanitizedBidAmount <= 0) {
          alert("Invalid bid amount.");
          return;
      }

      const response = await fetch(`${API_URL}/bids`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              auction_item_id: sanitizedItemId,
              user_id: userId,
              bid_amount: sanitizedBidAmount,
          }),
          credentials: "include", // Include cookies for authentication
      });

      const data = await response.json();
      if (response.ok && data.message) {
          alert("Bid placed successfully!");
          await get_balance(); // Re-fetch user balance
          await fetchAuctionItems(); // Re-fetch and re-render auction items
      } else {
          alert(sanitizeInput(data.message || "Failed to place bid."));
      }
  } catch (error) {
      console.error("Error placing bid:", error);
      alert("An error occurred while placing the bid. Please try again later.");
  }
};

// Render auction items to the page
// Render auction items to the page
const renderAuctionItems = async (items = filteredItems) => {
  const auctionContainer = document.getElementById("auction-items");
  auctionContainer.innerHTML = ""; // Clear existing items

  for (const item of items) {
      try {
          const data = await fetchHighestBid(item.id); // Fetch highest bid securely
          const highestBid = parseFloat(data.bid_amount || 0);
          const user = data.username ? sanitizeInput(data.username) : "No username"; // Sanitize username

          const formattedBid = highestBid.toLocaleString("en-US"); // Format bid amount
          const highestBidText = highestBid > 0
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
              <p class="timer" id="timer-${item.id}"></p>
              <button class="bid-btn" id="bid-btn-${item.id}">Place Bid</button>
          `;

          auctionContainer.appendChild(itemElement);

          startItemTimer(item); // Start countdown for each item

          const bidButton = document.getElementById(`bid-btn-${item.id}`);
          if (bidButton) {
              bidButton.addEventListener("click", (event) => {
                  event.stopPropagation();

                  // Validate auction time
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
                      placeBid(item.id, sanitizedBidAmount);
                  } else {
                      alert("Bid amount must be higher than the current highest bid and starting price.");
                  }
              });
          }

          // Add click event to display product overview
          itemElement.addEventListener("click", () => {
              showProductOverview(item, highestBid, user);
          });
      } catch (error) {
          console.error(`Error rendering item with ID ${item.id}:`, error);
      }
  }
};


// Start timer for a specific auction item
const startItemTimer = (item) => {
  const timerElement = document.getElementById(`timer-${item.id}`);
  const endTime = new Date(item.startingTime.getTime() + item.duration * 1000);//Get time converts it to miliseconds(Since UNIX epoch 1 JAN 1970)

  const interval = setInterval(() => {
    const currentTime = new Date();
    const timeLeft = Math.max(0, Math.floor((endTime - currentTime) / 1000));

    if (timeLeft <= 0) {
      clearInterval(interval);
      timerElement.textContent = "Auction ended";
      fetchAuctionItems();
    } 
    else {
      const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
      const seconds = (timeLeft % 60).toString().padStart(2, "0");
      timerElement.textContent = `${minutes}:${seconds}`;
    }
  }, 1000);

  timerIntervals.push(interval);
};

// Show product overview in a popup
// Show product overview in a popup
const showProductOverview = (item, highestBid, user) => {
  const overviewSection = document.getElementById("product-overview");
  overviewSection.style.display = "block";

  // Sanitize and render item details
  document.getElementById("product-name").value = sanitizeInput(item.name);
  const startingPrice = parseFloat(item.startingPrice || 0);
  const formattedPrice = startingPrice.toLocaleString("en-US");
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
  const sanitizedUser = sanitizeInput(user || "No username");
  const highestBidText = formattedBid > 0
      ? `$${formattedBid} by ${sanitizedUser}`
      : "No bids yet";

  highestBidElement.textContent = `Current Highest Bid: ${highestBidText}`;
  highestBidElement.style.marginTop = "10px";

  const detailsSection = document.querySelector(".details");
  detailsSection.appendChild(highestBidElement);

  // Add event listener for close button
  const closeButton = document.querySelector(".close-btn");
  closeButton.addEventListener("click", () => {
      overviewSection.style.display = "none";
      highestBidElement.remove(); // Clean up dynamically created element
  });
};

// Apply search and sort together
const applySearchAndSort = () => {
  const searchInput = sanitizeInput(document.getElementById("search-input").value.toLowerCase()); // Sanitize search input
  const sortCriteria = sanitizeInput(document.getElementById("sort-select").value); // Sanitize sort criteria

  // Filter items based on search input
  filteredItems = auctionItems.filter(item => {
      const sanitizedItemName = sanitizeInput(item.name.toLowerCase());
      const sanitizedItemDescription = sanitizeInput(item.description.toLowerCase());
      return sanitizedItemName.includes(searchInput) || sanitizedItemDescription.includes(searchInput);
  });

  // Sort items based on sort criteria
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
          console.error(`Unknown sort criteria: ${sortCriteria}`); // Log error for invalid sort criteria
  }

  renderAuctionItems(); // Re-render the auction items with the filtered and sorted list
};


// Attach event listeners for search and sort
const attachEventListeners = () => {
  document.getElementById("search-input").addEventListener("input", applySearchAndSort);
  document.getElementById("sort-select").addEventListener("change", applySearchAndSort);
};

async function get_balance() {
  try {
      const userID = await getCookie();


      // Fetch wallet balance
      const response = await fetch(`${API_URL_USER}/get-wallet-user?userID=${encodeURIComponent(userID)}`, {
          method: 'GET',
          credentials: 'include', // Ensure cookies are included in the request
      });

      const balanceElement = document.getElementById('current-balance');

      if (response.ok) {
          const data = await response.json();
          if (data.success) {
              const sanitizedBalance = sanitizeInput(data.wallet || 0);
              balanceElement.textContent = `${sanitizedBalance} CSP`; // Safely render the balance
          } else {
              console.error('Error fetching wallet:', sanitizeInput(data.error));
              balanceElement.textContent = 'Error loading balance';
          }
      } else {
          console.error('Request failed:', response.status, response.statusText);
          balanceElement.textContent = 'Error loading balance';
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
