let items = [];

async function fetch_products(sorted_items = null) {
    try {
        const userID = await getCookie(); // Use getCookie() to retrieve the userID from cookies


        const response = await fetch(`${API_URL_USER}/upcoming-auction-user?userID=${encodeURIComponent(userID)}`, {
            method: "GET",
            credentials: "include", // Include cookies for authentication
        });

        const data = await response.json();

        if (data.success && Array.isArray(data.items)) {
            items = sorted_items || data.items.map(product => ({
                id: sanitizeInput(product.id),
                item_name: sanitizeInput(product.item_name),
                starting_price: parseFloat(product.starting_price || 0),
                stock: sanitizeInput(product.stock),
                description: sanitizeInput(product.description || "N/A"),
                category: sanitizeInput(product.category || "N/A"),
                duration: sanitizeInput(product.duration || "N/A"),
                starting_time: sanitizeInput(product.starting_time),
                image: sanitizeInput(product.image || "placeholder.jpg"),
            }));

            const productContainer = document.getElementById('product-container-tbody');
            if (!productContainer) {
                console.error("Product container element not found.");
                return;
            }

            productContainer.innerHTML = items.map(product => {
                const formattedStartingTime = product.starting_time ? formatDateTime(product.starting_time) : "N/A";
                const formattedPrice = product.starting_price.toLocaleString("en-US");

                return `
                <tr data-id="${product.id}" class="pointer-row">
                    <td>
                        <img src="${product.image}" alt="Not Found!" 
                        original-image="${product.image}" class="product-image">
                    </td>
                    <td>${product.item_name}</td>
                    <td>$${formattedPrice}</td>
                    <td>${product.stock}</td>
                    <td>${product.description}</td>
                    <td>${product.category}</td>
                    <td>${product.duration}</td>
                    <td>${formattedStartingTime}</td>
                </tr>`;
            }).join('');

            // Add click event listeners to rows
            document.querySelectorAll('#product-container tbody tr').forEach(row => {
                row.addEventListener('click', () => {
                    const productId = sanitizeInput(row.getAttribute('data-id'));
                    const product = items.find(item => item.id == productId);
                    if (product) {
                        displayProductOverview(product);
                    } else {
                        console.error(`Product with ID ${productId} not found.`);
                    }
                });
            });
        } else {
            console.error("Failed to fetch products: Invalid response format or no items found.");
        }
    } catch (error) {
        console.error("Error fetching products:", error);
    }
}

            

function searchItems() {
    const searchBar = document.getElementById('search-bar');
    if (!searchBar) {
        console.error("Search bar element not found.");
        return;
    }

    const query = sanitizeInput(searchBar.value.trim().toLowerCase());
    if (query === "") {
        fetch_products(); // Reset to full product list if query is empty
        return;
    }

    const filteredItems = items
        .map(item => {
            const nameMatch = item.item_name.toLowerCase().includes(query) ? 1 : 0;
            const descMatch = item.description.toLowerCase().includes(query) ? 1 : 0;
            const categoryMatch = item.category.toLowerCase().includes(query) ? 1 : 0;

            const matchScore = nameMatch + descMatch + categoryMatch;
            return { ...item, matchScore };
        })
        .filter(item => item.matchScore > 0) // Keep items with positive match scores
        .sort((a, b) => {
            if (b.matchScore !== a.matchScore) {
                return b.matchScore - a.matchScore;
            }
            return a.item_name.localeCompare(b.item_name);
        });

    fetch_products(filteredItems); // Render filtered items
}
async function saveProductChanges(productId) {
    const formData = new FormData();

    // Validate inputs
    const price = parseFloat(document.getElementById('product-price').value.replace(/,/g, ''));
    const stock = parseInt(document.getElementById('product-stock').value, 10);
    const duration = parseInt(document.getElementById('product-duration').value, 10);

    if (price > 499999999999.99) {
        alert('Starting price too high, please enter a number below 500 billion!');
        return;
    }

    if (stock > 99999999 || duration > 99999999) {
        alert('Stock/duration too high, please enter a number below 99.99 million.');
        return;
    }

    // Append sanitized inputs to formData
    formData.append('id', sanitizeInput(productId));
    formData.append('name', sanitizeInput(document.getElementById('product-name').value));
    formData.append('price', price);
    formData.append('stock', stock);
    formData.append('description', sanitizeInput(document.getElementById('product-description').value));
    formData.append('category', sanitizeInput(document.getElementById('product-category').value));
    formData.append('duration', duration);

    let time = document.getElementById('product-start').value;
    if (time) {
        time = new Date(time).toISOString(); // Convert to UTC ISO format
    }
    formData.append('time', time);

    const imageFile = document.getElementById('image-form').files[0];
    if (imageFile) {
        formData.append('product-image', imageFile); // Add the image file if it exists
    } else {
        // Retrieve the original image from the `data-original-image` attribute
        const productRow = document.querySelector(`tr[data-id="${sanitizeInput(productId)}"]`);
        if (productRow) {
            const originalImage = sanitizeInput(productRow.querySelector('img').getAttribute('original-image'));
            formData.append('product-image', originalImage);
        } else {
            alert('Original image not found.');
            return;
        }
    }

    const confirmed = confirm('Are you sure you want to save these changes?');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/auction-items/${sanitizeInput(productId)}`, {
            method: 'PUT', // Do not include `Content-Type` header with FormData
            body: formData, // FormData handles encoding
            credentials: 'include', // Include cookies for authentication
        });

        if (response.ok) {
            alert('Product updated successfully!');
            fetch_products(); // Refresh the list
        } else {
            alert('Failed to update the product.');
        }
    } catch (error) {
        console.error('Error saving product:', error);
        alert('An error occurred while saving the product.');
    }
}

async function delete_product(productId) {
    const confirmed = confirm('Are you sure you want to delete the product?');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/remove-auction`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ itemID: sanitizeInput(parseInt(productId, 10)) }),
            credentials: 'include', // Include cookies for authentication
        });

        const result = await response.json();

        if (result.success) {
            alert("Product deleted successfully!");
            const overviewSection = document.getElementById('product-overview');
            if (overviewSection) {
                overviewSection.style.display = 'none'; // Hide the overview section
            }
            fetch_products(); // Refresh the list
        } else {
            alert(`Error: ${sanitizeInput(result.error)}`);
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        alert('An error occurred while trying to delete the product.');
    }
}



