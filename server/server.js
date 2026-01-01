const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));

// Database Setup
const dbPath = path.resolve(__dirname, 'booking.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to SQLite database.');
        createTables();
    }
});

function createTables() {
    db.serialize(() => {
        // Users Table (Clients, Owners, Admins)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'user', -- user, owner, admin
            status TEXT DEFAULT 'active'
        )`);

        // OTP Table (For verification simulation)
        db.run(`CREATE TABLE IF NOT EXISTS otps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT,
            code TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Listings Table (Halls, Chalets, Cars)
        db.run(`CREATE TABLE IF NOT EXISTS listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER,
            title TEXT,
            type TEXT, -- hall, chalet, car
            price REAL,
            location TEXT,
            description TEXT,
            image_url TEXT,
            status TEXT DEFAULT 'pending', -- pending, active, rejected
            FOREIGN KEY(owner_id) REFERENCES users(id)
        )`);

        // Bookings Table
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            listing_id INTEGER,
            date TEXT,
            status TEXT DEFAULT 'confirmed',
            total_price REAL,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(listing_id) REFERENCES listings(id)
        )`);

        // Seed Admin User (If not exists)
        db.get("SELECT * FROM users WHERE role = 'admin'", [], (err, row) => {
            if (!row) {
                db.run(`INSERT INTO users (name, phone, password, role) VALUES ('Admin', '0000', 'admin123', 'admin')`);
                console.log("Admin account created: Phone 0000, Pass admin123");
            }
        });
    });
}

// --- API Endpoints ---

// 1. Auth & OTP
app.post('/api/register', (req, res) => {
    const { name, phone, password, role } = req.body;
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Default role is user unless specified (owner requires approval logic usually, simplifying here)
    const userRole = role || 'user';

    db.run(`INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)`, 
        [name, phone, password, userRole], 
        function(err) {
            if (err) {
                return res.status(400).json({ error: 'رقم الهاتف مسجل مسبقاً' });
            }
            // Insert OTP
            db.run(`INSERT INTO otps (phone, code) VALUES (?, ?)`, [phone, otp]);
            res.json({ message: 'تم التسجيل بنجاح، يرجى التحقق من OTP', userId: this.lastID });
        }
    );
});

app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    db.get(`SELECT * FROM users WHERE phone = ? AND password = ?`, [phone, password], (err, row) => {
        if (err || !row) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        res.json({ user: row });
    });
});

// 2. Listings (Public & Owner)
app.get('/api/listings', (req, res) => {
    // Show only active listings to users
    const { type, minPrice, maxPrice, location } = req.query;
    let query = "SELECT * FROM listings WHERE status = 'active'";
    let params = [];

    if (type) { query += " AND type = ?"; params.push(type); }
    if (location) { query += " AND location LIKE ?"; params.push(`%${location}%`); }
    // Price logic simplified for SQL
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/listings', (req, res) => {
    const { owner_id, title, type, price, location, description, image_url } = req.body;
    db.run(`INSERT INTO listings (owner_id, title, type, price, location, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [owner_id, title, type, price, location, description, image_url],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'تم إضافة الطلب، بانتظار موافقة الإدارة' });
        }
    );
});

app.get('/api/listings/owner/:id', (req, res) => {
    db.all(`SELECT * FROM listings WHERE owner_id = ?`, [req.params.id], (err, rows) => {
        res.json(rows);
    });
});

// 3. Admin APIs
app.get('/api/admin/listings/pending', (req, res) => {
    db.all(`SELECT * FROM listings WHERE status = 'pending'`, [], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/admin/approve/:id', (req, res) => {
    db.run(`UPDATE listings SET status = 'active' WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'تم قبول العقار بنجاح' });
    });
});

app.get('/api/admin/otps', (req, res) => {
    db.all(`SELECT * FROM otps ORDER BY created_at DESC LIMIT 50`, [], (err, rows) => {
        res.json(rows);
    });
});

app.get('/api/admin/stats', (req, res) => {
    db.serialize(() => {
        let stats = {};
        db.get("SELECT count(*) as count FROM users", (err, row) => stats.users = row.count);
        db.get("SELECT count(*) as count FROM bookings", (err, row) => stats.bookings = row.count);
        db.get("SELECT sum(total_price) as total FROM bookings", (err, row) => {
            stats.revenue = row.total || 0;
            res.json(stats);
        });
    });
});

// 4. Bookings
app.post('/api/bookings', (req, res) => {
    const { user_id, listing_id, date, total_price } = req.body;
    db.run(`INSERT INTO bookings (user_id, listing_id, date, total_price) VALUES (?, ?, ?, ?)`,
        [user_id, listing_id, date, total_price],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'تم الحجز بنجاح!' });
        }
    );
});

app.get('/api/bookings/user/:id', (req, res) => {
    db.all(`SELECT b.*, l.title, l.image_url FROM bookings b JOIN listings l ON b.listing_id = l.id WHERE b.user_id = ?`, 
        [req.params.id], (err, rows) => {
        res.json(rows);
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
