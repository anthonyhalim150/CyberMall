async function crawler_check(){
    const userRole = await get_user_role(); 
    if (window.location.pathname.includes('/admin') && (userRole !== 'admin')) {
       window.location.href = sanitizeURL('/login.html');  // Redirect to non-admins to homepage
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
            <h2>Admin Dashboard</h2>
        </div>
        <nav class="sidebar-nav">
            <ul>
                <li class="dropdown">
                    <a href="#" class="nav-item dropdown-toggle">
                        Products <span class="arrow">▼</span>
                    </a>
                    <ul class="dropdown-menu">
                        <li><a href="/admin/add_new_product.html" class="nav-item">Add Product</a></li>
                        <li><a href="/admin/product_list.html" class="nav-item">Product List</a></li>
                    </ul>
                </li>
                <li class="dropdown">
                    <a href="#" class="nav-item dropdown-toggle">
                        Auctions <span class="arrow">▼</span>
                    </a>
                    <ul class="dropdown-menu">
                        <li><a href="/admin/add_new_auction.html" class="nav-item">Add Auction</a></li>
                        <li><a href="/admin/expired_auction_list.html" class="nav-item">Expired Auction List</a></li>
                        <li><a href="/admin/ongoing_auction_list.html" class="nav-item">Ongoing Auction List</a></li>
                        <li><a href="admin/upcoming_auction_list.html" class="nav-item">Upcoming Auction List</a></li>
                    </ul>
                </li>
                <li class="dropdown">
                    <a href="#" class="nav-user dropdown-toggle">
                        Users <span class="arrow">▼</span>
                    </a>
                    <ul class="dropdown-menu">
                        <li><a href="/admin/add_new_user.html" class="nav-user">Add Users</a></li>               
                        <li><a href="/admin/user_list.html" class="nav-user">User List</a></li>
                    </ul>
                </li>
                <li><a href="/admin/transaction_list.html" class="nav-item">Transaction List</a></li>
                <li><a href="/admin/metrics.html" class="nav-item">Metrics</a></li>
                <li><a href="/admin/comment_list.html" class="nav-item">Comments</a></li>
                <li><a href="/admin/AI/templates/AI_comment.html" class="nav-item">AI Page</a></li>
                <li><a id="logout_nav" class="nav-item">Logout</a></li>
            </ul>
        </nav>
    `;

    // Append sidebar to the body or a specific container
    document.body.prepend(sidebar);
    sanitizeAllLinks();

    // Add event listeners for dropdown
    open_drop_down();
}

async function clear_login() {
    const login = document.getElementById('logout_nav');
    if (login){
        login.addEventListener('click', async () => {
            try {
                // Make a POST request to the logout endpoint
                const response = await fetch(`${API_URL}/logout`, {
                    method: 'POST',
                    credentials: 'include', // Include cookies in the request
                });

                if (response.ok) {
                    alert('You have logged out.');
                    window.location.href = sanitizeURL("/login.html");
                } else {
                    const data = await response.json();
                    console.error('Logout failed:', data.message);
                    alert('Failed to log out. Please try again.');
                }
            } catch (error) {
                console.error('Error during logout:', error);
                alert('An error occurred while logging out.');
            }
        });
    }
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
    clear_login();
});
