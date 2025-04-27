from flask import Flask, request, jsonify
import numpy as np
import mysql.connector
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input, MobileNetV2
from tensorflow.keras.preprocessing.image import load_img, img_to_array
import io
import random
import cv2
from PIL import Image
import requests
from sklearn.feature_extraction.text import TfidfVectorizer

# Initialize Flask app
app = Flask(__name__)

# Load Pre-Trained AI Model for Image Feature Extraction
model = MobileNetV2(weights="imagenet", include_top=False, pooling="avg")

# 🔹 DeepAI API Key for Violent/NSFW Content Detection
DEEP_AI_API_KEY = "99a5bc8b-2825-42fe-a5a4-c252a9091b09"

# Database Connection
def get_db_connection():
    return mysql.connector.connect(
        host="34.67.118.54",
        user="root",
        password="Vvs319338",
        database="ecommerce",
        port="3306"
    )

# Pre-trained keywords for game-relevant feature detection
GAME_KEYWORDS = {
    "speed": "Speed Boost",
    "power": "Power Surge",
    "efficiency": "Energy Saver",
    "luck": "Lucky Miner",
    "auto": "Auto-Miner Bonus",
    "laser": "Laser Drill Boost",
    "gold": "Gold Rush"
}

# 🔹 **Violent/NSFW Content Detection**
def is_violent_or_nsfw(image_file):
    """Detects whether an image is violent or inappropriate."""
    try:
        response = requests.post(
            "https://api.deepai.org/api/nsfw-detector",
            files={"image": image_file},
            headers={"api-key": DEEP_AI_API_KEY},
        )
        result = response.json()

        if "output" in result and "nsfw_score" in result["output"]:
            nsfw_score = result["output"]["nsfw_score"]
            if nsfw_score > 0.6:  # 60% confidence threshold
                return True  # Reject the image
        return False  # Safe image
    except Exception as e:
        print(f"Error in NSFW detection: {e}")
        return False  # Default to safe if API fails

# 🔹 **Improved Image Feature Extraction**
def process_image(image_file):
    """Processes the image and extracts features."""

    # Run NSFW & Violence Detection
    if is_violent_or_nsfw(image_file):
        raise ValueError("Image contains violent or inappropriate content.")

    # Load image and preprocess for MobileNetV2
    image = load_img(io.BytesIO(image_file.read()), target_size=(224, 224))
    image_array = img_to_array(image)
    image_array = np.expand_dims(image_array, axis=0)
    image_array = preprocess_input(image_array)

    # Extract features using MobileNetV2
    image_features = model.predict(image_array).flatten()
    aesthetics = round(np.mean(image_features) * 10, 2)  # Aesthetic Score

    # Convert to OpenCV format for advanced processing
    image_cv = np.array(image)
    image_cv = cv2.cvtColor(image_cv, cv2.COLOR_RGB2GRAY)

    # Edge Detection for Complexity Scoring
    edges = cv2.Canny(image_cv, 100, 200)
    complexity = round(np.mean(edges) / 2, 2)

    # Color Variance for Uniqueness Scoring
    color_variance = np.var(image_array)
    uniqueness = round(color_variance / 40, 2) if color_variance > 0 else round(random.uniform(5, 10), 2)

    return aesthetics, complexity, uniqueness

# 🔹 **Text Processing for Game Relevance**
def process_description(description):
    """Analyzes the description for game-relevant features."""
    description_lower = description.lower()

    # Assign Game Relevance Score based on keyword matching
    game_relevance = sum(1 for word in GAME_KEYWORDS if word in description_lower) * 3
    game_relevance = max(game_relevance, round(random.uniform(5, 10), 2))  # Ensure variability

    # Assign Set Bonus based on matched keywords
    set_bonus = [GAME_KEYWORDS[word] for word in GAME_KEYWORDS if word in description_lower]
    set_bonus = ", ".join(set_bonus) if set_bonus else "None"

    return game_relevance, set_bonus

# 🔹 **Similarity Detection with Enhanced Accuracy**
def calculate_similarity(description, existing_descriptions):
    """Detects how similar the new description is to existing items."""
    if not existing_descriptions:
        return 1.0  # No existing items to compare

    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(existing_descriptions + [description])

    similarity_scores = (tfidf_matrix * tfidf_matrix.T).A[-1][:-1]  # Compare last item with others
    highest_similarity = max(similarity_scores, default=0.75)  # Default to 0.75 for uniqueness

    return round(1.0 - highest_similarity, 2)  # Lower similarity = More unique

# 🔹 **Main AI Processing Function**
def analyze_item(image_file, description):
    aesthetics, complexity, uniqueness = process_image(image_file)
    game_relevance, set_bonus = process_description(description)

    # Retrieve existing descriptions from the database
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT description FROM ITEMS")
    existing_descriptions = [row[0] for row in cursor.fetchall()]
    cursor.close()
    conn.close()

    similarity = calculate_similarity(description, existing_descriptions)

    # **Final Mining Power & Efficiency Calculation**
    mining_power = round((complexity + uniqueness) / 2 * similarity, 2)
    mining_efficiency = round((game_relevance + aesthetics) / 2 * similarity, 2)

    return aesthetics, complexity, uniqueness, game_relevance, similarity, mining_power, mining_efficiency, set_bonus

# 🔹 **API Endpoint to Analyze & Store Data**
@app.route('/analyze-item', methods=['POST'])
def analyze_and_store():
    try:
        # Get Form Data
        item_id = request.form.get("item_id")
        description = request.form.get("description")
        image_file = request.files.get("image")

        if not item_id or not description or not image_file:
            return jsonify({"error": "Missing fields"}), 400

        # Analyze the item
        aesthetics, complexity, uniqueness, game_relevance, similarity, mining_power, mining_efficiency, set_bonus = analyze_item(image_file, description)

        # Store Data in GAME_ITEMS Table
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            INSERT INTO GAME_ITEMS (item_id, mining_power, mining_efficiency, aesthetics_score, complexity_score,
            uniqueness_score, game_relevance_score, similarity_score)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (item_id, mining_power, mining_efficiency, aesthetics, complexity, uniqueness, game_relevance, similarity))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"success": True, "mining_power": mining_power, "mining_efficiency": mining_efficiency, "set_bonus": set_bonus})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Run Flask Server
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
