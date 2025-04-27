const sign_up_form = document.getElementById("sign-up-form");

if (sign_up_form) {
    sign_up_form.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Extract and sanitize form values
        const username = sanitizeInput(document.getElementById("username").value.trim());
        const email = sanitizeInput(document.getElementById("email").value.trim());
        const password = document.getElementById("password").value;
        const confirm_password = document.getElementById("confirm_password").value;

        if (!validateEmail(email)) {
            alert("Please enter a valid email address.");
            return;
        }

        if (!validatePassword(password)) {
            alert("Password must be at least 8 characters long, include a number, and have at least one special character.");
            return;
        }

        if (password !== confirm_password) {
            alert("Passwords do not match!");
            return;
        }

        // Create the sanitized user object
        const user = { username, email, password };

        try {
            const response = await fetch(`${API_URL}/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(user),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert(`Account created successfully for ${username}!`);
                sign_up_form.reset(); // Reset the form
                window.location.href = sanitizeURL("/login"); // Redirect securely
            } else {
                document.getElementById("signup_message").innerText =
                    `Sign-Up Failed: ${sanitizeInput(result.error || "Unknown error.")}`;
            }
        } catch (error) {
            console.error("Error connecting to server:", error);
            document.getElementById("signup_message").innerText =
                "Error connecting to server. Please try again later.";
        }
    });
}

// Utility function to validate email
function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Utility function to validate password
function validatePassword(password) {
    const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
}

