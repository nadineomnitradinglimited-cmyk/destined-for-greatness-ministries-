require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const Database = require('better-sqlite3');
const path = require('path');
const nodemailer = require('nodemailer');
const multer = require('multer');
const fs = require('fs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Database setup
const db = new Database('./donations.db');
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        donation_type TEXT,
        amount INTEGER,
        currency TEXT DEFAULT 'USD',
        stripe_payment_id TEXT UNIQUE,
        status TEXT DEFAULT 'completed',
        signup BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN DEFAULT 1,
        image_url TEXT NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT,
        primary_label TEXT,
        primary_url TEXT,
        secondary_label TEXT,
        secondary_url TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bible_verses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN DEFAULT 1,
        reference TEXT NOT NULL,
        verse_text TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT DEFAULT 'Teaching',
        description TEXT,
        mp3_name TEXT,
        mp3_path TEXT,
        pdf_name TEXT,
        pdf_path TEXT,
        active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`);

console.log('Connected to SQLite database');

seedContentTables();

// Email configuration
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// ── Donation endpoint ──
app.post('/api/donate', async (req, res) => {
    try {
        const { paymentMethodId, amount, firstName, lastName, email, phone, donationType, signup } = req.body;

        if (!amount || amount < 100) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        if (!stripe) {
            return res.status(503).json({ success: false, message: 'Payment system not configured yet.' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            payment_method: paymentMethodId,
            confirm: true,
            return_url: `${process.env.BASE_URL || 'http://localhost:3000'}/index.html`
        });

        if (paymentIntent.status === 'succeeded') {
            const amountInDollars = amount / 100;

            db.prepare(`
                INSERT INTO donations (first_name, last_name, email, phone, donation_type, amount, stripe_payment_id, status, signup, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(firstName, lastName, email, phone, donationType, amountInDollars, paymentIntent.id, 'completed', signup ? 1 : 0, req.ip);

            if (signup) {
                db.prepare(`INSERT OR IGNORE INTO email_subscribers (email, name) VALUES (?, ?)`)
                  .run(email, `${firstName} ${lastName}`);
            }

            await sendDonationConfirmation(email, firstName, (amount / 100).toFixed(2), paymentIntent.id);

            return res.json({ success: true, message: 'Donation successful', paymentId: paymentIntent.id });

        } else if (paymentIntent.status === 'requires_action') {
            return res.json({ success: false, message: 'Payment requires action', clientSecret: paymentIntent.client_secret });
        } else {
            return res.json({ success: false, message: 'Payment failed' });
        }

    } catch (error) {
        console.error('Donation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Send confirmation email
async function sendDonationConfirmation(email, name, amount, paymentId) {
    if (!process.env.EMAIL_USER) return;
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Donation Confirmation – Destined for Greatness Ministries',
            html: `
                <h2>Thank You for Your Generosity!</h2>
                <p>Dear ${name},</p>
                <p>Thank you for your donation of <strong>$${amount}</strong> to Destined for Greatness Messianic Ministries.</p>
                <ul>
                    <li>Payment ID: ${paymentId}</li>
                    <li>Amount: $${amount}</li>
                    <li>Date: ${new Date().toLocaleDateString()}</li>
                </ul>
                <p>Your donation is tax-deductible. Blessings,<br/>Destined for Greatness Messianic Ministries</p>
            `
        });
    } catch (error) {
        console.error('Email error:', error);
    }
}

// ── Admin endpoints ──
app.get('/api/admin/donations', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM donations ORDER BY created_at DESC').all();
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/stats', (req, res) => {
    try {
        const row = db.prepare(`
            SELECT COUNT(*) as totalDonations, SUM(amount) as totalAmount,
                   AVG(amount) as averageAmount, MAX(created_at) as latestDonation
            FROM donations WHERE status = 'completed'
        `).get();
        res.json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/donations-by-type', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT donation_type, COUNT(*) as count, SUM(amount) as total
            FROM donations WHERE status = 'completed' GROUP BY donation_type
        `).all();
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/monthly-donations', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count, SUM(amount) as total
            FROM donations WHERE status = 'completed'
            GROUP BY month ORDER BY month DESC LIMIT 12
        `).all();
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/subscribers', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM email_subscribers ORDER BY created_at DESC').all();
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/login', (req, res) => {
    try {
        const username = String(req.body.username || '').trim();
        const password = String(req.body.password || '');
        const expectedUser = process.env.ADMIN_USERNAME || 'admin';
        const expectedPass = process.env.ADMIN_PASSWORD || 'admin123';

        if (username === expectedUser && password === expectedPass) {
            return res.json({ success: true });
        }

        res.status(401).json({ success: false, message: 'Invalid username or password.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Login error.' });
    }
});

