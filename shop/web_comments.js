let selectedRating = 0;

async function submitComment(event) {
    event.preventDefault(); // Prevent form reload

    // Ensure user is authenticated
    const userID = await getCookie();

    if (selectedRating === 0) {
        alert('Please add a rating for the website!');
        return;
    }

    // Get form data
    const comment_text = document.getElementById('comment-text').value.trim();

    // Validate form input
    if (!comment_text) {
        alert('Comment cannot be empty.');
        return;
    }

    // Construct the comment object
    const newComment = { userID, comment_text, selectedRating };

    try {
        const response = await fetch(`${API_URL}/add-new-comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newComment),
            credentials: 'include',
        });

        const result = await response.json();
        if (result.success) {
            alert('Comment submitted successfully!');
            document.getElementById('comment-form').reset(); // Clear the form
            const stars = document.querySelectorAll('#star-rating span');
            if (stars) { // Refresh stars
                updateStars(0, stars);
            }
            selectedRating = 0;
        } else {
            alert('Failed to submit comment. Please try again.');
        }
    } catch (error) {
        console.error('Error submitting comment:', error);
        alert('An error occurred. Please try again later.');
    }
}

function updateStars(rating, stars) {
    if (stars) {
        stars.forEach(star => {
            const starValue = parseFloat(star.dataset.value);
            if (starValue <= rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await getCookie();
    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', submitComment);
    }

    const stars = document.querySelectorAll('#star-rating span');
    if (stars) {
        stars.forEach(star => {
            star.addEventListener('click', () => {
                selectedRating = parseFloat(star.dataset.value);
                updateStars(selectedRating, stars);
            });
        });
    }
});
