# Use a specific Python version that is compatible with PyTorch (e.g., 3.9)
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose the port Flask will use
EXPOSE 8080

# Command to run the application
CMD ["python", "app.py"]
