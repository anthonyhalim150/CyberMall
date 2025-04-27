async function addProduct(event) {
    event.preventDefault(); // Prevent form reload

    // Get form data
    const name = sanitizeInput(document.getElementById('product-name').value);
    const price = parseFloat(sanitizeInput(document.getElementById('product-price').value.replace(/,/g, '')));
    const description = sanitizeInput(document.getElementById('product-description').value);
    const stock = parseInt(sanitizeInput(document.getElementById('product-stock').value));
    const imageFile = document.getElementById('product-image').files[0]; // Get the selected file
    const category = sanitizeInput(document.getElementById('product-category').value);

    // Validate form inputs
    if (!name || !price || price <= 0 || !stock || stock <= 0 || !description || !imageFile || !category) {
        alert('All fields are required, and price/stock must be positive numbers.');
        return;
    }

    if (price > 99999999.99 || stock > 99999999) {
        alert('Price/stock too high, please enter a number below 99.99 million.');
        return;
    }

    // Retrieve userID securely
    const userID = await getCookie();

    // Create FormData object to send data, including the image file
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    formData.append('description', description);
    formData.append('stock', stock);
    formData.append('product-image', imageFile); // Key must match the backend's expected key
    formData.append('category', category);
    formData.append('userID', sanitizeInput(userID));

    try {
        const response = await fetch(`${API_URL}/add-new-product`, {
            method: 'POST',
            body: formData,
            credentials: 'include', // Ensure cookies are included with the request
        });
        const result = await response.json();

        if (result.success) {
            alert('Product added successfully!');
        } else {
            console.error('Error adding product:', result.message);
            alert('Failed to add product. Please try again.');
        }
    } catch (error) {
        console.error('Error adding product:', error);
        alert('An error occurred. Please try again.');
    }
}

// Handle formatting and validation for product price input
const productPriceInput = document.getElementById("product-price");
if (productPriceInput) {
    productPriceInput.addEventListener("input", (event) => {
        let value = event.target.value.replace(/,/g, ''); // Remove commas for processing
        if (!isNaN(value) && value !== "") {
            event.target.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ","); // Add commas
        }
    });

    productPriceInput.addEventListener("blur", (event) => {
        let value = event.target.value.replace(/,/g, ''); // Remove commas for validation
        if (value === "" || isNaN(value)) {
            event.target.value = ""; // Clear invalid input
        } else {
            event.target.value = parseFloat(value).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
        }
    });
}

// Attach submit event listener to the product form
document.addEventListener('DOMContentLoaded', () => {
    const product_form = document.getElementById('product-form');
    if (product_form) {
        product_form.addEventListener('submit', addProduct);
    }
});
