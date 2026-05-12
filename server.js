require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Database setup
const db = new sqlite3.Database('./donations.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    db.run(`
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
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS email_subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

// Email configuration
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Routes

// Donation endpoint
app.post('/api/donate', async (req, res) => {
    try {
        const {
            paymentMethodId,
            amount,
            firstName,
            lastName,
            email,
            phone,
            donationType,
            signup
        } = req.body;

        // Validate amount
        if (!amount || amount < 100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount'
            });
        }

        if (!stripe) {
            return res.status(503).json({ success: false, message: 'Payment system not configured yet.' });
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method: paymentMethodId,
            confirm: true,
            return_url: `${process.env.BASE_URL || 'http://localhost:3000'}/donate.html`
        });

        if (paymentIntent.status === 'succeeded') {
            // Save to database
            const amountInDollars = amount / 100;
            db.run(
                `INSERT INTO donations (first_name, last_name, email, phone, donation_type, amount, stripe_payment_id, status, signup, ip_address)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [firstName, lastName, email, phone, donationType, amountInDollars, paymentIntent.id, 'completed', signup ? 1 : 0, req.ip],
                function(err) {
                    if (err) {
                        console.error('Database error:', err);
                    }
                }
            );

            // Add to email subscribers if opted in
            if (signup) {
                db.run(
                    `INSERT OR IGNORE INTO email_subscribers (email, name) VALUES (?, ?)`,
                    [email, `${firstName} ${lastName}`],
                    (err) => {
                        if (err) console.error('Subscriber error:', err);
                    }
                );
            }

            // Send confirmation email
            const donationAmount = (amount / 100).toFixed(2);
            await sendDonationConfirmation(email, firstName, donationAmount, paymentIntent.id);

            return res.json({
                success: true,
                message: 'Donation successful',
                paymentId: paymentIntent.id
            });
        } else if (paymentIntent.status === 'requires_action') {
            return res.json({
                success: false,
                message: 'Payment requires action',
                clientSecret: paymentIntent.client_secret
            });
        } else {
            return res.json({
                success: false,
                message: 'Payment failed'
            });
        }
    } catch (error) {
        console.error('Donation error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Send donation confirmation email
async function sendDonationConfirmation(email, name, amount, paymentId) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Donation Confirmation - Destined for Greatness Ministries',
        html: `
            <h2>Thank You for Your Generosity!</h2>
            <p>Dear ${name},</p>
            <p>Thank you for your donation of <strong>$${amount}</strong> to Destined for Greatness Messianic Ministries.</p>
            <p><strong>Confirmation Details:</strong></p>
            <ul>
                <li>Payment ID: ${paymentId}</li>
                <li>Amount: $${amount}</li>
                <li>Date: ${new Date().toLocaleDateString()}</li>
            </ul>
            <p>Your donation is tax-deductible. A tax receipt will be sent to you separately.</p>
            <p>Your generosity helps us serve our community with love and faith. Together, we are making a difference!</p>
            <p>Blessings,<br/>Destined for Greatness Messianic Ministries Team</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Email error:', error);
    }
}

// Admin endpoints

// Get all donations (protected route - add authentication)
app.get('/api/admin/donations', (req, res) => {
    // TODO: Add authentication middleware
    db.all('SELECT * FROM donations ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Get donation statistics
app.get('/api/admin/stats', (req, res) => {
    // TODO: Add authentication middleware
    db.get(
        `SELECT 
            COUNT(*) as totalDonations,
            SUM(amount) as totalAmount,
            AVG(amount) as averageAmount,
            MAX(created_at) as latestDonation
         FROM donations WHERE status = 'completed'`,
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(row);
        }
    );
});

// Get donations by type
app.get('/api/admin/donations-by-type', (req, res) => {
    // TODO: Add authentication middleware
    db.all(
        `SELECT donation_type, COUNT(*) as count, SUM(amount) as total
         FROM donations WHERE status = 'completed'
         GROUP BY donation_type`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// Get monthly donation data
app.get('/api/admin/monthly-donations', (req, res) => {
    // TODO: Add authentication middleware
    db.all(
        `SELECT 
            strftime('%Y-%m', created_at) as month,
            COUNT(*) as count,
            SUM(amount) as total
         FROM donations WHERE status = 'completed'
         GROUP BY month
         ORDER BY month DESC
         LIMIT 12`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// Get email subscribers
app.get('/api/admin/subscribers', (req, res) => {
    // TODO: Add authentication middleware
    db.all('SELECT * FROM email_subscribers ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Export donations as CSV
app.get('/api/admin/export-donations', (req, res) => {
    // TODO: Add authentication middleware
    db.all('SELECT * FROM donations ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Convert to CSV
        const csv = convertToCSV(rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="donations.csv"');
        res.send(csv);
    });
});

function convertToCSV(data) {
    const headers = Object.keys(data[0]);
    const csv = [headers.join(',')];

    data.forEach(row => {
        const values = headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && value.includes(',')) {
                return `"${value}"`;
            }
            return value;
        });
        csv.push(values.join(','));
    });

    return csv.join('\n');
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Webhook for Stripe events (optional - for additional processing)
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle different event types
    switch (event.type) {
        case 'payment_intent.succeeded':
            console.log('Payment succeeded:', event.data.object);
            break;
        case 'payment_intent.payment_failed':
            console.log('Payment failed:', event.data.object);
            break;
    }

    res.json({ received: true });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'An error occurred',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing database and server');
    db.close();
    process.exit(0);
});
