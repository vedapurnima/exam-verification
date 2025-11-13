# Deployment Guide

## Frontend Deployment (Vercel)

The frontend is configured to deploy on Vercel. 

### Setting Backend API URL

The frontend is configured to use the production backend by default: `https://exam-verification-1.onrender.com`

**Optional:** If you want to override the backend URL, set the `VITE_API_BASE_URL` environment variable in Vercel:

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add a new variable:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://exam-verification-1.onrender.com` (or your custom backend URL)
   - **Environment**: Production, Preview, Development (select all)

4. Redeploy your application

**Note:** If `VITE_API_BASE_URL` is not set, the app will default to `https://exam-verification-1.onrender.com`

### Backend Deployment Options

#### Option 1: Deploy Backend on Vercel (Serverless Functions)
- Convert backend to Vercel serverless functions
- API will be available at `/api/*` routes
- Update `VITE_API_BASE_URL` to use relative paths or your Vercel domain

#### Option 2: Deploy Backend Separately
Deploy your backend on:
- **Railway**: https://railway.app
- **Render**: https://render.com
- **Heroku**: https://heroku.com
- **DigitalOcean App Platform**: https://www.digitalocean.com/products/app-platform

Then set `VITE_API_BASE_URL` to your backend URL.

#### Option 3: Use Same Domain with API Routes
If deploying both on Vercel, configure API routes in `vercel.json` to proxy to your backend.

### Current Configuration

- **Development**: 
  - Default: `https://exam-verification-1.onrender.com`
  - For local development, set `VITE_API_BASE_URL=http://localhost:4001` or `http://10.10.10.52:4001` (WiFi IP)
- **Production**: 
  - Default: `https://exam-verification-1.onrender.com`
  - Can be overridden with `VITE_API_BASE_URL` environment variable

### Backend Information

- **Production Backend URL**: `https://exam-verification-1.onrender.com`
- **Backend CORS**: Configured to allow requests from `https://exam-verification.vercel.app`

Make sure your backend:
- Has CORS enabled for your frontend domain
- Is accessible from the internet
- Has the Google Sheets credentials configured

