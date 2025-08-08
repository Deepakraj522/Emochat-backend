# 🤖 Google Cloud NLP API Setup Guide

## 🎯 **Overview**
This guide will help you set up Google Cloud Natural Language Processing (NLP) API for advanced emotion analysis in your EMOCHAT backend.

## 🚀 **Step 1: Create Google Cloud Project**

### 1.1 Go to Google Cloud Console
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click **"Select a project"** → **"New Project"**
4. Project name: `emochat-nlp` (or any name you prefer)
5. Click **"Create"**

### 1.2 Enable Natural Language API
1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
2. Search for **"Cloud Natural Language API"**
3. Click on it and click **"Enable"**

## 🔑 **Step 2: Create Service Account**

### 2.1 Create Service Account
1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ Create Credentials"** → **"Service account"**
3. Service account name: `emochat-nlp-service`
4. Service account ID: `emochat-nlp-service` (auto-filled)
5. Click **"Create and Continue"**

### 2.2 Grant Permissions
1. Role: **"Cloud Natural Language API User"**
2. Click **"Continue"** → **"Done"**

### 2.3 Create and Download Key
1. In the **"Credentials"** page, find your service account
2. Click on the service account email
3. Go to **"Keys"** tab
4. Click **"Add Key"** → **"Create new key"**
5. Key type: **JSON**
6. Click **"Create"** and download the JSON file
7. **Keep this file secure!**

## 🔧 **Step 3: Configure Your Project**

### Option A: Using Service Account JSON File
1. Move the downloaded JSON file to your project root (outside public folders)
2. Rename it to something like `google-credentials.json`
3. Add to your `.env`:
```env
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GOOGLE_PROJECT_ID=your-project-id
```

### Option B: Using Environment Variables (Recommended)
1. Open the downloaded JSON file
2. Extract the required fields
3. Add to your `.env`:
```env
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_CLIENT_EMAIL=emochat-nlp-service@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
```

**⚠️ Important**: Keep the quotes and `\n` characters in the private key!

## 💰 **Step 4: Understanding Pricing**

### Google Cloud NLP Free Tier
- ✅ **5,000 units per month FREE**
- ✅ Each text analysis = 1 unit
- ✅ Perfect for development and small apps

### Example Usage:
- **100 messages/day** = 3,000 units/month (FREE)
- **500 messages/day** = 15,000 units/month (~$15/month)

## 🧪 **Step 5: Test Your Setup**

### 5.1 Start Your Server
```bash
npm start
```

### 5.2 Test Emotion Analysis Endpoint
```bash
curl -X POST http://localhost:5000/api/emotion/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{"text": "I am so excited about this new technology!"}'
```

### 5.3 Expected Response
```json
{
  "success": true,
  "message": "Emotion analyzed successfully",
  "data": {
    "emotion": "joy",
    "confidence": 0.892,
    "sentiment": {
      "score": 0.8,
      "magnitude": 0.9
    },
    "processedBy": "google-cloud-nlp",
    "processingTime": 245,
    "text": "I am so excited about this new technology!"
  }
}
```

## 🔄 **Step 6: Fallback Behavior**

Your EMOCHAT backend is designed with fallback:

1. **Primary**: Google Cloud NLP (high accuracy)
2. **Fallback**: Local keyword analysis (if Google Cloud fails)
3. **Always Works**: Your app never breaks

## 🛡️ **Security Best Practices**

### ✅ **Do:**
- Store credentials in environment variables
- Use service account with minimal permissions
- Add `google-credentials.json` to `.gitignore`
- Monitor API usage in Google Cloud Console

### ❌ **Don't:**
- Commit service account JSON to Git
- Share your private key
- Use root/owner roles for service account
- Ignore rate limits

## 🚨 **Troubleshooting**

### "Google Cloud NLP Error: Authentication failed"
**Solution**: 
- Check `GOOGLE_PROJECT_ID` matches your actual project ID
- Verify `GOOGLE_PRIVATE_KEY` format (keep `\n` characters)
- Ensure service account has "Cloud Natural Language API User" role

### "API not enabled"
**Solution**: 
- Go to Google Cloud Console → APIs & Services → Library
- Search "Cloud Natural Language API" and enable it

### "Quota exceeded"
**Solution**: 
- Check your usage in Google Cloud Console
- Upgrade to paid plan if needed
- Implement request rate limiting

### "Fallback to local analysis"
**Info**: This is normal behavior when:
- Google Cloud API is temporarily unavailable
- Authentication fails
- Network issues occur

## 📊 **Monitoring Usage**

### Check API Usage:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** → **Dashboard**
3. Click **"Cloud Natural Language API"**
4. View quotas and usage statistics

### Set Up Alerts:
1. **Monitoring** → **Alerting**
2. Create alert for quota usage
3. Get notified before hitting limits

## 🎯 **Advanced Features**

Once basic setup works, you can enhance with:

### Entity Recognition
```javascript
const [entitiesResult] = await client.analyzeEntities({document});
// Detect people, places, events mentioned in messages
```

### Content Classification
```javascript
const [classificationResult] = await client.classifyText({document});
// Categorize messages by topic
```

### Syntax Analysis
```javascript
const [syntaxResult] = await client.analyzeSyntax({document});
// Analyze grammar and sentence structure
```

## 🚀 **Production Deployment**

When deploying to production:

1. **Update Environment Variables** on your hosting platform
2. **Set Up Monitoring** in Google Cloud Console
3. **Configure Rate Limiting** to prevent abuse
4. **Set Up Usage Alerts** to monitor costs
5. **Test Fallback Behavior** thoroughly

Your EMOCHAT backend now has enterprise-grade emotion analysis! 🧠✨

---

**Need help?** Check the [Google Cloud NLP Documentation](https://cloud.google.com/natural-language/docs)
