require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise'); // Promise-based MySQL
const bodyParser = require('body-parser');
const cors = require('cors'); // Handle cross-origin requests
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer'); // For file uploads
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const { NONAME } = require('dns');
const axios = require('axios');
const cookieParser = require("cookie-parser");


// Secret key for JWT
const JWT_SECRET = 'blabla729wwdee302!2-';
// Path to the service account key file
const keyFilePath = path.join(__dirname, 'keyfile.json');

// Bucket configuration
const bucketName = 'my-product-images-shop'; // Replace with your bucket name

// Initialize Google Cloud Storage

// Google Cloud Storage setup
const storage = new Storage({ keyFilename: keyFilePath });
const bucket = storage.bucket(bucketName);

// Multer setup for local file handling
const upload = multer({
    storage: multer.memoryStorage(), // Temporarily store files in memory
});



// Express app setup
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Enable cookie parsing


// CORS configuration
/*app.use(cors({
    origin: (origin, callback) => {
        if (!origin || origin.startsWith('https://')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
}));
*/
const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500", // Add localhost for testing
    /^https:\/\/testinghellow/, // Production domains
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.some((allowed) => {
            return typeof allowed === "string"
                ? allowed === origin
                : allowed.test(origin); // Check regex match
        })) {
            callback(null, true); // Allow the request
        } else {
            callback(new Error("Not allowed by CORS")); // Block the request
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed HTTP methods
    credentials: true, // Allow cookies and credentials
}));





app.use(bodyParser.json());

const pool = mysql.createPool({
    host: '34.67.118.54'||process.env.DB_HOST,
    user: 'root'||process.env.DB_USER,
    password: ''||process.env.DB_PASSWORD,
    database: 'ecommerce'||process.env.DB_NAME,
    port: '3306'||process.env.DB_PORT,
});

const authenticateToken = (req, res, next) => {
    if (req.path === "/signup" || req.path === "/login") {
        console.log("Skipping token authentication for /signup and /login endpoint.");
        return next(); // Bypass the middleware for /signup
    }
    const token = req.cookies.authToken;
    
    console.log("Received Token:", token); // Log the token for debugging

    if (!token) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("Token verification failed:", err.message);
            return res.status(403).json({ message: "Forbidden: Invalid token" });
        }
        req.user = user; // Attach user to request
        next();
    });
};
app.use(authenticateToken);

