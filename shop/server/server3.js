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
    host: ''||process.env.DB_HOST,
    user: 'root'||process.env.DB_USER,
    password: ''||process.env.DB_PASSWORD,
    database: 'ecommerce'||process.env.DB_NAME,
    port: '3306'||process.env.DB_PORT,
});

// Middleware to Authenticate Token from Cookies
const authenticateToken = (req, res, next) => {
    if (req.path === "/signup" || req.path === "/login") {
        console.log("Skipping token authentication for /signup, /login endpoint.");
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

// Sign-up route
app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.json({ success: false, error: 'All fields are required.' });
    }
    if (password.length < 8 || !/\d/.test(password)) {
        return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long and include a number.' });
    }    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const connection = await pool.getConnection();
        try {
            const query = `INSERT INTO USERS (username, email, password) VALUES (?, ?, ?)`;
            await connection.query(query, [username, email, hashedPassword]);
            res.json({ success: true });
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.message.includes('username')) {
                // Handle duplicate username error
                console.error('Duplicate username error:', error);
                res.status(400).json({ success: false, error: 'Username already exists.' });
            } else if (error.message.includes('email')) {
                // Handle duplicate email error
                console.error('Duplicate email error:', error);
                res.status(400).json({ success: false, error: 'Email already exists.' });
            } else {
                // General duplicate entry error
                console.error('Duplicate entry error:', error);
                res.status(400).json({ success: false, error: 'Duplicate entry detected.' });
            }
        }
        else {
            // Handle other errors
            console.error('Error signing up:', error);
            res.status(500).json({ success: false, error: 'Internal server error.' });
        }
    }
});




// Backend endpoint to clear the authToken cookie
app.post('/logout', (req, res) => {
    res.clearCookie('authToken', {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        path: "/", // Ensure the path matches where the cookie was set
    });
    res.clearCookie('txid', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
    });

    res.clearCookie('amount', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
    });
    res.clearCookie('transaction_amount', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
    });

    res.clearCookie('assetId', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
    });

    res.clearCookie('recipientAddress', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
    });

    res.clearCookie('note', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
    });
    res.clearCookie('transaction_id', {
        httpOnly: true,
        secure: true, // Ensures the cookie is only sent over HTTPS
        sameSite: 'None', // Allows cross-site cookie sharing
        path: '/', // Matches the path where the cookie was set
    });   
    res.clearCookie('type', {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        path: '/', // Matches the path where the cookie was set
    });
     
    res.status(200).json({ message: 'Logged out successfully' });
});



// Login Endpoint
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const connection = await pool.getConnection();
        try {
            // Fetch the user by username
            const query = `SELECT * FROM USERS WHERE username = ?`;
            const [results] = await connection.query(query, [username]);

            // Check if the user exists
            if (results.length === 0) {
                return res.status(401).json({ success: false, error: "Invalid username or password." });
            }

            const user = results[0];

            // Verify the password
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ success: false, error: "Invalid username or password." });
            }

            // Generate a JWT with the user's ID, username, and role
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: "2h" } // Token expires in 2 hours
            );
            console.log(token);

            // Send the token in an HTTP-only cookie
            res.clearCookie('authToken', {
                httpOnly: true,
                secure: true,
                sameSite: "None",
                path: "/", // Ensure the path matches where the cookie was set
            });
            res.cookie("authToken", token, {
                httpOnly: true,
                secure: true,
                sameSite: "None",
                maxAge: 48 * 60 * 60 * 1000,
                path: "/",
            });

            // Optionally return additional information (not the token)
            res.status(200).json({
                success: true,
                userID: user.id,
                role: user.role,
                username: user.username,
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ success: false, error: "Internal server error." });
    }
});




// Example Protected Route
app.get("/protected", authenticateToken, (req, res) => {
    res.json({ message: "This is a protected route", user: req.user });
});
app.get("/me", authenticateToken, (req, res) => {
    // `req.user` is set by the authenticateToken middleware
    res.status(200).json({ success: true, user: req.user });
});

app.post('/start-transaction', (req, res) => {
    const { address, transaction_amount, note} = req.body;

    if (!address || !transaction_amount || !note) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Set cookies for transaction details
    res.cookie('recipientAddress', address, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: "None",
    });
    res.cookie('transaction_amount', transaction_amount, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: "None",
    });
    res.cookie('note', note, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: "None",
    });
    res.json({ success: true, message: 'Transaction initiated' });
});
app.get('/get-transaction-details', (req, res) => {
    const { recipientAddress, transaction_amount, note} = req.cookies;
    // Ensure all required cookies are present
    if (!recipientAddress || !transaction_amount || !note) {
        return res.status(400).json({ error: 'Required transaction details are missing.' });
    }
    res.json({
        recipientAddress,
        transaction_amount,
        note,
    });
});
app.get('/get-all-transactions', (req, res) => {
    const { txid, amount, assetId, recipientAddress, note } = req.cookies;

    // Ensure all required cookies are present
    if (!txid || !amount || !assetId || !recipientAddress || !note) {
        return res.status(400).json({ error: 'Some required cookies are missing.' });
    }

    res.json({
        success: true,
        txid,
        amount,
        assetId,
        recipientAddress,
        note,
    });
});




