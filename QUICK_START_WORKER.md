# Quick Start: Ably Worker

Get your dedicated Ably worker running in 5 minutes.

## 🚀 Local Development

### 1. Install Dependencies
```bash
npm run worker:install
```

### 2. Configure Environment
Make sure your `.env` file has:
```env
ABLY_API_KEY=your_ably_server_key
DATABASE_URL=your_neon_database_url
```

### 3. Start the Worker
```bash
npm run worker:dev
```

You should see:
```
🎬 Starting Ably Worker...
   Environment: development
   Health check port: 3001
🏥 Health check server running on port 3001
🚀 Initializing Ably worker...
✅ Database pool initialized
✅ Ably connection established
✅ Worker initialized with 2 subscriptions
```

### 4. Test It
```bash
npm run worker:health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 15,
  "connectionState": "connected",
  "subscriptions": 2,
  "requestsProcessed": 0,
  "requestsFailed": 0
}
```

---

## ☁️ Production Deployment (Railway - Easiest)

### 1. Create Railway Account
- Go to https://railway.app
- Sign up with GitHub
- Get $5 free credit

### 2. Install CLI
```bash
npm install -g @railway/cli
railway login
```

### 3. Deploy
```bash
# From project root
railway init
railway link

# Set environment variables
railway variables set ABLY_API_KEY="your_key_here"
railway variables set DATABASE_URL="your_db_url_here"
railway variables set NODE_ENV="production"

# Deploy!
railway up
```

### 4. Monitor
```bash
railway logs --tail
```

---

## 🐳 Docker Deployment (Alternative)

### Build and Run
```bash
# Build image
npm run worker:docker:build

# Run container
npm run worker:docker:run

# Check status
docker ps
docker logs ably-worker

# Test health
curl http://localhost:3001/health
```

---

## 📊 What to Monitor

After deployment, keep an eye on:

1. **Connection State**: Should always be `connected`
2. **Subscription Count**: Should be `2`
3. **Requests Processed**: Should increase as users scan QR codes
4. **Retry Attempts**: Should be `0` when healthy
5. **Last Error**: Should be `null`

---

## 🐛 Troubleshooting

### Worker won't start
- Check `.env` file exists and has correct values
- Verify `ABLY_API_KEY` has full server permissions
- Ensure `DATABASE_URL` is accessible

### Connection keeps dropping
- Check Ably service status: https://status.ably.com
- Verify API key hasn't expired
- Check platform logs for errors

### No requests being processed
- Verify client app is publishing to correct channels
- Check subscription count is 2
- Review worker logs for errors

---

## 📚 Next Steps

1. ✅ Worker is running locally
2. 📖 Read full deployment guide: [WORKER_DEPLOYMENT.md](./WORKER_DEPLOYMENT.md)
3. 🚀 Deploy to production (Railway/Render/DigitalOcean)
4. 🔍 Set up monitoring and alerts
5. 📊 Monitor for 24 hours to ensure stability

---

## 💡 Tips

- **Development**: Run both Next.js dev server AND worker locally
- **Production**: Deploy worker to Railway/Render, Next.js to Vercel
- **Monitoring**: Use platform dashboards + health endpoint
- **Scaling**: Start with smallest plan, upgrade if needed
- **Debugging**: Check logs first, then health endpoint

---

**Need more help?** See [WORKER_DEPLOYMENT.md](./WORKER_DEPLOYMENT.md) for detailed documentation.
