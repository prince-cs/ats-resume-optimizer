// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

// DOM Elements
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const providerSelect = document.getElementById('provider-select');
const geminiSettingsGroup = document.getElementById('gemini-settings-group');
const apiKeyInput = document.getElementById('api-key-input');
const togglePasswordVisibility = document.getElementById('toggle-password-visibility');
const modelInput = document.getElementById('model-input');
const anthropicSettingsGroup = document.getElementById('anthropic-settings-group');
const anthropicKeyInput = document.getElementById('anthropic-key-input');
const toggleAnthropicVisibility = document.getElementById('toggle-anthropic-visibility');
const anthropicModelInput = document.getElementById('anthropic-model-input');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingsStatus = document.getElementById('settings-status');

const pdfStatusContainer = document.getElementById('pdf-status-container');
const pdfStatusText = document.getElementById('pdf-status-text');
const pdfDetails = document.getElementById('pdf-details');

const jobDescriptionTextarea = document.getElementById('job-description');
const analyzeBtn = document.getElementById('analyze-btn');

const progressCard = document.getElementById('progress-card');
const stepPdf = document.getElementById('step-pdf');
const stepAi = document.getElementById('step-ai');
const stepLatex = document.getElementById('step-latex');

const suggestedFilenameCode = document.getElementById('suggested-filename');
const copyFilenameBtn = document.getElementById('copy-filename-btn');
const copyLatexBtn = document.getElementById('copy-latex-btn');
const latexCodeBlock = document.getElementById('latex-code');

const resultsCard = document.getElementById('results-card');
const atsScoreBadge = document.getElementById('ats-score');
const missingKeywordsList = document.getElementById('missing-keywords');
const atsSuggestionsList = document.getElementById('ats-suggestions');
const recruiterNegativesList = document.getElementById('recruiter-negatives');
const recruiterPositivesList = document.getElementById('recruiter-positives');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// App State
let activeTabUrl = '';
let activeTabTitle = '';
let aiProvider = 'gemini';
let geminiApiKey = '';
let geminiModelName = 'gemini-2.5-flash';
let anthropicApiKey = '';
let anthropicModelName = 'claude-3-5-sonnet-20241022';
let isPdfDetected = false;
let extractedResumeText = '';
let analysisResults = null;

// Initialize Extension Sidepanel
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Load API Settings
  let data = await chrome.storage.local.get([
    'aiProvider',
    'geminiApiKey',
    'geminiModelName',
    'anthropicApiKey',
    'anthropicModelName'
  ]);

  // Try loading default settings from a local .env file (if created by developer and gitignored)
  try {
    const envResponse = await fetch(chrome.runtime.getURL('.env'));
    if (envResponse.ok) {
      const envText = await envResponse.text();
      const envLines = envText.split('\n');
      const envVars = {};
      for (const line of envLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const equalIdx = trimmed.indexOf('=');
        if (equalIdx > 0) {
          const key = trimmed.substring(0, equalIdx).trim();
          let val = trimmed.substring(equalIdx + 1).trim();
          // Remove wrapping quotes if present
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          envVars[key] = val;
        }
      }
      
      data = {
        aiProvider: data.aiProvider || envVars.AI_PROVIDER || 'gemini',
        geminiApiKey: data.geminiApiKey || envVars.GEMINI_API_KEY || '',
        geminiModelName: data.geminiModelName || envVars.GEMINI_MODEL_NAME || 'gemini-2.5-flash',
        anthropicApiKey: data.anthropicApiKey || envVars.ANTHROPIC_API_KEY || '',
        anthropicModelName: data.anthropicModelName || envVars.ANTHROPIC_MODEL_NAME || 'claude-3-5-sonnet-20241022'
      };
    }
  } catch (err) {
    // .env may not exist, which is fine
    console.log('No local .env default found or failed to load:', err);
  }

  if (data.aiProvider) {
    aiProvider = data.aiProvider;
    providerSelect.value = aiProvider;
  }

  // Load Gemini
  if (data.geminiApiKey) {
    geminiApiKey = data.geminiApiKey;
    apiKeyInput.value = geminiApiKey;
  }
  if (data.geminiModelName) {
    geminiModelName = data.geminiModelName;
    modelInput.value = geminiModelName;
  }

  // Load Anthropic
  if (data.anthropicApiKey) {
    anthropicApiKey = data.anthropicApiKey;
    anthropicKeyInput.value = anthropicApiKey;
  }
  if (data.anthropicModelName) {
    anthropicModelName = data.anthropicModelName;
    anthropicModelInput.value = anthropicModelName;
  }

  // Update visibility of settings
  updateSettingsGroupVisibility();

  // Settings Status
  const activeKey = aiProvider === 'gemini' ? geminiApiKey : anthropicApiKey;
  if (activeKey) {
    setSettingsStatus('API Settings loaded.', 'success');
  } else {
    setSettingsStatus(`Please set your API Key for ${aiProvider === 'gemini' ? 'Gemini' : 'Claude'}.`, 'error');
    settingsPanel.classList.remove('hidden');
  }

  // 2. Setup Listeners
  setupEventListeners();

  // 3. Scan Active Tab
  await scanActiveTab();
});

