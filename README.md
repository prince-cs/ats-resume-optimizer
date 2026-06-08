# ATS Resume Optimizer & Overleaf Generator

This is a Manifest V3 Chrome Extension that scans a resume PDF loaded inside a Chrome tab, analyzes it against a target Job Description using the Google Gemini API or Anthropic Claude API, and outputs:
1. **ATS Match Score & Gap Analysis**: Identifies missing keywords and provides tailoring suggestions.
2. **Hiring Manager & Recruiter Critique**: Highlights standouts and flags red flags that might cause recruiters to ignore the resume.
3. **Tailored LaTeX Resume Template**: Generates a clean, professional, single-column Overleaf-compatible LaTeX document with the suggestions and keywords already fully integrated.

## 🎁 100% Free for Everyone

This extension is built to be run entirely for free with no subscriptions, ads, or paywalls:
*   **No Server Hosting Cost**: The extension runs 100% client-side inside your browser. No personal data is sent to external servers other than directly to the Google Gemini or Anthropic Claude APIs.
*   **Free AI Power**: It utilizes a free Gemini API Key that anyone can generate from [Google AI Studio](https://aistudio.google.com/). The free tier is more than sufficient for general personal resume optimization tasks.

---

## Folder Structure

The project contains the following files:
*   `manifest.json`: Configuration manifest V3 file for the extension.
*   `background.js`: Extension Service Worker that configures the action click to open the side panel.
*   `sidepanel.html`: The HTML structure for the UI panel.
*   `sidepanel.css`: Modern premium dark-mode styling for the interface.
*   `sidepanel.js`: Orchestrates PDF fetching, parsing via PDF.js, and communicating with the Gemini and Anthropic APIs.
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
1. Click the **Analyze & Generate Template** button.
2. Watch the progress steps complete:
   *   *Step 1: Extracting Resume PDF*
   *   *Step 2: Comparing with Job Description*
   *   *Step 3: Generating Overleaf LaTeX*

### Step 4: Review Results & Build Resume
1. Once completed, review the tabs:
   *   **ATS Feedback**: Shows your Match Score, Missing Keywords, and Specific Tailoring Suggestions to optimize your content.
   *   **Recruiter Critique**: Highlights what stands out positively to hiring managers and flags potential issues that recruiters might dislike.
   *   **LaTeX Template**: Contains the fully compiled LaTeX code for your new optimized resume.
2. Under the **LaTeX Template** tab:
   *   Copy the **Suggested PDF Filename** (e.g., `JohnDoe_Senior_Software_Engineer.pdf`) using the copy button (📋).
   *   Copy the **Overleaf LaTeX Code** using the `Copy Template Code` button.
3. Open [Overleaf](https://www.overleaf.com/) and log in.
4. Create a new project: **New Project** -> **Blank Project**.
5. Give your project the name you copied in Step 2 (Suggested PDF Filename).
6. Delete everything inside the default `main.tex` and paste the copied LaTeX code.
7. Click **Recompile**. Your professionally typeset, ATS-optimized, single-column resume is ready! When you download the PDF, it will automatically have the correct search-friendly filename.

---

## Customizing & Prompt Details

If you want to modify the instructions, styling, or prompts, check out the `callGeminiApi` and `callAnthropicApi` functions in [sidepanel.js](file:///usr/local/google/home/princedatta/ats-resume/sidepanel.js).
