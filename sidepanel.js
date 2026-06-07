// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

// DOM Elements
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const apiKeyInput = document.getElementById('api-key-input');
const togglePasswordVisibility = document.getElementById('toggle-password-visibility');
const modelInput = document.getElementById('model-input');
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

const resultsCard = document.getElementById('results-card');
const atsScoreBadge = document.getElementById('ats-score');
const missingKeywordsList = document.getElementById('missing-keywords');
const atsSuggestionsList = document.getElementById('ats-suggestions');
const recruiterNegativesList = document.getElementById('recruiter-negatives');
const recruiterPositivesList = document.getElementById('recruiter-positives');
const suggestedFilenameCode = document.getElementById('suggested-filename');
const copyFilenameBtn = document.getElementById('copy-filename-btn');
const copyLatexBtn = document.getElementById('copy-latex-btn');
const latexCodeBlock = document.getElementById('latex-code');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// App State
let activeTabUrl = '';
let activeTabTitle = '';
let geminiApiKey = '';
let geminiModelName = 'gemini-2.0-flash';
let isPdfDetected = false;
let extractedResumeText = '';
let analysisResults = null;

// Initialize Extension Sidepanel
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Load API Settings
  const data = await chrome.storage.local.get(['geminiApiKey', 'geminiModelName']);
  if (data.geminiApiKey) {
    geminiApiKey = data.geminiApiKey;
    apiKeyInput.value = geminiApiKey;
    if (data.geminiModelName) {
      geminiModelName = data.geminiModelName;
      modelInput.value = geminiModelName;
    }
    setSettingsStatus('API Settings loaded.', 'success');
  } else {
    setSettingsStatus('Please set your Gemini API Key.', 'error');
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

  // Save Settings
  saveSettingsBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    const model = modelInput.value.trim() || 'gemini-2.0-flash';
    if (!key) {
      setSettingsStatus('API Key cannot be empty.', 'error');
      return;
    }
    await chrome.storage.local.set({ geminiApiKey: key, geminiModelName: model });
    geminiApiKey = key;
    geminiModelName = model;
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
  const hasApiKey = geminiApiKey.length > 0;
  
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

    // Step 2: Compare with Job Description (Gemini API)
    updateStepState('step-ai', 'active');
    const jobDescription = jobDescriptionTextarea.value.trim();
    analysisResults = await callGeminiApi(extractedResumeText, jobDescription);
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
4. It compiles cleanly in Overleaf LaTeX (standard TeX Live environment) without packages that require non-standard fonts.

CRITICAL INSTRUCTIONS FOR LATEX:
- Use clean, standard packages: article, latexsym, fullpage, titlesec, marvosym, color, verbatim, enumitem, hyperref, fancyhdr, babel, tabularx.
- Do NOT use fonts that are not in the standard TeX Live package list. Standard fonts like computer modern (default) are fine.
- Structure headers clearly. Use simple bullet points with custom small margins using enumitem.
- Do not use multi-column tables for experience or education; they are bad for ATS. Instead, use headers or custom single-column descriptions.
- Ensure all LaTeX special characters like %, &, $, _, #, { } are correctly escaped.
- Return the LaTeX code as a string in the JSON output. Remember to escape backslashes as double backslashes in JSON (e.g. \\documentclass, \\begin{document}).
- Make sure the LaTeX code contains the actual tailored content of the resume, incorporating the keywords and suggestions. Do NOT output a placeholder template. It should be a COMPLETE, fully written, ready-to-compile resume.

Return the response in JSON format matching this schema:
{
  "atsMatchScore": <number between 0 and 100>,
  "missingKeywords": ["keyword1", "keyword2", ...],
  "atsSuggestions": ["suggestion1", "suggestion2", ...],
  "recruiterNegatives": ["point1", "point2", ...],
  "recruiterPositives": ["point1", "point2", ...],
  "candidateName": "Extracted Candidate's Full Name (e.g. John Doe)",
  "targetDesignation": "Target Role/Designation from Job Description (e.g. Senior Software Engineer)",
  "latexCode": "Full compiled LaTeX code, with all backslashes escaped for JSON format. Do not wrap this in markdown blocks, just the raw string."
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
