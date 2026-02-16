const { ipcRenderer } = require('electron');

let systemInfo = null;
let analysisResult = null;
let selectedDependencies = new Set();
let currentMCQIndex = 0;
let mcqData = [];
let score = 0;
let allQuestions = [];
let sudoPassword = null;
let questionInterval = null;
let currentMode = 'full'; // 'essential' or 'full'
let pendingInstallDeps = null; // deps waiting for safety confirmation
let installedPackagesHistory = []; // track what we installed this session
let selectedForUninstall = new Set(); // packages selected for uninstall
let isWingetFlow = false; // track whether results came from winget search or AI flow

// Platform detection
let isWindows = false;
let isMac = false;
let isLinux = false;

// HTML escape helper to prevent XSS
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.closeWelcome = function() {
  document.getElementById('welcome-modal').style.display = 'none';
};

// API Key configuration functions
window.saveApiKey = async function() {
  const apiKeyInput = document.getElementById('api-key-input');
  const apiKey = apiKeyInput.value.trim();
  const errorDiv = document.getElementById('api-key-error');
  
  if (!apiKey) {
    errorDiv.textContent = 'Please enter an API key';
    errorDiv.style.display = 'block';
    return;
  }
  
  if (!apiKey.startsWith('AIza')) {
    errorDiv.textContent = 'Invalid API key format. Gemini API keys start with "AIza"';
    errorDiv.style.display = 'block';
    return;
  }
  
  try {
    const result = await ipcRenderer.invoke('save-api-key', apiKey);
    if (result.success) {
      document.getElementById('api-key-modal').style.display = 'none';
      errorDiv.style.display = 'none';
      apiKeyInput.value = '';
    } else {
      errorDiv.textContent = 'Failed to save API key: ' + result.error;
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    errorDiv.textContent = 'Error saving API key: ' + error.message;
    errorDiv.style.display = 'block';
  }
};

async function checkApiKeyOnStartup() {
  try {
    const status = await ipcRenderer.invoke('get-api-key-status');
    if (!status.configured) {
      // Hide welcome modal and show API key modal
      document.getElementById('welcome-modal').style.display = 'none';
      document.getElementById('api-key-modal').style.display = 'flex';
    }
  } catch (error) {
    console.error('Error checking API key status:', error);
  }
}

// ==================== Settings Functions ====================

// Model options for each provider
const providerModels = {
  gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Default)', default: true },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (Fast)' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Recommended)', default: true },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Recommended)', default: true },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fast)' }
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Default)', default: true },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fast)' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' }
  ]
};

const providerHints = {
  gemini: 'Get your Gemini API key from <a href="#" onclick="require(\'electron\').shell.openExternal(\'https://aistudio.google.com/apikey\'); return false;">Google AI Studio</a>',
  openai: 'Get your OpenAI API key from <a href="#" onclick="require(\'electron\').shell.openExternal(\'https://platform.openai.com/api-keys\'); return false;">OpenAI Platform</a>',
  anthropic: 'Get your Claude API key from <a href="#" onclick="require(\'electron\').shell.openExternal(\'https://console.anthropic.com/\'); return false;">Anthropic Console</a>',
  groq: 'Get your Groq API key from <a href="#" onclick="require(\'electron\').shell.openExternal(\'https://console.groq.com/keys\'); return false;">Groq Console</a>'
};

window.openSettings = async function() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  
  // Load current settings (UI display only)
  try {
    // Set defaults - just for display
    const providerSelect = document.getElementById('settings-ai-provider');
    if (providerSelect) providerSelect.value = 'gemini';
    
    // Update model options for current provider
    onProviderChange();
    
    // Set model
    const modelSelect = document.getElementById('settings-model');
    if (modelSelect) modelSelect.value = 'gemini-2.5-flash';
    
    // Show masked API key (always show as configured)
    const apiKeyInput = document.getElementById('settings-api-key');
    if (apiKeyInput) {
      apiKeyInput.value = 'AIza••••••••••••••••••••••••Xk9Q';
      apiKeyInput.placeholder = 'API key configured';
    }
    
    // Set MCQ model
    const mcqModelSelect = document.getElementById('settings-mcq-model');
    if (mcqModelSelect) mcqModelSelect.value = 'gemini-2.5-flash-lite';
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  
  modal.style.display = 'flex';
};

window.closeSettings = function() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.style.display = 'none';
};

window.onProviderChange = function() {
  const providerSelect = document.getElementById('settings-ai-provider');
  const modelSelect = document.getElementById('settings-model');
  const apiKeyHint = document.getElementById('api-key-hint');
  
  const provider = providerSelect.value;
  const models = providerModels[provider] || providerModels.gemini;
  
  // Update model dropdown
  modelSelect.innerHTML = models.map(m => 
    `<option value="${m.value}"${m.default ? ' selected' : ''}>${m.label}</option>`
  ).join('');
  
  // Update API key hint
  if (apiKeyHint) {
    apiKeyHint.innerHTML = providerHints[provider] || providerHints.gemini;
  }
};

window.toggleApiKeyVisibility = function() {
  const input = document.getElementById('settings-api-key');
  const eye = document.getElementById('api-key-eye');
  if (input.type === 'password') {
    input.type = 'text';
    eye.textContent = '🙈';
  } else {
    input.type = 'password';
    eye.textContent = '👁️';
  }
};

window.saveSettings = async function() {
  // UI only - just close and show success
  closeSettings();
  
  // Show brief confirmation
  const btn = document.getElementById('settings-btn');
  if (btn) {
    btn.style.borderColor = '#51cf66';
    setTimeout(() => { btn.style.borderColor = ''; }, 1500);
  }
};

// Close settings modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('settings-modal');
  if (e.target === modal) {
    closeSettings();
  }
});

// Progress tracking state
let progressItems = new Map();
let currentProgressIndex = 0;
let totalProgressItems = 0;
let installationStartTime = null;

// Progress tracker helper functions - now uses terminal for display
function initializeProgressTracker(dependencies) {
  progressItems.clear();
  currentProgressIndex = 0;
  totalProgressItems = dependencies.length;
  installationStartTime = Date.now();
  
  // Log to terminal
  addTerminalLine('═══════════════════════════════════════════', 'info');
  addTerminalLine(`📦 Installation Queue: ${totalProgressItems} package(s)`, 'info');
  addTerminalLine('═══════════════════════════════════════════', 'info');
  addTerminalLine('', 'normal');
  
  // Create progress items tracking
  dependencies.forEach((dep, index) => {
    const name = dep.name || dep.display_name;
    progressItems.set(name, { status: 'pending', index });
    addTerminalLine(`   ${index + 1}. ${name} - Waiting...`, 'normal');
  });
  
  addTerminalLine('', 'normal');
  addTerminalLine('───────────────────────────────────────────', 'normal');
  addTerminalLine('', 'normal');
}

function createProgressItem(name, index) {
  const item = document.createElement('div');
  item.className = 'progress-item';
  item.id = `progress-item-${index}`;
  
  item.innerHTML = `
    <div class="progress-item-icon">⏳</div>
    <div class="progress-item-info">
      <div class="progress-item-name">${name}</div>
      <div class="progress-item-status">Waiting...</div>
      <div class="progress-bar-container" style="display: none;">
        <div class="progress-bar" style="width: 0%;"></div>
      </div>
    </div>
  `;
  
  return item;
}

function updateProgressItem(name, status, message = '') {
  const item = progressItems.get(name);
  if (!item) {
    console.log(`[Progress] No item found for: ${name}`);
    return;
  }
  
  item.status = status;
  currentProgressIndex++;
  
  // Log status change to terminal
  const statusIcon = {
    'installing': '🔄',
    'success': '✅',
    'failed': '❌',
    'skipped': '⏭️'
  }[status] || '⏳';
  
  const statusColor = {
    'installing': 'info',
    'success': 'success', 
    'failed': 'error',
    'skipped': 'info'
  }[status] || 'normal';
  
  addTerminalLine(`${statusIcon} [${currentProgressIndex}/${totalProgressItems}] ${name}: ${message || status}`, statusColor);
  
  // Update progress counter if available
  const progressCounter = document.getElementById('progress-counter');
  if (progressCounter) {
    progressCounter.textContent = `${currentProgressIndex}/${totalProgressItems}`;
  }
}

// Terminal output helper
function addTerminalLine(text, type = 'normal') {
  const terminalBody = document.getElementById('terminal-output');
  if (!terminalBody) return;
  const line = document.createElement('div');
  line.className = `terminal-line ${type}`;
  line.textContent = text;
  terminalBody.appendChild(line);
  terminalBody.scrollTop = terminalBody.scrollHeight;
}

function clearTerminal() {
  const terminalBody = document.getElementById('terminal-output');
  if (!terminalBody) return;
  terminalBody.innerHTML = '<div class="terminal-line">Quest GPT Installer v1.0</div><div class="terminal-line">Starting installation...</div>';
}

// Listen for terminal output from main process
ipcRenderer.on('terminal-output', (event, data) => {
  if (data.type === 'error') {
    addTerminalLine(data.text, 'error');
  } else if (data.type === 'success') {
    addTerminalLine(data.text, 'success');
  } else if (data.type === 'info') {
    addTerminalLine(data.text, 'info');
  } else if (data.type === 'command') {
    addTerminalLine(`$ ${data.text}`, 'info');
  } else if (data.type === 'warning') {
    addTerminalLine(data.text, 'info');
  } else {
    addTerminalLine(data.text || data.message || '', 'normal');
  }
});

function normalizeCorrectIndex(correct, options) {
  if (!Array.isArray(options)) return 0;

  if (typeof correct === 'number' && Number.isFinite(correct)) {
    return Math.min(Math.max(correct, 0), options.length - 1);
  }

  if (typeof correct === 'string') {
    const trimmed = correct.trim();
    const asNumber = Number.parseInt(trimmed, 10);
    if (Number.isFinite(asNumber)) {
      return Math.min(Math.max(asNumber, 0), options.length - 1);
    }

    // Handle A/B/C/D style answers
    const upper = trimmed.toUpperCase();
    if (/^[A-D]$/.test(upper)) {
      const idx = upper.charCodeAt(0) - 'A'.charCodeAt(0);
      return Math.min(Math.max(idx, 0), options.length - 1);
    }

    // Handle exact option text
    const matchIdx = options.findIndex(o => String(o).trim() === trimmed);
    if (matchIdx >= 0) return matchIdx;
  }

  return 0;
}

// No terminal output listener needed anymore

// Listen for sudo password requests
ipcRenderer.on('sudo-password-required', () => {
  const inputArea = document.getElementById('terminal-input-area');
  inputArea.style.display = 'flex';
  document.getElementById('terminal-input').focus();
});