// Event Listeners
function setupEventListeners() {
  // Toggle Settings Panel
  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  // Toggle API Key Visibility
  togglePasswordVisibility.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      togglePasswordVisibility.textContent = 'Hide';
    } else {
      apiKeyInput.type = 'password';
      togglePasswordVisibility.textContent = 'Show';
    }
  });

  // AI Provider Toggle
  providerSelect.addEventListener('change', () => {
    aiProvider = providerSelect.value;
    updateSettingsGroupVisibility();
    validateAnalyzeButton();
  });

  // Toggle Anthropic API Key Visibility
  toggleAnthropicVisibility.addEventListener('click', () => {
    if (anthropicKeyInput.type === 'password') {
      anthropicKeyInput.type = 'text';
      toggleAnthropicVisibility.textContent = 'Hide';
    } else {
      anthropicKeyInput.type = 'password';
      toggleAnthropicVisibility.textContent = 'Show';
    }
  });

  // Save Settings
  saveSettingsBtn.addEventListener('click', async () => {
    const provider = providerSelect.value;
    const geminiKey = apiKeyInput.value.trim();
    const geminiModel = modelInput.value.trim() || 'gemini-2.5-flash';
    const anthropicKey = anthropicKeyInput.value.trim();
    const anthropicModel = anthropicModelInput.value.trim() || 'claude-3-5-sonnet-20241022';
    
    if (provider === 'gemini' && !geminiKey) {
      setSettingsStatus('Gemini API Key cannot be empty.', 'error');
      return;
    }
    if (provider === 'anthropic' && !anthropicKey) {
      setSettingsStatus('Anthropic API Key cannot be empty.', 'error');
      return;
    }
    
    const modelRegex = /^[a-zA-Z0-9\-\.\_]+$/;
    const modelToValidate = provider === 'gemini' ? geminiModel : anthropicModel;
    if (!modelRegex.test(modelToValidate) || modelToValidate.length > 100) {
      setSettingsStatus('Invalid Model Name. Spaces/special characters are not allowed.', 'error');
      return;
    }

    await chrome.storage.local.set({
      aiProvider: provider,
      geminiApiKey: geminiKey,
      geminiModelName: geminiModel,
      anthropicApiKey: anthropicKey,
      anthropicModelName: anthropicModel
    });

    aiProvider = provider;
    geminiApiKey = geminiKey;
    geminiModelName = geminiModel;
    anthropicApiKey = anthropicKey;
    anthropicModelName = anthropicModel;

    setSettingsStatus('API Settings saved successfully!', 'success');
    setTimeout(() => {
      settingsPanel.classList.add('hidden');
      settingsStatus.textContent = '';
    }, 1500);
    validateAnalyzeButton();
  });

  // Handle Tab Switch / Updates
  chrome.tabs.onActivated.addListener(() => setTimeout(scanActiveTab, 500));
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      scanActiveTab();
    }
  });

  // Job Description Input validation
  jobDescriptionTextarea.addEventListener('input', validateAnalyzeButton);

  // Run Analysis
  analyzeBtn.addEventListener('click', runResumeOptimization);

  // Tab Navigation
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });

  // Copy LaTeX Code
  copyLatexBtn.addEventListener('click', () => {
    if (!analysisResults || !analysisResults.latexCode) return;
    navigator.clipboard.writeText(analysisResults.latexCode)
      .then(() => {
        const originalText = copyLatexBtn.textContent;
        copyLatexBtn.textContent = 'Copied! ✓';
        copyLatexBtn.style.backgroundColor = 'var(--success-color)';
        setTimeout(() => {
          copyLatexBtn.textContent = originalText;
          copyLatexBtn.style.backgroundColor = 'var(--accent-color)';
        }, 2000);
      })
      .catch(err => console.error('Failed to copy text:', err));
  });

  // Copy Filename
  copyFilenameBtn.addEventListener('click', () => {
    if (!analysisResults) return;
    const filename = getSuggestedFilename();
    navigator.clipboard.writeText(filename)
      .then(() => {
        const originalText = copyFilenameBtn.textContent;
        copyFilenameBtn.textContent = '✓';
        setTimeout(() => {
          copyFilenameBtn.textContent = '📋';
        }, 1500);
      })
      .catch(err => console.error('Failed to copy filename:', err));
  });
}

