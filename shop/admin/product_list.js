let items = [];

// Fetch products and render them in the table
async function fetch_products(sorted_items = null) {
    try {
        const response = await fetch(`${API_URL}/all-items`, {
            method: "GET",
            credentials: "include", // Include cookies for authentication
        });

        const data = await response.json();

        if (data.success && data.items) {
            items = data.items.map(item => ({
                id: sanitizeInput(item.id),
                name: sanitizeInput(item.name),
                price: parseFloat(item.price || 0),
                stock: sanitizeInput(item.stock),
                description: sanitizeInput(item.description || "N/A"),
                category: sanitizeInput(item.category || "N/A"),
                image: sanitizeInput(item.image || "placeholder.jpg"),
            }));

            if (sorted_items !== null) {
                items = sorted_items;
            }

            const productContainer = document.getElementById('product-container-tbody');
            if (!productContainer) {
                console.error("Product container element not found.");
                return;
            }

            productContainer.innerHTML = items.map(product => {
                const formattedPrice = product.price.toLocaleString('en-US');

                return `
                <tr data-id="${sanitizeInput(product.id)}" class="pointer-row">
                    <td>
                        <img src="${product.image}" alt="Not Found!" 
                        original-image="${product.image}" class="product-image">
                    </td>
                    <td>${product.name}</td>
                    <td>$${formattedPrice}</td>
                    <td>${product.stock}</td>
                    <td>${product.description}</td>
                    <td>${product.category}</td>
                </tr>`;
            }).join("");

            // Add click event listeners to rows
            document.querySelectorAll("#product-container-tbody tr").forEach(row => {
                row.addEventListener("click", () => {
                    const productId = sanitizeInput(row.getAttribute("data-id"));
                    const product = items.find(item => item.id == productId);
                    if (product) {
                        displayProductOverview(product);
                    }
                });
            });
        } else {
            console.error('Failed to fetch products:', sanitizeInput(data.error));
        }
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

// Search through items based on user query
function searchItems() {
    const searchBar = document.getElementById('search-bar');
    if (!searchBar) {
        console.error("Search bar element not found.");
        return;
    }

    const query = sanitizeInput(searchBar.value.trim().toLowerCase());
    let desc_match = 0;
    let category_match = 0;

    if (query === '') {
        fetch_products(); // Reset to full product list if query is empty
        return;
    }

    const filteredItems = items
        .map(item => {
            const nameMatch = item.name.toLowerCase().includes(query) ? 1 : 0;
            if (item.description !== null) {
                desc_match = item.description.toLowerCase().includes(query) ? 1 : 0;
            }
            if (item.category !== null) {
                category_match = item.category.toLowerCase().includes(query) ? 1 : 0;
            }

            const matchScore = nameMatch + desc_match + category_match;
            return { ...item, matchScore };
        })
        .filter(item => item.matchScore > 0) // Keep items with positive match scores
        .sort((a, b) => {
            if (b.matchScore !== a.matchScore) {
                return b.matchScore - a.matchScore;
            }
            return a.name.localeCompare(b.name);
        });

    fetch_products(filteredItems); // Render filtered items
}


async function saveProductChanges(productId) {
    const formData = new FormData();

    const price = parseFloat(document.getElementById('product-price').value.replace(/,/g, ''));
    const stock = parseInt(document.getElementById('product-stock').value, 10);

    if (price > 99999999.99 || stock > 99999999) {
        alert('Price/stock too high, please enter a number below 99.99 million.');
        return;
    }

    formData.append('id', sanitizeInput(productId));
    formData.append('name', sanitizeInput(document.getElementById('product-name').value));
    formData.append('price', price);
    formData.append('stock', stock);
    formData.append('description', sanitizeInput(document.getElementById('product-description').value));
    formData.append('category', sanitizeInput(document.getElementById('product-category').value));

    const imageFile = document.getElementById('image-form').files[0];
    if (imageFile) {
        formData.append('product-image', imageFile); // Add the image file if it exists
    } else {
        // Retrieve the original image from the `data-original-image` attribute
        const productRow = document.querySelector(`tr[data-id="${sanitizeInput(productId)}"]`);
        if (productRow) {
            const originalImage = productRow.querySelector('img').getAttribute('original-image');
            formData.append('product-image', sanitizeInput(originalImage));
        } else {
            console.error('Product row not found for image retrieval.');
            alert('Error retrieving original product image.');
            return;
        }
    }

    const confirmed = confirm('Are you sure you want to save these changes?');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/items/${sanitizeInput(productId)}`, {
            method: 'PUT',
            body: formData, // FormData handles multipart/form-data encoding
            credentials: 'include',
        });

        if (response.ok) {
            alert('Product updated successfully!');
            fetch_products(); // Refresh the list
        } else {
            const error = await response.json();
            alert(`Failed to update the product: ${sanitizeInput(error.message || 'Unknown error')}`);
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
        const response = await fetch(`${API_URL}/remove-product`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId: sanitizeInput(parseInt(productId, 10)) }),
            credentials: 'include',
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

function displayProductOverview(product) {
    const overviewSection = document.getElementById('product-overview');
    if (!overviewSection) {
        console.error("Product overview section not found.");
        return;
    }

    overviewSection.style.display = 'block';

    // Populate the overview card with product details
    document.getElementById('product-image').src = sanitizeInput(product.image);
    document.getElementById('product-name').value = sanitizeInput(product.name);
    document.getElementById('product-price').value = parseFloat(sanitizeInput(product.price)).toLocaleString('en-US');
    document.getElementById('product-stock').value = sanitizeInput(product.stock);
    document.getElementById('product-description').value = sanitizeInput(product.description);
    document.getElementById('product-category').value = sanitizeInput(product.category);

    // Add save and delete button listeners
    document.getElementById('save-button').onclick = () => saveProductChanges(sanitizeInput(product.id));
    document.getElementById('delete-button').onclick = () => delete_product(sanitizeInput(product.id));
}

// Hide product overview when clicking outside
document.addEventListener('click', (event) => {
    const overviewSection = document.getElementById('product-overview');
    const closeBtn = event.target.closest('.close-btn');
    if (overviewSection && (!overviewSection.contains(event.target) && !event.target.closest('tr') || closeBtn)) {
        overviewSection.style.display = 'none';
    }
});

// Add row click events dynamically
document.querySelectorAll('#product-container tbody tr').forEach(row => {
    row.addEventListener('click', () => {
        const productId = sanitizeInput(row.getAttribute('data-id'));
        const product = items.find(item => item.id == productId);

        if (product) {
            // Highlight the selected row
            document.querySelectorAll('#product-container tbody tr').forEach(r => r.classList.remove('highlight-row'));
            row.classList.add('highlight-row');

            displayProductOverview(product);
        } else {
            console.error(`Product with ID ${productId} not found.`);
        }
    });
});

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    fetch_products();
});

const searchBar = document.getElementById('search-bar');
if (searchBar) {
    searchBar.addEventListener('input', () => {
        searchItems();
    });
}

// Add formatting for product price input
const productPriceInput = document.getElementById("product-price");
if (productPriceInput) {
    productPriceInput.addEventListener("input", (event) => {
        let rawValue = event.target.value.replace(/,/g, ''); // Remove commas
        if (!isNaN(rawValue) && rawValue !== "") {
            const [whole, decimal] = rawValue.split('.'); // Split into whole and decimal parts
            // Format whole part with commas and append decimal part if exists
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
