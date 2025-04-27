const filter_button = document.getElementById('filter-button')
if (filter_button){
    filter_button.addEventListener('click', fetchFilteredMetrics);
}

let salesChart, productMetricsChart, productComparisonChart, userRegistrationChart; // Chart instances

async function fetchFilteredMetrics() {
    const startDate = sanitizeInput(document.getElementById('start-date').value);
    const endDate = sanitizeInput(document.getElementById('end-date').value);

    if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
        return;
    }

    const params = new URLSearchParams({ startDate, endDate }).toString();
    const url = `${API_URL + '/shop-metrics'}?${params}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include', // Include cookies for authentication
        });
        const data = await response.json();

        if (data.success) {
            displaySalesOverTimeChart(data.salesOverTime);
            displayProductMetricsChart(data.productMetricsOverTime);
            displayProductComparisonChart(data.productComparison);
            displayUserRegistrationChart(data.userRegistrations);
        } else {
            console.error('Failed to fetch shop metrics:', sanitizeInput(data.error));
        }
    } catch (error) {
        console.error('Error fetching shop metrics:', error);
    }
}

function displaySalesOverTimeChart(salesData) {
    if (!salesData || !salesData.timeLabels) {
        console.error('Missing or invalid sales data.');
        return;
    }

    const ctx = document.getElementById('sales-chart').getContext('2d');

    if (salesChart) {
        salesChart.destroy();
    }

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sanitizeInputArray(salesData.timeLabels),
            datasets: [
                {
                    label: 'Total Amount',
                    data: sanitizeInputArray(salesData.totalAmounts) || [],
                    borderColor: '#33FF57',
                    fill: false,
                },
            ],
        },
        options: {
            scales: {
                x: { title: { display: true, text: 'Time' } },
                y: { beginAtZero: true },
            },
        },
    });
}

function displayProductMetricsChart(productMetrics) {
    if (!productMetrics || !productMetrics.timeLabels) {
        console.error('Missing or invalid product metrics data.');
        return;
    }

    const ctx = document.getElementById('product-metrics-chart').getContext('2d');

    if (productMetricsChart) {
        productMetricsChart.destroy();
    }

    productMetricsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sanitizeInputArray(productMetrics.timeLabels),
            datasets: [
                {
                    label: 'Total Items Sold',
                    data: sanitizeInputArray(productMetrics.itemsSold) || [],
                    borderColor: '#3357FF',
                    fill: false,
                },
                {
                    label: 'Stock Remaining',
                    data: sanitizeInputArray(productMetrics.stockRemaining) || [],
                    borderColor: '#FF33FF',
                    fill: false,
                },
            ],
        },
        options: {
            scales: {
                x: { title: { display: true, text: 'Time' } },
                y: { beginAtZero: true },
            },
        },
    });
}

// Helper function to sanitize an array of strings or numbers
function sanitizeInputArray(inputArray) {
    if (!Array.isArray(inputArray)) {
        console.error('Invalid data format.');
        return [];
    }

    return inputArray.map(item => sanitizeInput(item));
}

function displayProductComparisonChart(productComparison) {
    if (!productComparison || !productComparison.productNames || !productComparison.itemsSold) {
        console.error("Missing or invalid product comparison data.");
        return;
    }

    const ctx = document.getElementById('product-comparison-chart').getContext('2d');
    if (!ctx) {
        console.error("Product comparison chart canvas element not found.");
        return;
    }

    // Destroy existing chart instance if present
    if (productComparisonChart) {
        productComparisonChart.destroy();
    }

    productComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: productComparison.productNames.map(name => sanitizeInput(name)),
            datasets: [
                {
                    label: 'Total Items Sold',
                    data: productComparison.itemsSold.map(sold => sanitizeInput(sold)),
                    backgroundColor: '#FF5733',
                },
            ],
        },
        options: {
            scales: {
                x: { title: { display: true, text: 'Products' } },
                y: { beginAtZero: true },
            },
        },
    });
}

function displayUserRegistrationChart(userRegistrations) {
    if (!userRegistrations || !userRegistrations.timeLabels || !userRegistrations.newUsers) {
        console.error("Missing or invalid user registration data.");
        return;
    }

    const ctx = document.getElementById('user-registration-chart').getContext('2d');
    if (!ctx) {
        console.error("User registration chart canvas element not found.");
        return;
    }

    // Destroy existing chart instance if present
    if (userRegistrationChart) {
        userRegistrationChart.destroy();
    }

    userRegistrationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: userRegistrations.timeLabels.map(label => sanitizeInput(label)),
            datasets: [
                {
                    label: 'New Users',
                    data: userRegistrations.newUsers.map(user => sanitizeInput(user)),
                    borderColor: '#FF5733',
                    fill: false,
                },
            ],
        },
        options: {
            scales: {
                x: { title: { display: true, text: 'Time' } },
                y: { beginAtZero: true },
            },
        },
    });
}
