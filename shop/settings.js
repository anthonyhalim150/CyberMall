
// Fetch user settings from the server
async function applyInitialSettings() {
    const userID = await getCookie(); // Use the shared getCookie function
    if (!userID) {
        alert('User not logged in.');
        window.location.href = sanitizeURL("/login");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/get-user-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userID }),
            credentials: 'include',
        });

        const data = await response.json();
        if (data.success) {
            const { dark_mode, color_scheme } = data.settings;
            document.documentElement.style.setProperty('--primary-color', sanitizeInput(color_scheme));
            document.body.classList.toggle('dark-mode', dark_mode);

            // Update controls to reflect the settings
            document.getElementById('dark-mode-toggle').checked = dark_mode;
            document.getElementById('color-scheme').value = sanitizeInput(color_scheme);
        } else {
            console.error('Error fetching settings:', data.message);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save user settings to the server
async function saveSettings() {
    const userID = await getCookie(); // Use the shared getCookie function
    if (!userID) {
        alert('User not logged in.');
        return;
    }

    const isDarkMode = document.getElementById('dark-mode-toggle').checked;
    const newColorScheme = document.getElementById('color-scheme').value;

    try {
        const response = await fetch(`${API_URL}/save-user-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userID, dark_mode: isDarkMode, color_scheme: newColorScheme }),
            credentials: 'include',
        });

        const data = await response.json();
        if (data.success) {
            alert('Settings saved successfully!');
        } else {
            console.error('Error saving settings:', data.message);
        }
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Apply dynamic changes without saving
function applyDynamicSettings() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', () => {
            document.body.classList.toggle('dark-mode', darkModeToggle.checked);
        });
    }

    const colorScheme = document.getElementById('color-scheme');
    if (colorScheme) {
        colorScheme.addEventListener('input', () => {
            document.documentElement.style.setProperty('--primary-color', colorScheme.value);
        });
    }
}

// Initialize settings
document.addEventListener('DOMContentLoaded', async () => {
    await applyInitialSettings(); // Fetch and apply user settings
    applyDynamicSettings(); // Enable dynamic changes for settings

    const saveSettingsButton = document.getElementById('save-settings');
    if (saveSettingsButton) {
        saveSettingsButton.addEventListener('click', saveSettings); // Save settings on button click
    }
    const back_btn = document.getElementById("back-btn");
    if (back_btn){
    back_btn.addEventListener("click", () => {
        window.location.href = sanitizeURL("/index");
    });
}
});
