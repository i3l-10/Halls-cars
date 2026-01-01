const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;
const dbPath = path.join(__dirname, 'database.sqlite');

// إنشاء قاعدة البيانات و الجداول
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        initializeDatabase();
    }
});

// إعدادات التطبيق
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// إنشاء الجداول اللازمة
function initializeDatabase() {
    const queries = [
        // جدول المستخدمين
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL,
            password TEXT NOT NULL,
            user_type TEXT DEFAULT 'customer',
            is_verified INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // جدول أصحاب القاعات
        `CREATE TABLE IF NOT EXISTS venue_owners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            business_name TEXT NOT NULL,
            business_license TEXT,
            is_verified INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )`,
        
        // جدول الأماكن (قاعات، شاليهات، سيارات)
        `CREATE TABLE IF NOT EXISTS venues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL CHECK(type IN ('hall', 'chalet', 'car')),
            location TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            price_per_night REAL NOT NULL,
            amenities TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES venue_owners (id) ON DELETE CASCADE
        )`,
        
        // جدول صور الأماكن
        `CREATE TABLE IF NOT EXISTS venue_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venue_id INTEGER NOT NULL,
            image_url TEXT NOT NULL,
            is_primary INTEGER DEFAULT 0,
            FOREIGN KEY (venue_id) REFERENCES venues (id) ON DELETE CASCADE
        )`,
        
        // جدول الحجوزات
        `CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venue_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            check_in_date DATE NOT NULL,
            check_out_date DATE NOT NULL,
            total_price REAL NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'cancelled')),
            payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'refunded')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (venue_id) REFERENCES venues (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )`,
        
        // جدول المراجعات والتقييمات
        `CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            venue_id INTEGER NOT NULL,
            rating INTEGER CHECK(rating BETWEEN 1 AND 5),
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (venue_id) REFERENCES venues (id) ON DELETE CASCADE
        )`,
        
        // جدول الاشتراكات
        `CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venue_owner_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('basic', 'premium')),
            price REAL NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'cancelled')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (venue_owner_id) REFERENCES venue_owners (id) ON DELETE CASCADE
        )`,
        
        // جدول الـ OTP
        `CREATE TABLE IF NOT EXISTS otp_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            phone TEXT NOT NULL,
            code TEXT NOT NULL,
            is_used INTEGER DEFAULT 0,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )`,
        
        // جدول المفضلات
        `CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            venue_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, venue_id),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (venue_id) REFERENCES venues (id) ON DELETE CASCADE
        )`
    ];
    
    queries.forEach(query => {
        db.run(query, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            }
        });
    });
}

// دوال مساعدة
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// APIs للمستخدمين
app.post('/api/auth/register', (req, res) => {
    const { name, email, phone, password, user_type = 'customer' } = req.body;
    
    if (!name || !email || !phone || !password) {
        return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }
    
    const hashedPassword = hashPassword(password);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 دقائق
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(
            'INSERT INTO users (name, email, phone, password, user_type) VALUES (?, ?, ?, ?, ?)',
            [name, email, phone, hashedPassword, user_type],
            function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'البريد الإلكتروني أو رقم الهاتف مسجل مسبقًا' });
                    }
                    return res.status(500).json({ error: 'خطأ في التسجيل' });
                }
                
                const userId = this.lastID;
                db.run(
                    'INSERT INTO otp_codes (user_id, phone, code, expires_at) VALUES (?, ?, ?, ?)',
                    [userId, phone, otp, otpExpires],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'خطأ في إنشاء OTP' });
                        }
                        
                        db.run('COMMIT');
                        // هنا يجب إرسال OTP عبر SMS (تم تقسيمه للتبسيط)
                        res.json({ 
                            success: true, 
                            message: 'تم التسجيل بنجاح. يرجى التحقق من OTP.',
                            user_id: userId,
                            otp: otp // في التطبيق الفعلي، يجب إرساله عبر SMS
                        });
                    }
                );
            }
        );
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'البريد الإلكتروني والكلمة السرية مطلوبة' });
    }
    
    const hashedPassword = hashPassword(password);
    
    db.get(
        'SELECT * FROM users WHERE email = ? AND password = ?',
        [email, hashedPassword],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في الدخول' });
            }
            
            if (!user) {
                return res.status(401).json({ error: 'بيانات الاعتماد غير صحيحة' });
            }
            
            if (!user.is_verified) {
                return res.status(403).json({ error: 'لم يتم التحقق من الحساب بعد' });
            }
            
            res.json({ 
                success: true, 
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    user_type: user.user_type
                }
            });
        }
    );
});

