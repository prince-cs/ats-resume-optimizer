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
    renderResults(analysisResults);

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
  const steps = [stepPdf, stepAi];
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

  const systemInstruction = `You are a world-class senior tech recruiter and hiring manager.
Your job is to analyze a candidate's resume against a target job description and provide structured feedback on ATS fit and recruiter feedback:
1. ATS Match Score: A percentage rating of how well the candidate's skills and experience match the job description.
2. Missing Keywords: Crucial missing keywords and skills identified from the job description that should be in the resume.
3. ATS Suggestions: Specific, actionable bullet-point tailoring suggestions for the resume's experience section to improve ATS matching.
4. Recruiter Critique Negatives: Clear explanations of what might cause a recruiter/hiring manager to reject the resume or pass on the candidate.
5. Recruiter Critique Positives: Clear explanations of candidate standouts that match the job requirements well.

Return the response in JSON format matching this schema:
{
  "atsMatchScore": <number between 0 and 100>,
  "missingKeywords": ["keyword1", "keyword2", ...],
  "atsSuggestions": ["suggestion1", "suggestion2", ...],
  "recruiterNegatives": ["point1", "point2", ...],
  "recruiterPositives": ["point1", "point2", ...]
}`;

  const promptText = `
JOB DESCRIPTION:
${jobDescription}

CANDIDATE CURRENT RESUME TEXT:
${resumeText}

Analyze this resume against the job description and output the complete JSON object containing recommendations.`;

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

  const systemInstruction = `You are a world-class senior tech recruiter and hiring manager.
Your job is to analyze a candidate's resume against a target job description and provide structured feedback on ATS fit and recruiter feedback:
1. ATS Match Score: A percentage rating of how well the candidate's skills and experience match the job description.
2. Missing Keywords: Crucial missing keywords and skills identified from the job description that should be in the resume.
3. ATS Suggestions: Specific, actionable bullet-point tailoring suggestions for the resume's experience section to improve ATS matching.
4. Recruiter Critique Negatives: Clear explanations of what might cause a recruiter/hiring manager to reject the resume or pass on the candidate.
5. Recruiter Critique Positives: Clear explanations of candidate standouts that match the job requirements well.

Return the response in JSON format matching this schema:
{
  "atsMatchScore": <number between 0 and 100>,
  "missingKeywords": ["keyword1", "keyword2", ...],
  "atsSuggestions": ["suggestion1", "suggestion2", ...],
  "recruiterNegatives": ["point1", "point2", ...],
  "recruiterPositives": ["point1", "point2", ...]
}

CRITICAL: Your entire response must be a single raw JSON object matching the above schema. Do NOT wrap it in markdown code blocks like \`\`\`json. Do NOT include any additional conversational text, preambles, or explanations.`;

  const promptText = `
JOB DESCRIPTION:
${jobDescription}

CANDIDATE CURRENT RESUME TEXT:
${resumeText}

Analyze this resume against the job description and output the complete JSON object containing recommendations.`;

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