app.get('/all-items', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const query = `SELECT * FROM ITEMS`;
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
app.get("/ongoing-auction-user", async (req, res) => {
    const userID = req.query.userID; 
    const query = `
    SELECT * 
    FROM AUCTION_ITEMS 
    WHERE (starting_time + INTERVAL duration SECOND) > NOW() AND starting_time < NOW() AND created_by = ?
    `;//NOW() is guranteed to be the server date and cannot be manipulated
  
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
app.get("/auction", async (req, res) => {
    const userID = req.query.userID; 
    const query = `
    SELECT * 
    FROM AUCTION_ITEMS 
    WHERE (starting_time + INTERVAL duration SECOND) > NOW() AND starting_time < NOW() AND created_by != ?
    `;//NOW() is guranteed to be the server date and cannot be manipulated
  
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
// Fetch items for the shop
app.get('/items', async (req, res) => {
    try {
        const userID = req.query.userID; 
        const connection = await pool.getConnection();
        try {
            const query = `SELECT * FROM ITEMS WHERE created_by != ?`;
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

app.get('/users', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const query = `SELECT * FROM USERS`;
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
// Fetch cart items
app.get('/cart-items', async (req, res) => {
    const userID = req.query.userID;

    if (!userID) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const [cart] = await connection.query(
                'SELECT cart_id FROM CART WHERE user_id = ?',
                [userID]
            );

            if (cart.length === 0) {
                return res.json({ success: true, cartItems: [] });
            }

            const cartID = cart[0].cart_id;
            const [cartItems] = await connection.query(
                `SELECT i.id, ci.cart_item_id, ci.item_id, i.name, ci.quantity, ci.price, i.stock, i.image, i.description, i.category
                 FROM CARTITEMS ci
                 JOIN ITEMS i ON ci.item_id = i.id
                 WHERE ci.cart_id = ?`,
                [cartID]
            );

            res.json({ success: true, cartItems });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching cart items:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch cart items' });
    }
});

// Add to cart
app.post('/cart', async (req, res) => {
    const { userID, itemID, quantity } = req.body;

    if (!userID || !itemID || !quantity || quantity <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid request data' });
    }
    console.log(userID);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [existingCart] = await connection.query(
            'SELECT cart_id FROM CART WHERE user_id = ?',
            [userID]
        );

        let cartID;
        if (existingCart.length > 0) {
            cartID = existingCart[0].cart_id;
        } else {
            const [cartResult] = await connection.query(
                'INSERT INTO CART (user_id) VALUES (?)',
                [userID]
            );
            cartID = cartResult.insertId;
        }

        const [existingCartItem] = await connection.query(
            'SELECT cart_item_id, quantity FROM CARTITEMS WHERE cart_id = ? AND item_id = ?',
            [cartID, itemID]
        );

        const [itemDetails] = await connection.query(
            'SELECT price FROM ITEMS WHERE id = ?',
            [itemID]
        );
        if (itemDetails.length === 0) {
            throw new Error('Item not found in database.');
        }

        const price = itemDetails[0].price;

        if (existingCartItem.length > 0) {
            const newQuantity = existingCartItem[0].quantity + quantity;
            await connection.query(
                'UPDATE CARTITEMS SET quantity = ?, price = ? WHERE cart_item_id = ?',
                [newQuantity, price, existingCartItem[0].cart_item_id]
            );
        } else {
            await connection.query(
                'INSERT INTO CARTITEMS (cart_id, item_id, quantity, price) VALUES (?, ?, ?, ?)',
                [cartID, itemID, quantity, price]
            );
        }

        await connection.commit();
        res.json({ success: true, message: 'Item added to cart.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error adding to cart:', error);
        res.status(500).json({ success: false, error: 'Failed to add item to cart.' });
    } finally {
        connection.release();
    }
});

app.post('/clear-cart', async (req, res) => {
    const { userID } = req.body;

    if (!userID) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check if the user has a cart
        const [existingCart] = await connection.query(
            'SELECT cart_id FROM CART WHERE user_id = ?',
            [userID]
        );

        if (existingCart.length === 0) {
            return res.status(404).json({ success: false, error: 'Cart not found' });
        }

        const cartID = existingCart[0].cart_id;

        // Delete all items from the cart
        await connection.query(
            'DELETE FROM CARTITEMS WHERE cart_id = ?',
            [cartID]
        );
        await connection.query(
            'DELETE FROM CART WHERE cart_id = ?',
            [cartID]
        );

        await connection.commit();
        res.json({ success: true, message: 'Cart cleared successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error clearing cart:', error);
        res.status(500).json({ success: false, error: 'Failed to clear cart.' });
    } finally {
        connection.release();
    }
});
app.post('/remove-cart-item', async (req, res) => {
    const { userID, itemID } = req.body;

    if (!userID || !itemID) {
        return res.status(400).json({ success: false, error: 'User ID and Item ID are required' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check if the user has a cart
        const [existingCart] = await connection.query(
            'SELECT cart_id FROM CART WHERE user_id = ?',
            [userID]
        );

        if (existingCart.length === 0) {
            return res.status(404).json({ success: false, error: 'Cart not found' });
        }

        const cartID = existingCart[0].cart_id;
        console.log(cartID);
        // Check if the item exists in the cart
        const [existingItem] = await connection.query(
            'SELECT cart_item_id FROM CARTITEMS WHERE cart_id = ? AND item_id = ?',
            [cartID, itemID]
        );

        if (existingItem.length === 0) {
            return res.status(404).json({ success: false, error: 'Item not found in cart' });
        }

        await connection.query(
            'DELETE FROM CARTITEMS WHERE cart_id = ? AND item_id = ?',
            [cartID, itemID]
        );

        await connection.commit();
        res.json({ success: true, message: 'Item removed from cart successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error removing item from cart:', error);
        res.status(500).json({ success: false, error: 'Failed to remove item from cart.' });
    } finally {
        connection.release();
    }
});


app.post('/update-cart-item', async (req, res) => {
    const { userID, itemID, quantity } = req.body;

    if (!userID || !itemID || !quantity || quantity < 1) {
        return res.status(400).json({ success: false, error: 'Invalid input. User ID, item ID, and a valid quantity are required.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check if the user has a cart
        const [existingCart] = await connection.query(
            'SELECT cart_id FROM CART WHERE user_id = ?',
            [userID]
        );

        if (existingCart.length === 0) {
            return res.status(404).json({ success: false, error: 'Cart not found' });
        }

        const cartID = existingCart[0].cart_id;

        // Check if the item exists in the cart
        const [existingItem] = await connection.query(
            'SELECT cart_item_id FROM CARTITEMS WHERE cart_id = ? AND item_id = ?',
            [cartID, itemID]
        );

        if (existingItem.length === 0) {
            return res.status(404).json({ success: false, error: 'Item not found in cart' });
        }

        // Update the quantity of the item
        await connection.query(
            'UPDATE CARTITEMS SET quantity = ? WHERE cart_id = ? AND item_id = ?',
            [quantity, cartID, itemID]
        );

        await connection.commit();
        res.json({ success: true, message: 'Cart item quantity updated successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating cart item quantity:', error);
        res.status(500).json({ success: false, error: 'Failed to update cart item quantity.' });
    } finally {
        connection.release();
    }
});


// Checkout route
app.post('/checkout', async (req, res) => {
    const { userID } = req.body;
    const { transaction_id, type} = req.cookies;

    if (!userID) {
        return res.status(400).json({ success: false, error: 'User ID is required for checkout.' });
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        if (type === 'wallet'){
            let decodedTransaction;
            try {
                // Decode and verify the JWT
                decodedTransaction = jwt.verify(transaction_id, JWT_SECRET);
            } catch (error) {
                return res.status(403).json({ success: false, error: 'Invalid or expired transaction token.' });
            }
            const { transactionID, userID: jwtUserID, amount } = decodedTransaction;

            // Check if the `userID` matches the one in the JWT
            if (userID !== jwtUserID) {
                await connection.rollback();
                return res.status(403).json({ success: false, error: 'User ID mismatch.' });
            }
    
            // Remove the record from PENDING_TRANSACTIONS
            const deleteQuery = `
                DELETE FROM PENDING_TRANSACTIONS
                WHERE transaction_id = ? AND user_id = ? AND amount = ?
            `;
            const [deleteResult] = await connection.query(deleteQuery, [transactionID, userID, amount]);
    
            if (deleteResult.affectedRows === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, error: 'Pending transaction not found.' });
            }
    
        }
        // 1. Retrieve the user's cart
        const [cart] = await connection.query(
            'SELECT cart_id FROM CART WHERE user_id = ?',
            [userID]
        );

        if (cart.length === 0) {
            return res.status(400).json({ success: false, error: 'No active cart found for the user.' });
        }

        const cartID = cart[0].cart_id;

        // 2. Get the items from the cart along with the creators
        const [cartItems] = await connection.query(
            `SELECT ci.item_id, ci.quantity, ci.price, i.created_by
             FROM CARTITEMS ci
             JOIN ITEMS i ON ci.item_id = i.id
             WHERE ci.cart_id = ?`,
            [cartID]
        );

        if (cartItems.length === 0) {
            return res.status(400).json({ success: false, error: 'No items in the cart.' });
        }

        const totalAmount = cartItems.reduce((total, item) => total + (item.quantity * item.price), 0);

        // 3. Record the transaction
        const [transactionResult] = await connection.query(
            'INSERT INTO TRANSACTIONS (user_id, total_amount) VALUES (?, ?)',
            [userID, totalAmount]
        );

        const transactionID = transactionResult.insertId;//Gets the transaction id from the transaction

        // 4. Process each item in the cart
        for (const item of cartItems) {
            const itemTotal = item.quantity * item.price;

            // Record sale item
            await connection.query(
                'INSERT INTO SALE_ITEMS (transaction_id, item_id, quantity, price) VALUES (?, ?, ?, ?)',
                [transactionID, item.item_id, item.quantity, item.price]
            );

            // Update stock
            await connection.query(
                'UPDATE ITEMS SET stock = stock - ? WHERE id = ?',
                [item.quantity, item.item_id]
            );

            // Credit the wallet of the product creator
            await connection.query(
                'UPDATE USERS SET wallet = wallet + ? WHERE id = ?',
                [itemTotal, item.created_by]
            );
        }

        // 5. Clear the cart
        await connection.query('DELETE FROM CARTITEMS WHERE cart_id = ?', [cartID]);
        await connection.query('DELETE FROM CART WHERE cart_id = ?', [cartID]);
        try {
            // Clear all transaction-related cookies
            res.clearCookie('txid', {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
            res.clearCookie('transaction_amount', {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
    
            res.clearCookie('amount', {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
    
            res.clearCookie('assetId', {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
    
            res.clearCookie('recipientAddress', {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
    
            res.clearCookie('note', {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
            res.clearCookie('transaction_id', {
                httpOnly: true,
                secure: true, // Ensures the cookie is only sent over HTTPS
                sameSite: 'None', // Allows cross-site cookie sharing
                path: '/', // Matches the path where the cookie was set
            });
            res.clearCookie('type', {
                httpOnly: true,
                secure: true,
                sameSite: 'None',
                path: '/', // Matches the path where the cookie was set
            });
               
    
        } catch (error) {
            console.error('Error clearing cookies:', error);
            res.status(500).json({ success: false, message: 'Failed to clear cookies.' });
        }
        
        // Commit the transaction only after cookies are cleared
        await connection.commit();
        res.json({ success: true, message: 'Checkout completed successfully.' });
    } catch (error) {
        // Rollback the transaction in case of any error
        await connection.rollback();
        console.error('Error during checkout:', error);
        res.status(500).json({ success: false, error: 'Checkout failed.' });
    } finally {
        // Release the connection back to the pool
        connection.release();
    }
});


app.get('/shop-metrics', async (req, res) => {
    const { startDate, endDate } = req.query;
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

        // Build WHERE clause dynamically
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Query for sales over time
        const [salesOverTime] = await connection.query(`
            SELECT DATE(TRANSACTIONS.created_at) AS timeLabel, 
                   COUNT(TRANSACTIONS.transaction_id) AS totalTransactions,
                   SUM(TRANSACTIONS.total_amount) AS totalAmounts
            FROM TRANSACTIONS
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
        const [userRegistrations] = await connection.query(`
            SELECT DATE(created_at) AS timeLabel, COUNT(id) AS newUsers
            FROM USERS
            ${startDate || endDate ? `WHERE ${startDate ? 'created_at >= ?' : ''} ${endDate ? (startDate ? 'AND created_at <= ?' : 'created_at <= ?') : ''}` : ''}
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `, startDate && endDate ? [startDate, endDate] : startDate ? [startDate] : endDate ? [endDate] : []);
        
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
            userRegistrations: {
                timeLabels: userRegistrations.map(row => row.timeLabel),
                newUsers: userRegistrations.map(row => row.newUsers),
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
    const { name, category, price, stock, description, userID } = req.body;

    // Validate required fields
    if (!name || !category || !price || !stock || !req.file || !description || !userID) {
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
                        INSERT INTO ITEMS (name, category, price, stock, image, description, created_by) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;
                    const values = [name, category, price, stock, imagePath, description, userID];

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


app.delete('/remove-product', async (req, res) => {
    const { productId } = req.body;

    // Validate required fields
    if (!productId) {
        return res.status(400).json({ success: false, error: 'Product ID is required.' });
    }

    // Ensure `productId` is a valid number
    if (isNaN(productId)) {
        return res.status(400).json({ success: false, error: 'Product ID must be a valid number.' });
    }

    try {
        const connection = await pool.getConnection();

        try {
            // Retrieve the image URL for the product
            const [rows] = await connection.query('SELECT image FROM ITEMS WHERE id = ?', [productId]);

            if (rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Product not found.' });
            }

            const imageUrl = rows[0].image;
            const imageName = imageUrl.split('/').slice(-2).join('/'); // Extract the file name from the URL

            // Delete the product from the database
            const deleteQuery = 'DELETE FROM ITEMS WHERE id = ?';
            const [result] = await connection.query(deleteQuery, [productId]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Product not found.' });
            }

            // Delete the image from Google Cloud Storage
            await bucket.file(imageName).delete();

            res.status(200).json({ success: true, message: 'Product and its image removed successfully!' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error removing product:', error.message);
        res.status(500).json({ success: false, error: 'Failed to remove product.', details: error.message });
    }
});



app.post('/add-new-user', async (req, res) => {
    const { username, password, role, email} = req.body;

    // Validate required fields
    if (!username || !password || !role || !email) {
        return res.status(400).json({ success: false, error: 'All fields are required.' });
    }
    try {
        
        const connection = await pool.getConnection(); // Get a connection from the pool
        try {
            // SQL query to insert the product into the database
            const query = `
                INSERT INTO USERS (username, email, password, role) 
                VALUES (?, ?, ?, ?)
            `;
            const values = [username, email, password, role];

            // Execute the query
            await connection.query(query, values);
            res.status(201).json({ success: true, message: 'User added successfully!' });
        } finally {
            connection.release(); // Always release the connection back to the pool
        }
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});


app.post('/add-new-comment', async (req, res) => {
    const { userID, comment_text, selectedRating} = req.body;

    // Validate required fields
    if (!userID|| !comment_text) {
        return res.status(400).json({ success: false, error: 'All fields are required.' });
    }
    try {
        
        const connection = await pool.getConnection(); // Get a connection from the pool
        try {
            // SQL query to insert the product into the database
            const query = `
                INSERT INTO COMMENTS(comment, user_id, website_rating)
                VALUES (?, ?, ?)
            `;
            const values = [comment_text, userID, selectedRating];

            // Execute the query
            await connection.query(query, values);
            res.status(201).json({ success: true, message: 'User added successfully!' });
        } finally {
            connection.release(); // Always release the connection back to the pool
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ success: false, error: 'Internal server error.' });
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
                GROUP BY t.transaction_id
                ORDER BY t.created_at DESC;
            `;
            const [results] = await connection.query(query);
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

app.post('/add-like', async (req, res) => {
    const { userID, itemID } = req.body;
    console.log('Add like request:', userID, itemID); // Debug log

    if (!userID || !itemID) {
        return res.status(400).json({ success: false, error: 'User ID and Item ID are required' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Check if the like already exists
            const [existingLike] = await connection.query(
                'SELECT * FROM LIKES WHERE user_id = ? AND item_id = ?',
                [userID, itemID]
            );

            if (existingLike.length > 0) {
                return res.status(400).json({ success: false, error: 'Item already liked' });
            }

            // Insert the like
            await connection.query(
                'INSERT INTO LIKES (user_id, item_id) VALUES (?, ?)',
                [userID, itemID]
            );

            res.json({ success: true, message: 'Item liked successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error liking item:', error);
        res.status(500).json({ success: false, error: 'Failed to like item' });
    }
});


// API to unlike an item
app.delete('/delete-like', async (req, res) => {
    const { userID, itemID } = req.body;

    if (!userID || !itemID) {
        return res.status(400).json({ success: false, error: 'User ID and Item ID are required' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            await connection.query(
                'DELETE FROM LIKES WHERE user_id = ? AND item_id = ?',
                [userID, itemID]
            );

            res.json({ success: true, message: 'Item unliked successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error unliking item:', error);
        res.status(500).json({ success: false, error: 'Failed to unlike item' });
    }
});

// API to fetch liked items for a user
app.get('/like-list', async (req, res) => {
    const userID = req.query.userID;

    if (!userID) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const [likedItems] = await connection.query(
                `SELECT i.id, i.name, i.description, i.category, i.price, i.stock, i.image
                 FROM  LIKES l
                 JOIN ITEMS i ON l.item_id = i.id
                 WHERE l.user_id = ?`,
                [userID]
            );

            res.json({ success: true, likedItems });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching liked items:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch liked items' });
    }
});


app.post('/get-user-settings', async (req, res) => {
    const { userID } = req.body;

    if (!userID) {
        return res.status(400).json({ success: false, message: 'UserID is required.' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(
                'SELECT dark_mode, color_scheme FROM USER_SETTINGS WHERE user_id = ?',
                [userID]
            );

            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Settings not found.' });
            }

            res.status(200).json({ success: true, settings: rows[0] });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

app.post('/save-user-settings', async (req, res) => {
    const { userID, dark_mode, color_scheme } = req.body;

    if (!userID || dark_mode === undefined || !color_scheme) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            await connection.query(
                `INSERT INTO USER_SETTINGS (user_id, dark_mode, color_scheme)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE dark_mode = ?, color_scheme = ?`,
                [userID, dark_mode, color_scheme, dark_mode, color_scheme]
            );

            res.status(200).json({ success: true, message: 'Settings saved successfully!' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
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
    const { name, price, starting_time, description, stock, category, duration, userID } = req.body;
    let time;
    if (starting_time){
        time = new Date(starting_time);
    }
  
    // Validate inputs
    if (!name || !price || price <= 0 || !stock || stock <= 0 || !description || !req.file || !category || !duration || duration <= 0 || !userID) {
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
              INSERT INTO AUCTION_ITEMS (item_name, stock, description, category, image, starting_price, duration, starting_time, created_by) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const values = [name, stock, description, category, imageUrl, price, duration, time||null, userID];
  
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


  // Delete an auction item
app.delete("/remove-auction", async (req, res) => {
  const { itemID } = req.body;

  if (!itemID) {
    return res.status(400).json({ success: false, error: "Item ID is required." });
  }

  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query("SELECT image FROM AUCTION_ITEMS WHERE id = ?", [itemID]);

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: "Item not found." });
      }

      const imageUrl = rows[0].image;
      const imageName = imageUrl.split("/").slice(-2).join("/");

      const deleteQuery = "DELETE FROM AUCTION_ITEMS WHERE id = ?";
      const [result] = await connection.query(deleteQuery, [itemID]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: "Item not found." });
      }

      await bucket.file(imageName).delete();

      res.status(200).json({ success: true, message: "Item deleted successfully!" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error removing auction item:", error.message);
    res.status(500).json({ success: false, error: "Failed to remove item." });
  }
});

app.get("/expired-auction", async (req, res) => {
    const query = `
    SELECT * 
    FROM AUCTION_ITEMS 
    WHERE is_expired = TRUE
    `;//NOW() is guranteed to be the server date and cannot be manipulated
  
    try {
      const connection = await pool.getConnection();
      try {
        const [results] = await connection.query(query);
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
    const query = `
    SELECT * 
    FROM AUCTION_ITEMS 
    WHERE starting_time > NOW() OR starting_time IS NULL
    `;//NOW() is guranteed to be the server date and cannot be manipulated
  
    try {
      const connection = await pool.getConnection();
      try {
        const [results] = await connection.query(query);
        res.json({ success: true, items: results });
      } finally {
        connection.release();
      }
    } catch (err) {
      console.error("Error fetching auction items:", err);
      res.status(500).json({ error: "Database query failed" });
    }
});
//Ongoing auctions
app.get("/all-ongoing-auction", async (req, res) => {
    const query = `
    SELECT * 
    FROM AUCTION_ITEMS 
    WHERE (starting_time + INTERVAL duration SECOND) > NOW() AND starting_time < NOW()
    `;//NOW() is guranteed to be the server date and cannot be manipulated
  
    try {
      const connection = await pool.getConnection();
      try {
        const [results] = await connection.query(query);
        res.json({ success: true, items: results });
      } finally {
        connection.release();
      }
    } catch (err) {
      console.error("Error fetching auction items:", err);
      res.status(500).json({ error: "Database query failed" });
    }
});

app.get('/bid-list', async (req, res) => {
    const { auction_item_id } = req.query;

    if (!auction_item_id) {
        return res.status(400).json({ success: false, message: 'Missing auction_item_id' });
    }

    const query = `
        SELECT b.id, b.bid_amount, b.bid_time, u.username 
        FROM BIDS b
        INNER JOIN USERS u ON b.user_id = u.id
        WHERE b.auction_item_id = ?
        ORDER BY b.bid_time DESC
    `;

    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query(query, [auction_item_id]);
            res.json({ success: true, bids: rows });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching bids:', error);
        res.status(500).json({ success: false, message: 'Database query failed' });
    }
});
app.post('/bids', async (req, res) => {
    const { auction_item_id, user_id, bid_amount } = req.body;

    if (!auction_item_id || !user_id || !bid_amount) {
        return res.status(400).json({ message: "Missing required parameters." });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Get the current highest bid for the auction
        const [currentBid] = await connection.query(
            `SELECT user_id, bid_amount FROM BIDS
             WHERE auction_item_id = ?
             ORDER BY bid_amount DESC LIMIT 1`,
            [auction_item_id]
        );

        // Check if there is a previous highest bidder
        let previousBidderId = null;
        let previousBidAmount = 0;
        if (currentBid.length > 0) {
            ({ user_id: previousBidderId, bid_amount: previousBidAmount } = currentBid[0]);

            // Refund the previous highest bidder
            await connection.query(
                `UPDATE USERS
                 SET wallet = wallet + ?
                 WHERE id = ?`,
                [previousBidAmount, previousBidderId]
            );
        }

        // Check the bidder's wallet
        const [bidder] = await connection.query(
            `SELECT wallet FROM USERS
             WHERE id = ?`,
            [user_id]
        );

        if (bidder[0].wallet < bid_amount) {
            // Revert the previous refund if it was made
            if (previousBidderId) {
                await connection.query(
                    `UPDATE USERS
                     SET wallet = wallet - ?
                     WHERE id = ?`,
                    [previousBidAmount, previousBidderId]
                );
            }
            return res.status(400).json({ message: "Insufficient funds." });
        }

        // Deduct the bid amount from the new bidder's wallet
        await connection.query(
            `UPDATE USERS
             SET wallet = wallet - ?
             WHERE id = ?`,
            [bid_amount, user_id]
        );

        // Insert the new bid
        await connection.query(
            `INSERT INTO BIDS (auction_item_id, user_id, bid_amount)
             VALUES (?, ?, ?)`,
            [auction_item_id, user_id, bid_amount]
        );

        // Commit the transaction
        await connection.commit();

        res.json({ message: "Bid placed successfully." });
    } catch (error) {
        console.error("Error placing bid:", error);
        await connection.rollback();
        res.status(500).json({ message: "Error placing bid." });
    } finally {
        connection.release();
    }
});


app.get("/get-bid-by-user", async (req, res) => {
    const { userID } = req.query;
    if (!userID) {
        return res.status(400).json({ message: "No user ID sent." });
    }

    const sql = "SELECT AI.* FROM AUCTION_ITEMS AI INNER JOIN BIDS B ON AI.id = B.auction_item_id WHERE B.user_id = ? AND (AI.starting_time + INTERVAL AI.duration SECOND) > NOW() AND AI.starting_time < NOW();";

    try {
        const connection = await pool.getConnection();
        try {
            const [results] = await connection.query(sql, [userID]); // Pass userID as the query parameter
            res.json(results);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error("Error fetching bidded items:", err);
        res.status(500).json({ error: "Database query failed" });
    }
});

app.get("/highest-bid", async (req, res) => {
    const { auction_item_id } = req.query;
  
    if (!auction_item_id) {
      return res.status(400).json({ message: "Auction item ID is required." });
    }
    //Faster than using max
    const sql = `
        SELECT 
            b.bid_amount
        FROM 
            BIDS b
        JOIN 
            USERS u ON b.user_id = u.id
        WHERE 
            b.auction_item_id = ?
        ORDER BY 
            b.bid_amount DESC
        LIMIT 1;
    `;
  
    try {
      const connection = await pool.getConnection();
      try {
        const [results] = await connection.query(sql, [auction_item_id]);
        res.json(results[0]);
      } finally {
        connection.release();
      }
    } catch (err) {
      console.error("Error fetching the highest bid:", err);
      res.status(500).json({ error: "Database query failed" });
    }
});

app.post('/check-transaction', async (req, res) => {
    const { txid, amount, assetId, recipientAddress, orderId } = req.body; // Receive details from the frontend

    if (!txid || !amount || !assetId || !recipientAddress || !orderId) {
        return res.status(400).json({ error: "Transaction ID, amount, asset ID, and recipient address are required." });
    }

    try {
        // Query the Nodely Indexer API for transaction information
        const response = await fetch(`https://testnet-idx.4160.nodely.dev/v2/transactions/${txid}`);
        const txnInfo = await response.json();

        if (!txnInfo || txnInfo.error) {
            return res.status(500).json({ error: "Error fetching transaction info." });
        }

        if (txnInfo.transaction && txnInfo.transaction['confirmed-round'] > 0) {
            const payment = txnInfo.transaction['asset-transfer-transaction'];
            const transactionNote = Buffer.from(txnInfo.transaction.note, 'base64').toString(); // Decode Base64

            // Normalize and decode the transaction note and order ID
            const normalizedTransactionNote = decodeURIComponent(transactionNote).trim();
            const normalizedOrderId = decodeURIComponent(orderId).trim();



            // Compare the normalized values
            if (
                decodeURIComponent(payment.receiver) === decodeURIComponent(recipientAddress) &&
                parseInt(payment['asset-id']) === parseInt(assetId) &&
                parseFloat(payment.amount) === parseFloat(amount) &&
                normalizedTransactionNote === normalizedOrderId
            ) {
                res.cookie('txid', txid, {
                    path: '/', 
                    httpOnly: true,
                    secure: true,
                    sameSite: 'None', // Allows cross-site requests
                    maxAge: 15 * 60 * 1000, // 15 minutes
                });

                res.cookie('amount', amount, {
                    path: '/', 
                    httpOnly: true,
                    secure: true,
                    sameSite: 'None',
                    maxAge: 15 * 60 * 1000, // 15 minutes
                });

                res.cookie('assetId', assetId, {
                    path: '/', 
                    httpOnly: true,
                    secure: true,
                    sameSite: 'None',
                    maxAge: 15 * 60 * 1000, // 15 minutes
                });

                res.cookie('recipientAddress', recipientAddress, {
                    path: '/', 
                    httpOnly: true,
                    secure: true,
                    sameSite: 'None',
                    maxAge: 15 * 60 * 1000, // 15 minutes
                });
                res.cookie('note', orderId, {
                    path: '/', 
                    httpOnly: true,
                    secure: true,
                    sameSite: 'None',
                    maxAge: 15 * 60 * 1000, // 15 minutes
                });

                return res.json({
                    completed: true,
                    confirmedRound: txnInfo.transaction['confirmed-round'],
                    sender: txnInfo.transaction.sender,
                    amount: payment.amount,
                    assetId: payment['asset-id'],
                    note: orderId,
                });
            } else {
                console.log("Comparison failed:");
                console.log("Receiver Match:", decodeURIComponent(payment.receiver) === decodeURIComponent(recipientAddress));
                console.log("Asset ID Match:", payment['asset-id'] === assetId);
                console.log("Amount Match:", parseFloat(payment.amount) === parseFloat(amount));
                console.log("Note Match:", normalizedTransactionNote === normalizedOrderId);

                return res.json({
                    completed: false,
                    error: "Transaction details do not match the expected values.",
                });
            }
        } else {
            return res.json({ completed: false });
        }
    } catch (error) {
        console.error("Error checking transaction:", error);
        return res.status(500).json({ error: "Error verifying transaction. Please try again." });
    }
});

app.get('/items-user', async (req, res) => {
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



app.get('/shop-metrics-user', async (req, res) => {
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






app.put('/items-user/:id', upload.single('product-image'), async (req, res) => {
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
app.get('/transaction-history-user', async (req, res) => {
    const userID = req.query.userID;
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
                WHERE t.user_id = ?
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


app.get('/transactions-user', async (req, res) => {
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


app.get('/comments-user', async (req, res) => {
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




app.get("/expired-auction-user", async (req, res) => {
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
app.get("/upcoming-auction-user", async (req, res) => {
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



app.post('/update-address-user', async (req, res) => {
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

app.post('/update-wallet-user', async (req, res) => {
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
        await connection.beginTransaction(); // Begin transaction

        // Update wallet
        const [result] = await connection.query(
            'UPDATE USERS SET wallet = wallet + ? WHERE id = ?',
            [amount, userID]
        );

        if (result.affectedRows === 0) {
            await connection.rollback(); // Rollback if user not found
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        try {
            // Clear all transaction-related cookies
            res.clearCookie('txid', {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
            res.clearCookie('transaction_amount', {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
    
            res.clearCookie('amount', {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
    
            res.clearCookie('assetId', {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
    
            res.clearCookie('recipientAddress', {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
    
            res.clearCookie('note', {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
    
        } catch (error) {
            console.error('Error clearing cookies:', error);
            res.status(500).json({ success: false, message: 'Failed to clear cookies.' });
        }

        await connection.commit(); // Commit transaction after clearing cookies
        res.json({ success: true });
    } catch (error) {
        await connection.rollback(); // Rollback transaction on error
        console.error('Error updating wallet:', error);
        res.status(500).json({ success: false, error: 'Database error or cookie clearing failed.' });
    } finally {
        connection.release(); // Release connection back to the pool
    }
});


// Endpoint to get the wallet balance
app.get('/get-wallet-user', async (req, res) => {
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
app.get('/get-address-user', async (req, res) => {
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
app.post('/validate-transaction', async (req, res) => {
    const { transaction_id } = req.cookies; // Get the cookie from the request

    if (!transaction_id) {
        return res.status(400).json({ success: false, error: 'Transaction cookie is missing.' });
    }

    try {
        // Decode and verify the JWT
        const payload = jwt.verify(transaction_id, JWT_SECRET);

        // Extract transaction details from the payload
        const { transactionID, userID, amount } = payload;

        if (!transactionID || !userID || !amount) {
            return res.status(400).json({ success: false, error: 'Invalid transaction data in cookie.' });
        }

        const connection = await pool.getConnection();
        try {
            // Check if the transaction exists in the PENDING_TRANSACTIONS table
            const query = `
                SELECT * FROM PENDING_TRANSACTIONS
                WHERE transaction_id = ? AND user_id = ? AND amount = ?
            `;
            const [rows] = await connection.query(query, [transactionID, userID, amount]);

            if (rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Transaction not found or already processed.' });
            }

            // Transaction is valid
            res.json({ success: true, message: 'Transaction is valid.', transaction: rows[0] });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error validating transaction:', error);

        // Handle invalid or expired JWT
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(403).json({ success: false, error: 'Invalid or expired transaction token.' });
        }

        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});


app.post('/wallet-checkout-user', async (req, res) => {
    const { userID, amount } = req.body;

    if (!userID || !amount) {
        return res.status(400).json({ success: false, error: 'UserID and amount are required.' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Begin a transaction
            await connection.beginTransaction();

            // Deduct the amount from the user's wallet
            const deductQuery = `
                UPDATE USERS
                SET wallet = wallet - ?
                WHERE id = ?
            `;
            const [deductResult] = await connection.query(deductQuery, [amount, userID]);

            if (deductResult.affectedRows === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, error: 'User not found.' });
            }

            // Generate a transaction ID
            const transactionID = `${userID}-${Date.now()}`;

            // Insert the transaction ID into the PENDING_TRANSACTIONS table
            const insertQuery = `
                INSERT INTO PENDING_TRANSACTIONS (transaction_id, user_id, amount)
                VALUES (?, ?, ?)
            `;
            const [insertResult] = await connection.query(insertQuery, [transactionID, userID, amount]);

            if (insertResult.affectedRows === 0) {
                await connection.rollback();
                return res.status(500).json({ success: false, error: 'Failed to create pending transaction.' });
            }

            // Generate a JWT token with transaction details
            const payload = { userID, transactionID, amount };
            const jwtToken = jwt.sign(payload, JWT_SECRET);

            // Set the JWT as a cookie
            res.cookie('transaction_id', jwtToken, {
                httpOnly: true,
                secure: true,
                sameSite: 'None',
                path: '/',
            });
            res.cookie('type', 'wallet', {
                httpOnly: true,
                secure: true,
                sameSite: 'None',
                path: '/',
            });

            // Commit the transaction
            await connection.commit();

            res.json({ success: true, transactionID });
        } catch (error) {
            await connection.rollback(); // Rollback transaction on error
            console.error('Error processing wallet checkout:', error);
            res.status(500).json({ success: false, error: 'Internal server error.' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error connecting to the database:', error);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

app.post('/withdraw-user', async (req, res) => {
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