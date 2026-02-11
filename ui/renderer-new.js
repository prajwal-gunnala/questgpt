/**
 * Main Renderer Process
 * Simplified orchestrator that initializes the app and coordinates modules
 */

const { ipcRenderer } = require('electron');

// Initialize app on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  // Load all HTML components first
  await loadAllComponents();
  
  // Initialize all modules after components are loaded
  await initializeApp();
});

async function initializeApp() {
  // Initialize system detection
  try {
    window.appState.systemInfo = await ipcRenderer.invoke('detect-system');
    displaySystemInfo(window.appState.systemInfo);
  } catch (error) {
    console.error('System detection failed:', error);
    const systemInfoDiv = document.getElementById('system-info');
    if (systemInfoDiv) {
      systemInfoDiv.innerHTML = `<span>Failed</span>`;
    }
  }
  
  // Initialize all step handlers
  initStep1();
  initStep2();
  initStep4();
  
  // Setup IPC listeners
  setupIPCListeners();
  
  // Setup terminal password handler
  setupTerminalPasswordHandler();
  
  // Auto-close welcome modal
  setTimeout(() => {
    window.closeWelcome();
  }, 3000);
}

// Setup IPC event listeners
function setupIPCListeners() {
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
    if (inputArea) {
      inputArea.style.display = 'flex';
      const terminalInput = document.getElementById('terminal-input');
      if (terminalInput) terminalInput.focus();
    }
  });
}

// Setup terminal password submission handler
function setupTerminalPasswordHandler() {
  const terminalSubmit = document.getElementById('terminal-submit');
  const terminalInput = document.getElementById('terminal-input');
  
  if (terminalSubmit && terminalInput) {
    terminalSubmit.addEventListener('click', () => {
      window.appState.sudoPassword = terminalInput.value;
      terminalInput.value = '';
      const inputArea = document.getElementById('terminal-input-area');
      if (inputArea) inputArea.style.display = 'none';
      addTerminalLine('Password submitted, continuing...', 'success');
    });
    
    terminalInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        terminalSubmit.click();
      }
    });
  }
}

// Initialize Step 4 event listeners
function initStep4() {
  const newSearchBtn = document.getElementById('new-search-btn');
  const uninstallBtn = document.getElementById('uninstall-btn');
  
  if (newSearchBtn) {
    newSearchBtn.addEventListener('click', () => {
      showStep(1);
      window.appState.selectedDependencies.clear();
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = '';
    });
  }
  
  if (uninstallBtn) {
    uninstallBtn.addEventListener('click', showUninstallPlaceholder);
  }
}

// Global utility functions
window.closeWelcome = function() {
  const modal = document.getElementById('welcome-modal');
  if (modal) modal.style.display = 'none';
};

// Note: handleInstall, step 3 functions, and uninstall functions 
// are still in the original renderer.js for now
// We'll need to extract them in a follow-up refactor