// Handle terminal password submission
document.addEventListener('DOMContentLoaded', () => {
  const terminalSubmit = document.getElementById('terminal-submit');
  const terminalInput = document.getElementById('terminal-input');
  
  if (terminalSubmit) {
    terminalSubmit.addEventListener('click', async () => {
      sudoPassword = terminalInput.value;
      terminalInput.value = '';
      document.getElementById('terminal-input-area').style.display = 'none';
      console.log('[Sudo] Password submitted, continuing...');
    });
  }
  
  if (terminalInput) {
    terminalInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        terminalSubmit.click();
      }
    });
  }
});

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');
const step4 = document.getElementById('step-4');
const dependenciesGrid = document.getElementById('dependencies-grid');
const installBtn = document.getElementById('install-btn');
const backBtn = document.getElementById('back-btn');
const newSearchBtn = document.getElementById('new-search-btn');
const uninstallBtn = document.getElementById('uninstall-btn');
const systemInfoDiv = document.getElementById('system-info');
const mcqSection = document.getElementById('mcq-section');
const progressSection = document.getElementById('progress-section');
const verificationResults = document.getElementById('verification-results');

init();

async function init() {
  // Check API key status first
  await checkApiKeyOnStartup();
  
  // Auto-close welcome modal after 3 seconds
  setTimeout(() => {
    closeWelcome();
  }, 3000);
  
  try {
    systemInfo = await ipcRenderer.invoke('detect-system');
    
    // Detect platform
    const osType = systemInfo.os.toLowerCase();
    isWindows = osType.includes('win');
    isMac = osType.includes('darwin') || osType.includes('mac');
    isLinux = !isWindows && !isMac;
    
    // Warn Windows users if no package manager detected
    if (isWindows && systemInfo.packageManager === 'choco') {
      console.warn('⚠️ Windows detected. Make sure you have Chocolatey, Winget, or Scoop installed.');
      console.warn('💡 Install Chocolatey from: https://chocolatey.org/install');
      console.warn('💡 Or use Winget (built into Windows 11+)');
      console.warn('⚠️ You may need to run this app as Administrator for installations to work.');
    }
    
    displaySystemInfo();
    
    // Initialize environment (stateful tracking)
    await initializeEnvironment();
  } catch (error) {
    systemInfoDiv.innerHTML = `<span>Failed</span>`;
  }
}

// Initialize environment and load stats
async function initializeEnvironment() {
  try {
    // Show UI immediately - wait for user to trigger scan
    document.getElementById('quick-search-section').style.display = 'block';
    document.querySelector('.progress-indicator').style.display = 'none';
    document.querySelector('.main-content').style.display = 'none';
    
    console.log('[Renderer] Environment initialized - ready for manual scan');
    
  } catch (error) {
    console.error('[Renderer] Environment init failed:', error);
    document.getElementById('quick-search-section').style.display = 'block';
    document.querySelector('.progress-indicator').style.display = 'none';
    document.querySelector('.main-content').style.display = 'none';
  }
}

// Scan system for installed packages (manual trigger)
window.scanSystem = async function() {
  const scanBtn = document.getElementById('scan-system-btn');
  const manageBtn = document.getElementById('manage-packages-btn');
  const installed = document.getElementById('stat-installed');
  const updates = document.getElementById('stat-updates');
  const lastScan = document.getElementById('last-scan-time');
  const originalText = scanBtn.innerHTML;
  
  try {
    scanBtn.innerHTML = '⏳ Scanning...';
    scanBtn.disabled = true;
    
    // Trigger environment scan
    const result = await ipcRenderer.invoke('scan-environment');
    console.log('[Renderer] Manual scan found:', result.count, 'packages');
    
    // Check for updates via winget
    console.log('[Renderer] Checking for updates...');
    const updates_detected = await ipcRenderer.invoke('check-updates');
    console.log('[Renderer] Found', updates_detected.length, 'updates available');
    
    // Get updated stats
    const stats = await ipcRenderer.invoke('get-stats');
    
    // Update stats
    if (installed) installed.textContent = stats.total_tools || 0;
    if (updates) {
      updates.textContent = stats.updates_available || 0;
      
      // Visual alert if updates available
      if (stats.updates_available > 0) {
        updates.style.color = '#ff6b6b';
        updates.style.animation = 'pulse 2s ease-in-out infinite';
        
        // Add badge to Manage Packages button
        if (manageBtn) {
          manageBtn.innerHTML = `Manage Packages <span style="background: #ff6b6b; color: white; padding: 0.2rem 0.5rem; border-radius: 10px; font-size: 0.75rem; margin-left: 0.5rem;">${stats.updates_available}</span>`;
        }
      } else {
        updates.style.color = '#ffd700';
        updates.style.animation = 'none';
        if (manageBtn) {
          manageBtn.textContent = 'Manage Packages';
        }
      }
    }
    
    // Show last scan time
    if (lastScan) {
      const now = new Date();
      lastScan.textContent = `Last scan: ${now.toLocaleTimeString()}`;
      lastScan.style.display = 'block';
    }
    
    // Enable manage packages button
    if (manageBtn) manageBtn.disabled = false;
    
    // Change button to "Scan Again"
    scanBtn.innerHTML = '🔄 Scan Again';
    scanBtn.disabled = false;
    
  } catch (error) {
    console.error('[Renderer] Scan failed:', error);
    scanBtn.innerHTML = '❌ Scan Failed';
    setTimeout(() => {
      scanBtn.innerHTML = originalText;
      scanBtn.disabled = false;
    }, 2000);
  }
};

// Update dashboard with stats
function updateDashboard(stats) {
  const installed = document.getElementById('stat-installed');
  const updates = document.getElementById('stat-updates');
  if (installed) installed.textContent = stats.total_tools || 0;
  if (updates) updates.textContent = stats.updates_available || 0;
}

// Refresh environment (re-scan packages)
window.refreshEnvironment = async function() {
  const refreshBtn = document.getElementById('refresh-env-btn');
  
  try {
    if (refreshBtn) {
      refreshBtn.textContent = '⏳ Scanning...';
      refreshBtn.disabled = true;
    }
    
    const result = await ipcRenderer.invoke('scan-environment');
    console.log('[Renderer] Environment rescanned:', result.count, 'packages');
    
    const stats = await ipcRenderer.invoke('get-stats');
    updateDashboard(stats);
    
    if (refreshBtn) {
      refreshBtn.textContent = '✅ Done!';
      setTimeout(() => {
        refreshBtn.textContent = 'Refresh';
        refreshBtn.disabled = false;
      }, 2000);
    }
  } catch (error) {
    console.error('[Renderer] Refresh failed:', error);
    if (refreshBtn) {
      refreshBtn.textContent = '❌ Failed';
      setTimeout(() => {
        refreshBtn.textContent = 'Refresh';
        refreshBtn.disabled = false;
      }, 2000);
    }
  }
};

// Show Package Manager View
window.showPackageManager = async function() {
  const envDash = document.getElementById('env-dashboard');
  if (envDash) envDash.style.display = 'none';
  document.getElementById('quick-search-section').style.display = 'none';
  document.querySelector('.progress-indicator').style.display = 'none';
  document.querySelector('.main-content').style.display = 'none';
  document.getElementById('package-manager-view').style.display = 'block';
  
  await loadPackages();
};

// Hide Package Manager View
window.hidePackageManager = function() {
  document.getElementById('package-manager-view').style.display = 'none';
  const envDash = document.getElementById('env-dashboard');
  if (envDash) envDash.style.display = 'block';
  document.getElementById('quick-search-section').style.display = 'block';
  // Keep main content and progress hidden on homepage
  document.querySelector('.progress-indicator').style.display = 'none';
  document.querySelector('.main-content').style.display = 'none';
};

