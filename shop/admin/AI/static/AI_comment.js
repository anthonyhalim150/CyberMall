const API_URL = 'https://anthonyhalim-150-lu32dxaw4a-uc.a.run.app';

let analyze_btn = document.querySelector('.analyze-btn');
if (analyze_btn){
    analyze_btn.addEventListener('click', function (e) {
        e.preventDefault();

        // Collect comments (you can change this to dynamically fetch from input fields)
        
        // Send POST request to Node.js server
        fetch(`${API_URL}/analyze-comments`, {  // Point to the Node.js server
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                displayAnalysisResults(data.ratings);  // Display results from Flask
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => alert('Error: ' + error.message));
    });
}
let train_btn = document.querySelector('.train-btn');
if (train_btn){
    train_btn.addEventListener('click', function (e) {
        e.preventDefault();
        fetch(`${API_URL}/train-AI`, {
            method: 'POST',
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('Model trained successfully!');
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => alert('Error: ' + error));
    });
}

// Function to display analysis results
function displayAnalysisResults(ratings) {
    const resultContainer = document.getElementById('analysis-result');
    resultContainer.innerHTML = '';  // Clear previous results

    ratings.forEach(result => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.classList.add('mb-3');

        card.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">Comment:</h5>
                <p class="card-text">${result.comment}</p>
                <p><strong>Predicted Importance:</strong> ${result.predicted_importance}</p>
                <p><strong>Predicted Quality:</strong> ${result.predicted_quality}</p>
            </div>
        `;
        resultContainer.appendChild(card);
    });
}