function formatDateTime(dateTime) {
    const date = new Date(dateTime);

    const options = {
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true // To use AM/PM format
    };

    return date.toLocaleString('en-US', options).replace(',', '');
}
function displayProductOverview(product) {
    const overviewSection = document.getElementById('product-overview');
    if (!overviewSection) {
        console.error("Product overview section not found.");
        return;
    }
    overviewSection.style.display = 'block';

    // Populate the overview card with product details
    document.getElementById('product-image').src = sanitizeInput(product.image);
    document.getElementById('product-name').value = sanitizeInput(product.item_name);
    document.getElementById('product-price').value = parseFloat(sanitizeInput(product.starting_price)).toLocaleString('en-US');
    document.getElementById('product-stock').value = sanitizeInput(product.stock);
    document.getElementById('product-description').value = sanitizeInput(product.description);
    document.getElementById('product-category').value = sanitizeInput(product.category);
    document.getElementById('product-duration').value = sanitizeInput(product.duration);

    const startingTime = new Date(sanitizeInput(product.starting_time));
    const formattedTime = startingTime.toLocaleString('en-CA', { hour12: false }).replace(',', '').slice(0, 16);
    document.getElementById('product-start').value = formattedTime;

    // Add a save button listener
    document.getElementById('save-button').onclick = () => saveProductChanges(sanitizeInput(product.id));
    document.getElementById('delete-button').onclick = () => delete_product(sanitizeInput(product.id));
}

// Add input formatting for the product price field
const productPriceInput = document.getElementById("product-price");
if (productPriceInput) {
    productPriceInput.addEventListener("input", (event) => {
        let rawValue = event.target.value.replace(/,/g, ''); // Remove commas
        if (!isNaN(rawValue) && rawValue !== "") {
            const [whole, decimal] = rawValue.split('.'); // Split into whole and decimal parts
            event.target.value = decimal !== undefined 
                ? parseFloat(whole).toLocaleString('en-US') + '.' + decimal 
                : parseFloat(whole).toLocaleString('en-US');
        } else {
            event.target.value = ""; // Clear invalid input
        }
    });

    productPriceInput.addEventListener("blur", (event) => {
        let rawValue = event.target.value.replace(/,/g, ''); // Remove commas for raw value
        if (!isNaN(rawValue) && rawValue !== "") {
            event.target.value = parseFloat(rawValue).toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            }); // Format with two decimal places
        } else {
            event.target.value = ""; // Clear invalid input
        }
    });
}

// Hide product overview when clicking outside
document.addEventListener('click', (event) => {
    const overviewSection = document.getElementById('product-overview');
    if (!overviewSection) {
        console.error("Product overview section not found.");
        return;
    }

    const closeBtn = event.target.closest('.close-btn');
    if ((!overviewSection.contains(event.target) && !event.target.closest('tr')) || closeBtn) {
        overviewSection.style.display = 'none';
    }
});

// Add row click events dynamically
document.querySelectorAll('#product-container tbody tr').forEach(row => {
    row.addEventListener('click', () => {
        const productId = sanitizeInput(row.getAttribute('data-id'));
        const product = items.find(item => item.id == productId);

        if (!product) {
            console.error(`Product with ID ${productId} not found.`);
            return;
        }

        // Highlight the selected row
        document.querySelectorAll('#product-container tbody tr').forEach(r => r.classList.remove('highlight-row'));
        row.classList.add('highlight-row');

        displayProductOverview(product);
    });
});


// Existing event listeners remain unchanged
document.addEventListener('DOMContentLoaded', () => {
    fetch_products();
});

const searchBar = document.getElementById('search-bar');
if (searchBar) {
    searchBar.addEventListener('input', () => {
        searchItems();
    });
}