// Set Status Message in Settings
function setSettingsStatus(msg, type) {
  settingsStatus.textContent = msg;
  settingsStatus.className = 'status-msg ' + type;
}

// Validate whether all fields are filled to run the analysis
function validateAnalyzeButton() {
  const isJdFilled = jobDescriptionTextarea.value.trim().length > 10;
  const hasApiKey = aiProvider === 'gemini' ? geminiApiKey.length > 0 : anthropicApiKey.length > 0;
  
  analyzeBtn.disabled = !(isPdfDetected && isJdFilled && hasApiKey);
}

// Scan the active tab to detect if it contains a PDF
async function scanActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      setPdfStatus('error', 'No active tab found', 'Please open a tab containing a PDF resume.');
      return;
    }

    const activeTab = tabs[0];
    activeTabUrl = activeTab.url || '';
    activeTabTitle = activeTab.title || 'Resume';

    // Verify if URL points to a PDF
    const isPdf = activeTabUrl.toLowerCase().endsWith('.pdf') || 
                  activeTabUrl.includes('mime=application/pdf') ||
                  activeTabTitle.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      isPdfDetected = true;
      let displayName = activeTabTitle;
      if (activeTabUrl.startsWith('file:///')) {
        displayName = activeTabUrl.substring(activeTabUrl.lastIndexOf('/') + 1);
        setPdfStatus('success', 'Local PDF Detected', displayName);
      } else {
        setPdfStatus('success', 'Web PDF Detected', displayName);
      }
    } else {
      isPdfDetected = false;
      setPdfStatus('warning', 'No PDF Resume Detected', 'Please navigate to a PDF resume file in this tab.');
    }
  } catch (error) {
    console.error('Error scanning active tab:', error);
    setPdfStatus('error', 'Error scanning tab', error.message);
  } finally {
    validateAnalyzeButton();
  }
}

// Set state of the PDF detector
function setPdfStatus(type, statusText, detailsText) {
  pdfStatusContainer.className = `status-indicator ${type}`;
  pdfStatusText.textContent = statusText;
  pdfDetails.textContent = detailsText;
}

// Trigger parsing the PDF and analyzing it with Gemini API
async function runResumeOptimization() {
  try {
    // Show Progress indicator, hide results
    progressCard.classList.remove('hidden');
    resultsCard.classList.add('hidden');
    resetProgressSteps();

    // Step 1: Fetch and extract PDF text
    updateStepState('step-pdf', 'active');
    extractedResumeText = await extractTextFromPdf(activeTabUrl);
    updateStepState('step-pdf', 'completed');

    // Step 2: Compare with Job Description (AI API)
    updateStepState('step-ai', 'active');
    const jobDescription = jobDescriptionTextarea.value.trim();
    if (aiProvider === 'gemini') {
      analysisResults = await callGeminiApi(extractedResumeText, jobDescription);
    } else {
      analysisResults = await callAnthropicApi(extractedResumeText, jobDescription);
    }
    updateStepState('step-ai', 'completed');

    // Step 3: Render and display results
    updateStepState('step-latex', 'active');
    renderResults(analysisResults);
    updateStepState('step-latex', 'completed');

    // Hide progress, display results card
    setTimeout(() => {
      progressCard.classList.add('hidden');
      resultsCard.classList.remove('hidden');
    }, 800);

  } catch (error) {
    console.error('Optimization failed:', error);
    alert('Optimization failed: ' + error.message);
    progressCard.classList.add('hidden');
  }
}

// Helper to reset step styling
function resetProgressSteps() {
  const steps = [stepPdf, stepAi, stepLatex];
  steps.forEach(step => {
    step.className = 'step';
  });
}

// Helper to change classes on steps
function updateStepState(stepId, state) {
  const step = document.getElementById(stepId);
  if (state === 'active') {
    step.classList.add('active');
    step.classList.remove('completed');
  } else if (state === 'completed') {
    step.classList.add('completed');
    step.classList.remove('active');
  }
}

