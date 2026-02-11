/**
 * Step 1: Search Handler
 * Handles dependency search and analysis
 */

async function handleSearch() {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const query = searchInput.value.trim();
  
  if (!query) return;

  searchBtn.disabled = true;
  searchBtn.textContent = 'Analyzing...';

  try {
    const { ipcRenderer } = require('electron');
    const systemInfo = window.appState.systemInfo;
    
    window.appState.analysisResult = await ipcRenderer.invoke('analyze-request', query, systemInfo);
    
    // Check if we have stack options
    if (window.appState.analysisResult.type === 'stack' && 
        window.appState.analysisResult.stack_options && 
        window.appState.analysisResult.stack_options.length > 0) {
      displayStackOptions(
        window.appState.analysisResult.stack_options, 
        window.appState.analysisResult.dependencies
      );
    } else {
      // Hide stack options if not applicable
      const container = document.getElementById('stack-options-container');
      if (container) container.classList.add('hidden');
    }
    
    // Show mode toggle if dependencies have priority values
    const hasPriorities = window.appState.analysisResult.dependencies.some(d => d.priority && d.priority > 1);
    const toggleBar = document.getElementById('mode-toggle-bar');
    if (toggleBar) {
      if (hasPriorities && window.appState.analysisResult.dependencies.length > 2) {
        toggleBar.style.display = 'flex';
        window.appState.currentMode = 'full';
        document.getElementById('mode-full')?.classList.add('active');
        document.getElementById('mode-essential')?.classList.remove('active');
      } else {
        toggleBar.style.display = 'none';
      }
    }

    displayDependencies(window.appState.analysisResult.dependencies);

    // Check for environment conflicts
    try {
      const conflicts = await ipcRenderer.invoke('check-conflicts', window.appState.analysisResult.dependencies);
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

// Initialize Step 1 event listeners
function initStep1() {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  
  if (searchBtn) {
    searchBtn.addEventListener('click', handleSearch);
  }
  
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleSearch, initStep1 };
}
