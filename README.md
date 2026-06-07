# ATS Resume Optimizer & Overleaf Generator (Chrome Extension)

This is a Manifest V3 Chrome Extension that scans a resume PDF loaded inside a Chrome tab, analyzes it against a target Job Description using the Google Gemini API, and outputs:
1. **ATS Match Score & Gap Analysis** (identifying missing keywords and suggestions).
2. **Hiring Manager & Recruiter Critique** (providing actionable advice so recruiters do not ignore the resume).
3. **Complete Tailored LaTeX Code** (pre-formatted, ATS-friendly, single-column Overleaf resume template ready to compile).

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

### Step 3: Configure Gemini API Key
1. Click the puzzle icon in Chrome's toolbar and pin **ATS Resume Optimizer**.
2. Click the extension icon to open the Side Panel.
3. Click the gear icon (`⚙️`) in the header of the side panel to open the settings.
4. Paste your Gemini API key. If you do not have one, get a free key from [Google AI Studio](https://aistudio.google.com/).
5. Click **Save Key**.

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

### Step 4: Review Results & Export to Overleaf
1. Once completed, review the **ATS Feedback** and **Recruiter Critique** tabs.
2. Navigate to the **LaTeX Template** tab.
3. Click the **📋** button next to the **Suggested PDF Filename** to copy it (e.g. `JohnDoe_SeniorSoftwareEngineer.pdf`).
4. Click **Copy Template Code** to copy the full LaTeX code.
5. Open [Overleaf](https://www.overleaf.com) in your browser:
   *   Create a **New Project** -> **Blank Project**.
   *   Name the project *exactly* what was copied in Step 3 (without the `.pdf` extension, e.g. `JohnDoe_SeniorSoftwareEngineer`).
   *   Delete all default code in the `main.tex` file.
   *   Paste the copied LaTeX code into `main.tex`.
   *   Click **Recompile** in Overleaf.
   *   Click the **Download PDF** button in Overleaf.
   *   The downloaded file will be named matching the format: `candidateName_designation.pdf` (e.g. `JohnDoe_SeniorSoftwareEngineer.pdf`).

---

## Customizing & Prompt Details

The system prompt is configured to return standard LaTeX markup in JSON. The templates generate modern, clean, single-column structures using the standard `article`, `geometry`, `titlesec`, and `enumitem` packages. 

If you want to modify the instructions, styling, or prompts, check out the `callGeminiApi` function in [sidepanel.js](file:///usr/local/google/home/princedatta/ats-resume/sidepanel.js).
