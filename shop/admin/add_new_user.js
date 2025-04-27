async function addProduct(event) {
    event.preventDefault(); // Prevent form reload

    // Get form data
    const username = sanitizeInput(document.getElementById('product-name').value);
    const password = sanitizeInput(document.getElementById('product-price').value);
    const role = sanitizeInput(document.getElementById('product-stock').value.toLowerCase());
    const email = sanitizeInput(document.getElementById('product-category').value);

    // Validate form inputs
    if (!username || !password || !role || !email) {
        alert('All fields are required!');
        return;
    }

    if (role !== 'admin' && role !== 'user') {
        alert('Role must be either "admin" or "user".');
        return;
    }

    // Create a new user object
    const newUser = { username, password, role, email };

    try {
        const response = await fetch(`${API_URL}/add-new-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newUser),
            credentials: 'include',
        });

        const result = await response.json();
        if (result.success) {
            alert('User added successfully!');
        } else {
            console.error('Error adding user:', result.message);
            alert(result.message || 'Failed to add user. Please try again.');
        }
    } catch (error) {
        console.error('Error adding user:', error);
        alert('An error occurred. Please try again later.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', addProduct);
    }
});
