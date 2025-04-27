
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


// Function to update the login state
async function update_login() {
    const navbarLinks = document.getElementById('navbar-links');
    
    // Fetch userID and role using the functions from auth.js
    const userID = await getCookie();  // Use auth.js to get the user ID securely
    const role = await get_user_role();  // Get the user role using the provided function from auth.js

    if (userID) {
        if (role === 'admin') {
            window.location.href = sanitizeURL("/admin/index");
            return;
        }
        
        // User is logged in, update the navbar links
        navbarLinks.innerHTML = `
        <ul class="navbar-icons">
            <li class="nav-item">
                <a class="cart-btn" href="/cart" id="cart_nav">
                    <img src="Icons/cart.png" title="Cart" alt="Transparent Cart Icon">
                </a>
            </li>
            <li class="nav-item dropdown">
                <a class="dropdown-toggle" href="#" id="profileDropdown" role="button">
                    <img src="Icons/profile.png" title="Profile" alt="Profile Icon" class="profile-btn">
                </a>
                <ul class="dropdown-menu" aria-labelledby="profileDropdown">
                    <li><a class="dropdown-item" href="/Dashboard/index">Dashboard</a></li>
                    <li><a class="dropdown-item" href="/auction">Auctions</a></li>
                    <li><a class="dropdown-item" href="/settings">Settings</a></li>
                    <li><a class="dropdown-item" id="likes_nav"  href="/like">Likes</a></li>
                    <li><a class="dropdown-item" id="logout_nav" href="/index">Logout</a></li>
                </ul>
            </li>
            <li class="nav-item">
                <button id="customer-support" class="support-btn">
                    <img src="Icons/customer-support.png" title="Customer Support" alt="Feedback">
                </button>
            </li>
        </ul>
        `;
        sanitizeAllLinks();


        clear_login();  // Call function to clear login data (if needed)
    } else {
        // User is logged out, show login/signup links
        navbarLinks.innerHTML = `
        <ul class="navbar-icons">
            <li class="nav-item">
                <a class="cart-btn" href="#" id="cart_nav">
                    <img src="Icons/cart.png" title="Cart" alt="Transparent Cart Icon">
                </a>
            </li>
            <li class="nav-item dropdown">
                <a class="dropdown-toggle" href="#" id="profileDropdown" role="button">
                    <img src="Icons/profile.png" title="Profile" alt="Profile Icon" class="profile-btn">
                </a>
                <ul class="dropdown-menu" aria-labelledby="profileDropdown">
                    <li><a class="dropdown-item" href="/signup">Sign Up</a></li>
                    <li><a class="dropdown-item" href="/login">Login</a></li>
                </ul>
            </li>
            <li class="nav-item">
                <button id="customer-support" class="support-btn">
                    <img src="Icons/customer-support.png" title="Customer Support" alt="Feedback">
                </button>
            </li>
        </ul>
        `;
        sanitizeAllLinks();
    }

    setup_icon();  // Initialize profile dropdown or other settings
}



// Function to set up the profile icon dropdown
function setup_icon() {
    const profileDropdown = document.querySelector('#profileDropdown');
    if (profileDropdown) {
        profileDropdown.addEventListener('click', function (event) {
            event.preventDefault(); // Prevent default link behavior
            const dropdownMenu = this.nextElementSibling; // Get the dropdown menu
            // Toggle visibility of the dropdown menu
            dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
        });

        // Close dropdown if clicking outside
        document.addEventListener('click', function (event) {
            const dropdown = document.querySelector('.dropdown-menu');
            if (dropdown && !profileDropdown.contains(event.target) && !dropdown.contains(event.target)) {
                dropdown.style.display = 'none';
            }
        });
    }
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
                    window.location.href = sanitizeURL("/login");
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


async function loadUserSettings() {
    const userID = await getCookie(); // Fetch the userID using getCookie to align with your secure cookie handling.
    if (!userID) return;

    const sanitizedUserID = sanitizeInput(userID); // Sanitize the userID to prevent XSS or unsafe characters
    
    try {
        const response = await fetch(`${API_URL}/get-user-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userID: sanitizedUserID }), // Send sanitized userID
            credentials: "include",
        });

        const data = await response.json();
        if (data.success) {
            // Apply the settings
            const { dark_mode, color_scheme } = data.settings;

            // Sanitize color_scheme to ensure it is a valid value
            const sanitizedColorScheme = sanitizeInput(color_scheme);
            document.documentElement.style.setProperty('--primary-color', sanitizedColorScheme);

            // Ensure dark_mode is boolean and safe
            document.documentElement.style.setProperty('--secondary-color', dark_mode ? '#333' : 'light');
            document.documentElement.style.setProperty('--text-color', dark_mode ? '#FFFFFF' : 'black');
        }
        else {
            console.error(data.message);
        }
    } catch (error) {
        console.error('Error fetching user settings:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    document.body.classList.add('loading');
    loadUserSettings().then(() => {
        document.body.classList.remove('loading');
    });
    await update_login();
    customer_support();
});