// Fetch items for the shop
app.get('/items', async (req, res) => {
    const userID = req.query.userID; // Get userID from query parameter

    // Validate userID if required (optional)
    if (!userID) {
        return res.status(400).json({ success: false, error: 'UserID is required.' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const query = `
                SELECT * FROM ITEMS
                WHERE created_by = ?`; 
  
            const [results] = await connection.query(query, [userID]);
            res.json({ success: true, items: results });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching items:', error);
        res.json({ success: false, error: 'Error fetching items.' });
    }
});



app.get('/shop-metrics', async (req, res) => {
    const { startDate, endDate, userID } = req.query;
    
    // Ensure userID is provided
    if (!userID) {
        return res.status(400).json({ success: false, error: 'UserID is required.' });
    }

    const connection = await pool.getConnection();

    try {
        const conditions = [];
        const values = [];

        // Add conditions based on query parameters
        if (startDate) {
            conditions.push('TRANSACTIONS.created_at >= ?');
            values.push(startDate);
        }
        if (endDate) {
            conditions.push('TRANSACTIONS.created_at <= ?');
            values.push(endDate);
        }

        // Filter by userID (products created by the user)
        conditions.push('ITEMS.created_by = ?');
        values.push(userID);

        // Build WHERE clause dynamically
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Query for sales over time
        const [salesOverTime] = await connection.query(`
            SELECT DATE(TRANSACTIONS.created_at) AS timeLabel, 
                   COUNT(TRANSACTIONS.transaction_id) AS totalTransactions,
                   SUM(TRANSACTIONS.total_amount) AS totalAmounts
            FROM TRANSACTIONS
            JOIN SALE_ITEMS ON SALE_ITEMS.transaction_id = TRANSACTIONS.transaction_id
            JOIN ITEMS ON SALE_ITEMS.item_id = ITEMS.id
            ${whereClause}
            GROUP BY DATE(TRANSACTIONS.created_at)
            ORDER BY DATE(TRANSACTIONS.created_at)
        `, values);

        // Query for product metrics over time
        const [productMetricsOverTime] = await connection.query(`
            SELECT DATE(TRANSACTIONS.created_at) AS timeLabel,
                   SUM(SALE_ITEMS.quantity) AS itemsSold,
                   IFNULL(SUM(ITEMS.stock), 0) AS stockRemaining
            FROM SALE_ITEMS
            JOIN ITEMS ON SALE_ITEMS.item_id = ITEMS.id
            JOIN TRANSACTIONS ON SALE_ITEMS.transaction_id = TRANSACTIONS.transaction_id
            ${whereClause}
            GROUP BY DATE(TRANSACTIONS.created_at)
            ORDER BY DATE(TRANSACTIONS.created_at)
        `, values);

        // Query for product comparison
        const [productComparison] = await connection.query(`
            SELECT ITEMS.name AS productName,
                   SUM(SALE_ITEMS.quantity) AS itemsSold
            FROM SALE_ITEMS
            JOIN ITEMS ON SALE_ITEMS.item_id = ITEMS.id
            ${whereClause}
            GROUP BY ITEMS.name
            ORDER BY ITEMS.name
        `, values);

        // Construct and send the response
        res.json({
            success: true,
            salesOverTime: {
                timeLabels: salesOverTime.map(row => row.timeLabel),
                totalAmounts: salesOverTime.map(row => row.totalAmounts),
            },
            productMetricsOverTime: {
                timeLabels: productMetricsOverTime.map(row => row.timeLabel),
                itemsSold: productMetricsOverTime.map(row => row.itemsSold),
                stockRemaining: productMetricsOverTime.map(row => row.stockRemaining),
            },
            productComparison: {
                productNames: productComparison.map(row => row.productName),
                itemsSold: productComparison.map(row => row.itemsSold),
            },
        });        
    } catch (error) {
        console.error('Error fetching shop metrics:', error);
        res.status(500).json({ success: false, error: 'No data found.' });
    } finally {
        connection.release();
    }
});




app.post('/add-new-product', upload.single('product-image'), async (req, res) => {
    const { name, category, price, stock, description } = req.body;

    // Validate required fields
    if (!name || !category || !price || !stock || !req.file || !description) {
        return res.status(400).json({ success: false, error: 'All fields are required.' });
    }

    // Ensure `price` and `stock` are valid numbers
    if (isNaN(price) || isNaN(stock)) {
        return res.status(400).json({ success: false, error: 'Price and stock must be valid numbers.' });
    }

    try {
        // Generate a unique file name
        const uniqueName = `Products/${Date.now()}${path.extname(req.file.originalname)}`;
        
        // Upload the file to Google Cloud Storage
        const blob = bucket.file(uniqueName);
        const blobStream = blob.createWriteStream({
            metadata: {
                contentType: req.file.mimetype, // Set the content type
            },
        });

        blobStream.on('error', (error) => {
            console.error('Upload failed:', error.message);
            res.status(500).json({ success: false, error: 'Upload failed.', details: error.message });
        });

        blobStream.on('finish', async () => {
            const imagePath = `https://storage.googleapis.com/${bucketName}/${uniqueName}`;
            
            try {
                const connection = await pool.getConnection();

                try {
                    // Insert product details into the database
                    const query = `
                        INSERT INTO ITEMS (name, category, price, stock, image, description) 
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;
                    const values = [name, category, price, stock, imagePath, description];

                    await connection.query(query, values);
                    res.status(200).json({ success: true, message: 'Product added successfully!' });
                } finally {
                    connection.release();
                }
            } catch (error) {
                console.error('Database error:', error.message);
                res.status(500).json({ success: false, error: 'Internal server error.', details: error.message });
            }
        });

        blobStream.end(req.file.buffer); // End the stream and upload the file
    } catch (error) {
        console.error('Error handling request:', error.message);
        res.status(500).json({ success: false, error: 'Internal server error.', details: error.message });
    }
});


app.put('/items/:id', upload.single('product-image'), async (req, res) => {
    const productId = req.params.id;
    const { name, price, stock, description, category } = req.body;

    try {
        const connection = await pool.getConnection();

        try {
            // Fetch the existing image URL
            const [rows] = await connection.query('SELECT image FROM ITEMS WHERE id = ?', [productId]);

            if (rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Product not found.' });
            }

            const oldImageUrl = rows[0].image;
            const oldImageName = oldImageUrl ? oldImageUrl.split('/').slice(-2).join('/') : null; // Extract the file name from the URL

            // Handle new image upload
            let newImagePath = oldImageUrl;
            if (req.file) {
                const uniqueName = `Products/${Date.now()}${path.extname(req.file.originalname)}`;
                const blob = bucket.file(uniqueName);
                const blobStream = blob.createWriteStream({
                    metadata: { contentType: req.file.mimetype },
                });

                await new Promise((resolve, reject) => {
                    blobStream.on('error', reject);
                    blobStream.on('finish', resolve);
                    blobStream.end(req.file.buffer);
                });

                newImagePath = `https://storage.googleapis.com/${bucketName}/${uniqueName}`;

                // Remove the old image from Google Cloud Storage
                if (oldImageName) {
                    await bucket.file(oldImageName).delete().catch((err) => {
                        console.error('Error deleting old image:', err.message);
                    });
                }
            }

            // Update product details in the database
            const updateQuery = `
                UPDATE ITEMS
                SET name = ?, price = ?, stock = ?, description = ?, category = ?, image = ?
                WHERE id = ?
            `;
            const [result] = await connection.query(updateQuery, [
                name,
                price,
                stock,
                description,
                category,
                newImagePath,
                productId,
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Product not found.' });
            }

            res.status(200).json({ success: true, message: 'Product updated successfully!' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating product:', error.message);
        res.status(500).json({ success: false, error: 'Failed to update product.', details: error.message });
    }
});


app.get('/transactions', async (req, res) => {
    const userID = req.query.userID;  // Get userID from query parameter

    // Validate userID
    if (!userID) {
        return res.status(400).json({ success: false, error: 'UserID is required.' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const query = `
                SELECT 
                    t.transaction_id, 
                    u.username, 
                    t.total_amount, 
                    t.created_at,
                    GROUP_CONCAT(CONCAT('Item: ', i.name, ', Quantity: ', s.quantity, ', Price: $', FORMAT(s.price, 2)) SEPARATOR '\n') AS description
                FROM TRANSACTIONS t
                JOIN USERS u ON t.user_id = u.id
                JOIN SALE_ITEMS s ON t.transaction_id = s.transaction_id
                JOIN ITEMS i ON s.item_id = i.id
                WHERE i.created_by = ?  -- Only include items created by the given user
                GROUP BY t.transaction_id
                ORDER BY t.created_at DESC;
            `;
            const [results] = await connection.query(query, [userID]);
            res.json(results);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch transactions.' });
    }
});


app.get('/comments', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const query = `
                SELECT 
                    u.username, 
                    c.comments_id,
                    c.comment, 
                    c.created_at
                FROM COMMENTS c
                JOIN USERS u ON c.user_id = u.id
                ORDER BY c.created_at DESC;
            `;
            const [results] = await connection.query(query);
            res.json({success: true, items:results}); //Biar organized, sends the results in key-value pair jdi ada clear structure for response, not just send the value, also tells the system whether it is successful or not.
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch comments.' });
    }
});

app.post('/feedback', async (req, res) => {
    const { comments_id, true_importance, true_quality } = req.body;

    if (!comments_id || true_importance === undefined || true_quality === undefined) {
        return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const query = `
                INSERT INTO FEEDBACK (comments_id, true_importance, true_quality) 
                VALUES (?, ?, ?)
            `;
            await connection.query(query, [comments_id, true_importance, true_quality]);
            res.json({ success: true, message: 'Feedback added successfully.' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error inserting feedback:', error);
        res.status(500).json({ success: false, error: 'Failed to add feedback.' });
    }
});



app.post('/analyze-comments', async (req, res) => {
    try {
        const comments = req.body.comments || []; // Ensure comments are passed, klo empty error
        console.log('Sending comments to Flask for analysis:', comments);

        const flaskResponse = await axios.post('https://ai-723848267249.us-central1.run.app/analyze', req.body);//Gabisa pake localhost

        console.log('Response from Flask:', flaskResponse.data);  // Log the response data

        // Check if the response from Flask is valid JSON
        if (flaskResponse.data && flaskResponse.data.status === 'success') {
            res.status(flaskResponse.status).json(flaskResponse.data);
        } else {
            throw new Error('Invalid response from Flask');
        }
    } catch (error) {
        console.error('Error communicating with Flask:', error.message);
        res.status(500).json({ success: false, error: 'Failed to analyze comments.' });
    }
});


app.post('/train-AI', async (req, res) => {
    try {
        const comments = req.body.comments || []; // Ensure comments are passed
        console.log('Sending comments to Flask for analysis:', comments);

        const flaskResponse = await axios.post('https://ai-723848267249.us-central1.run.app/train-enhanced', req.body);//Gabisa pake localhost

        console.log('Response from Flask:', flaskResponse.data);  // Log the response data

        // Check if the response from Flask is valid JSON
        if (flaskResponse.data && flaskResponse.data.status === 'success') {
            res.status(flaskResponse.status).json(flaskResponse.data);
        } else {
            throw new Error('Invalid response from Flask');
        }
    } catch (error) {
        console.error('Error communicating with Flask:', error.message);
        res.status(500).json({ success: false, error: 'Failed to analyze comments.' });
    }
});


app.put('/auction-items/:id', upload.single('product-image'), async (req, res) => {
    const auctionItemId = req.params.id;
    const { name, price, stock, description, category, duration, time } = req.body;
    let starting_time;
    if (time){
        starting_time = new Date(time);
    }
    try {
        const connection = await pool.getConnection();

        try {
            // Fetch the existing image URL
            const [rows] = await connection.query('SELECT image FROM AUCTION_ITEMS WHERE id = ?', [auctionItemId]);

            if (rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Auction item not found.' });
            }

            const oldImageUrl = rows[0].image;
            const oldImageName = oldImageUrl ? oldImageUrl.split('/').slice(-2).join('/') : null; // Extract the file name from the URL

            // Handle new image upload
            let newImagePath = oldImageUrl;
            if (req.file) {
                const uniqueName = `AuctionItems/${Date.now()}${path.extname(req.file.originalname)}`;
                const blob = bucket.file(uniqueName);
                const blobStream = blob.createWriteStream({
                    metadata: { contentType: req.file.mimetype },
                });

                await new Promise((resolve, reject) => {
                    blobStream.on('error', reject);
                    blobStream.on('finish', resolve);
                    blobStream.end(req.file.buffer);
                });

                newImagePath = `https://storage.googleapis.com/${bucketName}/${uniqueName}`;

                // Remove the old image from Google Cloud Storage
                if (oldImageName) {
                    await bucket.file(oldImageName).delete().catch((err) => {
                        console.error('Error deleting old image:', err.message);
                    });
                }
            }

            // Update auction item details in the database
            const updateQuery = `
                UPDATE AUCTION_ITEMS
                SET item_name = ?, starting_price = ?, stock = ?, description = ?, category = ?, duration = ?, image = ?, starting_time = ?
                WHERE id = ?
            `;
            const [result] = await connection.query(updateQuery, [
                name,
                price,
                stock,
                description,
                category,
                duration,
                newImagePath,
                starting_time || null,
                auctionItemId,
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Auction item not found.' });
            }

            res.status(200).json({ success: true, message: 'Auction item updated successfully!' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating auction item:', error.message);
        res.status(500).json({ success: false, error: 'Failed to update auction item.', details: error.message });
    }
});


app.get('/auctions', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const query = `SELECT * FROM AUCTION_ITEMS`;
            const [results] = await connection.query(query);
            res.json({ success: true, items: results });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching items:', error);
        res.json({ success: false, error: 'Error fetching items.' });
    }
});
app.post("/add-new-auction", upload.single("product-image"), async (req, res) => {
    const { name, price, starting_time, description, stock, category, duration } = req.body;
    let time;
    if (starting_time){
        time = new Date(starting_time);
    }
  
    // Validate inputs
    if (!name || !price || price <= 0 || !stock || stock <= 0 || !description || !req.file || !category || !duration || duration <= 0) {
      return res.status(400).json({ success: false, error: "All fields are required, and price/stock/duration must be positive numbers." });
    }
  
    try {
      // Generate a unique name for the uploaded image
      const uniqueName = `AuctionItems/${Date.now()}${path.extname(req.file.originalname)}`;
      const blob = bucket.file(uniqueName);
  
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: req.file.mimetype,
        },
      });
  
      blobStream.on("error", (error) => {
        console.error("Upload failed:", error.message);
        res.status(500).json({ success: false, error: "Image upload failed." });
      });
  
      blobStream.on("finish", async () => {
        const imageUrl = `https://storage.googleapis.com/${bucketName}/${uniqueName}`;
  
        try {
          const connection = await pool.getConnection();
          try {
            const query = `
              INSERT INTO AUCTION_ITEMS (item_name, stock, description, category, image, starting_price, duration, starting_time) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const values = [name, stock, description, category, imageUrl, price, duration, time||null];
  
            const [result] = await connection.query(query, values);
            res.status(201).json({
              success: true,
              message: "Auction item added successfully!",
              itemID: result.insertId,
            });
          } finally {
            connection.release();
          }
        } catch (error) {
          console.error("Database error:", error.message);
          res.status(500).json({ success: false, error: "Failed to add auction item." });
        }
      });
  
      blobStream.end(req.file.buffer);
    } catch (error) {
      console.error("Error handling request:", error.message);
      res.status(500).json({ success: false, error: "Internal server error." });
    }
  });


app.get("/expired-auction", async (req, res) => {
    const userID = req.query.userID; // Get the userID from the query string

    // If userID is required for this route, validate it
    if (!userID) {
        return res.status(400).json({ success: false, error: 'UserID is required.' });
    }
    const query = `
    SELECT * 
    FROM AUCTION_ITEMS 
    WHERE is_expired = TRUE
    AND created_by = ?`;//NOW() is guranteed to be the server date and cannot be manipulated
  
    try {
      const connection = await pool.getConnection();
      try {
        const [results] = await connection.query(query, [userID]);
        res.json({ success: true, items: results });
      } finally {
        connection.release();
      }
    } catch (err) {
      console.error("Error fetching auction items:", err);
      res.status(500).json({ error: "Database query failed" });
    }
});
//TBA auctions
app.get("/upcoming-auction", async (req, res) => {
    const userID = req.query.userID; // Get userID from query parameter

    // Validate userID
    if (!userID) {
        return res.status(400).json({ success: false, error: 'UserID is required.' });
    }

    const query = `
    SELECT * 
    FROM AUCTION_ITEMS 
    WHERE (starting_time > NOW() OR starting_time IS NULL) 
    AND created_by = ?`; // Use ? placeholder for userID
  
    try {
        const connection = await pool.getConnection();
        try {
            // Pass userID as the value for the placeholder
            const [results] = await connection.query(query, [userID]);
            res.json({ success: true, items: results });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error("Error fetching upcoming auction items:", err);
        res.status(500).json({ error: "Database query failed" });
    }
});

//Ongoing auctions
app.get("/auction", async (req, res) => {
    const userID = req.query.userID; // Get userID from query parameter

    // Validate userID
    if (!userID) {
        return res.status(400).json({ success: false, error: 'UserID is required.' });
    }

    const query = `
    SELECT * 
    FROM AUCTION_ITEMS 
    WHERE (starting_time + INTERVAL duration SECOND) > NOW() 
    AND starting_time < NOW() 
    AND created_by = ?`; // Use ? placeholder for userID
  
    try {
        const connection = await pool.getConnection();
        try {
            // Pass userID as the value for the placeholder
            const [results] = await connection.query(query, [userID]);
            res.json({ success: true, items: results });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error("Error fetching ongoing auction items:", err);
        res.status(500).json({ error: "Database query failed" });
    }
});


app.post('/update-address', async (req, res) => {
    const { userID, walletAddress } = req.body;

    if (!userID || !walletAddress) {
        return res.status(400).json({ success: false, error: 'User ID and wallet address are required.' });
    }

    const connection = await pool.getConnection();

    try {
        const [result] = await connection.query(
            'UPDATE USERS SET address = ? WHERE id = ?',
            [walletAddress, userID]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating wallet address:', error);
        res.status(500).json({ success: false, error: 'Database error.' });
    } finally {
        connection.release();
    }
});

app.post('/update-wallet', async (req, res) => {
    let { userID, amount } = req.body;

    if (!userID || !amount) {
        return res.status(400).json({ success: false, error: 'User ID and amount are required.' });
    }
    amount = parseFloat(amount);

    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid amount.' });
    }

    const connection = await pool.getConnection();

    try {
        const [result] = await connection.query(
            'UPDATE USERS SET wallet = wallet + ? WHERE id = ?',
            [amount, userID]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error depositing:', error);
        res.status(500).json({ success: false, error: 'Database error.' });
    } finally {
        connection.release();
    }
});

// Endpoint to get the wallet balance
app.get('/get-wallet', async (req, res) => {
    const userID = req.query.userID; // Get userID from query parameter

    // Validate userID
    if (!userID) {
        return res.status(400).json({ success: false, error: 'UserID is required.' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const query = `
                SELECT wallet FROM USERS
                WHERE id = ?`; // Replace `id` with your user identifier column name if different
  
            const [results] = await connection.query(query, [userID]);

            if (results.length > 0) {
                res.json({ success: true, wallet: results[0].wallet });
            } else {
                res.status(404).json({ success: false, error: 'User not found.' });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).json({ success: false, error: 'Error fetching wallet.' });
    }
});

// Endpoint to get the wallet address
app.get('/get-address', async (req, res) => {
    const userID = req.query.userID; // Get userID from query parameter

    // Validate userID
    if (!userID) {
        return res.status(400).json({ success: false, error: 'UserID is required.' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const query = `
                SELECT address FROM USERS
                WHERE id = ?`; // Replace `id` with your user identifier column name if different
  
            const [results] = await connection.query(query, [userID]);

            if (results.length > 0) {
                res.json({ success: true, address: results[0].address });
            } else {
                res.status(404).json({ success: false, error: 'User not found.' });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching address:', error);
        res.status(500).json({ success: false, error: 'Error fetching address.' });
    }
});

app.post('/wallet-checkout', async(req, res)=> {
    const { userID, amount } = req.body;
    if (!userID || !amount){
        return res.status(400).json({ success: false, error: 'UserID and amount is required.' });
    }
    try {
        const connection = await pool.getConnection();
        try {
            const query = 
                `UPDATE USERS
                 SET wallet = wallet - ?
                 WHERE id = ?`; // Replace `id` with your user identifier column name if different
  
            const [results] = await connection.query(query, [amount,userID]);

            if (results.affectedRows > 0) {
                res.json({ success: true});
            } else {
                res.status(404).json({ success: false, error: 'User not found.' });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).json({ success: false, error: 'Error fetching wallet.' });
    }

});
app.post('/withdraw', async (req, res) => {
    const { userID, amount } = req.body;

    if (!userID || !amount) {
        return res.status(400).json({ message: "User ID and amount are required." });
    }

    const connection = await pool.getConnection();

    try {
        // Start database transaction
        await connection.beginTransaction();

        // Check the user's current wallet balance and address
        const [rows] = await connection.query('SELECT wallet, address FROM USERS WHERE id = ?', [userID]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const currentBalance = parseFloat(rows[0].wallet);
        const userAddress = rows[0].address;

        if (currentBalance < amount) {
            return res.status(400).json({ message: "Insufficient balance." });
        }

        // Call Flask endpoint for blockchain withdrawal
        try {
            const flaskResponse = await axios.post(`https://crypto-723848267249.us-central1.run.app/withdraw`, {
                address: userAddress,
                amount: amount,
            });

            // Check if the Flask API succeeded
            if (flaskResponse.data.status !== 'success') {
                throw new Error("Blockchain withdrawal failed.");
            }

            // Deduct the amount from the wallet only after Flask withdrawal succeeds
            const newBalance = currentBalance - amount;
            await connection.query('UPDATE USERS SET wallet = ? WHERE id = ?', [newBalance, userID]);

            // Commit the database transaction
            await connection.commit();

            // Return success response
            return res.json({
                message: "Withdrawal successful.",
                newBalance,
                blockchainTransaction: flaskResponse.data,
            });
        } catch (flaskError) {
            console.error("Error in Flask withdraw API:", flaskError.response?.data || flaskError.message);
            throw new Error("Blockchain withdrawal failed.");
        }
    } catch (error) {
        // Rollback transaction on any failure
        await connection.rollback();
        console.error("Error processing withdrawal:", error.message);
        return res.status(500).json({ error: error.message });
    } finally {
        connection.release(); // Ensure connection is always released
    }
});

// Start server
const PORT = 8080||process.env.PORT; // Cloud Run will use the PORT environment variable
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});