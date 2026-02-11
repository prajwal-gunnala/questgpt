/**
 * Step 2: Selection Handler
 * Handles dependency selection and display
 */

async function displayDependencies(dependencies) {
  const { ipcRenderer } = require('electron');
  const dependenciesGrid = document.getElementById('dependencies-grid');
  if (!dependenciesGrid) return;
  
  dependenciesGrid.innerHTML = '';

  // Filter by mode: essential = priority 1 only, full = all
  const filtered = window.appState.currentMode === 'essential'
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
      `<img src="${dep.logo_url}" alt="${dep.name}" class="dependency-logo" onerror="this.style.display='none';">` : 
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
      card.style.opacity = '0.7';
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
  
  if (window.appState.selectedDependencies.has(dep.name)) {
    window.appState.selectedDependencies.delete(dep.name);
    card.classList.remove('selected');
  } else {
    window.appState.selectedDependencies.add(dep.name);
    card.classList.add('selected');
  }
  
  updateInstallButton();
}

function toggleUninstallSelection(dep, card) {
  if (window.appState.selectedForUninstall.has(dep.name)) {
    window.appState.selectedForUninstall.delete(dep.name);
    card.classList.remove('selected-uninstall');
    card.style.opacity = '0.7';
  } else {
    window.appState.selectedForUninstall.add(dep.name);
    card.classList.add('selected-uninstall');
    card.style.opacity = '1';
  }
  updateInstallButton();
}

function updateInstallButton() {
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.disabled = window.appState.selectedDependencies.size === 0;
    installBtn.textContent = window.appState.selectedDependencies.size > 0 ? 
      `Install (${window.appState.selectedDependencies.size})` : 'Select Something';
  }
  
  // Update uninstall button
  const uninstallBtn = document.getElementById('uninstall-selected-btn');
  if (uninstallBtn) {
    if (window.appState.selectedForUninstall.size > 0) {
      uninstallBtn.style.display = 'block';
      uninstallBtn.textContent = `Uninstall (${window.appState.selectedForUninstall.size})`;
    } else {
      uninstallBtn.style.display = 'none';
    }
  }
}

function displayStackOptions(stackOptions, allDependencies) {
  const container = document.getElementById('stack-options-container');
  const grid = document.getElementById('stack-options-grid');
  
  if (!container || !grid) return;
  
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
  window.appState.selectedDependencies.clear();
  
  // Mark this stack as selected
  cardElement.classList.add('selected');
  
  // Select all dependencies for this stack
  stack.dependencies.forEach(depName => {
    const dep = allDependencies.find(d => d.name === depName);
    if (dep) {
      window.appState.selectedDependencies.add(dep.name);
    }
  });
  
  // Update UI to show selected dependencies
  updateDependencyCardsSelection();
  updateInstallButton();
  
  // Scroll to dependencies
  setTimeout(() => {
    const grid = document.getElementById('dependencies-grid');
    if (grid) {
      grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 300);
}

function updateDependencyCardsSelection() {
  const cards = document.querySelectorAll('.dependency-card');
  cards.forEach(card => {
    const depName = card.dataset.depName;
    if (window.appState.selectedDependencies.has(depName)) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

window.setMode = function(mode) {
  window.appState.currentMode = mode;
  document.getElementById('mode-essential')?.classList.toggle('active', mode === 'essential');
  document.getElementById('mode-full')?.classList.toggle('active', mode === 'full');

  // Re-render dependencies with filter
  if (window.appState.analysisResult && window.appState.analysisResult.dependencies) {
    displayDependencies(window.appState.analysisResult.dependencies);
  }
};

// Initialize Step 2 event listeners
function initStep2() {
  const installBtn = document.getElementById('install-btn');
  const backBtn = document.getElementById('back-btn');
  
  if (installBtn) {
    installBtn.addEventListener('click', handleInstall);
  }
  
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      showStep(1);
      window.appState.selectedDependencies.clear();
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    displayDependencies,
    toggleDependency,
    updateInstallButton,
    displayStackOptions,
    selectStack,
    initStep2
  };
}
