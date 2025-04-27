document.getElementById('filter-button').addEventListener('click', fetchFilteredMetrics);

let salesChart, productMetricsChart, productComparisonChart; // Chart instances

async function fetchFilteredMetrics() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const userID = await getCookie(); // Securely retrieve userID using await getCookie()

 

    const params = new URLSearchParams({ startDate, endDate, userID }).toString();
    const url = `${API_URL + '/shop-metrics-user'}?${params}`;

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
        } else {
            console.error('Failed to fetch shop metrics:', data.error);
        }
    } catch (error) {
        console.error('Error fetching shop metrics:', error);
    }
}

function displaySalesOverTimeChart(salesData) {
    if (!salesData || !salesData.timeLabels) {
        console.error("Missing sales data");
        return;
    }

    const ctx = document.getElementById('sales-chart').getContext('2d');

    if (salesChart) {
        salesChart.destroy();
    }

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: salesData.timeLabels,
            datasets: [
                {
                    label: 'Total Amount',
                    data: salesData.totalAmounts || [],
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
        console.error("Missing product metrics data");
        return;
    }

    const ctx = document.getElementById('product-metrics-chart').getContext('2d');

    if (productMetricsChart) {
        productMetricsChart.destroy();
    }

    productMetricsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: productMetrics.timeLabels,
            datasets: [
                {
                    label: 'Total Items Sold',
                    data: productMetrics.itemsSold || [],
                    borderColor: '#3357FF',
                    fill: false,
                },
                {
                    label: 'Stock Remaining',
                    data: productMetrics.stockRemaining || [],
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

function displayProductComparisonChart(productComparison) {
    if (!productComparison || !productComparison.productNames) {
        console.error("Missing product comparison data");
        return;
    }

    const ctx = document.getElementById('product-comparison-chart').getContext('2d');

    if (productComparisonChart) {
        productComparisonChart.destroy();
    }

    productComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: productComparison.productNames,
            datasets: [
                {
                    label: 'Total Items Sold',
                    data: productComparison.itemsSold || [],
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
