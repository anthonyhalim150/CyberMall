import os
import torch
import torch.nn as nn
import torch.optim as optim
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from sklearn.model_selection import train_test_split
import numpy as np
import re
import json
import mysql.connector
import logging
from transformers import pipeline

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests
# Set up logging
logging.basicConfig(level=logging.INFO)

# Initialize sentiment analysis pipeline
sentiment_model = pipeline(
    "sentiment-analysis",
    model="distilbert/distilbert-base-uncased-finetuned-sst-2-english",
    revision="714eb0f"
)

# Database connection
def get_db_connection():
    """Create a connection to the database."""
    return mysql.connector.connect(
        host="34.67.118.54",
        user="root",
        password="Vvs319338",
        database="ecommerce",
        port= "3306"
    )

def fetch_comments_from_db():
    """Fetch comments from the database."""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT comment, website_rating FROM COMMENTS")
        comments = cursor.fetchall()
        connection.close()
        return comments
    except Exception as e:
        logging.error(f"Database error: {e}")
        return []

def fetch_feedback_from_db():
    """Fetch feedback from the database."""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT c.comment, f.true_importance, f.true_quality FROM FEEDBACK f INNER JOIN COMMENTS c ON f.comments_id = c.comments_id")
        feedback = cursor.fetchall()
        connection.close()
        return feedback
    except Exception as e:
        logging.error(f"Database error: {e}")
        return []

# Read baseline weights from file
def read_baseline_weights(filename='baseline_weight.txt'):
    with open(filename, 'r') as file:
        return json.load(file)

def preprocess_comment(comment, baseline_weights, website_rating=None):
    """Preprocess the comment and calculate importance and quality."""
    importance = 0
    quality = 0
    keywords_found_importance = 0
    keywords_found_quality = 0

    # Tokenize and analyze words
    words = re.findall(r'\b\w+\b', comment.lower())
    for word in words:
        if word in baseline_weights and is_meaningful_keyword(word):
            importance += baseline_weights[word]["importance"]
            keywords_found_importance += 1
            quality += baseline_weights[word]["quality"]
            keywords_found_quality += 1

    # Default importance if no meaningful keywords are found
    if keywords_found_importance == 0:
        importance = 2

    # Normalize importance and quality
    if keywords_found_importance > 0:
        importance /= keywords_found_importance
    if keywords_found_quality > 0:
        quality /= keywords_found_quality

    # Sentiment analysis adjustment
    sentiment = sentiment_model(comment)[0]
    sentiment_label = sentiment["label"]
    sentiment_score = sentiment["score"]

    if sentiment_label == "POSITIVE":
        quality = min(quality + sentiment_score * 2, 5)
        importance = max(importance - sentiment_score, 0)
    elif sentiment_label == "NEGATIVE":
        importance = min(importance + sentiment_score * 2, 5)
        quality = max(quality - sentiment_score, 1)

    # Incorporate website_rating to quality, biar dua2nya efek
    if website_rating is not None:
        diff = website_rating - quality
        scaling_factor = abs(5-abs(diff))*1.5*0.1
        quality += (diff * 0.95) * scaling_factor


    # Clamp values to range [0, 5] for importance and [1, 5] for quality
    importance = max(0, min(importance, 5))
    quality = max(1, min(quality, 5))

    return importance, quality

# Neural network model
class EnhancedRatingModel(nn.Module):
    def __init__(self):
        super(EnhancedRatingModel, self).__init__()
        self.fc1 = nn.Linear(2, 128)
        self.fc2 = nn.Linear(128, 64)
        self.fc3 = nn.Linear(64, 32)
        self.fc4 = nn.Linear(32, 2)
        self.relu = nn.ReLU()

    def forward(self, x):
        x = self.relu(self.fc1(x))
        x = self.relu(self.fc2(x))
        x = self.relu(self.fc3(x))
        x = self.fc4(x)
        return torch.clamp(x, 0, 5)