app.get('/api/content', (req, res) => {
    try {
        res.json(getSiteContent(true));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/content', (req, res) => {
    try {
        res.json(getSiteContent(false));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/content', (req, res) => {
    try {
        const banners = Array.isArray(req.body.banners) ? req.body.banners : [];
        const verses = Array.isArray(req.body.verses) ? req.body.verses : [];

        const save = db.transaction(() => {
            db.prepare('DELETE FROM site_banners').run();
            db.prepare('DELETE FROM bible_verses').run();

            const insertBanner = db.prepare(`
                INSERT INTO site_banners
                (sort_order, active, image_url, title, subtitle, primary_label, primary_url, secondary_label, secondary_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            banners.forEach((banner, index) => {
                const imageUrl = String(banner.imageUrl || banner.image_url || '').trim();
                const title = String(banner.title || '').trim();
                if (!imageUrl || !title) return;

                insertBanner.run(
                    index,
                    banner.active ? 1 : 0,
                    imageUrl,
                    title,
                    String(banner.subtitle || '').trim(),
                    String(banner.primaryLabel || banner.primary_label || '').trim(),
                    String(banner.primaryUrl || banner.primary_url || '').trim(),
                    String(banner.secondaryLabel || banner.secondary_label || '').trim(),
                    String(banner.secondaryUrl || banner.secondary_url || '').trim()
                );
            });

            const insertVerse = db.prepare(`
                INSERT INTO bible_verses (sort_order, active, reference, verse_text)
                VALUES (?, ?, ?, ?)
            `);

            verses.forEach((verse, index) => {
                const reference = String(verse.reference || '').trim();
                const text = String(verse.text || verse.verse_text || '').trim();
                if (!reference || !text) return;

                insertVerse.run(index, verse.active ? 1 : 0, reference, text);
            });

            seedContentTables();
        });

        save();
        res.json({ success: true, content: getSiteContent(false) });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/admin/export-donations', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM donations ORDER BY created_at DESC').all();
        if (!rows.length) return res.send('No donations yet.');
        const headers = Object.keys(rows[0]);
        const csv = [headers.join(','), ...rows.map(row =>
            headers.map(h => {
                const v = row[h] ?? '';
                return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
            }).join(',')
        )].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="donations.csv"');
        res.send(csv);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── File upload setup (lessons) ──
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, Date.now() + '_' + safe);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['audio/mpeg', 'application/pdf'];
        cb(null, allowed.includes(file.mimetype));
    }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// ── PUBLIC: Get all active lessons ──
app.get('/api/lessons', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT id, title, category, description, mp3_name, mp3_path, pdf_name, pdf_path, created_at
            FROM lessons WHERE active = 1 ORDER BY created_at DESC
        `).all();
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: Get all lessons (including inactive) ──
app.get('/api/admin/lessons', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM lessons ORDER BY created_at DESC').all();
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: Upload new lesson ──
app.post('/api/admin/lessons', upload.fields([
    { name: 'mp3', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
]), (req, res) => {
    try {
        const { title, category, description } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

        const mp3  = req.files?.mp3?.[0];
        const pdf  = req.files?.pdf?.[0];

        if (!mp3 && !pdf) return res.status(400).json({ success: false, message: 'At least one file (MP3 or PDF) is required' });

        const result = db.prepare(`
            INSERT INTO lessons (title, category, description, mp3_name, mp3_path, pdf_name, pdf_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            title,
            category || 'Teaching',
            description || '',
            mp3 ? mp3.originalname : null,
            mp3 ? '/uploads/' + mp3.filename : null,
            pdf ? pdf.originalname : null,
            pdf ? '/uploads/' + pdf.filename : null
        );

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── ADMIN: Delete lesson ──
app.delete('/api/admin/lessons/:id', (req, res) => {
    try {
        const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
        if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

        // Delete physical files
        [lesson.mp3_path, lesson.pdf_path].forEach(p => {
            if (p) {
                const full = path.join(__dirname, p);
                if (fs.existsSync(full)) fs.unlinkSync(full);
            }
        });

        db.prepare('DELETE FROM lessons WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// Stripe webhook
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    if (!process.env.STRIPE_WEBHOOK_SECRET || !stripe) return res.json({ received: true });
    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        console.log('Webhook event:', event.type);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    res.json({ received: true });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'An error occurred' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('SIGTERM', () => { db.close(); process.exit(0); });

function seedContentTables() {
    const bannerCount = db.prepare('SELECT COUNT(*) as count FROM site_banners').get().count;
    if (!bannerCount) {
        const insertBanner = db.prepare(`
            INSERT INTO site_banners
            (sort_order, active, image_url, title, subtitle, primary_label, primary_url, secondary_label, secondary_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertBanner.run(
            0,
            1,
            'banner.jpg',
            'Destined for Greatness',
            'Messianic Ministries',
            'Explore Our Work',
            '#ministries',
            'Make a Donation',
            '#donate'
        );
        insertBanner.run(
            1,
            1,
            'banner2.jpg',
            'Destined for Greatness',
            'Messianic Ministries',
            'Explore Our Work',
            '#ministries',
            'Make a Donation',
            '#donate'
        );
    }

    const verseCount = db.prepare('SELECT COUNT(*) as count FROM bible_verses').get().count;
    if (!verseCount) {
        db.prepare(`
            INSERT INTO bible_verses (sort_order, active, reference, verse_text)
            VALUES (?, ?, ?, ?)
        `).run(
            0,
            1,
            'Ephesians 2:10',
            "For we are God's handiwork, created in Messiah Yeshua to do good works, which God prepared in advance for us to do."
        );
    }
}

function getSiteContent(activeOnly) {
    const bannerWhere = activeOnly ? 'WHERE active = 1' : '';
    const verseWhere = activeOnly ? 'WHERE active = 1' : '';

    const banners = db.prepare(`
        SELECT
            id,
            sort_order as sortOrder,
            active,
            image_url as imageUrl,
            title,
            subtitle,
            primary_label as primaryLabel,
            primary_url as primaryUrl,
            secondary_label as secondaryLabel,
            secondary_url as secondaryUrl
        FROM site_banners
        ${bannerWhere}
        ORDER BY sort_order ASC, id ASC
    `).all().map(row => ({ ...row, active: Boolean(row.active) }));

    const verses = db.prepare(`
        SELECT
            id,
            sort_order as sortOrder,
            active,
            reference,
            verse_text as text
        FROM bible_verses
        ${verseWhere}
        ORDER BY sort_order ASC, id ASC
    `).all().map(row => ({ ...row, active: Boolean(row.active) }));

    return { banners, verses };
}
