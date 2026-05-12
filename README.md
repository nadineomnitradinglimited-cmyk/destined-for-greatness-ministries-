# Destined for Greatness - Full Stack Donation Website

A complete solution for managing donations for Destined for Greatness Messianic Ministries, featuring Kaloko New Life School.

## 📋 Features

- **Website Pages**
  - Homepage with ministry overview
  - Ministries page featuring Kaloko New Life School
  - Donation page with Stripe integration
  - Contact form
  - Admin dashboard for viewing donations

- **Donation System**
  - Stripe payment processing
  - Preset and custom donation amounts
  - Email confirmations
  - Database storage of all donations
  - Tax-deductible receipts

- **Admin Dashboard**
  - View all donations with filters
  - Donation statistics and analytics
  - Monthly donation trends
  - Donation breakdown by category
  - Email subscriber management
  - Export donations as CSV

- **Database**
  - SQLite for easy deployment
  - Donation history
  - Email subscriber list
  - Admin user management

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm
- Stripe account (free tier works)
- Gmail account or email service

### 1. Installation

```bash
# Clone or download the project
cd destined-for-greatness

# Install dependencies
npm install
```

### 2. Configuration

1. **Create `.env` file** (copy from `.env.example`):
```bash
cp .env.example .env
```

2. **Get Stripe Keys**
   - Go to https://stripe.com
   - Sign up for free account
   - Navigate to Developers > API Keys
   - Copy your **Publishable Key** and **Secret Key**
   - Add to `.env`:
     ```
     STRIPE_PUBLIC_KEY=pk_test_your_key_here
     STRIPE_SECRET_KEY=sk_test_your_key_here
     ```

3. **Setup Email** (for donation confirmations)
   - Gmail: Enable 2FA, create App Password
   - Add to `.env`:
     ```
     EMAIL_USER=your-email@gmail.com
     EMAIL_PASSWORD=your-app-password
     ```

4. **Update donation page**
   - In `donate.html`, find this line:
     ```javascript
     const stripe = Stripe('pk_test_YOUR_STRIPE_PUBLIC_KEY');
     ```
   - Replace with your actual public key from `.env`

### 3. Update Website Content

Edit these files with your actual information:

**index-updated.html:**
- Replace `[Your Address Here]`
- Update phone and email in contact info

**donate.html:**
- Update your Stripe public key
- Customize impact messages

**ministries.html:**
- Update school information
- Add specific programs and statistics

**contact.html:**
- Add real phone number
- Add real email addresses
- Add office hours

### 4. Run Locally

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will run on `http://localhost:3000`

Test at: http://localhost:3000/donate.html

## 💳 Testing Stripe Payments

Use these test card numbers:

**Success:**
- Card: `4242 4242 4242 4242`
- Exp: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)

**Decline:**
- Card: `4000 0000 0000 0002`

## 📁 File Structure

```
.
├── index-updated.html          # Homepage
├── donate.html                 # Donation page
├── ministries.html             # Ministries & school info
├── contact.html                # Contact form
├── admin-dashboard.html        # Admin panel
├── server.js                   # Express backend
├── package.json                # Dependencies
├── .env.example                # Environment template
├── .env                        # Your configuration (create this)
└── donations.db                # SQLite database (auto-created)
```

## 🌐 Deployment

### Option 1: Heroku (Free tier available)

1. Install Heroku CLI
2. Create account at https://www.heroku.com
3. Deploy:
   ```bash
   heroku login
   heroku create your-app-name
   git push heroku main
   heroku config:set STRIPE_PUBLIC_KEY=pk_...
   heroku config:set STRIPE_SECRET_KEY=sk_...
   heroku config:set EMAIL_USER=your@email.com
   heroku config:set EMAIL_PASSWORD=password
   ```

### Option 2: AWS / Azure / Digital Ocean

1. Rent a VPS or use managed Node hosting
2. Install Node.js
3. Clone repository
4. Setup `.env` file
5. Run `npm install && npm start`
6. Use PM2 to keep running:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "donations"
   pm2 startup
   pm2 save
   ```

### Option 3: Docker

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t donations .
docker run -p 3000:3000 --env-file .env donations
```

## 📊 Admin Dashboard Access

1. Navigate to `http://yourdomain.com/admin-dashboard.html`
2. Implement authentication (currently needs to be added)
3. View donations, statistics, and export data

**TODO:** Add login authentication to admin panel

## 💰 Donation Workflow

1. User visits donate.html
2. Selects donation amount or enters custom
3. Fills form with name, email, etc.
4. Enters card details (via Stripe)
5. Clicks "Donate Now"
6. Payment processed securely by Stripe
7. Donation saved to database
8. Confirmation email sent
9. Admin sees donation in dashboard

## 📧 Email Setup

If using Gmail:
1. Enable 2-factor authentication
2. Create App Password (not regular password)
3. Use App Password in `.env`

For other email providers, adjust `EMAIL_SERVICE` and credentials in `.env`

## 🔒 Security Notes

1. **Never commit `.env` file** - it contains sensitive keys
2. **Use HTTPS** on production site
3. **Stripe handles PCI compliance** - your server never sees full card data
4. **Add authentication** to admin panel before going live
5. **Validate** all input on backend
6. **Rate limit** donation endpoint to prevent abuse

## 🐛 Troubleshooting

**"Cannot find module stripe"**
- Run `npm install` to install dependencies

**Donations not appearing**
- Check that server is running
- Check `.env` file has correct keys
- Check browser console for errors

**Emails not sending**
- Verify Gmail App Password
- Check email address is correct
- Check spam folder

**Stripe errors**
- Verify public/secret keys match
- Check you're using test keys (start with pk_test/sk_test)
- Visit https://dashboard.stripe.com for details

## 📝 Next Steps

1. **Add Admin Authentication**
   - Implement login screen
   - Hash passwords
   - Validate admin access

2. **Email Marketing**
   - Send newsletters to subscribers
   - Automated thank you sequences

3. **Recurring Donations**
   - Monthly subscription option
   - Manage subscriptions

4. **Mobile App**
   - React Native app
   - Push notifications

5. **Integration**
   - Connect to accounting software
   - Automate tax receipts

## 📞 Support

For issues or questions:
1. Check logs: `npm run dev` shows all errors
2. Visit Stripe docs: https://stripe.com/docs
3. Check Node.js docs: https://nodejs.org/docs

## 📄 Tax Information

This is a 501(c)(3) nonprofit organization website. Ensure:
- All donations are properly logged
- Tax receipts are sent to donors
- Annual reports are filed
- Donation records are backed up

## 🎯 Customization

### Change Colors
Edit `:root` section in HTML files:
```css
:root {
    --gold: #F4C430;
    --dark: #1a1a1a;
}
```

### Add More Donation Categories
Edit `donate.html` select options:
```html
<option value="your-category">Category Name</option>
```

### Change Donation Amounts
Edit `donate.html` amount buttons:
```html
<button type="button" class="amount-btn" data-amount="50">$50</button>
```

## 📚 Resources

- Stripe Documentation: https://stripe.com/docs
- Express.js Guide: https://expressjs.com
- Node.js Tutorials: https://nodejs.org
- SQLite Reference: https://www.sqlite.org/docs.html
- Nodemailer Docs: https://nodemailer.com

## 📄 License

MIT License - Feel free to use and modify

---

**Last Updated:** May 2024
**Version:** 1.0.0
**Maintained by:** Nadine Omni Trading Limited
