async function addProduct(event) {
    event.preventDefault(); // Prevent form reload

    // Get form data
    const name = sanitizeInput(document.getElementById('product-name').value);
    const price = parseFloat(sanitizeInput(document.getElementById('product-price').value.replace(/,/g, '')));
    const description = sanitizeInput(document.getElementById('product-description').value);
    const stock = parseInt(sanitizeInput(document.getElementById('product-stock').value));
    const imageFile = document.getElementById('product-image').files[0]; // Get the selected file
    const category = sanitizeInput(document.getElementById('product-category').value);
    const duration = parseInt(sanitizeInput(document.getElementById('product-duration').value));
    const time = sanitizeInput(document.getElementById('product-start').value);

    // Validate form inputs
    if (!name || !price || price <= 0 || !stock || stock <= 0 || !description || !imageFile || !category || !duration || duration <= 0) {
        alert('All fields are required, and price/stock/duration must be positive numbers.');
        return;
    }

    if (price > 499999999999.99) {
        alert('Starting price too high, please enter a number below 500 billion.');
        return;
    }

    if (stock > 99999999 || duration > 99999999) {
        alert('Stock/duration too high, please enter a number below 99.99 million.');
        return;
    }

    let starting_time;
    if (time) {
        starting_time = new Date(time).toISOString(); // Convert to UTC ISO form
    }

    // Create FormData object to send data, including the image file
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    formData.append('starting_time', starting_time);
    formData.append('description', description);
    formData.append('stock', stock);
    formData.append('product-image', imageFile); // Key must match the backend's expected key
    formData.append('category', category);
    formData.append('duration', duration);

    const userID = await getCookie(); // Securely fetch userID using getCookie
    formData.append('userID', userID);

    try {
        const response = await fetch(`${API_URL}/add-new-auction`, { // Adjust the endpoint as needed
            method: 'POST',
            body: formData, // FormData includes all fields and the file
            credentials: 'include', // Ensure cookies are included in the request
        });

        const result = await response.json();
        if (result.success) {
            alert('Auction Product added successfully!');
        } else {
            alert('Failed to add product. Please try again.');
        }
    } catch (error) {
        console.error("Error adding product:", error);
        alert('Failed to add product. Please try again.');
    }
}

// Handle formatting and validation for product price input
const productPriceInput = document.getElementById("product-price");
if (productPriceInput) {
    productPriceInput.addEventListener("input", (event) => {
        let value = event.target.value.replace(/,/g, ''); // Remove commas for the purpose of processing
        // Check if it's a valid number, allowing for decimals
        if (!isNaN(value) && value !== "") {
            event.target.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ","); // Add commas as thousands separator
        }
    });

    productPriceInput.addEventListener("blur", (event) => {
        let value = event.target.value.replace(/,/g, ''); // Remove commas to handle the raw number
        if (value === "" || isNaN(value)) {
            event.target.value = ""; // Clear invalid input
        } else {
            // Ensure two decimal places on blur and format with commas
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