app.post('/api/auth/verify-otp', (req, res) => {
    const { user_id, otp } = req.body;
    
    if (!user_id || !otp) {
        return res.status(400).json({ error: 'معرّف المستخدم و OTP مطلوبان' });
    }
    
    db.get(
        'SELECT * FROM otp_codes WHERE user_id = ? AND code = ? AND is_used = 0 AND expires_at > ?',
        [user_id, otp, new Date()],
        (err, otpRecord) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في التحقق من OTP' });
            }
            
            if (!otpRecord) {
                return res.status(400).json({ error: 'OTP غير صحيح أو منتهي الصلاحية' });
            }
            
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                db.run(
                    'UPDATE users SET is_verified = 1 WHERE id = ?',
                    [user_id],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'خطأ في تفعيل الحساب' });
                        }
                        
                        db.run(
                            'UPDATE otp_codes SET is_used = 1 WHERE id = ?',
                            [otpRecord.id],
                            function(err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'خطأ في تحديث OTP' });
                                }
                                
                                db.run('COMMIT');
                                res.json({ success: true, message: 'تم التحقق من الحساب بنجاح' });
                            }
                        );
                    }
                );
            });
        }
    );
});

// APIs لأصحاب القاعات
app.post('/api/venues', (req, res) => {
    const { owner_id, name, description, type, location, latitude, longitude, price_per_night, amenities } = req.body;
    
    if (!owner_id || !name || !type || !location || !price_per_night) {
        return res.status(400).json({ error: 'جميع الحقول المطلوبة مطلوبة' });
    }
    
    db.run(
        'INSERT INTO venues (owner_id, name, description, type, location, latitude, longitude, price_per_night, amenities) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [owner_id, name, description, type, location, latitude, longitude, price_per_night, amenities],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'خطأ في إنشاء المكان' });
            }
            
            res.json({ 
                success: true, 
                message: 'تم إنشاء المكان بنجاح. في انتظار موافقة الأدمن.',
                venue_id: this.lastID 
            });
        }
    );
});

app.get('/api/venues', (req, res) => {
    const { type, location, min_price, max_price, amenities } = req.query;
    
    let query = `
        SELECT v.*, 
               (SELECT COUNT(*) FROM reviews WHERE venue_id = v.id) as review_count,
               (SELECT AVG(rating) FROM reviews WHERE venue_id = v.id) as average_rating,
               (SELECT image_url FROM venue_images WHERE venue_id = v.id AND is_primary = 1 LIMIT 1) as primary_image
        FROM venues v 
        WHERE v.status = 'approved'
    `;
    
    const params = [];
    
    if (type) {
        query += ' AND v.type = ?';
        params.push(type);
    }
    
    if (location) {
        query += ' AND v.location LIKE ?';
        params.push(`%${location}%`);
    }
    
    if (min_price) {
        query += ' AND v.price_per_night >= ?';
        params.push(parseFloat(min_price));
    }
    
    if (max_price) {
        query += ' AND v.price_per_night <= ?';
        params.push(parseFloat(max_price));
    }
    
    query += ' ORDER BY v.created_at DESC';
    
    db.all(query, params, (err, venues) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في جلب الأماكن' });
        }
        
        res.json({ success: true, venues });
    });
});

app.get('/api/venues/:id', (req, res) => {
    const venueId = req.params.id;
    
    db.get(
        `SELECT v.*, 
                (SELECT COUNT(*) FROM reviews WHERE venue_id = v.id) as review_count,
                (SELECT AVG(rating) FROM reviews WHERE venue_id = v.id) as average_rating,
                (SELECT image_url FROM venue_images WHERE venue_id = v.id ORDER BY is_primary DESC) as images
         FROM venues v 
         WHERE v.id = ? AND v.status = 'approved'`,
        [venueId],
        (err, venue) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في جلب تفاصيل المكان' });
            }
            
            if (!venue) {
                return res.status(404).json({ error: 'المكان غير موجود' });
            }
            
            res.json({ success: true, venue });
        }
    );
});

// APIs للحجوزات
app.post('/api/bookings', (req, res) => {
    const { venue_id, user_id, check_in_date, check_out_date, total_price } = req.body;
    
    if (!venue_id || !user_id || !check_in_date || !check_out_date || !total_price) {
        return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }
    
    db.run(
        'INSERT INTO bookings (venue_id, user_id, check_in_date, check_out_date, total_price) VALUES (?, ?, ?, ?, ?)',
        [venue_id, user_id, check_in_date, check_out_date, total_price],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'خطأ في إنشاء الحجز' });
            }
            
            res.json({ 
                success: true, 
                message: 'تم إنشاء الحجز بنجاح',
                booking_id: this.lastID 
            });
        }
    );
});

app.get('/api/bookings/:user_id', (req, res) => {
    const userId = req.params.user_id;
    
    db.all(
        `SELECT b.*, v.name as venue_name, v.type as venue_type, v.location as venue_location
         FROM bookings b
         JOIN venues v ON b.venue_id = v.id
         WHERE b.user_id = ?
         ORDER BY b.created_at DESC`,
        [userId],
        (err, bookings) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في جلب الحجوزات' });
            }
            
            res.json({ success: true, bookings });
        }
    );
});

// APIs للمراجعات
app.post('/api/reviews', (req, res) => {
    const { booking_id, user_id, venue_id, rating, comment } = req.body;
    
    if (!booking_id || !user_id || !venue_id || !rating) {
        return res.status(400).json({ error: 'جميع الحقول المطلوبة مطلوبة' });
    }
    
    db.run(
        'INSERT INTO reviews (booking_id, user_id, venue_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
        [booking_id, user_id, venue_id, rating, comment],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'خطأ في إنشاء المراجعة' });
            }
            
            res.json({ 
                success: true, 
                message: 'تم إضافة المراجعة بنجاح',
                review_id: this.lastID 
            });
        }
    );
});

