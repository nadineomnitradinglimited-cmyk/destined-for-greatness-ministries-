# 🚀 QUICK START GUIDE - 5 Minute Setup

## Step 1: Get Your Free Stripe Account (2 minutes)

1. Go to: https://stripe.com
2. Click "Sign up"
3. Fill in your email and password
4. Verify your email
5. Go to https://dashboard.stripe.com/apikeys
6. Copy these 2 keys and save them:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

## Step 2: Setup Your Computer (1 minute)

1. Download and install Node.js from: https://nodejs.org (get the LTS version)
2. Download this project folder
3. Open command prompt/terminal in the folder
4. Type: `npm install`

## Step 3: Create Configuration File (1 minute)

1. In the project folder, create a file named `.env`
2. Copy this content into it:

```
NODE_ENV=production
PORT=3000
BASE_URL=http://localhost:3000

STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLIC_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_test_secret

EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

DATABASE_URL=./donations.db
```

3. Replace `YOUR_PUBLIC_KEY` and `YOUR_SECRET_KEY` with your Stripe keys from Step 1
4. Replace email info with your Gmail

## Step 4: Setup Gmail for Emails (Optional but recommended)

1. Go to: https://myaccount.google.com/security
2. Enable "2-Step Verification"
3. Go to "App passwords" (at the bottom of Security page)
4. Select "Mail" and "Windows Computer" (or your device)
5. Copy the generated password
6. Paste it in `.env` as `EMAIL_PASSWORD`

## Step 5: Update Donation Page

1. Open `donate.html` in a text editor
2. Find this line (around line 206):
   ```javascript
   const stripe = Stripe('pk_test_YOUR_STRIPE_PUBLIC_KEY');
   ```
3. Replace `pk_test_YOUR_STRIPE_PUBLIC_KEY` with your actual Stripe PUBLIC key
4. Save the file

## Step 6: Test It! (1 minute)

1. In command prompt, type: `npm start`
2. Open browser to: http://localhost:3000/donate.html
3. Try a test donation with card: `4242 4242 4242 4242`
4. Use any future expiry date and any 3-digit CVC
5. Click "Donate Now"
6. Check command prompt for success message
7. Check admin dashboard: http://localhost:3000/admin-dashboard.html

## 🎉 That's It!

Your donation website is running locally. Now you can:

- **Test donations** with test card numbers
- **View donations** in admin dashboard
- **Check the database** donations.db file
- **Test emails** (if Gmail configured)

## 📋 Test Card Numbers

**Successful payment:**
- `4242 4242 4242 4242`
- Any future date (e.g., 12/25)
- Any 3-digit CVC (e.g., 123)

**Declined payment:**
- `4000 0000 0000 0002`

## 🌍 Going Live

When ready to deploy:

1. Switch from test keys to live keys in Stripe dashboard
2. Update `.env` with live keys (they start with `pk_live_` and `sk_live_`)
3. Deploy to hosting (Heroku, AWS, etc.)
4. Update `BASE_URL` in `.env` to your real domain
5. Enable HTTPS

## 📁 Your Files

| File | Purpose |
|------|---------|
| `index-updated.html` | Homepage - update with your info |
| `donate.html` | Donation page - NEED TO ADD YOUR STRIPE KEY |
| `ministries.html` | School and programs info |
| `contact.html` | Contact form |
| `admin-dashboard.html` | View all donations |
| `server.js` | Backend server (do NOT edit) |
| `.env` | Your secrets (do NOT share) |
| `package.json` | List of software needed |

## ⚠️ Important

- **NEVER share your `.env` file** - it has your secret keys
- **NEVER upload `.env` to GitHub/internet** - keep it private
- **Test mode is FREE** - use test cards and test keys while learning
- **Live mode charges real money** - switch to live keys only when ready

## 🆘 Common Issues

**"npm: command not found"**
- Node.js not installed. Download from https://nodejs.org

**"Port 3000 in use"**
- Change PORT in `.env` to 3001 or 3002
- OR kill the process using port 3000

**"Cannot find module"**
- Run `npm install` again
- Make sure you're in the right folder

**Donations not saving**
- Check the `.env` file exists and has correct keys
- Check command prompt for error messages

**Emails not sending**
- Check Gmail App Password is in `.env` (NOT regular password)
- Check spam folder
- Try a different email service in `.env`

## 📞 Need Help?

1. Read the full `README.md` for detailed info
2. Check command prompt for error messages
3. Stripe docs: https://stripe.com/docs
4. Node.js help: https://nodejs.org

## ✅ Next: Deploy to Real Server

Once testing is done locally:

1. Get a hosting account (Heroku, AWS, Digital Ocean, etc.)
2. Follow deployment instructions in `README.md`
3. Use live Stripe keys
4. Point your domain to your server
5. Enable HTTPS with Let's Encrypt (free)

---

**You're all set! Start donating! 💚**
