# ATS Resume Optimizer (Chrome Extension)

This is a Manifest V3 Chrome Extension that scans a resume PDF loaded inside a Chrome tab, analyzes it against a target Job Description using the Google Gemini API or Anthropic Claude API, and outputs:
1. **ATS Match Score & Gap Analysis** (identifying missing keywords and suggestions).
2. **Hiring Manager & Recruiter Critique** (providing actionable advice so recruiters do not ignore the resume).

## 🎁 100% Free for Everyone

This extension is built to be run entirely for free with no subscriptions, ads, or paywalls:
*   **No Server Hosting Cost**: The extension runs 100% client-side inside your browser. No personal data is sent to external servers other than directly to the Google Gemini API.
*   **Free AI Power**: It utilizes a free Gemini API Key that anyone can generate from [Google AI Studio](https://aistudio.google.com/). The free tier is more than sufficient for general personal resume optimization tasks.

---

## Folder Structure

The project contains the following files:
*   `manifest.json`: Configuration manifest V3 file for the extension.
*   `background.js`: Extension Service Worker that configures the action click to open the side panel.
*   `sidepanel.html`: The HTML structure for the UI panel.
*   `sidepanel.css`: Modern premium dark-mode styling for the interface.
*   `sidepanel.js`: Orchestrates PDF fetching, parsing via PDF.js, and communicating with the Gemini API.
*   `lib/`:
    *   `pdf.min.js`: Mozilla's PDF.js library for PDF content extraction.
    *   `pdf.worker.min.js`: Worker thread file for PDF.js processing.

---

## Installation & Setup

Follow these steps to run the extension in Google Chrome:

### Step 1: Install the Extension
1. Open Google Chrome.
2. Navigate to `chrome://extensions/` by typing it into the address bar.
3. Enable **Developer mode** in the top right corner by toggling the switch.
4. Click on **Load unpacked** in the top left corner.
5. Select the folder containing these files (`/usr/local/google/home/princedatta/ats-resume`).

### Step 2: Configure Local File Permissions (Recommended)
If you intend to analyze local PDF resumes (i.e. `file:///` links):
1. In `chrome://extensions/`, find the **ATS Resume Optimizer & Overleaf Generator** card.
2. Click **Details**.
3. Scroll down and toggle **Allow access to file URLs** to **ON**.
   *(If this is not enabled, the extension will fail to read local PDF files due to security restrictions).*

### Step 3: Configure AI API Keys (UI)
1. Click the puzzle icon in Chrome's toolbar and pin **ATS Resume Optimizer**.
2. Click the extension icon to open the Side Panel.
3. Click the gear icon (`⚙️`) in the header of the side panel to open the settings.
4. Select your preferred **AI Provider** (Google Gemini or Anthropic Claude).
5. Paste your API key and set the model name.
6. Click **Save Settings**.

### Step 4: Pre-populate API Keys via `.env` (Optional)
To avoid entering your API keys every time you reload or reinstall the extension, you can create a local environment file in the extension root directory. This file is gitignored and will never be pushed to version control:
1. In the root of the extension folder, create a file named `.env`.
2. Add your provider and keys matching this format:
   ```env
   AI_PROVIDER=gemini
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY
   GEMINI_MODEL_NAME=gemini-2.5-flash
   ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
   ANTHROPIC_MODEL_NAME=claude-3-5-sonnet-20241022
   ```
3. Reload the extension in Chrome. The keys and settings will be pre-populated automatically!

---

## How to Use the Extension

### Step 1: Open a Resume PDF
Open the candidate's current resume PDF inside a Chrome tab. This can be:
- A local PDF (e.g. `file:///home/user/Documents/Resume.pdf`).
- An online PDF (e.g. `https://example.com/resume.pdf` or a LinkedIn PDF printout).
*The side panel will show a green dot saying `Local PDF Detected` or `Web PDF Detected`.*

### Step 2: Input Job Description
1. Paste the target Job Description (JD) into the textarea in the side panel.
2. Make sure it contains key responsibilities and qualifications.

### Step 3: Analyze
1. Click the **Analyze Resume** button.
2. Watch the progress steps complete:
   *   *Step 1: Extracting Resume PDF*
   *   *Step 2: Comparing with Job Description*

### Step 4: Review Results
1. Once completed, review the **ATS Feedback** and **Recruiter Critique** tabs.
2. Under **ATS Feedback**, see the match score, missing keywords, and specific, actionable tailoring suggestions.
3. Under **Recruiter Critique**, check the highlights of what stand out positively, and what could be potential red flags/negatives that recruiters might ignore.

---

## Customizing & Prompt Details

If you want to modify the instructions, styling, or prompts, check out the `callGeminiApi` function in [sidepanel.js](file:///usr/local/google/home/princedatta/ats-resume/sidepanel.js).