// Extract PDF text using PDF.js
async function extractTextFromPdf(pdfUrl) {
  try {
    let response;
    try {
      response = await fetch(pdfUrl);
    } catch (fetchErr) {
      if (pdfUrl.startsWith('file:///')) {
        throw new Error('Cannot read local files. Please go to chrome://extensions, open details for this extension, and enable "Allow access to file URLs".');
      }
      throw fetchErr;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    if (fullText.trim().length === 0) {
      throw new Error('No readable text found in this PDF. It might be scanned or image-only.');
    }
    
    return fullText;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}

// Call Gemini 1.5 Pro to analyze the resume and generate the Overleaf LaTeX template
async function callGeminiApi(resumeText, jobDescription) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName}:generateContent?key=${geminiApiKey}`;

  const systemInstruction = `You are a world-class senior tech recruiter, hiring manager, and LaTeX typesetting expert.
Your job is to analyze a candidate's resume against a target job description and tailor the resume so that:
1. It passes any applicant tracking system (ATS) parser without layout or text bugs (clean single-column format).
2. It uses strong, action-oriented impact phrases that immediately hook senior recruiters and hiring managers.
3. It includes crucial missing keywords and skills identified from the job description.
4. It compiles cleanly in Overleaf LaTeX (standard TeX Live environment) without needing any secondary external class files.

CRITICAL INSTRUCTIONS FOR LATEX:
- You MUST use the following specific inline LaTeX document structure and layout template. It embeds the custom resume styles directly so the user can copy/paste it into a single main.tex file in Overleaf. Do not change command names, macro names, or section styles:

  \\documentclass[11pt,letterpaper]{article} % Font size and paper type

  \\usepackage[left=0.4 in,top=0.4in,right=0.4 in,bottom=0.4in]{geometry} % Document margins
  \\usepackage[parfill]{parskip} % Remove paragraph indentation
  \\usepackage{array} % Required for boldface tabular columns
  \\usepackage{ifthen} % Required for ifthenelse statements

  \\usepackage{hyperref}
  \\hypersetup{
      colorlinks=true,
      linkcolor=blue,
      filecolor=magenta,      
      urlcolor=blue,
  }

  \\pagestyle{empty} % Suppress page numbers

  %----------------------------------------------------------------------------------------
  %	HEADINGS COMMANDS & CLASS DEFINITIONS INLINED
  %----------------------------------------------------------------------------------------
  \\makeatletter

  \\def \\name#1{\\def\\@name{#1}} % Defines the \\name command to set name
  \\def \\@name {} % Sets \\@name to empty by default

  \\def \\addressSep {$\\diamond$} % Set default address separator to a diamond

  % One, two or three address lines can be specified 
  \\let \\@addressone \\relax
  \\let \\@addresstwo \\relax
  \\let \\@addressthree \\relax

  % \\address command can be used to set the first, second, and third address (last 2 optional)
  \\def \\address #1{
    \\@ifundefined{@addresstwo}{
      \\def \\@addresstwo {#1}
    }{
    \\@ifundefined{@addressthree}{
    \\def \\@addressthree {#1}
    }{
       \\def \\@addressone {#1}
    }}
  }

  % \\printaddress is used to style an address line (given as input)
  \\def \\printaddress #1{
    \\begingroup
      \\def \\\\ {\\addressSep\\ }
      \\centerline{#1}
    \\endgroup
    \\par
    \\addressskip
  }

  % \\printname is used to print the name as a page header
  \\def \\printname {
    \\begingroup
      \\hfil{\\MakeUppercase{\\namesize\\bf \\@name}}\\hfil
      \\nameskip\\break
    \\endgroup
  }

  %----------------------------------------------------------------------------------------
  %	PRINT THE HEADING LINES
  %----------------------------------------------------------------------------------------

  \\let\\ori@document=\\document
  \\renewcommand{\\document}{
    \\ori@document  % Begin document
    \\printname % Print the name specified with \\name
    \\@ifundefined{@addressone}{}{ % Print the first address if specified
      \\printaddress{\\@addressone}}
    \\@ifundefined{@addresstwo}{}{ % Print the second address if specified
      \\printaddress{\\@addresstwo}}
    \\@ifundefined{@addressthree}{}{ % Print the third address if specified
      \\printaddress{\\@addressthree}}
  }

  %----------------------------------------------------------------------------------------
  %	SECTION FORMATTING
  %----------------------------------------------------------------------------------------

  % Defines the rSection environment for the large sections within the CV
  \\newenvironment{rSection}[1]{ % 1 input argument - section name
    \\sectionskip
    \\MakeUppercase{{\\bf #1}} % Section title
    \\sectionlineskip
    \\hrule % Horizontal line
    \\begin{list}{}{ % List for each individual item in the section
      \\setlength{\\leftmargin}{0em} % Margin within the section
    }
    \\item[]
  }{
    \\end{list}
  }

  % The below commands define the whitespace after certain things in the document
  \\def\\namesize{\\LARGE} % Size of the name at the top of the document
  \\def\\addressskip{\\smallskip} % The space between the two address (or phone/email) lines
  \\def\\sectionlineskip{\\medskip} % The space above the horizontal line for each section 
  \\def\\nameskip{\\medskip} % The space after your name at the top
  \\def\\sectionskip{\\medskip} % The space after the heading section

  \\makeatother

  \\newcommand{\\tab}[1]{\\hspace{.2667\\textwidth}\\rlap{#1}} 
  \\newcommand{\\itab}[1]{\\hspace{0em}\\rlap{#1}}

  \\name{Candidate Name} % Your name
  % You can merge both of these into a single line, if you do not have a website.
  \\address{Phone Number \\\\ Location} 
  \\address{\\href{mailto:email@address.com}{email@address.com} \\\\ \\href{https://linkedin.com/in/username}{linkedin.com/in/username}}  %

  \\begin{document}

  %----------------------------------------------------------------------------------------
  %	OBJECTIVE
  %----------------------------------------------------------------------------------------

  \\begin{rSection}{OBJECTIVE}

  {Software Engineer/tailored role with years of experience, seeking full-time tailored roles.}

  \\end{rSection}

  %----------------------------------------------------------------------------------------
  % TECHINICAL STRENGTHS	
  %----------------------------------------------------------------------------------------
  \\begin{rSection}{SKILLS}

  \\begin{tabular}{ @{} >{\\bfseries}l @{\\hspace{6ex}} p{5.0in} }
  Technical Skills & A, B, C, D
  \\\\
  Soft Skills & A, B, C, D\\\\
  XYZ & A, B, C, D\\\\
  \\end{tabular}\\\\
  \\end{rSection}

  \\begin{rSection}{EXPERIENCE}

  \\textbf{Role Name} \\hfill Jan 2017 - Jan 2019\\\\
  Company Name \\hfill \\textit{San Francisco, CA}
   \\begin{itemize}
      \\itemsep -3pt {} 
       \\item Achieved X\\% growth for XYZ using A, B, and C skills.
       \\item Led XYZ which led to X\\% of improvement in ABC
      \\item Developed XYZ that did A, B, and C using X, Y, and Z. 
   \\end{itemize}

  \\end{rSection} 

  %----------------------------------------------------------------------------------------
  %	WORK EXPERIENCE SECTION (PROJECTS)
  %----------------------------------------------------------------------------------------

  \\begin{rSection}{PROJECTS}
  \\vspace{-1.25em}
  \\item \\textbf{Project Title.} {Project description... \\href{URL}{(Link)}}
  \\end{rSection} 

  %----------------------------------------------------------------------------------------
  %	EDUCATION SECTION
  %----------------------------------------------------------------------------------------

  \\begin{rSection}{Education}

  {\\bf Master/Bachelor of Computer Science}, Stanford University \\hfill {Expected 2020}\\\\
  Relevant Coursework: A, B, C, and D.

  \\end{rSection}

  \\end{document}

- Return the LaTeX code as a string in the JSON output. Remember to escape backslashes as double backslashes in JSON (e.g. \\\\documentclass, \\\\begin{document}, \\\\hfill, \\\\name, \\\\address, \\\\item, \\\\textbf, \\\\%).
- Make sure the LaTeX code contains the actual tailored content of the resume, incorporating the keywords and suggestions. Do NOT output a placeholder template. It should be a COMPLETE, fully written, ready-to-compile resume.
- For links, use standard LaTeX hyperref syntax: \\\\href{URL}{text}.
- Under the EXPERIENCE section, make sure the role name uses \\\\textbf{Role Name} and the dates use \\\\hfill, the company name is on the next line followed by \\\\hfill \\\\textit{Location}, and the bullet points are nested in an itemize block with \\\\itemsep -3pt {} and no other custom styling.
- Under the PROJECTS section, use \\\\item \\\\textbf{Project Title.} {Project description...} style.
- Under the Education section, use {\\\\bf Degree/Major}, University Name \\\\hfill {Expected Year or Year Range} followed by \\\\ Relevant Coursework: Course 1, Course 2...

Return the response in JSON format matching this schema:
{
  "atsMatchScore": <number between 0 and 100>,
  "missingKeywords": ["keyword1", "keyword2", ...],
  "atsSuggestions": ["suggestion1", "suggestion2", ...],
  "recruiterNegatives": ["point1", "point2", ...],
  "recruiterPositives": ["point1", "point2", ...],
  "candidateName": "Extracted Candidate's Full Name (e.g. John Doe)",
  "targetDesignation": "Target Role/Designation from Job Description (e.g. Senior Software Engineer)",
  "latexCode": "Full compiled LaTeX code, with all backslashes and quotes escaped for JSON format. Do not wrap this in markdown blocks, just the raw string."
}`;

  const promptText = `
JOB DESCRIPTION:
${jobDescription}

CANDIDATE CURRENT RESUME TEXT:
${resumeText}

Analyze this resume against the job description and output the complete JSON object containing recommendations and the fully tailored LaTeX resume code.`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        { text: systemInstruction }
      ]
    },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2
    }
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded (429). Google AI Studio's free tier has a requests-per-minute limit. Please wait 15-30 seconds and try again.");
    }
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  const jsonResponse = await response.json();
  
  try {
    const rawResult = jsonResponse.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(rawResult);
    return parsed;
  } catch (err) {
    console.error('Failed to parse Gemini response:', jsonResponse, err);
    throw new Error('Gemini API returned an invalid JSON response. Please try again.');
  }
}

// Render the results into the HTML UI
function renderResults(results) {
  // Score
  atsScoreBadge.textContent = `${results.atsMatchScore || 0}%`;
  
  // Missing Keywords
  missingKeywordsList.innerHTML = '';
  if (results.missingKeywords && results.missingKeywords.length > 0) {
    results.missingKeywords.forEach(keyword => {
      const li = document.createElement('li');
      li.textContent = keyword;
      missingKeywordsList.appendChild(li);
    });
  } else {
    missingKeywordsList.innerHTML = '<li>None detected! Good job.</li>';
  }

  // ATS Suggestions
  atsSuggestionsList.innerHTML = '';
  if (results.atsSuggestions && results.atsSuggestions.length > 0) {
    results.atsSuggestions.forEach(sug => {
      const li = document.createElement('li');
      li.textContent = sug;
      atsSuggestionsList.appendChild(li);
    });
  } else {
    atsSuggestionsList.innerHTML = '<li>No suggestions.</li>';
  }

  // Recruiter Critique Negatives
  recruiterNegativesList.innerHTML = '';
  if (results.recruiterNegatives && results.recruiterNegatives.length > 0) {
    results.recruiterNegatives.forEach(neg => {
      const li = document.createElement('li');
      li.textContent = neg;
      recruiterNegativesList.appendChild(li);
    });
  } else {
    recruiterNegativesList.innerHTML = '<li>No major red flags!</li>';
  }

  // Recruiter Critique Positives
  recruiterPositivesList.innerHTML = '';
  if (results.recruiterPositives && results.recruiterPositives.length > 0) {
    results.recruiterPositives.forEach(pos => {
      const li = document.createElement('li');
      li.textContent = pos;
      recruiterPositivesList.appendChild(li);
    });
  } else {
    recruiterPositivesList.innerHTML = '<li>No standouts highlighted.</li>';
  }

  // Filename suggestion
  suggestedFilenameCode.textContent = getSuggestedFilename();

  // LaTeX code
  latexCodeBlock.textContent = results.latexCode || '% No LaTeX code generated.';
}

// Generate the suggested file name based on API results
function getSuggestedFilename() {
  if (!analysisResults) return 'resume.pdf';

  const cleanName = (analysisResults.candidateName || 'Candidate')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '');

  const cleanDesignation = (analysisResults.targetDesignation || 'Role')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '');

  return `${cleanName}_${cleanDesignation}.pdf`;
}

// Show/hide settings groups based on selected provider
function updateSettingsGroupVisibility() {
  if (aiProvider === 'gemini') {
    geminiSettingsGroup.classList.remove('hidden');
    anthropicSettingsGroup.classList.add('hidden');
  } else {
    geminiSettingsGroup.classList.add('hidden');
    anthropicSettingsGroup.classList.remove('hidden');
  }
}

// Call Anthropic Claude to analyze the resume and generate the Overleaf LaTeX template
async function callAnthropicApi(resumeText, jobDescription) {
  const apiUrl = 'https://api.anthropic.com/v1/messages';

  const systemInstruction = `You are a world-class senior tech recruiter, hiring manager, and LaTeX typesetting expert.
Your job is to analyze a candidate's resume against a target job description and tailor the resume so that:
1. It passes any applicant tracking system (ATS) parser without layout or text bugs (clean single-column format).
2. It uses strong, action-oriented impact phrases that immediately hook senior recruiters and hiring managers.
3. It includes crucial missing keywords and skills identified from the job description.
4. It compiles cleanly in Overleaf LaTeX (standard TeX Live environment) without needing any secondary external class files.

CRITICAL INSTRUCTIONS FOR LATEX:
- You MUST use the following specific inline LaTeX document structure and layout template. It embeds the custom resume styles directly so the user can copy/paste it into a single main.tex file in Overleaf. Do not change command names, macro names, or section styles:

  \\documentclass[11pt,letterpaper]{article} % Font size and paper type

  \\usepackage[left=0.4 in,top=0.4in,right=0.4 in,bottom=0.4in]{geometry} % Document margins
  \\usepackage[parfill]{parskip} % Remove paragraph indentation
  \\usepackage{array} % Required for boldface tabular columns
  \\usepackage{ifthen} % Required for ifthenelse statements

  \\usepackage{hyperref}
  \\hypersetup{
      colorlinks=true,
      linkcolor=blue,
      filecolor=magenta,      
      urlcolor=blue,
  }

  \\pagestyle{empty} % Suppress page numbers

  %----------------------------------------------------------------------------------------
  %	HEADINGS COMMANDS & CLASS DEFINITIONS INLINED
  %----------------------------------------------------------------------------------------
  \\makeatletter

  \\def \\name#1{\\def\\@name{#1}} % Defines the \\name command to set name
  \\def \\@name {} % Sets \\@name to empty by default

  \\def \\addressSep {$\\diamond$} % Set default address separator to a diamond

  % One, two or three address lines can be specified 
  \\let \\@addressone \\relax
  \\let \\@addresstwo \\relax
  \\let \\@addressthree \\relax

  % \\address command can be used to set the first, second, and third address (last 2 optional)
  \\def \\address #1{
    \\@ifundefined{@addresstwo}{
      \\def \\@addresstwo {#1}
    }{
    \\@ifundefined{@addressthree}{
    \\def \\@addressthree {#1}
    }{
       \\def \\@addressone {#1}
    }}
  }

  % \\printaddress is used to style an address line (given as input)
  \\def \\printaddress #1{
    \\begingroup
      \\def \\\\ {\\addressSep\\ }
      \\centerline{#1}
    \\endgroup
    \\par
    \\addressskip
  }

  % \\printname is used to print the name as a page header
  \\def \\printname {
    \\begingroup
      \\hfil{\\MakeUppercase{\\namesize\\bf \\@name}}\\hfil
      \\nameskip\\break
    \\endgroup
  }

  %----------------------------------------------------------------------------------------
  %	PRINT THE HEADING LINES
  %----------------------------------------------------------------------------------------

  \\let\\ori@document=\\document
  \\renewcommand{\\document}{
    \\ori@document  % Begin document
    \\printname % Print the name specified with \\name
    \\@ifundefined{@addressone}{}{ % Print the first address if specified
      \\printaddress{\\@addressone}}
    \\@ifundefined{@addresstwo}{}{ % Print the second address if specified
      \\printaddress{\\@addresstwo}}
    \\@ifundefined{@addressthree}{}{ % Print the third address if specified
      \\printaddress{\\@addressthree}}
  }

  %----------------------------------------------------------------------------------------
  %	SECTION FORMATTING
  %----------------------------------------------------------------------------------------

  % Defines the rSection environment for the large sections within the CV
  \\newenvironment{rSection}[1]{ % 1 input argument - section name
    \\sectionskip
    \\MakeUppercase{{\\bf #1}} % Section title
    \\sectionlineskip
    \\hrule % Horizontal line
    \\begin{list}{}{ % List for each individual item in the section
      \\setlength{\\leftmargin}{0em} % Margin within the section
    }
    \\item[]
  }{
    \\end{list}
  }

  % The below commands define the whitespace after certain things in the document
  \\def\\namesize{\\LARGE} % Size of the name at the top of the document
  \\def\\addressskip{\\smallskip} % The space between the two address (or phone/email) lines
  \\def\\sectionlineskip{\\medskip} % The space above the horizontal line for each section 
  \\def\\nameskip{\\medskip} % The space after your name at the top
  \\def\\sectionskip{\\medskip} % The space after the heading section

  \\makeatother

  \\newcommand{\\tab}[1]{\\hspace{.2667\\textwidth}\\rlap{#1}} 
  \\newcommand{\\itab}[1]{\\hspace{0em}\\rlap{#1}}

  \\name{Candidate Name} % Your name
  % You can merge both of these into a single line, if you do not have a website.
  \\address{Phone Number \\\\ Location} 
  \\address{\\href{mailto:email@address.com}{email@address.com} \\\\ \\href{https://linkedin.com/in/username}{linkedin.com/in/username}}  %

  \\begin{document}

  %----------------------------------------------------------------------------------------
  %	OBJECTIVE
  %----------------------------------------------------------------------------------------

  \\begin{rSection}{OBJECTIVE}

  {Software Engineer/tailored role with years of experience, seeking full-time tailored roles.}

  \\end{rSection}

  %----------------------------------------------------------------------------------------
  % TECHINICAL STRENGTHS	
  %----------------------------------------------------------------------------------------
  \\begin{rSection}{SKILLS}

  \\begin{tabular}{ @{} >{\\bfseries}l @{\\hspace{6ex}} p{5.0in} }
  Technical Skills & A, B, C, D
  \\\\
  Soft Skills & A, B, C, D\\\\
  XYZ & A, B, C, D\\\\
  \\end{tabular}\\\\
  \\end{rSection}

  \\begin{rSection}{EXPERIENCE}

  \\textbf{Role Name} \\hfill Jan 2017 - Jan 2019\\\\
  Company Name \\hfill \\textit{San Francisco, CA}
   \\begin{itemize}
      \\itemsep -3pt {} 
       \\item Achieved X\\% growth for XYZ using A, B, and C skills.
       \\item Led XYZ which led to X\\% of improvement in ABC
      \\item Developed XYZ that did A, B, and C using X, Y, and Z. 
   \\end{itemize}

  \\end{rSection} 

  %----------------------------------------------------------------------------------------
  %	WORK EXPERIENCE SECTION (PROJECTS)
  %----------------------------------------------------------------------------------------

  \\begin{rSection}{PROJECTS}
  \\vspace{-1.25em}
  \\item \\textbf{Project Title.} {Project description... \\href{URL}{(Link)}}
  \\end{rSection} 

  %----------------------------------------------------------------------------------------
  %	EDUCATION SECTION
  %----------------------------------------------------------------------------------------

  \\begin{rSection}{Education}

  {\\bf Master/Bachelor of Computer Science}, Stanford University \\hfill {Expected 2020}\\\\
  Relevant Coursework: A, B, C, and D.

  \\end{rSection}

  \\end{document}

- Return the LaTeX code as a string in the JSON output. Remember to escape backslashes as double backslashes in JSON (e.g. \\\\documentclass, \\\\begin{document}, \\\\hfill, \\\\name, \\\\address, \\\\item, \\\\textbf, \\\\%).
- Make sure the LaTeX code contains the actual tailored content of the resume, incorporating the keywords and suggestions. Do NOT output a placeholder template. It should be a COMPLETE, fully written, ready-to-compile resume.
- For links, use standard LaTeX hyperref syntax: \\\\href{URL}{text}.
- Under the EXPERIENCE section, make sure the role name uses \\\\textbf{Role Name} and the dates use \\\\hfill, the company name is on the next line followed by \\\\hfill \\\\textit{Location}, and the bullet points are nested in an itemize block with \\\\itemsep -3pt {} and no other custom styling.
- Under the PROJECTS section, use \\\\item \\\\textbf{Project Title.} {Project description...} style.
- Under the Education section, use {\\\\bf Degree/Major}, University Name \\\\hfill {Expected Year or Year Range} followed by \\\\ Relevant Coursework: Course 1, Course 2...

Return the response in JSON format matching this schema:
{
  "atsMatchScore": <number between 0 and 100>,
  "missingKeywords": ["keyword1", "keyword2", ...],
  "atsSuggestions": ["suggestion1", "suggestion2", ...],
  "recruiterNegatives": ["point1", "point2", ...],
  "recruiterPositives": ["point1", "point2", ...],
  "candidateName": "Extracted Candidate's Full Name (e.g. John Doe)",
  "targetDesignation": "Target Role/Designation from Job Description (e.g. Senior Software Engineer)",
  "latexCode": "Full compiled LaTeX code, with all backslashes and quotes escaped for JSON format. Do not wrap this in markdown blocks, just the raw string."
}

CRITICAL: Your entire response must be a single raw JSON object matching the above schema. Do NOT wrap it in markdown code blocks like \`\`\`json. Do NOT include any additional conversational text, preambles, or explanations.`;

  const promptText = `
JOB DESCRIPTION:
${jobDescription}

CANDIDATE CURRENT RESUME TEXT:
${resumeText}

Analyze this resume against the job description and output the complete JSON object containing recommendations and the fully tailored LaTeX resume code.`;

  const requestBody = {
    model: anthropicModelName,
    max_tokens: 4096,
    system: systemInstruction,
    messages: [
      {
        role: "user",
        content: promptText
      }
    ]
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded (429) on Anthropic API. Please wait a moment and try again.");
    }
    const errText = await response.text();
    throw new Error(`Anthropic API Error (${response.status}): ${errText}`);
  }

  const jsonResponse = await response.json();
  
  try {
    const rawResult = jsonResponse.content[0].text.trim();
    // In case the model accidentally wrapped it in code blocks:
    const cleanJsonText = rawResult.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJsonText);
    return parsed;
  } catch (err) {
    console.error('Failed to parse Anthropic response:', jsonResponse, err);
    throw new Error('Anthropic API returned an invalid JSON response. Please try again.');
  }
}