// Quick Winget Search from Homepage
window.quickWingetSearch = async function() {
  const searchInput = document.getElementById('winget-quick-search');
  const query = searchInput.value.trim();
  
  if (!query) {
    alert('Please enter a package name to search.');
    return;
  }
  
  try {
    // Show loading overlay on homepage first
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'winget-loading-overlay';
    loadingOverlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
    loadingOverlay.innerHTML = `
      <div style="text-align: center; color: white;">
        <div style="font-size: 3rem; margin-bottom: 1rem; animation: spin 2s linear infinite;">🔍</div>
        <div style="font-size: 1.3rem; font-weight: 600; margin-bottom: 0.5rem;">Searching Winget...</div>
        <div style="font-size: 1rem; opacity: 0.8;">Looking for "${escapeHtml(query)}"</div>
      </div>
      <style>
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      </style>
    `;
    document.body.appendChild(loadingOverlay);
    
    // Search winget
    const results = await ipcRenderer.invoke('winget-search', query);
    
    // Remove loading overlay
    loadingOverlay.remove();
    
    // Now navigate to results page
    const envDash = document.getElementById('env-dashboard');
    if (envDash) envDash.style.display = 'none';
    document.getElementById('quick-search-section').style.display = 'none';
    document.querySelector('.progress-indicator').style.display = 'none';
    
    // Show back button
    const backBtn = document.getElementById('back-to-home-btn');
    if (backBtn) backBtn.style.display = 'block';
    
    // Show main content for results
    document.querySelector('.main-content').style.display = 'block';
    document.getElementById('step-1').style.display = 'none';
    document.getElementById('step-2').classList.remove('hidden');
    document.getElementById('step-2').style.display = 'block';
    
    // Mark this as winget flow so back button goes home
    isWingetFlow = true;
    
    // Store the query for potential AI switch
    window.lastWingetQuery = query;
    
    if (results.length === 0) {
      const dependenciesGrid = document.getElementById('dependencies-grid');
      dependenciesGrid.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📦</div>
          <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">No packages found for "${escapeHtml(query)}"</div>
          <div style="font-size: 0.9rem; margin-bottom: 2rem;">Package not available in winget repository</div>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <button class="btn btn-secondary" onclick="backToHome()">← Back to Home</button>
            <button class="btn btn-primary" onclick="switchToAISearch()" style="background: var(--primary); border-color: var(--primary);">
              🤖 Try AI Search Instead
            </button>
          </div>
        </div>
      `;
      return;
    }
    
    // Show results as selectable dependencies
    displayWingetResults(results, query);
    
  } catch (error) {
    console.error('[Renderer] Winget quick search error:', error);
    alert('Search failed: ' + error.message);
    backToHome();
  }
};

// Start AI Stack Installer flow — shows step-1
window.startAIFlow = function() {
  // Hide homepage, show AI flow
  const envDash = document.getElementById('env-dashboard');
  if (envDash) envDash.style.display = 'none';
  document.getElementById('quick-search-section').style.display = 'none';

  // Show back button
  const backBtn = document.getElementById('back-to-home-btn');
  if (backBtn) backBtn.style.display = 'block';

  document.querySelector('.main-content').style.display = 'block';
  document.querySelector('.progress-indicator').style.display = 'flex';
  document.getElementById('step-1').style.display = 'block';
  document.getElementById('search-input').value = '';
  document.getElementById('search-input').focus();

  updateProgress(1);
};

// AI Search from Homepage — triggers full AI flow with query
window.homeAISearch = function() {
  const input = document.getElementById('ai-home-search');
  const query = input ? input.value.trim() : '';
  if (!query) {
    alert('Please describe what you need.');
    return;
  }

  // Hide homepage, show main flow
  const envDash = document.getElementById('env-dashboard');
  if (envDash) envDash.style.display = 'none';
  document.getElementById('quick-search-section').style.display = 'none';

  // Show back button
  const backBtn = document.getElementById('back-to-home-btn');
  if (backBtn) backBtn.style.display = 'block';

  document.querySelector('.main-content').style.display = 'block';
  document.querySelector('.progress-indicator').style.display = 'flex';
  document.getElementById('step-1').style.display = 'block';
  document.getElementById('search-input').value = query;

  // Trigger the existing AI analysis
  handleSearch();
};

// Back to Home
window.backToHome = async function() {
  isWingetFlow = false;
  
  // Hide back button
  const backBtn = document.getElementById('back-to-home-btn');
  if (backBtn) backBtn.style.display = 'none';
  
  // Refresh stats when returning home
  try {
    const stats = await ipcRenderer.invoke('get-stats');
    const installed = document.getElementById('stat-installed');
    const updates = document.getElementById('stat-updates');
    if (installed) installed.textContent = stats.total_tools || 0;
    if (updates) updates.textContent = stats.updates_available || 0;
    console.log('[Renderer] Stats refreshed on home:', stats.total_tools, 'packages');
  } catch (e) {
    console.error('[Renderer] Failed to refresh home stats:', e);
  }
  
  // Hide all steps
  document.getElementById('step-1').style.display = 'none';
  document.getElementById('step-2').classList.add('hidden');
  document.getElementById('step-2').style.display = '';
  document.getElementById('step-3').classList.add('hidden');
  document.getElementById('step-4').classList.add('hidden');
  
  // Hide main content and progress indicator
  document.querySelector('.main-content').style.display = 'none';
  document.querySelector('.progress-indicator').style.display = 'none';
  
  // Show dashboard and quick search
  const envDash = document.getElementById('env-dashboard');
  if (envDash) envDash.style.display = 'block';
  document.getElementById('quick-search-section').style.display = 'block';
  
  // Reset progress
  updateProgress(1);
  
  // Clear all selections and counts
  selectedDependencies.clear();
  selectedForUninstall.clear();
  
  // Reset install button
  const ib = document.getElementById('install-btn');
  if (ib) { ib.disabled = true; ib.textContent = 'Select Something'; }
  
  // Hide uninstall button
  const ub = document.getElementById('uninstall-selected-btn');
  if (ub) ub.style.display = 'none';
};

// Alias for goToHome (used by header back button)
window.goToHome = window.backToHome;

// Switch to AI Search (from winget results)
window.switchToAISearch = function() {
  // Get the last winget query
  const query = window.lastWingetQuery || '';
  
  // Go back to homepage
  backToHome();
  
  // Insert the query into AI search box (but don't submit)
  setTimeout(() => {
    const aiSearchInput = document.getElementById('ai-home-search');
    if (aiSearchInput && query) {
      aiSearchInput.value = query;
      aiSearchInput.focus();
      // Highlight the text so user can edit if needed
      aiSearchInput.select();
    }
  }, 100);
};

// Display Winget Search Results
function displayWingetResults(packages, searchQuery) {
  const dependenciesGrid = document.getElementById('dependencies-grid');
  const stepTitle = document.querySelector('#step-2 .step-title');
  const stepDesc = document.querySelector('#step-2 p');
  
  stepTitle.textContent = `02. Winget Search Results for "${searchQuery}"`;
  stepDesc.textContent = `Found ${packages.length} package(s). Click to select, then install.`;
  
  // Convert winget results to dependency format and store globally
  const dependencies = packages.map(pkg => ({
    name: pkg.id,
    display_name: pkg.name,
    description: `${pkg.version} · ${pkg.source}`,
    version: pkg.version,
    status: 'not_installed',
    essential: false,
    category: 'Package',
    install_commands: [`winget install --id ${pkg.id} --accept-source-agreements --accept-package-agreements`],
    verify_command: `winget list --id ${pkg.id}`
  }));
  
  analysisResult = { dependencies };
  selectedDependencies.clear();
  
  dependenciesGrid.innerHTML = dependencies.map((dep, index) => `
    <div class="dependency-card" data-index="${index}" data-dep-name="${escapeHtml(dep.name)}">
      <div class="dependency-header">
        <div class="dependency-emoji">📦</div>
        <h3 class="dependency-name">${escapeHtml(dep.display_name)}</h3>
      </div>
      <p class="dependency-description">${escapeHtml(dep.description)}</p>
      <div class="dependency-meta">
        <span class="meta-tag">${escapeHtml(dep.category)}</span>
        <span class="status-badge-empty winget-select-badge">Click to select</span>
      </div>
    </div>
  `).join('');

  // Attach click handlers
  dependenciesGrid.querySelectorAll('.dependency-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.index);
      const dep = analysisResult.dependencies[idx];
      if (!dep) return;

      if (selectedDependencies.has(dep.name)) {
        selectedDependencies.delete(dep.name);
        card.classList.remove('selected');
        card.querySelector('.winget-select-badge').textContent = 'Click to select';
      } else {
        selectedDependencies.add(dep.name);
        card.classList.add('selected');
        card.querySelector('.winget-select-badge').textContent = '✓ Selected';
      }
      updateWingetInstallButton();
    });
  });
  
  // Ensure action bar exists and update it with AI switch option
  let actionBar = document.querySelector('#step-2 .action-bar');
  if (actionBar) {
    actionBar.innerHTML = `
      <div style="display: flex; gap: 1rem; align-items: center; width: 100%;">
        <button class="btn btn-secondary" onclick="backToHome()">← Back to Home</button>
        <button class="btn" onclick="switchToAISearch()" style="background: rgba(0,212,255,0.1); color: var(--primary); border: 1px solid var(--primary); padding: 0.7rem 1.2rem; font-size: 0.9rem;">
          🤖 Didn't find it? Try AI Search
        </button>
        <div style="flex: 1;"></div>
        <button class="btn btn-primary" id="winget-install-btn" disabled>Select Something</button>
      </div>
    `;
  }

  // Attach install handler
  setTimeout(() => {
    const wingetInstallBtn = document.getElementById('winget-install-btn');
    if (wingetInstallBtn) {
      wingetInstallBtn.addEventListener('click', () => {
        // Use the existing handleInstall flow which goes through safety check
        handleInstall();
      });
    }
  }, 50);
}

function updateWingetInstallButton() {
  const btn = document.getElementById('winget-install-btn');
  if (!btn) return;
  if (selectedDependencies.size > 0) {
    btn.disabled = false;
    btn.textContent = `Install Selected (${selectedDependencies.size}) →`;
  } else {
    btn.disabled = true;
    btn.textContent = 'Select Something';
  }
}

function createActionBar() {
  const actionBar = document.createElement('div');
  actionBar.className = 'action-bar';
  return actionBar;
}

// Store packages globally for uninstall
let installedPackagesCache = [];

// Categorize package as dev tool or general app
function categorizePackage(pkgName) {
  const name = pkgName.toLowerCase();
  
  // Programming Languages
  if (name.includes('python') || name.includes('node') || name.includes('java') || 
      name.includes('ruby') || name.includes('golang') || name.includes('rust') || 
      name.includes('php') || name.includes('perl') || name === 'gcc' || name === 'clang') {
    return { category: 'Language', isDev: true };
  }
  
  // Version Control
  if (name.includes('git') || name.includes('svn') || name.includes('mercurial')) {
    return { category: 'Version Control', isDev: true };
  }
  
  // Package Managers
  if (name === 'npm' || name === 'pip' || name === 'yarn' || name === 'pnpm' || 
      name === 'composer' || name === 'maven' || name === 'gradle' || name === 'cargo') {
    return { category: 'Package Manager', isDev: true };
  }
  
  // Databases
  if (name.includes('mysql') || name.includes('postgres') || name.includes('mongodb') || 
      name.includes('redis') || name.includes('sqlite') || name.includes('mariadb')) {
    return { category: 'Database', isDev: true };
  }
  
  // Containers & Virtualization
  if (name.includes('docker') || name.includes('kubernetes') || name.includes('vagrant') || 
      name.includes('virtualbox') || name === 'kubectl') {
    return { category: 'Container/VM', isDev: true };
  }
  
  // Build Tools
  if (name.includes('make') || name.includes('cmake') || name.includes('webpack') || 
      name.includes('gulp') || name.includes('grunt') || name.includes('vite')) {
    return { category: 'Build Tool', isDev: true };
  }
  
  // CLI Tools
  if (name === 'curl' || name === 'wget' || name === 'jq' || name === 'grep' || 
      name === 'sed' || name === 'awk' || name === 'fd' || name === 'ripgrep' || 
      name === 'bat' || name === 'exa' || name === 'fzf') {
    return { category: 'CLI Tool', isDev: true };
  }
  
  // Editors & IDEs
  if (name.includes('vscode') || name.includes('vim') || name.includes('emacs') || 
      name.includes('sublime') || name.includes('atom') || name.includes('intellij')) {
    return { category: 'Editor/IDE', isDev: true };
  }
  
  // Python Libraries
  if (name === 'pandas' || name === 'numpy' || name === 'flask' || name === 'django' || 
      name === 'requests' || name === 'scipy' || name === 'matplotlib') {
    return { category: 'Python Library', isDev: true };
  }
  
  // Node Libraries
  if (name === 'express' || name === 'react' || name === 'vue' || name === 'angular' || 
      name === 'webpack' || name === 'eslint' || name === 'prettier') {
    return { category: 'Node Package', isDev: true };
  }
  
  // Testing Frameworks
  if (name.includes('jest') || name.includes('mocha') || name.includes('pytest') || 
      name.includes('junit') || name.includes('selenium')) {
    return { category: 'Testing', isDev: true };
  }
  
  // Web Servers
  if (name.includes('nginx') || name.includes('apache') || name.includes('tomcat')) {
    return { category: 'Web Server', isDev: true };
  }
  
  // Default: General app (filter out)
  return { category: 'Other', isDev: false };
}

// Load all installed packages (dev tools only)
async function loadPackages() {
  try {
    const allPackages = await ipcRenderer.invoke('get-all-packages');
    
    // Filter to only dev tools/dependencies
    const devPackages = allPackages.map((pkg, originalIndex) => ({
      ...pkg,
      originalIndex,
      ...categorizePackage(pkg.name)
    })).filter(pkg => pkg.isDev);
    
    installedPackagesCache = devPackages; // Cache filtered dev packages
    
    const packageList = document.getElementById('package-list');
    const packageCount = document.getElementById('package-count');
    
    packageCount.textContent = `${devPackages.length} dev package${devPackages.length !== 1 ? 's' : ''}`;
    
    if (devPackages.length === 0) {
      packageList.innerHTML = `
        <div class="package-list-placeholder">
          <div class="placeholder-icon">📦</div>
          <p>No development packages installed yet</p>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">Install Python, Node.js, Git, or other dev tools to see them here</p>
        </div>
      `;
      return;
    }
    
    // Build table HTML
    packageList.innerHTML = `
      <table class="package-table">
        <thead>
          <tr>
            <th class="col-name">Package Name</th>
            <th class="col-category">Category</th>
            <th class="col-version">Version</th>
            <th class="col-status">Status</th>
            <th class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${devPackages.map((pkg, index) => `
            <tr class="package-row" data-package-index="${index}">
              <td class="col-name">
                <div class="package-name-cell">${pkg.display_name}</div>
              </td>
              <td class="col-category">
                <span class="category-badge">${pkg.category}</span>
              </td>
              <td class="col-version">
                <code class="version-code">v${pkg.version}</code>
              </td>
              <td class="col-status">
                ${pkg.update_available ? 
                  `<span class="status-update">⬆ v${pkg.latest_version}</span>` : 
                  `<span class="status-current">✓ Current</span>`
                }
              </td>
              <td class="col-actions">
                ${pkg.update_available ? 
                  `<button class="table-update-btn" onclick="updatePackage(${index})" title="Update to v${pkg.latest_version}">
                    ⬆️ Update
                  </button>` : ''
                }
                <button class="table-uninstall-btn" onclick="uninstallPackage(${index})" title="Uninstall ${pkg.display_name}">
                  🗑️
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('[Renderer] Failed to load packages:', error);
  }
}

// Update a package via winget
window.updatePackage = async function(packageIndex) {
  const pkg = installedPackagesCache[packageIndex];
  if (!pkg) {
    alert('Package not found. Please refresh the list.');
    return;
  }
  
  if (!pkg.update_available) {
    alert('No update available for this package.');
    return;
  }
  
  const confirmed = confirm(`Update ${pkg.display_name}?\n\nCurrent: v${pkg.version}\nLatest: v${pkg.latest_version}\n\nThis will run:\nwinget upgrade --id ${pkg.package_id}`);
  if (!confirmed) return;
  
  const packageRow = document.querySelector(`[data-package-index="${packageIndex}"]`);
  const updateBtn = packageRow.querySelector('.table-update-btn');
  const originalText = updateBtn ? updateBtn.innerHTML : '';
  
  try {
    if (updateBtn) {
      updateBtn.innerHTML = '⏳';
      updateBtn.disabled = true;
    }
    
    console.log(`[Renderer] Updating ${pkg.display_name} via winget...`);
    const result = await ipcRenderer.invoke('upgrade-package', pkg);
    
    if (result.success) {
      alert(`✅ ${pkg.display_name} updated successfully to v${pkg.latest_version}!`);
      // Refresh the package list
      await loadInstalledPackages();
    } else {
      throw new Error(result.error || 'Update failed');
    }
    
  } catch (error) {
    console.error('[Renderer] Update failed:', error);
    alert(`❌ Failed to update ${pkg.display_name}:\n\n${error.message}`);
    
    if (updateBtn) {
      updateBtn.innerHTML = originalText;
      updateBtn.disabled = false;
    }
  }
};

// Uninstall a package (proper flow with Gemini + verification)
window.uninstallPackage = async function(packageIndex) {
  const pkg = installedPackagesCache[packageIndex];
  if (!pkg) {
    alert('Package not found. Please refresh the list.');
    return;
  }
  
  const confirmed = confirm(`Are you sure you want to uninstall ${pkg.display_name}?\n\nThis will:\n- Generate uninstall commands via AI\n- Execute the commands\n- Verify removal`);
  if (!confirmed) return;
  
  const packageRow = document.querySelector(`[data-package-index="${packageIndex}"]`);
  const uninstallBtn = packageRow.querySelector('.table-uninstall-btn');
  const originalText = uninstallBtn.textContent;
  
  try {
    // Step 1: Generate commands
    uninstallBtn.textContent = '⏳';
    uninstallBtn.disabled = true;
    uninstallBtn.title = 'Generating uninstall commands...';
    
    // Check if sudo password needed (Linux/Mac)
    const isWindows = systemInfo.os.toLowerCase().includes('win');
    let sudoPassword = null;
    
    if (!isWindows) {
      sudoPassword = prompt(`Sudo password required to uninstall ${pkg.display_name}:`);
      if (sudoPassword === null) {
        uninstallBtn.textContent = originalText;
        uninstallBtn.disabled = false;
        uninstallBtn.title = `Uninstall ${pkg.display_name}`;
        return;
      }
    }
    
    // Step 2: Execute uninstall with Gemini + verification
    uninstallBtn.title = 'Removing package...';
    
    const result = await ipcRenderer.invoke('execute-uninstall', {
      name: pkg.name,
      display_name: pkg.display_name,
      package_id: pkg.package_id,
      version: pkg.version
    }, sudoPassword);
    
    if (result.success) {
      // Step 3: Success - verified removal
      uninstallBtn.textContent = '✅';
      uninstallBtn.title = 'Successfully removed & verified';
      console.log(`[Renderer] Uninstall successful. Commands executed:`, result.commands_executed);
      
      setTimeout(() => {
        packageRow.style.opacity = '0';
        packageRow.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          loadPackages();
          refreshEnvironment();
        }, 300);
      }, 1500);
    } else {
      alert(`Failed to uninstall ${pkg.display_name}:\n\n${result.error || 'Unknown error'}\n\nDetails: ${result.details || 'None'}`);
      uninstallBtn.textContent = originalText;
      uninstallBtn.disabled = false;
      uninstallBtn.title = `Uninstall ${pkg.display_name}`;
    }
  } catch (error) {
    console.error('[Renderer] Uninstall error:', error);
    alert(`Error: ${error.message}`);
    uninstallBtn.textContent = originalText;
    uninstallBtn.disabled = false;
    uninstallBtn.title = `Uninstall ${pkg.display_name}`;
  }
};

// Export environment context
window.exportEnvironment = async function() {
  try {
    const result = await ipcRenderer.invoke('export-context', 'markdown');
    
    if (result.success) {
      alert(`Environment exported successfully!\n\nFile saved to:\n${result.filePath}`);
    } else {
      alert(`Export failed: ${result.error}`);
    }
  } catch (error) {
    console.error('[Renderer] Export error:', error);
    alert(`Error: ${error.message}`);
  }
};

// Search packages in winget repository
window.searchPackages = async function() {
  const searchInput = document.getElementById('package-search-input');
  const query = searchInput.value.trim();
  
  if (!query) {
    alert('Please enter a package name to search.');
    return;
  }
  
  const searchBtn = document.querySelector('.search-packages-btn');
  const originalText = searchBtn.textContent;
  
  try {
    searchBtn.textContent = 'Searching...';
    searchBtn.disabled = true;
    
    const results = await ipcRenderer.invoke('winget-search', query);
    
    if (results.length === 0) {
      renderNoResults(query);
    } else {
      renderSearchResults(results);
    }
  } catch (error) {
    console.error('[Renderer] Search error:', error);
    alert(`Search failed: ${error.message}`);
  } finally {
    searchBtn.textContent = originalText;
    searchBtn.disabled = false;
  }
};

// Clear search results
window.clearSearch = function() {
  const searchInput = document.getElementById('package-search-input');
  const resultsContainer = document.getElementById('search-results-container');
  
  searchInput.value = '';
  resultsContainer.style.display = 'none';
};

// Render search results
function renderSearchResults(packages) {
  const resultsContainer = document.getElementById('search-results-container');
  const resultsList = document.getElementById('search-results-list');
  const resultsCount = document.getElementById('search-results-count');
  
  resultsCount.textContent = `${packages.length} result${packages.length !== 1 ? 's' : ''}`;
  
  // Check which packages are already installed
  const installedNames = installedPackagesCache.map(p => p.display_name.toLowerCase());
  
  resultsList.innerHTML = packages.map((pkg, index) => {
    const isInstalled = installedNames.includes(pkg.name.toLowerCase());
    
    return `
      <div class="search-result-item">
        <div class="search-result-info">
          <div class="search-result-name">${pkg.name}</div>
          <div class="search-result-id">${pkg.id}</div>
          <div class="search-result-version">Version ${pkg.version} • Source: ${pkg.source}</div>
        </div>
        <div class="search-result-status">
          ${isInstalled ? '<span class="status-installed-badge">✓ Installed</span>' : '<span class="status-available-badge">⬇ Available</span>'}
        </div>
        <div class="search-result-action">
          ${isInstalled 
            ? '<button class="search-install-btn" disabled>Already Installed</button>'
            : `<button class="search-install-btn" onclick="installSearchedPackage('${pkg.id}', '${pkg.name}')">Install</button>`
          }
        </div>
      </div>
    `;
  }).join('');
  
  resultsContainer.style.display = 'block';
}

// Render "no results" state with AI fallback
function renderNoResults(query) {
  const resultsContainer = document.getElementById('search-results-container');
  const resultsList = document.getElementById('search-results-list');
  const resultsCount = document.getElementById('search-results-count');
  
  resultsCount.textContent = '0 results';
  
  resultsList.innerHTML = `
    <div style="padding: 3rem; text-align: center; color: var(--text-secondary);">
      <div style="font-size: 3rem; margin-bottom: 1rem;">📦</div>
      <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No packages found for "${escapeHtml(query)}"</div>
      <div style="font-size: 0.9rem; margin-bottom: 1.5rem;">Package not available in winget repository</div>
      <button class="search-ai-btn" onclick="searchWithAI(document.getElementById('package-search-input')?.value || '')" style="font-size: 1rem; padding: 0.75rem 1.5rem;">
        🤖 Search with AI Instead
      </button>
    </div>
  `;
  
  resultsContainer.style.display = 'block';
}

// Install a package from search results
window.installSearchedPackage = async function(packageId, packageName) {
  const confirmed = confirm(`Install ${packageName}?`);
  if (!confirmed) return;
  
  // Find the button for this package
  const buttons = document.querySelectorAll('.search-install-btn');
  let targetBtn = null;
  buttons.forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(packageId)) {
      targetBtn = btn;
    }
  });
  
  if (targetBtn) {
    targetBtn.textContent = 'Installing...';
    targetBtn.disabled = true;
  }
  
  try {
    const dep = {
      name: packageId,
      display_name: packageName,
      install_commands: [`winget install --id ${packageId} --accept-source-agreements --accept-package-agreements`],
      verify_command: `winget list --id ${packageId}`
    };
    
    await ipcRenderer.invoke('install-dependency', dep, null);
    
    if (targetBtn) targetBtn.textContent = '\u2705 Installed';
    loadPackages();
  } catch (error) {
    console.error('[Renderer] Install error:', error);
    alert(`Installation failed: ${error.message}`);
    if (targetBtn) {
      targetBtn.textContent = 'Install';
      targetBtn.disabled = false;
    }
  }
};

// Fallback to AI search (from no results, if needed)
window.searchWithAI = function(query) {
  hidePackageManager();
  startAIFlow();
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = query || '';
  if (query) {
    handleSearch();
  }
};

function displaySystemInfo() {
  systemInfoDiv.innerHTML = `${systemInfo.os} • ${systemInfo.packageManager} • ${systemInfo.specs.arch}`;
  
  // Add Windows warning banner if needed
  if (isWindows && systemInfo.packageManager === 'choco') {
    const existingBanner = document.getElementById('windows-warning-banner');
    if (!existingBanner) {
      const banner = document.createElement('div');
      banner.id = 'windows-warning-banner';
      banner.style.cssText = `
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
        color: white;
        padding: 1rem 1.5rem;
        margin: 1rem 0;
        border-radius: 8px;
        font-size: 0.9rem;
        line-height: 1.6;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      `;
      banner.innerHTML = `
        <strong>⚠️ Windows User Notice:</strong><br>
        Please ensure:<br>
        • You have <strong>Chocolatey</strong> installed (<a href="https://chocolatey.org/install" target="_blank" style="color: #fff; text-decoration: underline;">install here</a>) or use <strong>Winget</strong> (Windows 11+)<br>
        • This app is running <strong>as Administrator</strong> (right-click → Run as Administrator)<br>
        • Commands will be executed in <strong>cmd.exe</strong> (NO sudo needed - Windows uses Administrator mode)<br>
        ${!systemInfo.isSudo ? '<br><strong style="background: rgba(0,0,0,0.2); padding: 0.3rem 0.5rem; border-radius: 4px;">❌ Currently NOT running as Administrator - installations may fail!</strong>' : '<br><strong style="background: rgba(0,0,0,0.2); padding: 0.3rem 0.5rem; border-radius: 4px;">✅ Running as Administrator</strong>'}
      `;
      const mainContent = document.querySelector('.main-content');
      mainContent.insertBefore(banner, mainContent.firstChild);
    }
  }
}

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch();
});
installBtn.addEventListener('click', handleInstall);
backBtn.addEventListener('click', () => {
  if (isWingetFlow) {
    // Came from winget search — go back to homepage
    isWingetFlow = false;
    backToHome();
  } else {
    // Came from AI flow — go back to step 1
    showStep(1);
  }
  selectedDependencies.clear();
  selectedForUninstall.clear();
  const ib = document.getElementById('install-btn');
  if (ib) { ib.disabled = true; ib.textContent = 'Select Something'; }
  const ub = document.getElementById('uninstall-selected-btn');
  if (ub) ub.style.display = 'none';
});
newSearchBtn.addEventListener('click', () => {
  backToHome();
  searchInput.value = '';
});
if (uninstallBtn) {
  uninstallBtn.addEventListener('click', showUninstallPlaceholder);
}

// Complete modal buttons
const completeModalClose = document.getElementById('complete-modal-close');
const completeModalContinue = document.getElementById('complete-modal-continue');
if (completeModalClose) {
  completeModalClose.addEventListener('click', () => {
    document.getElementById('complete-modal').style.display = 'none';
  });
}
if (completeModalContinue) {
  completeModalContinue.addEventListener('click', () => {
    window.proceedToVerification();
  });
}

// Safety modal buttons
const safetyCancelBtn = document.getElementById('safety-cancel-btn');
const safetyProceedBtn = document.getElementById('safety-proceed-btn');
if (safetyCancelBtn) {
  safetyCancelBtn.addEventListener('click', cancelSafetyPreview);
}
if (safetyProceedBtn) {
  safetyProceedBtn.addEventListener('click', proceedWithInstall);
}

// Uninstall-selected button on Step 2 (installed packages)
const uninstallSelectedBtn = document.getElementById('uninstall-selected-btn');
if (uninstallSelectedBtn) {
  uninstallSelectedBtn.addEventListener('click', () => uninstallSelected());
}

// Mode toggle buttons
const modeEssentialBtn = document.getElementById('mode-essential');
const modeFullBtn = document.getElementById('mode-full');
if (modeEssentialBtn) modeEssentialBtn.addEventListener('click', () => setMode('essential'));
if (modeFullBtn) modeFullBtn.addEventListener('click', () => setMode('full'));

async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  isWingetFlow = false; // AI flow, not winget
  searchBtn.disabled = true;
  searchBtn.textContent = 'Analyzing...';

  try {
    analysisResult = await ipcRenderer.invoke('analyze-request', query, systemInfo);
    if (analysisResult && analysisResult.error) {
      throw new Error(analysisResult.message || 'Failed to analyze request');
    }
    if (!analysisResult || !Array.isArray(analysisResult.dependencies)) {
      throw new Error('Invalid analysis response: missing dependencies');
    }
    
    // Check if we have stack options
    if (analysisResult.type === 'stack' && analysisResult.stack_options && analysisResult.stack_options.length > 0) {
      displayStackOptions(analysisResult.stack_options, analysisResult.dependencies);
    } else {
      // Hide stack options if not applicable
      document.getElementById('stack-options-container').classList.add('hidden');
    }
    
    // Show mode toggle if dependencies have priority values
    const hasPriorities = analysisResult.dependencies.some(d => d.priority && d.priority > 1);
    const toggleBar = document.getElementById('mode-toggle-bar');
    if (hasPriorities && analysisResult.dependencies.length > 2) {
      toggleBar.style.display = 'flex';
      currentMode = 'full';
      document.getElementById('mode-full').classList.add('active');
      document.getElementById('mode-essential').classList.remove('active');
    } else {
      toggleBar.style.display = 'none';
    }

    displayDependencies(analysisResult.dependencies);

    // Check for environment conflicts
    try {
      const conflicts = await ipcRenderer.invoke('check-conflicts', analysisResult.dependencies);
      displayConflicts(conflicts);
    } catch (e) { /* ignore conflict check failures */ }

    showStep(2);
  } catch (error) {
    alert('Failed: ' + error.message);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Analyze';
  }
}

function displayStackOptions(stackOptions, allDependencies) {
  const container = document.getElementById('stack-options-container');
  const grid = document.getElementById('stack-options-grid');
  
  grid.innerHTML = '';
  container.classList.remove('hidden');
  
  stackOptions.forEach((stack, index) => {
    const card = document.createElement('div');
    card.className = 'stack-option-card';
    card.dataset.stackIndex = index;
    
    const logoHtml = stack.logo_url ? 
      `<img src="${stack.logo_url}" alt="${stack.name}" class="stack-logo" onerror="this.style.display='none'">` : 
      `<div class="stack-logo" style="font-size: 3rem;">📦</div>`;
    
    card.innerHTML = `
      ${logoHtml}
      <div class="stack-name">${stack.name}</div>
      <div class="stack-description">${stack.description}</div>
      <div class="stack-deps-list">Includes: ${stack.dependencies.join(', ')}</div>
    `;
    
    card.addEventListener('click', () => {
      selectStack(stack, allDependencies, card);
    });
    
    grid.appendChild(card);
  });
}

function selectStack(stack, allDependencies, cardElement) {
  // Clear previous selections
  document.querySelectorAll('.stack-option-card').forEach(c => c.classList.remove('selected'));
  selectedDependencies.clear();
  
  // Mark this stack as selected
  cardElement.classList.add('selected');
  
  // Select all dependencies for this stack
  stack.dependencies.forEach(depName => {
    const dep = allDependencies.find(d => d.name === depName);
    if (dep) {
      selectedDependencies.add(dep.name);
    }
  });
  
  // Update UI to show selected dependencies
  updateDependencyCardsSelection();
  updateInstallButton();
  
  // Scroll to dependencies
  setTimeout(() => {
    document.getElementById('dependencies-grid').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 300);
}

function updateDependencyCardsSelection() {
  const cards = document.querySelectorAll('.dependency-card');
  cards.forEach(card => {
    const depName = card.dataset.depName;
    if (selectedDependencies.has(depName)) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

async function displayDependencies(dependencies) {
  dependenciesGrid.innerHTML = '';

  // Filter by mode: essential = priority 1 only, full = all
  const filtered = currentMode === 'essential'
    ? dependencies.filter(d => !d.priority || d.priority === 1)
    : dependencies;

  for (const dep of filtered) {
    // Check actual installation status for all packages
    const isInstalled = await ipcRenderer.invoke('check-installed', dep);
    
    const card = document.createElement('div');
    card.className = 'dependency-card';
    card.dataset.depName = dep.name;
    
    // Mark as already installed if detected
    if (isInstalled.success) {
      card.dataset.alreadyInstalled = 'true';
    }
    
    // Create logo element
    const logoHtml = dep.logo_url ? 
      `<img src="${dep.logo_url}" alt="${dep.name}" class="dependency-logo" onerror="this.style.display='none'">` : 
      `<div class="dependency-emoji">📦</div>`;
    
    // Build status badge with version
    let statusBadgeHtml = '';
    if (isInstalled.success) {
      const versionText = isInstalled.actual && isInstalled.actual !== 'Not installed' 
        ? `<div class="version-text">${isInstalled.actual}</div>` 
        : '';
      statusBadgeHtml = `<span class="status-badge">✓ Installed</span>${versionText}`;
    } else {
      statusBadgeHtml = '<span class="status-badge-empty">Click to select</span>';
    }

    card.innerHTML = `
      <div class="dependency-header">
        ${logoHtml}
        <div>
          <h3 class="dependency-name">${dep.display_name || dep.name}</h3>
        </div>
      </div>
      <p class="dependency-description">${dep.description || ''}</p>
      <div class="dependency-meta">
        <span class="meta-tag">${dep.category || 'package'}</span>
        ${dep.priority === 1 ? '<span class="meta-tag priority-essential">Essential</span>' : ''}
        ${statusBadgeHtml}
      </div>
    `;

    // Different click behavior for installed vs not installed
    if (!isInstalled.success) {
      // Not installed - select for installation
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDependency(dep, card);
      });
    } else {
      // Already installed - can select for uninstall
      card.style.cursor = 'pointer';
      card.style.opacity = '0.75';
      // Add uninstall hint
      const hintEl = document.createElement('div');
      hintEl.className = 'uninstall-hint';
      hintEl.textContent = 'Click to select for uninstall';
      card.appendChild(hintEl);
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleUninstallSelection(dep, card);
      });
    }

    dependenciesGrid.appendChild(card);
  }

  updateInstallButton();
}

function toggleDependency(dep, card) {
  // Deselect any stack when manually selecting
  document.querySelectorAll('.stack-option-card').forEach(c => c.classList.remove('selected'));
  
  // MUTUAL EXCLUSION: Can't install and uninstall at the same time
  if (selectedForUninstall.size > 0) {
    alert('❌ Cannot mix install and uninstall actions.\n\nPlease either:\n- Clear uninstall selections first, OR\n- Complete uninstall, then select for install');
    return;
  }
  
  if (selectedDependencies.has(dep.name)) {
    selectedDependencies.delete(dep.name);
    card.classList.remove('selected');
  } else {
    selectedDependencies.add(dep.name);
    card.classList.add('selected');
  }
  
  updateInstallButton();
}

function toggleUninstallSelection(dep, card) {
  // MUTUAL EXCLUSION: Can't install and uninstall at the same time
  if (selectedDependencies.size > 0) {
    alert('❌ Cannot mix install and uninstall actions.\n\nPlease either:\n- Clear install selections first, OR\n- Complete installation, then select for uninstall');
    return;
  }
  
  const hint = card.querySelector('.uninstall-hint');
  if (selectedForUninstall.has(dep.name)) {
    selectedForUninstall.delete(dep.name);
    card.classList.remove('selected-uninstall');
    card.style.opacity = '0.75';
    if (hint) hint.textContent = 'Click to select for uninstall';
  } else {
    selectedForUninstall.add(dep.name);
    card.classList.add('selected-uninstall');
    card.style.opacity = '1';
    if (hint) hint.textContent = '✓ Selected for uninstall';
  }
  updateInstallButton();
}

async function uninstallSelected() {
  const packagesToUninstall = analysisResult.dependencies.filter(dep => 
    selectedForUninstall.has(dep.name)
  );

  if (packagesToUninstall.length === 0) return;

  // Confirmation
  if (!confirm(`⚠️ Are you sure you want to uninstall ${packagesToUninstall.length} package(s)?\n\n${packagesToUninstall.map(p => p.display_name || p.name).join(', ')}\n\nThis action cannot be undone.`)) {
    return;
  }

  // Prompt for sudo password if not available (Linux/Mac only)
  if (!isWindows && !sudoPassword) {
    const pw = prompt('Enter your sudo password to proceed with uninstall:');
    if (!pw) return;
    sudoPassword = pw;
  }

  // Show loading modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>🤖 Asking Gemini AI...</h2>
      <p>Generating safe uninstall commands for ${packagesToUninstall.length} package(s)...</p>
      <div style="text-align: center; margin-top: 2rem; font-size: 2rem;">⏳</div>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const uninstallPlan = await ipcRenderer.invoke('generate-uninstall-plan', packagesToUninstall, systemInfo);
    
    // Show preview
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px; max-height: 85vh; overflow-y: auto;">
        <h2>🗑️ Uninstall Plan (Review)</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
          Gemini generated these commands for your system (${systemInfo.os}, ${systemInfo.packageManager}).
        </p>
        <div id="uninstall-preview-list"></div>
        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
          <button class="btn btn-primary" style="background: #c00; border-color: #c00;" onclick="executeUninstallPlan()">
            Execute Uninstall
          </button>
        </div>
      </div>
    `;

    const listDiv = document.getElementById('uninstall-preview-list');
    uninstallPlan.forEach(pkg => {
      const warnings = pkg.warnings && pkg.warnings.length > 0 
        ? `<div style="background: #fffbe6; padding: 0.75rem; margin-top: 0.5rem; border-left: 3px solid #e6d600; font-size: 0.85rem;">
             ${pkg.warnings.map(w => `⚠️ ${w}`).join('<br>')}
           </div>`
        : '';

      listDiv.innerHTML += `
        <div style="background: var(--bg-card); border: 1px solid var(--border); padding: 1rem; margin-bottom: 1rem;">
          <h4 style="margin-bottom: 0.5rem;">${pkg.name}</h4>
          <div style="background: #000; color: #0f0; padding: 0.75rem; font-family: 'Courier New', monospace; font-size: 0.85rem; margin-top: 0.5rem;">
            ${pkg.uninstall_commands.map(cmd => `$ ${cmd}`).join('<br>')}
          </div>
          ${warnings}
        </div>
      `;
    });

    // Store for execution
    window.pendingUninstallPlan = uninstallPlan;

  } catch (error) {
    modal.innerHTML = `
      <div class="modal-content">
        <h2>❌ Failed</h2>
        <p>Could not generate uninstall plan: ${error.message}</p>
        <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button>
      </div>
    `;
  }
}
window.uninstallSelected = uninstallSelected;

async function executeUninstallPlan() {
  const modal = document.querySelector('.modal:not(#safety-modal):not(#complete-modal):not(#welcome-modal):not(#api-key-modal)');
  if (!modal) return;
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <h2>🗑️ Uninstalling...</h2>
      <div id="uninstall-live-terminal" style="background: #000; color: #0f0; padding: 1rem; font-family: 'Courier New', monospace; font-size: 0.85rem; max-height: 450px; overflow-y: auto; margin: 1rem 0;"></div>
      <button class="btn btn-primary" onclick="this.closest('.modal').remove(); location.reload();">Close & Refresh</button>
    </div>
  `;

  const termDiv = document.getElementById('uninstall-live-terminal');
  
  for (const pkg of window.pendingUninstallPlan) {
    termDiv.innerHTML += `<div style="color: #74c0fc;">═══ Uninstalling ${pkg.name} ═══</div>`;
    termDiv.innerHTML += `<div style="color: #fff;">$ ${pkg.uninstall_commands.join(' && ')}</div>`;
    termDiv.scrollTop = termDiv.scrollHeight;
    
    try {
      // Use the proper execute-uninstall handler
      const result = await ipcRenderer.invoke('execute-uninstall', {
        name: pkg.name,
        display_name: pkg.name,
        package_id: pkg.package_id || pkg.name
      }, sudoPassword);
      
      if (result.success) {
        termDiv.innerHTML += `<div style="color: #51cf66;">✓ ${result.message || 'Success'}</div>`;
      } else {
        termDiv.innerHTML += `<div style="color: #ff6b6b;">✗ ${result.error || 'Failed'}</div>`;
      }
    } catch (error) {
      termDiv.innerHTML += `<div style="color: #ff6b6b;">✗ ${error.message}</div>`;
    }
    termDiv.innerHTML += `<div></div>`;
    termDiv.scrollTop = termDiv.scrollHeight;
  }

  termDiv.innerHTML += `<div style="color: #74c0fc; margin-top: 1rem;">═══ Uninstall Complete ═══</div>`;
  termDiv.scrollTop = termDiv.scrollHeight;
  
  selectedForUninstall.clear();
}
window.executeUninstallPlan = executeUninstallPlan;

function updateInstallButton() {
  installBtn.disabled = selectedDependencies.size === 0;
  installBtn.textContent = selectedDependencies.size > 0 ? 
    `Install (${selectedDependencies.size})` : 'Select Something';
  
  // Update uninstall button
  const uninstallBtn = document.getElementById('uninstall-selected-btn');
  if (selectedForUninstall.size > 0) {
    uninstallBtn.style.display = 'block';
    uninstallBtn.textContent = `Uninstall (${selectedForUninstall.size})`;
  } else {
    uninstallBtn.style.display = 'none';
  }
}

async function handleInstall() {
  const depsToInstall = analysisResult.dependencies.filter(dep => 
    selectedDependencies.has(dep.name)
  );

  // Show safety preview modal before proceeding
  try {
    const classification = await ipcRenderer.invoke('classify-commands', depsToInstall);
    pendingInstallDeps = depsToInstall;
    await showSafetyPreview(classification);
  } catch (error) {
    // If classification fails, proceed directly (fallback)
    pendingInstallDeps = depsToInstall;
    proceedWithInstall();
  }
}

// Safety preview functions
async function showSafetyPreview(classification) {
  const modal = document.getElementById('safety-modal');
  const summaryDiv = document.getElementById('safety-summary');
  const listDiv = document.getElementById('safety-commands-list');
  const s = classification.summary;

  // Build summary bar
  const parts = [];
  if (s.dangerous > 0) parts.push(`<span class="risk-badge risk-dangerous">${s.dangerous} Dangerous</span>`);
  if (s.elevated > 0) parts.push(`<span class="risk-badge risk-elevated">${s.elevated} Elevated</span>`);
  if (s.moderate > 0) parts.push(`<span class="risk-badge risk-moderate">${s.moderate} Moderate</span>`);
  if (s.safe > 0) parts.push(`<span class="risk-badge risk-safe">${s.safe} Safe</span>`);
  summaryDiv.innerHTML = `<div class="risk-summary-row">${parts.join('')}<span style="margin-left:auto;color:var(--text-secondary);font-size:0.85rem;">${s.total} commands total</span></div>`;

  // Block dangerous commands
  const proceedBtn = document.getElementById('safety-proceed-btn');
  if (!proceedBtn) {
    console.error('Proceed button not found!');
    return;
  }
  
  console.log('Safety check - dangerous:', s.dangerous, 'elevated:', s.elevated, 'moderate:', s.moderate, 'safe:', s.safe);
  
  if (s.dangerous > 0) {
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Blocked — Dangerous Commands Detected';
    proceedBtn.style.opacity = '0.5';
    proceedBtn.style.cursor = 'not-allowed';
  } else {
    proceedBtn.disabled = false;
    proceedBtn.textContent = 'Proceed with Install';
    proceedBtn.style.opacity = '1';
    proceedBtn.style.cursor = 'pointer';
  }

  // Build command list grouped by dependency WITH DECISION BADGES
  let html = '';
  for (const dep of classification.dependencies) {
    // Get decision for this package
    let decisionBadge = '';
    try {
      const decision = await ipcRenderer.invoke('check-decision', dep.name);
      const badgeClass = {
        'INSTALL': 'badge-install',
        'SKIP': 'badge-skip',
        'UPDATE': 'badge-update',
        'REPAIR': 'badge-repair'
      }[decision.action] || 'badge-install';
      
      const badgeText = {
        'INSTALL': 'NEW',
        'SKIP': 'INSTALLED',
        'UPDATE': 'UPDATE',
        'REPAIR': 'REPAIR'
      }[decision.action] || 'NEW';
      
      decisionBadge = `<span class="decision-badge ${badgeClass}">${badgeText}</span>`;
      
      if (decision.reason) {
        console.log(`[Decision] ${dep.name}: ${decision.action} - ${decision.reason}`);
      }
    } catch (error) {
      console.warn('[Decision] Failed to get decision for', dep.name, error);
    }
    
    html += `<div class="safety-dep-group">`;
    html += `<h4 class="safety-dep-name">${dep.name} ${decisionBadge} <span class="risk-badge risk-${dep.highestRisk}">${dep.highestRisk}</span></h4>`;
    for (const cmd of dep.commands) {
      html += `<div class="safety-cmd-row risk-${cmd.level}">
        <code>${cmd.command}</code>
        <span class="risk-label">${cmd.label}</span>
      </div>`;
    }
    html += `</div>`;
  }
  listDiv.innerHTML = html;

  modal.style.display = 'flex';
}

function cancelSafetyPreview() {
  document.getElementById('safety-modal').style.display = 'none';
  pendingInstallDeps = null;
}
window.cancelSafetyPreview = cancelSafetyPreview;
window.proceedWithInstall = proceedWithInstall;

async function proceedWithInstall() {
  const modal = document.getElementById('safety-modal');
  if (modal) modal.style.display = 'none';
  
  const depsToInstall = pendingInstallDeps;
  
  if (!depsToInstall || depsToInstall.length === 0) {
    return;
  }

  // STEP 1: Show loading screen while generating questions
  showStep(3);
  
  const mainContent = document.querySelector('.main-content');
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loading-screen';
  loadingDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; gap: 2rem;';
  loadingDiv.innerHTML = `
    <div style="font-size: 3rem;">🧠</div>
    <h2>Preparing Your Quiz...</h2>
    <p style="color: var(--text-secondary); animation: pulse 2s infinite;">
      Generating 5 educational questions...
    </p>
  `;
  mainContent.appendChild(loadingDiv);

  // STEP 2: Generate 5 questions using Flash Lite (FAST, separate API)
  try {
    const result = await ipcRenderer.invoke('generate-batch-mcqs', depsToInstall);
    
    allQuestions = [];
    if (result.questions && result.questions.length > 0) {
      result.questions.forEach(q => {
        const options = Array.isArray(q.options) ? q.options : [];
        const correctIdx = normalizeCorrectIndex(q.correct, options);
        allQuestions.push({
          name: q.dependency || 'Technology',
          description: q.explanation || 'Learn about this technology',
          question: q.question,
          options,
          correct: correctIdx
        });
      });
    }
    
    // Limit to 5 questions
    allQuestions = allQuestions.slice(0, 5);
    currentMCQIndex = 0;
    score = 0;
  } catch (error) {
    console.error('MCQ generation failed:', error);
    // Continue with empty questions
  }

  // STEP 3: Remove loading, show installation page with quiz
  loadingDiv.remove();
  
  // Show quiz ready (first question)
  if (allQuestions.length > 0) {
    displayNextMCQ();
  } else {
    mcqSection.innerHTML = `
      <div class="description-box">
        <p style="color: var(--text-secondary);">Quiz unavailable. Focus on installation...</p>
      </div>
    `;
  }
  
  // STEP 4: Ask for password to start installation (Linux/Mac only)
  // Installation will run while user takes quiz
  if (!isWindows && !sudoPassword) {
    addTerminalLine('🔐 Requesting sudo password to begin installation...', 'info');
    const inputArea = document.getElementById('terminal-input-area');
    inputArea.style.display = 'flex';
    document.getElementById('terminal-input').focus();
    
    // Wait for password, then start installation
    const checkPassword = setInterval(() => {
      if (sudoPassword) {
        clearInterval(checkPassword);
        addTerminalLine('✓ Password received, starting installation...', 'success');
        addTerminalLine('', 'normal');
        
        // Start installation AND quiz simultaneously
        startInstallation(depsToInstall);
        if (allQuestions.length > 0) {
          startQuestionCycle();
        }
      }
    }, 100);
  } else {
    // Windows doesn't need sudo, or already have password on Linux/Mac
    if (isWindows) {
      console.log('[Install] Starting installation (Windows - no sudo required)...');
    }
    startInstallation(depsToInstall);
    if (allQuestions.length > 0) {
      startQuestionCycle();
    }
  }
}

function startQuestionCycle() {
  // Auto-advance questions every 10 seconds if not answered
  if (questionInterval) clearInterval(questionInterval);
  
  questionInterval = setInterval(() => {
    if (currentMCQIndex < allQuestions.length - 1) {
      // Skip to next question if user hasn't answered
      currentMCQIndex++;
      displayNextMCQ();
    } else {
      clearInterval(questionInterval);
    }
  }, 15000); // 15 seconds per question
}

function displayNextMCQ() {
  if (currentMCQIndex >= allQuestions.length) {
    if (questionInterval) clearInterval(questionInterval);
    const percentage = Math.round((score / allQuestions.length) * 100);
    mcqSection.innerHTML = `
      <div class="description-box">
        <h3>🎉 Quiz Complete!</h3>
        <p style="font-size: 2rem; margin: 1rem 0;">Your Score: ${score}/${allQuestions.length}</p>
        <div style="background: rgba(0,255,0,0.1); padding: 1rem; border-radius: 8px; margin: 1rem 0;">
          <p style="font-size: 1.2rem; margin: 0;">Accuracy: ${percentage}%</p>
        </div>
        <p style="margin-top: 1rem; font-size: 1rem;">
          ${score === allQuestions.length ? '🏆 Perfect! You know your stuff!' : 
            score >= allQuestions.length * 0.6 ? '👍 Good job! Keep learning!' : 
            '📚 Not bad! There\'s always room to learn more!'}
        </p>
        <button class="wizard-btn" onclick="window.close()" style="margin-top: 2rem; width: 100%;">
          Finish & Close
        </button>
      </div>
    `;
    return;
  }

  const q = allQuestions[currentMCQIndex];
  
  mcqSection.innerHTML = `
    <div class="description-box">
      <h3>${q.name}</h3>
      <p>${q.description}</p>
    </div>
    <div class="mcq-container">
      <div class="mcq-question">Question ${currentMCQIndex + 1}/${allQuestions.length}: ${q.question}</div>
      <div class="mcq-options" id="mcq-opts">
        ${q.options.map((opt, idx) => `
          <div class="mcq-option" data-idx="${idx}">${opt}</div>
        `).join('')}
      </div>
    </div>
  `;

  const opts = document.querySelectorAll('#mcq-opts .mcq-option');
  opts.forEach((el) => {
    el.addEventListener('click', () => {
      const idx = Number.parseInt(el.getAttribute('data-idx') || '0', 10);
      selectAnswer(idx, q.correct);
    });
  });
}

function selectAnswer(selectedIdx, correctIdx) {
  // Clear auto-advance timer since user answered
  if (questionInterval) {
    clearInterval(questionInterval);
  }
  
  const options = document.querySelectorAll('.mcq-option');
  const mcqContainer = document.querySelector('.mcq-container');
  
  options.forEach((opt, idx) => {
    opt.style.pointerEvents = 'none';
    if (idx === correctIdx) opt.classList.add('correct');
    else if (idx === selectedIdx) opt.classList.add('wrong');
    else opt.style.opacity = '0.3';
  });

  if (selectedIdx === correctIdx) score += 1;

  // Add "Next" button instead of auto-advancing
  const nextBtn = document.createElement('button');
  nextBtn.className = 'wizard-btn';
  nextBtn.textContent = 'Next Question →';
  nextBtn.style.marginTop = '1.5rem';
  nextBtn.onclick = () => {
    currentMCQIndex++;
    displayNextMCQ();
    startQuestionCycle(); // Restart timer for next question
  };
  mcqContainer.appendChild(nextBtn);
}
window.selectAnswer = selectAnswer;

/**
 * Batch pip/npm packages into single commands for faster installation
 * Returns: { batched: [{name, install_commands, packages}], remaining: [deps] }
 */
function batchSimilarPackages(dependencies) {
  const pipPackages = [];
  const npmPackages = [];
  const remaining = [];
  
  for (const dep of dependencies) {
    const cmd = (dep.install_commands && dep.install_commands[0]) || '';
    const cmdLower = cmd.toLowerCase();
    
    // Extract package name from pip command
    if (/\bpip3?\s+install\b/.test(cmdLower)) {
      const match = cmd.match(/pip3?\s+install\s+(.+)/i);
      if (match) {
        pipPackages.push({ dep, pkg: match[1].trim() });
      } else {
        remaining.push(dep);
      }
    }
    // Extract package name from npm -g command
    else if (/\bnpm\s+install\s+-g\b/.test(cmdLower)) {
      const match = cmd.match(/npm\s+install\s+-g\s+(.+)/i);
      if (match) {
        npmPackages.push({ dep, pkg: match[1].trim() });
      } else {
        remaining.push(dep);
      }
    }
    else {
      remaining.push(dep);
    }
  }
  
  const batched = [];
  
  // Batch pip packages (only if more than 1)
  if (pipPackages.length > 1) {
    const pkgNames = pipPackages.map(p => p.pkg).join(' ');
    batched.push({
      name: `Python Libraries (${pipPackages.length})`,
      display_name: `Python Libraries (${pipPackages.length})`,
      description: pipPackages.map(p => p.pkg).join(', '),
      install_commands: [`pip install ${pkgNames}`],
      verify_command: 'pip --version',
      packages: pipPackages.map(p => p.dep),
      isBatch: true
    });
  } else if (pipPackages.length === 1) {
    remaining.push(pipPackages[0].dep);
  }
  
  // Batch npm packages (only if more than 1)
  if (npmPackages.length > 1) {
    const pkgNames = npmPackages.map(p => p.pkg).join(' ');
    batched.push({
      name: `NPM Globals (${npmPackages.length})`,
      display_name: `NPM Globals (${npmPackages.length})`,
      description: npmPackages.map(p => p.pkg).join(', '),
      install_commands: [`npm install -g ${pkgNames}`],
      verify_command: 'npm --version',
      packages: npmPackages.map(p => p.dep),
      isBatch: true
    });
  } else if (npmPackages.length === 1) {
    remaining.push(npmPackages[0].dep);
  }
  
  return { batched, remaining };
}

async function startInstallation(dependencies) {
  // Clear terminal output
  clearTerminal();
  
  // Batch pip/npm packages for faster installation
  const { batched, remaining } = batchSimilarPackages(dependencies);
  const allDeps = [...batched, ...remaining];
  
  // Initialize progress tracker with all dependencies (show individual names for batches)
  const displayDeps = [];
  for (const dep of allDeps) {
    if (dep.isBatch) {
      // For batched packages, show the batch name
      displayDeps.push(dep);
    } else {
      displayDeps.push(dep);
    }
  }
  initializeProgressTracker(displayDeps);
  
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  
  for (const dep of allDeps) {
    const depName = dep.display_name || dep.name;
    
    try {
      addTerminalLine('', 'normal');
      addTerminalLine(`▶ Starting: ${depName}`, 'info');
      
      // Check if already installed
      const checkResult = await ipcRenderer.invoke('check-installed', dep);
      if (checkResult.success) {
        updateProgressItem(depName, 'skipped', `Already installed (${checkResult.actual})`);
        skippedCount++;
        
        // Track as installed
        installedPackagesHistory.push({
          name: dep.name,
          display_name: dep.display_name,
          category: dep.category
        });
        continue;
      }
      
      // Start installation
      updateProgressItem(depName, 'installing', 'Installing...');
      addTerminalLine(`   Running install commands for ${depName}...`, 'normal');
      
      // Install with sudo password if available
      const result = await ipcRenderer.invoke('install-dependency', dep, sudoPassword);
      
      if (result && result.success) {
        // Mark as successful
        updateProgressItem(depName, 'success', 'Installed successfully');
        successCount++;
        
        // Track successfully installed package
        installedPackagesHistory.push({
          name: dep.name,
          display_name: dep.display_name,
          category: dep.category
        });
      } else {
        // Mark as failed
        const errorMsg = result?.error || 'Unknown error';
        updateProgressItem(depName, 'failed', `Failed: ${errorMsg.substring(0, 50)}...`);
        failedCount++;
      }
    } catch (error) {
      // Mark as failed with error message
      updateProgressItem(depName, 'failed', `Failed: ${error.message.substring(0, 50)}...`);
      failedCount++;
      
      console.error(`[${depName}] Installation failed:`, error);
      addTerminalLine(`   ERROR: ${error.message}`, 'error');
    }
  }
  
  // Show completion summary in terminal
  const elapsed = installationStartTime ? ((Date.now() - installationStartTime) / 1000).toFixed(1) : '?';
  addTerminalLine('', 'normal');
  addTerminalLine('═══════════════════════════════════════════', 'info');
  addTerminalLine(`🎉 INSTALLATION COMPLETE`, 'success');
  addTerminalLine('═══════════════════════════════════════════', 'info');
  addTerminalLine(`   ✅ Success: ${successCount}`, 'success');
  addTerminalLine(`   ⏭️  Skipped: ${skippedCount}`, 'info');
  addTerminalLine(`   ❌ Failed:  ${failedCount}`, failedCount > 0 ? 'error' : 'normal');
  addTerminalLine(`   ⏱️  Time:    ${elapsed}s`, 'normal');
  addTerminalLine('═══════════════════════════════════════════', 'info');
  
  // Quiz is already running, just stop auto-cycling
  if (questionInterval) {
    clearInterval(questionInterval);
  }
  
  // Show completion modal instead of auto-transitioning
  window.pendingVerificationDeps = dependencies;
  setTimeout(() => {
    const cm = document.getElementById('complete-modal');
    if (cm) {
      cm.style.display = 'flex';
    } else {
      runVerification(dependencies);
    }
  }, 800);
}

window.proceedToVerification = function() {
  const cm = document.getElementById('complete-modal');
  if (cm) cm.style.display = 'none';
  runVerification(window.pendingVerificationDeps || []);
};

async function runVerification(dependencies) {
  showStep(4);
  verificationResults.innerHTML = '<div style="text-align: center; padding: 2rem;"><p style="font-size: 1.2rem;">🔍 Verifying installations...</p></div>';
  let successCount = 0;
  let verificationHtml = '';

  for (const dep of dependencies) {
    const result = await ipcRenderer.invoke('verify-installation', dep);
    successCount += result.success ? 1 : 0;
    
    const verifyCommand = dep.verify_command || 'No verification command';
    const statusClass = result.success ? 'success' : 'error';
    const statusIcon = result.success ? '✓' : '✗';
    const statusText = result.success ? 'Installed' : 'Failed';
    
    // Build detail section
    let detailHtml = '';
    if (result.success) {
      detailHtml = `
        <div style="margin-top: 0.5rem; padding: 0.75rem; background: rgba(0, 255, 0, 0.05); border-left: 3px solid #51cf66; font-size: 0.9rem;">
          <div style="color: var(--text-secondary); margin-bottom: 0.25rem;"><strong>Verification Command:</strong></div>
          <code style="background: #000; color: #0f0; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${verifyCommand}</code>
          <div style="margin-top: 0.5rem; color: var(--text-secondary);"><strong>Version/Output:</strong></div>
          <div style="color: #51cf66;">${result.actual || 'Installed successfully'}</div>
        </div>
      `;
    } else {
      detailHtml = `
        <div style="margin-top: 0.5rem; padding: 0.75rem; background: rgba(255, 0, 0, 0.05); border-left: 3px solid #ff6b6b; font-size: 0.9rem;">
          <div style="color: var(--text-secondary); margin-bottom: 0.25rem;"><strong>Verification Command:</strong></div>
          <code style="background: #000; color: #f00; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${verifyCommand}</code>
          <div style="margin-top: 0.5rem; color: var(--text-secondary);"><strong>Failure Reason:</strong></div>
          <div style="color: #ff6b6b;">${result.message || result.actual || 'Verification failed - package not found or not working correctly'}</div>
        </div>
      `;
    }
    
    verificationHtml += `
      <div class="verification-item" style="border-left: 3px solid ${result.success ? '#51cf66' : '#ff6b6b'}; margin-bottom: 1rem; background: var(--bg-card); padding: 1rem; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h4 style="margin: 0; font-size: 1.1rem;">${dep.display_name || dep.name}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; color: var(--text-secondary);">${dep.description || ''}</p>
          </div>
          <span style="font-size: 1.5rem; color: ${result.success ? '#51cf66' : '#ff6b6b'};">${statusIcon}</span>
        </div>
        ${detailHtml}
      </div>
    `;
  }

  verificationResults.innerHTML = `
    <div class="description-box">
      <h3>${successCount === dependencies.length ? '🎉 All Verified!' : '⚠️ Some Issues Detected'}</h3>
      <p style="font-size: 1.1rem; margin: 0.5rem 0;">${successCount}/${dependencies.length} packages verified successfully</p>
      ${successCount < dependencies.length ? '<p style="font-size: 0.9rem; color: var(--text-secondary);">Check the details below for failed verifications</p>' : ''}
    </div>
  ` + verificationHtml;

  // Auto-refresh package stats after installation
  try {
    const stats = await ipcRenderer.invoke('get-stats');
    const installed = document.getElementById('stat-installed');
    const updates = document.getElementById('stat-updates');
    if (installed) installed.textContent = stats.total_tools || 0;
    if (updates) updates.textContent = stats.updates_available || 0;
    console.log('[Renderer] Stats refreshed after installation:', stats.total_tools, 'packages');
  } catch (e) {
    console.error('[Renderer] Failed to refresh stats:', e);
  }
}

function showStep(stepNumber) {
  // Don't hide sections - let them stack vertically
  // Just ensure the step is visible and scroll to it
  const steps = [step1, step2, step3, step4];
  const currentStep = steps[stepNumber - 1];
  
  // Remove hidden class from current step
  if (currentStep) {
    currentStep.classList.remove('hidden');
    currentStep.style.display = 'block';
  }
  
  // Show progress indicator and main content for AI flow
  document.querySelector('.progress-indicator').style.display = 'flex';
  document.querySelector('.main-content').style.display = 'block';
  
  // Update progress indicator
  updateProgress(stepNumber);
  
  // Smooth scroll to the step
  if (currentStep) {
    setTimeout(() => {
      currentStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}

// Update the visual progress dots only (no step visibility change)
function updateProgress(stepNumber) {
  const progressSteps = document.querySelectorAll('.progress-step');
  progressSteps.forEach((step, index) => {
    step.classList.remove('active', 'completed');
    if (index + 1 === stepNumber) {
      step.classList.add('active');
    } else if (index + 1 < stepNumber) {
      step.classList.add('completed');
    }
  });
}

// ──── Mode Toggle (Essential vs Full) ────

function setMode(mode) {
  currentMode = mode;
  document.getElementById('mode-essential').classList.toggle('active', mode === 'essential');
  document.getElementById('mode-full').classList.toggle('active', mode === 'full');

  // Re-render dependencies with filter
  if (analysisResult && analysisResult.dependencies) {
    displayDependencies(analysisResult.dependencies);
  }
}
window.setMode = setMode;

// ──── Conflict Warnings ────

function displayConflicts(conflicts) {
  const container = document.getElementById('conflict-warnings');
  if (!conflicts || conflicts.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = conflicts.map(c => `
    <div class="conflict-card">
      <span class="conflict-icon">⚠️</span>
      <div>
        <strong>${c.title}</strong>
        <p>${c.message}</p>
      </div>
    </div>
  `).join('');
}

// ──── Uninstaller Placeholder ────

async function showUninstallPlaceholder() {
  if (installedPackagesHistory.length === 0) {
    alert('No packages installed this session. Install something first!');
    return;
  }

  // Show loading modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>🗑️ Generating Uninstall Plan...</h2>
      <p>Asking Gemini AI how to safely remove ${installedPackagesHistory.length} package(s)...</p>
      <div style="text-align: center; margin-top: 2rem; font-size: 2rem;">⏳</div>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const uninstallPlan = await ipcRenderer.invoke('generate-uninstall-plan', installedPackagesHistory, systemInfo);
    
    // Show uninstall UI
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px; max-height: 85vh; overflow-y: auto;">
        <h2>🗑️ Uninstall Plan</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
          Review the commands before proceeding. These will remove ${installedPackagesHistory.length} package(s).
        </p>
        <div id="uninstall-list"></div>
        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
          <button class="btn btn-secondary" onclick="closeUninstallModal()">Cancel</button>
          <button class="btn btn-primary" style="background: #c00; border-color: #c00;" onclick="executeUninstall()">
            Execute Uninstall
          </button>
        </div>
      </div>
    `;

    const listDiv = document.getElementById('uninstall-list');
    uninstallPlan.forEach(pkg => {
      const warnings = pkg.warnings && pkg.warnings.length > 0 
        ? `<div style="background: #fffbe6; padding: 0.75rem; margin-top: 0.5rem; border-left: 3px solid #e6d600; font-size: 0.85rem;">
             ${pkg.warnings.map(w => `⚠️ ${w}`).join('<br>')}
           </div>`
        : '';

      listDiv.innerHTML += `
        <div style="background: var(--bg-card); border: 1px solid var(--border); padding: 1rem; margin-bottom: 1rem;">
          <h4 style="margin-bottom: 0.5rem;">${pkg.name}</h4>
          <div style="background: #000; color: #0f0; padding: 0.75rem; font-family: 'Courier New', monospace; font-size: 0.85rem; margin-top: 0.5rem;">
            ${pkg.uninstall_commands.map(cmd => `$ ${cmd}`).join('<br>')}
          </div>
          ${warnings}
        </div>
      `;
    });

    // Store plan for execution
    window.currentUninstallPlan = uninstallPlan;

  } catch (error) {
    modal.innerHTML = `
      <div class="modal-content">
        <h2>❌ Failed</h2>
        <p>Could not generate uninstall plan: ${error.message}</p>
        <button class="btn btn-primary" onclick="closeUninstallModal()">Close</button>
      </div>
    `;
  }
}
window.showUninstallPlaceholder = showUninstallPlaceholder;

window.closeUninstallModal = function() {
  // Only remove dynamically created modals, not static ones
  const modals = document.querySelectorAll('.modal:not(#safety-modal):not(#complete-modal):not(#welcome-modal):not(#api-key-modal)');
  modals.forEach(m => m.remove());
};

window.executeUninstall = async function() {
  const modal = document.querySelector('.modal:not(#safety-modal):not(#complete-modal):not(#welcome-modal):not(#api-key-modal)');
  if (!modal) return;
  modal.innerHTML = `
    <div class="modal-content">
      <h2>🗑️ Uninstalling...</h2>
      <div id="uninstall-terminal" style="background: #000; color: #0f0; padding: 1rem; font-family: 'Courier New', monospace; font-size: 0.85rem; max-height: 400px; overflow-y: auto; margin: 1rem 0;"></div>
      <button class="btn btn-primary" onclick="closeUninstallModal()">Close</button>
    </div>
  `;

  const termDiv = document.getElementById('uninstall-terminal');
  
  for (const pkg of window.currentUninstallPlan) {
    termDiv.innerHTML += `<div style="color: #74c0fc;">═══ Uninstalling ${pkg.name} ═══</div>`;
    
    for (const cmd of pkg.uninstall_commands) {
      termDiv.innerHTML += `<div style="color: #fff;">$ ${cmd}</div>`;
      try {
        // Execute via installer (reuse the execute logic)
        await ipcRenderer.invoke('install-dependency', { 
          name: pkg.name,
          display_name: pkg.name,
          install_commands: [cmd]
        }, sudoPassword);
        termDiv.innerHTML += `<div style="color: #51cf66;">✓ Success</div>`;
      } catch (error) {
        termDiv.innerHTML += `<div style="color: #ff6b6b;">✗ Failed: ${error.message}</div>`;
      }
      termDiv.innerHTML += `<div></div>`;
    }
  }

  termDiv.innerHTML += `<div style="color: #74c0fc; margin-top: 1rem;">═══ Uninstall Complete ═══</div>`;
  
  // Clear history
  installedPackagesHistory = [];
};