// APIs للمفضلات
app.post('/api/favorites', (req, res) => {
    const { user_id, venue_id } = req.body;
    
    if (!user_id || !venue_id) {
        return res.status(400).json({ error: 'معرّف المستخدم والمكان مطلوبان' });
    }
    
    db.run(
        'INSERT OR IGNORE INTO favorites (user_id, venue_id) VALUES (?, ?)',
        [user_id, venue_id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'خطأ في إضافة المفضلة' });
            }
            
            if (this.changes === 0) {
                return res.json({ success: true, message: 'المكان موجود بالفعل في المفضلة' });
            }
            
            res.json({ success: true, message: 'تمت إضافة المكان إلى المفضلة' });
        }
    );
});

app.get('/api/favorites/:user_id', (req, res) => {
    const userId = req.params.user_id;
    
    db.all(
        `SELECT f.*, v.name, v.type, v.location, v.price_per_night,
                (SELECT image_url FROM venue_images WHERE venue_id = v.id AND is_primary = 1 LIMIT 1) as primary_image
         FROM favorites f
         JOIN venues v ON f.venue_id = v.id
         WHERE f.user_id = ? AND v.status = 'approved'
         ORDER BY f.created_at DESC`,
        [userId],
        (err, favorites) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في جلب المفضلة' });
            }
            
            res.json({ success: true, favorites });
        }
    );
});

app.delete('/api/favorites', (req, res) => {
    const { user_id, venue_id } = req.body;
    
    if (!user_id || !venue_id) {
        return res.status(400).json({ error: 'معرّف المستخدم والمكان مطلوبان' });
    }
    
    db.run(
        'DELETE FROM favorites WHERE user_id = ? AND venue_id = ?',
        [user_id, venue_id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'خطأ في حذف المفضلة' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'المفضلة غير موجودة' });
            }
            
            res.json({ success: true, message: 'تم حذف المفضلة بنجاح' });
        }
    );
});

// APIs للأدمن
app.get('/api/admin/pending-venues', (req, res) => {
    db.all(
        `SELECT v.*, u.name as owner_name, u.email as owner_email, u.phone as owner_phone
         FROM venues v
         JOIN venue_owners vo ON v.owner_id = vo.id
         JOIN users u ON vo.user_id = u.id
         WHERE v.status = 'pending'
         ORDER BY v.created_at DESC`,
        (err, venues) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في جلب الأماكن قيد المراجعة' });
            }
            
            res.json({ success: true, venues });
        }
    );
});

app.put('/api/admin/venues/:id/status', (req, res) => {
    const venueId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'الحالة يجب أن تكون approved أو rejected' });
    }
    
    db.run(
        'UPDATE venues SET status = ? WHERE id = ?',
        [status, venueId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'خطأ في تحديث حالة المكان' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'المكان غير موجود' });
            }
            
            res.json({ success: true, message: `تم تحديث المكان إلى ${status}` });
        }
    );
});

app.get('/api/admin/stats', (req, res) => {
    const statsQueries = [
        'SELECT COUNT(*) as total_users FROM users WHERE user_type = "customer"',
        'SELECT COUNT(*) as total_venue_owners FROM venue_owners',
        'SELECT COUNT(*) as total_venues FROM venues WHERE status = "approved"',
        'SELECT COUNT(*) as total_bookings FROM bookings WHERE status = "confirmed"',
        'SELECT COUNT(*) as total_reviews FROM reviews',
        'SELECT COUNT(*) as total_pending_venues FROM venues WHERE status = "pending"'
    ];
    
    let completed = 0;
    const results = {};
    
    statsQueries.forEach((query, index) => {
        db.get(query, (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
            }
            
            const keys = ['total_users', 'total_venue_owners', 'total_venues', 'total_bookings', 'total_reviews', 'total_pending_venues'];
            results[keys[index]] = Object.values(row)[0];
            
            completed++;
            if (completed === statsQueries.length) {
                res.json({ success: true, stats: results });
            }
        });
    });
});

app.get('/api/admin/bookings', (req, res) => {
    db.all(
        `SELECT b.*, v.name as venue_name, u.name as user_name, u.email as user_email
         FROM bookings b
         JOIN venues v ON b.venue_id = v.id
         JOIN users u ON b.user_id = u.id
         ORDER BY b.created_at DESC`,
        (err, bookings) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في جلب الحجوزات' });
            }
            
            res.json({ success: true, bookings });
        }
    );
});

app.put('/api/admin/bookings/:id/status', (req, res) => {
    const bookingId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['confirmed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'الحالة يجب أن تكون confirmed أو cancelled' });
    }
    
    db.run(
        'UPDATE bookings SET status = ? WHERE id = ?',
        [status, bookingId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'خطأ في تحديث حالة الحجز' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'الحجز غير موجود' });
            }
            
            res.json({ success: true, message: `تم تحديث الحجز إلى ${status}` });
        }
    );
});

// تشغيل السيرفر
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
