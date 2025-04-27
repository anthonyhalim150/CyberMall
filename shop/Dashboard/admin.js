async function crawler_check(){
    const userRole = await get_user_role(); 
    if (window.location.pathname.includes('/Dashboard') && userRole !== 'user') {
        window.location.href = sanitizeURL('/login');  // Redirect to non-admins to homepage
    }
}




// Function to create the sidebar
function createSidebar() {
    // Sidebar container
    const sidebar = document.createElement('aside');
    sidebar.classList.add('sidebar');

    // Sidebar content
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <h2>Dashboard</h2>
        </div>
        <nav class="sidebar-nav">
            <ul>
                <li><a href="/Dashboard/wallet" class="nav-item">Wallet</a></li>
                <li class="dropdown">
                    <a href="#" class="nav-item dropdown-toggle">
                        Products <span class="arrow">▼</span>
                    </a>
                    <ul class="dropdown-menu">
                        <li><a href="/Dashboard/add_new_product" class="nav-item">Add Product</a></li>
                        <li><a href="/Dashboard/product_list" class="nav-item">Product List</a></li>
                        <li><a href="/Dashboard/transaction_list" class="nav-item">Sold List</a></li>
                    </ul>
                </li>
                <li class="dropdown">
                    <a href="#" class="nav-item dropdown-toggle">
                        Auctions <span class="arrow">▼</span>
                    </a>
                    <ul class="dropdown-menu">
                        <li><a href="/Dashboard/add_new_auction" class="nav-item">Add Auction</a></li>
                        <li><a href="/Dashboard/expired_auction_list" class="nav-item">Expired Auction List</a></li>
                        <li><a href="/Dashboard/ongoing_auction_list" class="nav-item">Ongoing Auction List</a></li>
                        <li><a href="/Dashboard/upcoming_auction_list" class="nav-item">Upcoming Auction List</a></li>
                    </ul>
                </li>
                <li><a href="/Dashboard/transaction_history" class="nav-item">Transaction History</a></li>
                <li><a href="/Dashboard/metrics" class="nav-item">Metrics</a></li>
                <li><a href="/index" class="nav-item">Home</a></li>
            </ul>
        </nav>
    `;

    // Append sidebar to the body or a specific container
    document.body.prepend(sidebar);
    sanitizeAllLinks();

    // Add event listeners for dropdown
    open_drop_down();
}



function open_drop_down() {
    // Select all dropdown toggles
    const drop_down_toggles = document.querySelectorAll('.dropdown-toggle');

    drop_down_toggles.forEach(toggle => {
        toggle.addEventListener('click', (event) => {
            event.preventDefault();

            // Find the parent dropdown and toggle the 'open' class
            const dropdown = toggle.parentElement;
            dropdown.classList.toggle('open');

            // Close other open dropdowns
            document.querySelectorAll('.dropdown').forEach(otherDropdown => {
                if (otherDropdown !== dropdown) {
                    otherDropdown.classList.remove('open');
                }
            });
        });
    });

    // Close the dropdown when clicking outside
    document.addEventListener('click', (event) => {
        document.querySelectorAll('.dropdown').forEach(dropdown => {
            if (!dropdown.contains(event.target)) {
                dropdown.classList.remove('open');
            }
        });
    });
}



document.addEventListener('DOMContentLoaded', () => {
    createSidebar();
    crawler_check();
});