# Prepare dataset with meaningful keywords
def prepare_dataset(comments_data, baseline_weights, feedback_data=None):
    X = []
    y = []#X, Y harus dipisah
    for data in comments_data:
        comment = data["comment"]
        website_rating = data.get("website_rating")#Pake get karena [] bisa keyerror kalo NULL
        imp, qual = preprocess_comment(comment, baseline_weights, website_rating=website_rating)
        X.append([imp, qual])  # Features: importance and quality
        y.append([imp, qual])  # Targets: importance and quality

    # Incorporate feedback
    if feedback_data:
        for feedback in feedback_data:
            comment = feedback["comment"]
            true_importance = feedback["true_importance"]
            true_quality = feedback["true_quality"]
            imp, qual = preprocess_comment(comment, baseline_weights)
            X.append([imp, qual])
            y.append([true_importance, true_quality])

    X = np.array(X)
    y = np.array(y)
    return (X - X.mean(axis=0)) / X.std(axis=0), y  # Normalize X

# Train model
def train_model(model, X_train, y_train, epochs=50, batch_size=32, model_file="enhanced_model.pth"):
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    for epoch in range(epochs):
        model.train()
        for i in range(0, len(X_train), batch_size):
            X_batch = torch.tensor(X_train[i:i + batch_size], dtype=torch.float32)
            y_batch = torch.tensor(y_train[i:i + batch_size], dtype=torch.float32)

            optimizer.zero_grad()
            outputs = model(X_batch)
            loss = criterion(outputs, y_batch)
            loss.backward()
            optimizer.step()

        if epoch % 10 == 0:
            logging.info(f'Epoch [{epoch + 1}/{epochs}], Loss: {loss.item():.4f}')

    torch.save(model.state_dict(), model_file)
    logging.info(f"Model saved to '{model_file}'.")

# Evaluate model
def evaluate_model(model, comments_data, baseline_weights):
    model.eval()
    X, _ = prepare_dataset(comments_data, baseline_weights)
    X = torch.tensor(X, dtype=torch.float32)

    with torch.no_grad():
        outputs = model(X)
        results = []
        for i, output in enumerate(outputs):
            results.append({
                "comment": comments_data[i]["comment"],
                "predicted_importance": round(output[0].item(), 2),
                "predicted_quality": round(output[1].item(), 2)
            })
        return results

def is_meaningful_keyword(word):
    # Define your logic or use a predefined list of meaningful keywords
    generic_keywords = {"product", "item", "thing", "purchase", "order", "company", "store", "website", "service",
                        "site", "brand", "shop", "business", "experience", "delivery", "customer", "checkout", "shopping",
                        "team", "market", "review", "feedback", "discount", "return", "exchange", "warranty", "support"}
    return word.isalpha() and word not in generic_keywords

# Flask routes
@app.route('/')
def home():
    """Render home page."""
    return render_template('AI_comment.html')

@app.route('/train-enhanced', methods=['POST'])
def train_enhanced():
    comments_data = fetch_comments_from_db()
    feedback_data = fetch_feedback_from_db()
    if not comments_data:
        return jsonify({"status": "error", "message": "No comments found for training."})

    baseline_weights = read_baseline_weights()
    X, y = prepare_dataset(comments_data, baseline_weights, feedback_data)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = EnhancedRatingModel()
    train_model(model, X_train, y_train, epochs=100)
    return jsonify({"status": "success", "message": "Enhanced model trained successfully."})

@app.route('/analyze', methods=['POST'])
def analyze_enhanced():
    comments_data = fetch_comments_from_db()
    if not comments_data:
        return jsonify({"status": "error", "message": "No comments found in the database."})

    baseline_weights = read_baseline_weights()
    model = EnhancedRatingModel()
    model.load_state_dict(torch.load("enhanced_model.pth"))
    results = evaluate_model(model, comments_data, baseline_weights)
    return jsonify({"status": "success", "ratings": results})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))  # Default to 8080 if PORT is not set
    app.run(host='0.0.0.0', port=port, debug=False)
