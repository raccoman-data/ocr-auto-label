# **Lead-Photo Auto-Tagger**

This is a forked version of the original Lead-Photo Auto-Tagger created by Neil Bhammar. The original repository can be found [here](https://github.com/neilbhammar/ocr-auto-label).

This fork includes several modifications and usability improvements specifically to address the photo relabelling task for [leadresearch.org](https://leadresearch.org/).

## **The Problem**

Field researchers often capture thousands of photos (e.g., IMG\_1234.jpg) during lead testing. Each photo containing a handwritten sample code (like MWI.1.2.15.7B.12.8) needs to be identified and renamed. Manually opening, reading, and renaming these photos can take 30-60 seconds per image, translating to **20-40 hours** for 2,000 samples. Additionally, photos without visible codes need manual association with their corresponding coded sample.

## **The Solution**

This project provides a streamlined workflow combining Google Colab notebooks and a local web application to automate the renaming and organization process:

1. **Initial Processing (Colab):** A notebook prepares images, converting formats like HEIC to JPEG.  
2. **AI Analysis & Grouping (Web App):** A local web application uses Google's Gemini AI to read handwritten codes, automatically groups related photos (even those without codes), and allows for quick manual review.  
3. **Final Renaming & Analysis (Colab):** Additional notebooks use the application's output to perform final renaming based on groups and generate descriptions for entire item sets.

**Result:** What previously took days can now be accomplished in minutes, significantly reducing manual effort and potential errors.

## **Features**

* **Multi-Stage Workflow:** Combines Colab for pre/post-processing and a local web app for AI analysis and review.  
* **HEIC Conversion:** Initial Colab step converts HEIC images to JPEG.  
* **AI-Powered OCR:** Uses Google Gemini Flash Vision API via the web app to read handwritten sample codes.  
* **Smart Grouping:** Web app intelligently groups photos without visible labels based on time proximity, object color, and description similarity.  
* **Efficient Review Interface:** Web app provides a spreadsheet-like table with keyboard shortcuts for rapid review and correction.  
* **Batch Renaming:** Final Colab step renames files systematically based on group assignments (e.g., GROUP\_ID\_1.jpg, GROUP\_ID\_2.jpg).  
* **Group Description Generation:** Final Colab step uses Gemini to analyze all images within a group and generate a consolidated description.  
* **Local Processing:** Web app runs locally, ensuring photo privacy (only previews sent to AI).  
* **Simplified Pattern Management:** Easy configuration for adding new sample code formats (See [EASY\_PATTERN\_MANAGEMENT.md](http://docs.google.com/EASY_PATTERN_MANAGEMENT.md) and [ADDING\_NEW\_SAMPLE\_CODES.md](http://docs.google.com/ADDING_NEW_SAMPLE_CODES.md)).

## **Workflow Overview**

This repository uses a combination of Google Colab notebooks and a local web application.

### **Stage 1: Image Preparation (Google Colab)**

1. **Upload Raw Photos:** Place your original photos (including HEIC, JPG, PNG, etc.) into a designated folder in your Google Drive (e.g., .../lera/plastic\_foodware/All photos).  
2. **Run copy\_folder.ipynb:**  
   * **Purpose:** Ingests raw images, converts HEIC files to JPEG, and copies all resulting images (JPEG, PNG, etc.) to a standardized input folder.  
   * **Input:** Reads from the raw photos folder specified in the notebook (e.g., INPUT\_SUBDIR).  
   * **Output:** Saves standardized images to the folder specified as OUTPUT\_SUBDIR (e.g., .../lera/plastic\_foodware/plastic\_foodware\_input). This folder will be used by the web application later.  
3. **Download as ZIP:** Download the *contents* of the OUTPUT\_SUBDIR folder (the standardized images) as a ZIP file to your local computer.

### **Stage 2: AI Analysis & Manual Review (Local Web App)**

4. **Install & Run the Web App:** Follow the [Quick Start](#bookmark=id.8fxrr6adgo3g) instructions below to set up and run the local Node.js application.  
5. **Upload ZIP to Web App:** Drag and drop the ZIP file (downloaded in step 3\) into the web application's upload area.  
6. **Automatic Processing:** The app extracts the images, sends previews to Google Gemini AI for code extraction/description/color analysis, and performs smart grouping for images without codes. Progress is shown in real-time.  
7. **Review & Correct:**  
   * Use the spreadsheet-like interface to review the AI's results.  
   * Correct any misidentified codes or incorrect group assignments using inline editing or keyboard shortcuts (Press F1 for help).  
   * Ensure all items are correctly grouped.  
8. **Export Metadata:** Once satisfied, click the "Export" button in the web app. This generates and downloads a ZIP file containing only metadata (metadata.csv and export-summary.json).

### **Stage 3: Final Renaming & Group Analysis (Google Colab)**

9. **Upload Metadata:** Upload the metadata.csv file (from the export ZIP in step 8\) to the appropriate location in your Google Drive project folder (e.g., overwriting .../lera/plastic\_foodware/metadata.csv if that's what rename\_photos.ipynb expects).  
10. **Run rename\_photos.ipynb:**  
    * **Purpose:** Renames the standardized images based on the final group assignments defined in the metadata.csv.  
    * **Input:** Reads images from the folder created by copy\_folder.ipynb (e.g., .../plastic\_foodware/plastic\_foodware\_input) and the updated metadata.csv.  
    * **Output:** Copies and renames images into a final output folder (e.g., .../plastic\_foodware/plastic\_foodware\_output), creating names like GROUPID\_1.jpg, GROUPID\_2.jpg. It also saves the final metadata.csv (including new filenames) to this output folder.  
11. **Run grouped\_img\_desc.ipynb:**  
    * **Purpose:** Analyzes all images within each group (from the final output folder) using Gemini AI to generate a consolidated description for the item set.  
    * **Input:** Reads the renamed images from the folder created by rename\_photos.ipynb (e.g., .../plastic\_foodware/plastic\_foodware\_output).  
    * **Output:** Saves a new CSV file (output.csv by default) in the same folder, containing the AI-generated descriptions for each group ID.

## **Quick Start (Local Web App \- 5 Minutes)**

These steps are only for **Stage 2** of the workflow.

### **Step 1: Install Node.js (If not already installed)**

* **Mac/Linux:** Use a version manager like fnm or nvm (fnm install 18, fnm use 18).  
* **Windows:** Download the "LTS" version from [nodejs.org](https://nodejs.org/) and run the installer.

### **Step 2: Clone or Download This Repository**

\# Using Git  
git clone \[https://github.com/raccoman-data/ocr-auto-label.git\](https://github.com/raccoman-data/ocr-auto-label.git)  
cd ocr-auto-label

\# Or download ZIP and unzip

### **Step 3: Install Dependencies**

\# Run this in the root ocr-auto-label directory  
npm run install:all

### **Step 4: Get Google AI API Key**

1. Go to [Google AI Studio](https://aistudio.google.com/).  
2. Click **"Get API Key"** \> **"Create API Key"** \> **"Create API key in new project"**.  
3. Copy the key (starts with AIza...).

### **Step 5: Configure API Key**

Create a file named .env inside the backend folder and add your key:

GEMINI\_API\_KEY=YOUR\_KEY\_HERE

*(Replace YOUR\_KEY\_HERE with the key you copied)*

### **Step 6: Start the App**

npm start

The application will open in your browser, usually at http://localhost:3000. You can now proceed with **Step 5** of the [Workflow Overview](#bookmark=id.fugiyjile3hk).

## **Changes in This Fork**

This version builds upon the original with:

* **Windows Compatibility:** Fixes for thumbnail display.  
* **Improved Grouping Logic:** Uses original names alongside timestamps.  
* **Enhanced AI Prompt:** Optimized for better text extraction accuracy.  
* **Video File Support:** Extracts and analyzes the first frame.  
* **UI Improvements:** Sort by status, display API error messages.  
* **Simplified Pattern Management:** Centralized configuration for sample code formats (see linked .md files).

## **Known Issues & Future Improvements**

### **Known Issues**

* **Manual HEIC Conversion:** The *local web app* doesn't convert HEIC; rely on the initial Colab step (copy\_folder.ipynb) for this.  
* **Incomplete Image Export (Web App):** The *web app's* export focuses on *metadata*. Final image renaming happens in Colab (rename\_photos.ipynb). Ensure the Colab step completes successfully.  
* **Large Batch Stability:** Processing very large numbers of images (5,000+) in a single web app session may cause instability. Process in manageable batches if needed.

### **Suggested Future Improvements**

* **Migrate Entire Workflow to Google Colab:** Consolidate all steps (preparation, AI analysis, review, renaming) into Colab notebooks to eliminate file transfers between Drive and local machine.  
* **User-Defined ID Formats:** Allow users to input the expected sample code format (e.g., using Regex) via the UI or notebook parameters. This would dynamically update the AI prompt and validation logic, making the tool adaptable to different projects without code changes.

## **Colab Notebook Details**

Located in the colab\_notebooks directory:

1. **copy\_folder.ipynb:** (Stage 1\) Prepares images. Converts HEIC to JPEG, copies others. Creates the input dataset for the web app.  
2. **rename\_photos.ipynb:** (Stage 3\) Renames images. Uses the web app's exported metadata.csv to rename files systematically based on final groups (e.g., GROUPID\_1.jpg). Creates the final image output folder.  
3. **grouped\_img\_desc.ipynb:** (Stage 3\) Analyzes groups. Sends all images for each group ID (from the final output folder) to Gemini to generate a consolidated item description. Outputs a final output.csv.

## **Technical Details**

* **Frontend:** React 18, Vite, TypeScript, Zustand, Radix UI, Tailwind CSS  
* **Backend:** Node.js, Express, Prisma, SQLite, Sharp (image processing)  
* **AI:** Google Generative AI SDK (Gemini Flash)  
* **Preprocessing:** Python (in Google Colab), pyheif, Pillow  
* **Postprocessing:** Python (in Google Colab), pandas

## **License**

MIT License \- See original repository for details.

## **Appendix: Additional Information (from Original README)**

### **How to Use the App (Local Web App \- Stage 2 Focus)**

#### **Uploading Photos**

1. **Drag and drop** the ZIP file (containing standardized images from Colab Stage 1\) into the web app.  
2. **Supported formats (within ZIP):** JPEG, PNG. The app also supports video files (first frame only). *Note: HEIC files should have been converted in Colab Stage 1\.*  
3. **Photos appear** in the table, typically sorted by capture time.

#### **Understanding the Status Icons**

Each photo has status indicators showing processing progress:

* **Extracting:** AI is reading the handwritten code.  
* **Grouping:** App is finding similar photos to group together.  
* **Complete / Extracted / Grouped:** Ready for review/export.  
* **Needs Attention / Invalid Group / Ungrouped:** May require manual review.

#### **Reviewing and Fixing**

* Click column headers (like **Status**) to sort items needing attention.  
* **Arrow keys** to navigate like Excel.  
* **Enter** to edit the selected cell (e.g., New Name, Group).  
* **G** to quickly edit the group name for selected images.  
* **N** to quickly edit the new filename (less common with Colab renaming).  
* **F1** (or Help button) to see all keyboard shortcuts.

#### **Exporting Metadata (End of Stage 2\)**

1. Click **"Export"** when corrections are complete.  
2. This downloads a ZIP containing metadata.csv needed for Colab Stage 3\.

### **Troubleshooting (Local Web App)**

* **"Command not found" or "npm not recognized":** Ensure Node.js is installed correctly and PATH is set. Restart Terminal/Command Prompt.  
* **"Permission denied" errors (Mac/Linux):** Try sudo chown \-R $(whoami) \~/.npm.  
* **App won't start:**  
  * Check backend/.env for a valid GEMINI\_API\_KEY.  
  * Restart the app (Ctrl+C, then npm start).  
  * Clear cache: delete node\_modules folders, run npm run install:all.  
* **Photos aren't processing:**  
  * Check internet connection (required for AI).  
  * Verify API key at [Google AI Studio](https://aistudio.google.com/).  
  * Check browser console (F12) and terminal for errors.  
* **"Rate limit exceeded" errors:** Wait a few minutes; Google limits requests. Process smaller batches if issues persist.

### **Tips for Best Results (Local Web App AI)**

* **Photo Quality:** Well-lit, non-blurry photos taken at straight angles work best for AI.  
* **Batch Processing:** Start with smaller batches (50-100) to test. Check results periodically.

### **Keyboard Shortcuts (Press F1 in the app)**

* **Arrow keys:** Navigate table  
* **Enter:** Edit selected cell  
* **Escape:** Cancel editing / Clear selection  
* **Shift \+ Arrow/Click:** Select range  
* **Ctrl/Cmd \+ Click:** Add/remove item from selection  
* **Ctrl/Cmd \+ A:** Select all  
* **Ctrl/Cmd \+ F:** Focus search bar  
* **G / Ctrl+G:** Edit group name(s)  
* **N:** Edit new filename  
* **Ctrl/Cmd \+ C:** Copy group name from selected  
* **Ctrl/Cmd \+ V:** Paste copied group name to selected  
* **Delete / Backspace:** Clear group name(s) for selected  
* **Ctrl/Cmd \+ Shift \+ Delete/Backspace:** Delete selected image(s)

### **Cost Information (Google AI Usage)**

Based on Gemini Flash analysis:

* **Cost per photo:** \~$0.000349  
* **1,000 photos:** \~$0.35  
* **5,000 photos:** \~$1.75  
* Uses efficient **Gemini Flash**.  
* **Free Tier:** Google Cloud offers credits for new users.  
* App runs locally; no hosting/storage fees.

### **Privacy & Security**

* Web app processes photos **locally**.  
* Only compressed image previews are sent to Google AI.  
* Original photos remain on your computer during web app use.  
* Temporary files stored locally (backend/prisma/dev.db, OS temp dir).

### **Getting Help**

1. Review this README and Troubleshooting section.  
2. Check browser console (F12) and terminal running the app for errors.  
3. Restart the application.  
4. If unresolved, create an issue on the GitHub repository, including:  
   * Operating System & Node.js version (node \--version)  
   * Exact error message  
   * Steps taken  
   * Screenshots (if applicable)

### **Understanding the Technology (Local Web App)**

* **Simple Version:** Upload ZIP \-\> AI reads codes \-\> Smart grouping \-\> Manual review \-\> Export metadata CSV.  
* **Sample Code Patterns:** Trained for leadresearch.org formats (MWI/KEN/etc.), strictly validated. See backend/src/lib/sampleCodePatterns.ts.  
* **File Storage (Local):**  
  * Database: backend/prisma/dev.db (SQLite)  
  * Temporary Files/Uploads/Thumbnails: In OS temp directory (e.g., /tmp/ocr-auto-label/ or C:\\Users\\...\\AppData\\Local\\Temp\\ocr-auto-label\\)

### **System Requirements (Local Web App)**

* **OS:** Windows 10+, macOS 10.14+, Ubuntu 18.04+  
* **RAM:** 4GB (8GB+ recommended for large batches)  
* **Storage:** 2GB free \+ space for extracted photos  
* **Internet:** Required for AI processing stage