let cachedUserID = null;
const API_URL = 'https://anthonyhalim-150-723848267249.us-central1.run.app';
const API_URL_USER = 'https://anthonyhalim-150-723848267249.us-central1.run.app';



let cachedUserRole = null;

async function get_user_role() {
    // Return cached role if available
    if (cachedUserRole) {
        return cachedUserRole;
    }

    try {
        // Fetch user details from the server
        const response = await fetch("https://anthonyhalim-150-723848267249.us-central1.run.app/me", {
            method: "GET",
            credentials: "include", // Include cookies for authentication
        });

        if (response.ok) {
            const data = await response.json();
            const userRole = sanitizeInput(data.user.role); // Sanitize the role from the response
            cachedUserRole = userRole; // Cache the role
            return cachedUserRole;
        } else {
            console.error("Failed to fetch user role: User not authenticated");
            return null;
        }
    } catch (error) {
        console.error("Error fetching user role:", error);
        return null;
    }
}


// Function to fetch and cache userID securely
async function getUserID() {
    if (cachedUserID) {
        return cachedUserID; // Return cached userID if available
    }

    try {
        const response = await fetch("https://anthonyhalim-150-723848267249.us-central1.run.app/me", {
            method: "GET",
            credentials: "include", // Include cookies for authentication
        });

        if (response.ok) {
            const data = await response.json();
            const userID = sanitizeInput(data.user.id);
            cachedUserID = userID; // Cache the sanitized userID
            return cachedUserID;
        } else {
            console.error("Failed to fetch user ID: User not authenticated");
            return null;
        }
    } catch (error) {
        console.error("Error fetching user ID:", error);
        return null;
    }
}

// Function to ensure user is authenticated
async function getCookie(path ="/login") {
    const userID = await getUserID();
    const currentPath = window.location.pathname;
    if (!userID && !currentPath.endsWith("login")) {
        window.location.href = sanitizeURL(path); // Redirect safely
        alert("Login Expired. Redirecting to login....");
    }
    return userID;
}

// Utility function to sanitize input and prevent XSS
function sanitizeInput(input) {
    if (typeof input === 'string') {
        const div = document.createElement("div");
        div.textContent = input;
        return div.innerHTML;
    }
    return input; // Return non-string inputs unchanged
}

// Utility function to sanitize URLs
function sanitizeURL(url) {
    try {
        const sanitizedURL = new URL(url, window.location.origin);
        return sanitizedURL.href;
    } catch (e) {
        console.error("Invalid URL:", e);
        return "/";
    }
}
function sanitizeAllLinks() {
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
        const originalHref = link.getAttribute('href');
        const sanitizedHref = sanitizeURL(originalHref);
        link.setAttribute('href', sanitizedHref);
    });
}

// Call the function on page load to sanitize all links
document.addEventListener('DOMContentLoaded', sanitizeAllLinks);