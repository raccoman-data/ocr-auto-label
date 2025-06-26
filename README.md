# Lead-Photo Auto-Tagger

> **Born from real field research frustration – automatically rename thousands of sample photos using AI.**

I built this app specifically for the team at [leadresearch.org](https://leadresearch.org) who were collecting thousands of object sampl photos in Malawi and Kenya for lead contamination research. They were taking photos of each sample with handwritten labels like "MWI.1.2.15.7B.12.8" and needed a quicker way to rename the files to match the appropriate codes (even the photos with no visible code).

---

## 🎯 The Problem This Solves

**Before:** Field researchers have thousands of photos named `IMG_1234.jpg`, `IMG_1235.jpg`, etc. Each one needs to be manually opened, the handwritten sample code read if it existed, and the file renamed – taking 30-60 seconds per photo. For 2,000 samples, that's **20-40 hours of mind-numbing work**. If there was no code in the file, it needed to be manually associated with another object/image that did have a code.

**After:** Drop your camera folder into the app, grab coffee, come back to perfectly renamed files like `MWI.1.2.15.7B.12.8.jpg`. What used to take days now takes minutes.

### How It Works:
1. **Drag your photo folder** (or ZIP file) into the web app
2. **Google's AI reads each handwritten label** and extracts the sample code
3. **Smart grouping** finds photos without clear labels and groups them with similar ones
4. **Quick review interface** lets you fix any mistakes with Excel-like keyboard shortcuts
5. **Export** your perfectly organized collection

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Node.js (1 minute)
Node.js is like the "engine" that runs the app on your computer.

**For Mac/Linux users:**
```bash
# Copy and paste this into Terminal
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 18
fnm use 18
```

**For Windows users:**
1. Go to [nodejs.org](https://nodejs.org/)
2. Download the "LTS" version (the green button)
3. Run the installer and click "Next" through everything

### Step 2: Download the App (30 seconds)
```bash
# Copy and paste this into Terminal (Mac/Linux) or Command Prompt (Windows)
git clone https://github.com/your-org/ocr-auto-label.git
cd ocr-auto-label
```

**Don't have git?** [Click here to download as ZIP](https://github.com/your-org/ocr-auto-label/archive/refs/heads/main.zip), then unzip it.

### Step 3: Install App Dependencies (2 minutes)
```bash
# This downloads all the code libraries the app needs
npm run install:all
```

### Step 4: Get Your AI Key (1 minute)
The app uses Google's AI to read the handwritten codes. You need a free API key:

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click **"Get API Key"** in the top right
3. Click **"Create API Key"** → **"Create API key in new project"**
4. Copy the long string that appears (starts with `AIza...`)

### Step 5: Add Your Key to the App (30 seconds)
Create a file called `.env` in the `backend` folder with your key:

**Mac/Linux:**
```bash
echo "GEMINI_API_KEY=YOUR_KEY_HERE" > backend/.env
```

**Windows (Command Prompt):**
```cmd
echo GEMINI_API_KEY=YOUR_KEY_HERE > backend\.env
```

**Or manually:** Create a file called `.env` in the `backend` folder and put this inside:
```
GEMINI_API_KEY=YOUR_KEY_HERE
```

### Step 6: Start the App (10 seconds)
```bash
npm start
```

🎉 **That's it!** The app will open in your browser at `http://localhost:3000`

---

## 📖 How to Use the App

### Uploading Photos
1. **Drag and drop** your photo folder or ZIP file into the web app
2. **Supported formats:** JPEG, PNG, HEIC, ZIP archives (up to 5GB)
3. **Photos appear instantly** in the table, sorted by when they were taken

### Understanding the Status Icons
Each photo has status indicators that show processing progress:
- **📝 Extracting:** AI is reading the handwritten code
- **🔗 Grouping:** App is finding similar photos to group together
- **✅ Complete:** Ready for export
- **⚠️ Needs Attention:** Couldn't read the code clearly

### Reviewing and Fixing
- **Arrow keys** to navigate like Excel
- **Enter** to edit the selected cell
- **G** to quickly edit the group name
- **N** to quickly edit the new filename
- **F1** to see all keyboard shortcuts

### Exporting Your Results
1. Click **"Export"** when you're happy with the results
2. Choose **"Download ZIP"** to get a compressed file
3. Or **"Save to Folder"** to create an organized folder on your computer

---

## 🔧 Troubleshooting

### "Command not found" or "npm not recognized"
- **Mac/Linux:** Restart Terminal and try `node --version`
- **Windows:** Restart Command Prompt and try `node --version`
- If still not working, reinstall Node.js from [nodejs.org](https://nodejs.org/)

### "Permission denied" errors (Mac/Linux)
```bash
sudo chown -R $(whoami) ~/.npm
```

### "Python not found" errors (Windows)
```cmd
# Install Python and Visual Studio Build Tools
npm install --global windows-build-tools
```

### App won't start or crashes
1. **Check your API key** in `backend/.env` - it should start with `AIza`
2. **Restart the app:** Press `Ctrl+C` to stop, then `npm start` again
3. **Clear the cache:** Delete the `node_modules` folders and run `npm run install:all` again

### Photos aren't being processed
- **Check your internet connection** - the app needs internet to use Google's AI
- **Verify your API key** is working at [Google AI Studio](https://aistudio.google.com/)
- **Check the console** for error messages (press F12 in your browser)

### "Rate limit exceeded" errors
- **Wait a few minutes** - Google limits how many requests you can make per minute
- **Reduce batch size** - process fewer photos at once

---

## 💡 Tips for Best Results

### Photo Quality
- **Well-lit photos** work best
- **Avoid blurry images** - the AI needs to read the handwriting clearly
- **Straight angles** help - try to avoid tilted or angled shots

### Batch Processing
- **Start small** - try 50-100 photos first to test your setup
- **Group similar photos** - photos taken at the same time/location work better
- **Check periodically** - review results every few hundred photos

### Keyboard Shortcuts (Press F1 in the app)
- **Arrow keys:** Navigate table
- **Enter:** Edit selected cell
- **Escape:** Cancel editing
- **Ctrl+A:** Select all
- **G:** Edit group name
- **N:** Edit new filename
- **Delete:** Remove selected photos

---

## 💰 Cost Information

### Actual Google AI Usage & Costs
Based on analysis of the app's implementation with Gemini 2.0 Flash:

**Per Photo Breakdown:**
- **Input tokens:** ~2,790 tokens (1,290 for image + 1,500 for comprehensive prompt)
- **Output tokens:** ~175 tokens (structured JSON response with code, colors, description)
- **Cost per photo:** ~$0.349 per 1,000 photos = **$0.000349 per photo**

**Real-World Cost Examples:**
- **100 photos:** ~$0.035 (3.5 cents)
- **500 photos:** ~$0.175 (17.5 cents)
- **1,000 photos:** ~$0.35 (35 cents)
- **2,000 photos:** ~$0.70 (70 cents)
- **5,000 photos:** ~$1.75

**Why It's So Affordable:**
- Uses efficient **Gemini 2.0 Flash** (not the more expensive Pro model)
- Only processes each photo **once** - no retries unless you specifically request them
- Optimized prompt design minimizes token usage while maintaining accuracy

### Free Tier Benefits
- **$300 Google Cloud credit** for new users covers ~860,000 photos
- **No hidden costs** - only pay for successful AI processing
- **Transparent billing** - see exact usage in Google Cloud Console

### No Hidden Costs
- **App is free** - open source, no subscription fees
- **Runs locally** - no cloud storage or hosting fees
- **One-time setup** - no recurring payments
- **Only pay Google** for AI processing (and only when you use it)

---

## 🔒 Privacy & Security

### Your Photos Stay Private
- **Processed locally** on your computer
- **Only tiny previews** (100KB) sent to Google for AI processing
- **Original photos never leave** your computer
- **No cloud storage** - everything stays on your device

### Data Storage
- **Temporary files** stored in your system's temp folder
- **Automatically cleaned up** when you restart your computer
- **SQLite database** keeps track of your work (stored locally)

---

## 🆘 Getting Help

### If You're Stuck
1. **Check this README** - most issues are covered above
2. **Look at the browser console** - press F12 to see error messages
3. **Restart everything** - close the app, run `npm start` again
4. **Create an issue** on GitHub with your error message

### What to Include When Asking for Help
- **Your operating system** (Windows 10, macOS Monterey, etc.)
- **Node.js version** (run `node --version`)
- **Error message** (copy and paste the exact text)  
- **What you were doing** when the error occurred
- **Screenshots** if there's a visual problem

---

## 🎓 Understanding the Technology

### How It Works (Simple Version)
1. **Upload:** Your photos are copied to a secure temp folder
2. **Analysis:** AI reads each photo and extracts the handwritten code
3. **Grouping:** Smart algorithm finds similar photos based on colors, descriptions, and timing
4. **Review:** You can fix any mistakes using the spreadsheet-like interface
5. **Export:** Renamed photos are packaged for download

### Sample Code Patterns
The app was specifically trained to recognize leadresearch.org's sample coding system:
- **Malawi samples:** `MWI.1.2.15.7B.12.8` or `MWI.0.1.4.10.15.7`
- **Kenya samples:** `KEN.0.2.3.5.8.11`
- **Strict validation:** Prevents false matches and catches common handwriting mistakes (like "D" vs "0")

### File Storage
- **Uploads:** `~/AppData/Local/Temp/ocr-auto-label/` (Windows) or `/tmp/ocr-auto-label/` (Mac/Linux)
- **Database:** `backend/prisma/dev.db` (SQLite file)
- **Thumbnails:** Auto-generated for fast preview

---

## 📋 System Requirements

### Minimum Requirements
- **Operating System:** Windows 10, macOS 10.14, or Ubuntu 18.04+
- **RAM:** 4GB (8GB recommended for large batches)
- **Storage:** 2GB free space (plus space for your photos)
- **Internet:** Required for AI processing

### Recommended Setup
- **RAM:** 8GB+ for processing 1000+ photos
- **CPU:** Multi-core processor for faster processing
- **SSD:** Faster file operations
- **Stable internet:** For reliable AI processing

---

## 🏗️ Technical Details (For Developers)

### Project Structure
```
ocr-auto-label/
├── frontend/          # React + TypeScript + Vite
│   ├── src/components/    # UI components
│   ├── src/stores/        # Zustand state management
│   └── src/types/         # TypeScript definitions
├── backend/           # Node.js + Express + Prisma
│   ├── src/routes/        # API endpoints
│   ├── src/services/      # Business logic
│   └── prisma/            # Database schema
└── package.json       # Workspace configuration
```

### Key Technologies
- **Frontend:** React 18, Vite, TypeScript, Zustand, Radix UI, Tailwind CSS
- **Backend:** Node.js, Express, Prisma, SQLite, Sharp (image processing)
- **AI:** Google Generative AI (Gemini 2.0 Flash)
- **Deployment:** Local development with production build support

### API Endpoints
- `POST /api/upload` - Upload photos and ZIP files
- `GET /api/images` - List all processed images
- `PUT /api/images/:id` - Update image metadata
- `POST /api/export` - Generate export ZIP
- `GET /api/gemini-updates` - Server-sent events for real-time updates

---

## 📄 License

**MIT License** - Free for personal and commercial use. No attribution required, but appreciated! 🌍

---

*Need help? Create an issue on GitHub or check the troubleshooting section above.*