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

window.closeWelcome = function() {
  document.getElementById('welcome-modal').style.display = 'none';
};

// Terminal output helper
function addTerminalLine(text, type = 'normal') {
  const terminalBody = document.getElementById('terminal-output');
  const line = document.createElement('div');
  line.className = `terminal-line ${type}`;
  line.textContent = text;
  terminalBody.appendChild(line);
  terminalBody.scrollTop = terminalBody.scrollHeight;
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
const systemInfoDiv = document.getElementById('system-info');
const mcqSection = document.getElementById('mcq-section');
const progressSection = document.getElementById('progress-section');
const verificationResults = document.getElementById('verification-results');

init();

async function init() {
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
    
    displayDependencies(analysisResult.dependencies);
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

  for (const dep of dependencies) {
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
        ${isInstalled.success ? '<span class="status-badge">✓ Installed</span>' : '<span class="status-badge-empty">Click to select</span>'}
      </div>
    `;

    if (!isInstalled.success) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDependency(dep, card);
      });
    } else {
      card.style.opacity = '0.5';
      card.style.cursor = 'not-allowed';
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

function updateInstallButton() {
  installBtn.disabled = selectedDependencies.size === 0;
  installBtn.textContent = selectedDependencies.size > 0 ? 
    `Install (${selectedDependencies.size})` : 'Select Something';
}

async function handleInstall() {
  const depsToInstall = analysisResult.dependencies.filter(dep => 
    selectedDependencies.has(dep.name)
  );

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
        allQuestions.push({
          name: q.dependency || 'Technology',
          description: q.explanation || 'Learn about this technology',
          question: q.question,
          options: q.options,
          correct: q.correct
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
          <div class="mcq-option" onclick="selectAnswer(${idx}, ${q.correct})">${opt}</div>
        `).join('')}
      </div>
    </div>
  `;
}

window.selectAnswer = function(selectedIdx, correctIdx) {
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
};

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
    } catch (error) {
      addTerminalLine(`[${dep.display_name}] ✗ Installation failed`, 'error');
      addTerminalLine(`Error: ${error.message}`, 'error');
    }
  }

  addTerminalLine('', 'normal');
  addTerminalLine('═══════════════════════════════════════', 'info');
  addTerminalLine('All installations complete! Verifying...', 'success');
  addTerminalLine('═══════════════════════════════════════', 'info');
  
  // Quiz is already running, just stop auto-cycling
  if (questionInterval) {
    clearInterval(questionInterval);
  }
  
  setTimeout(() => runVerification(dependencies), 1500);
}

async function runVerification(dependencies) {
  showStep(4);
  verificationResults.innerHTML = '';
  let successCount = 0;

  for (const dep of dependencies) {
    const result = await ipcRenderer.invoke('verify-installation', dep);
    successCount += result.success ? 1 : 0;
    
    verificationResults.innerHTML += `
      <div class="verification-item">
        <div>
          <h4>${dep.display_name}</h4>
          <p>${result.success ? 'Working' : 'Failed'}</p>
        </div>
        <span>${result.success ? '✓' : '✗'}</span>
      </div>
    `;
  }

  verificationResults.innerHTML = `
    <div class="description-box">
      <h3>${successCount === dependencies.length ? 'Done!' : 'Issues'}</h3>
      <p>${successCount}/${dependencies.length} installed</p>
    </div>
  ` + verificationResults.innerHTML;
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
