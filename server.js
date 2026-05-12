require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const Database = require('better-sqlite3');
const path = require('path');
const nodemailer = require('nodemailer');

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
`);

console.log('Connected to SQLite database');

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
