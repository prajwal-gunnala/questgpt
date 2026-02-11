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


// Terminal output helper
function addTerminalLine(text, type = 'normal') {
  const terminalBody = document.getElementById('terminal-output');
  const line = document.createElement('div');
  line.className = `terminal-line ${type}`;
  line.textContent = text;
  terminalBody.appendChild(line);
  terminalBody.scrollTop = terminalBody.scrollHeight;
}

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

function clearTerminal() {
  const terminalBody = document.getElementById('terminal-output');
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
  } else {
    addTerminalLine(data.text || data, 'normal');
  }
});

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
      addTerminalLine('Password submitted, continuing...', 'success');
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
    displaySystemInfo();
  } catch (error) {
    systemInfoDiv.innerHTML = `<span>Failed</span>`;
  }
}

function displaySystemInfo() {
  systemInfoDiv.innerHTML = `${systemInfo.os} • ${systemInfo.packageManager} • ${systemInfo.specs.arch}`;
}

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch();
});
installBtn.addEventListener('click', handleInstall);
backBtn.addEventListener('click', () => {
  showStep(1);
  selectedDependencies.clear();
});
newSearchBtn.addEventListener('click', () => {
  showStep(1);
  selectedDependencies.clear();
  searchInput.value = '';
});
if (uninstallBtn) {
  uninstallBtn.addEventListener('click', showUninstallPlaceholder);
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

  searchBtn.disabled = true;
  searchBtn.textContent = 'Analyzing...';

  try {
    analysisResult = await ipcRenderer.invoke('analyze-request', query, systemInfo);
    
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

  // Prompt for sudo password if not available
  if (!sudoPassword) {
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
    
    for (const cmd of pkg.uninstall_commands) {
      termDiv.innerHTML += `<div style="color: #fff;">$ ${cmd}</div>`;
      termDiv.scrollTop = termDiv.scrollHeight;
      
      try {
        await ipcRenderer.invoke('install-dependency', { 
          name: pkg.name,
          display_name: pkg.name,
          install_commands: [cmd]
        }, sudoPassword);
        termDiv.innerHTML += `<div style="color: #51cf66;">✓ Success</div>`;
      } catch (error) {
        termDiv.innerHTML += `<div style="color: #ff6b6b;">✗ ${error.message}</div>`;
      }
      termDiv.innerHTML += `<div></div>`;
      termDiv.scrollTop = termDiv.scrollHeight;
    }
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
    showSafetyPreview(classification);
  } catch (error) {
    // If classification fails, proceed directly (fallback)
    pendingInstallDeps = depsToInstall;
    proceedWithInstall();
  }
}

// Safety preview functions
function showSafetyPreview(classification) {
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

  // Build command list grouped by dependency
  let html = '';
  for (const dep of classification.dependencies) {
    html += `<div class="safety-dep-group">`;
    html += `<h4 class="safety-dep-name">${dep.name} <span class="risk-badge risk-${dep.highestRisk}">${dep.highestRisk}</span></h4>`;
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

async function proceedWithInstall() {
  const modal = document.getElementById('safety-modal');
  if (modal) modal.style.display = 'none';
  
  const depsToInstall = pendingInstallDeps;
  
  if (!depsToInstall || depsToInstall.length === 0) {
    return;
  }

  // STEP 1: Show loading screen while generating questions
  showStep(3);
  clearTerminal();
  
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
  clearTerminal();
  
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
  
  // STEP 4: Ask for password to start installation
  // Installation will run while user takes quiz
  if (!sudoPassword) {
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
    // Already have password, start immediately
    startInstallation(depsToInstall);
    if (allQuestions.length > 0) {
      startQuestionCycle();
    }
  }
}

window.proceedWithInstall = proceedWithInstall;

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

async function startInstallation(dependencies) {
  addTerminalLine('', 'normal');
  addTerminalLine('═══════════════════════════════════════', 'info');
  addTerminalLine('Starting installation process...', 'info');
  addTerminalLine('═══════════════════════════════════════', 'info');
  
  for (const dep of dependencies) {
    try {
      addTerminalLine('', 'normal');
      
      // Check if already installed (skip if detected via NVM, etc.)
      const checkResult = await ipcRenderer.invoke('check-installed', dep);
      if (checkResult.success) {
        addTerminalLine(`[${dep.display_name}] ⚠ Already installed (${checkResult.actual})`, 'info');
        addTerminalLine(`[${dep.display_name}] ✓ Skipping installation`, 'success');
        continue;
      }
      
      addTerminalLine(`[${dep.display_name}] Preparing installation...`, 'info');
      
      // Install with sudo password if available
      await ipcRenderer.invoke('install-dependency', dep, sudoPassword);
      
      addTerminalLine(`[${dep.display_name}] ✓ Installation complete`, 'success');
      
      // Track successfully installed package
      installedPackagesHistory.push({
        name: dep.name,
        display_name: dep.display_name,
        category: dep.category
      });
    } catch (error) {
      addTerminalLine(`[${dep.display_name}] ✗ Installation failed`, 'error');
      addTerminalLine(`Error: ${error.message}`, 'error');

      // AI Error Analysis
      addTerminalLine(`[${dep.display_name}] 🔍 Analyzing error with AI...`, 'info');
      try {
        const diagnosis = await ipcRenderer.invoke('analyze-error', {
          command: (dep.install_commands || [])[0] || 'unknown',
          stderr: error.message,
          exitCode: error.code || 1,
          dependency: dep.display_name || dep.name,
          systemInfo: systemInfo
        });
        addTerminalLine(``, 'normal');
        addTerminalLine(`┌─ AI Diagnosis ──────────────────────`, 'info');
        addTerminalLine(`│ Cause: ${diagnosis.root_cause}`, 'info');
        addTerminalLine(`│`, 'normal');
        addTerminalLine(`│ ${diagnosis.explanation}`, 'normal');
        addTerminalLine(`│`, 'normal');
        if (diagnosis.suggested_fixes && diagnosis.suggested_fixes.length > 0) {
          addTerminalLine(`│ Suggested fixes:`, 'info');
          diagnosis.suggested_fixes.forEach((fix, i) => {
            addTerminalLine(`│  ${i + 1}. ${fix}`, 'success');
          });
        }
        addTerminalLine(`└─────────────────────────────────────`, 'info');
      } catch (analysisErr) {
        addTerminalLine(`[${dep.display_name}] Could not analyze error automatically`, 'info');
      }
    }
  }

  addTerminalLine('', 'normal');
  addTerminalLine('═══════════════════════════════════════', 'info');
  addTerminalLine('All installations complete!', 'success');
  addTerminalLine('═══════════════════════════════════════', 'info');
  
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
}

function showStep(stepNumber) {
  // Hide all steps
  [step1, step2, step3, step4].forEach(step => step.classList.add('hidden'));
  
  // Show current step
  [step1, step2, step3, step4][stepNumber - 1].classList.remove('hidden');
  
  // Update progress indicator
  const progressSteps = document.querySelectorAll('.progress-step');
  progressSteps.forEach((step, index) => {
    step.classList.remove('active', 'completed');
    if (index + 1 === stepNumber) {
      step.classList.add('active');
    } else if (index + 1 < stepNumber) {
      step.classList.add('completed');
    }
  });
  
  // Smooth scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
