/**
 * UI Helper Functions
 * Common utilities for managing UI state and interactions
 */

// Show/hide loading indicator
function showLoading(element, message = 'Loading...') {
  element.innerHTML = `<div style="text-align: center; padding: 2rem;"><p style="font-size: 1.2rem;">${message}</p></div>`;
}

// Display system information in header
function displaySystemInfo(systemInfo) {
  const systemInfoDiv = document.getElementById('system-info');
  if (systemInfoDiv) {
    systemInfoDiv.innerHTML = `${systemInfo.os} • ${systemInfo.packageManager} • ${systemInfo.specs.arch}`;
  }
}

// Show specific step and update progress indicator
function showStep(stepNumber) {
  const steps = [
    document.getElementById('step-1'),
    document.getElementById('step-2'),
    document.getElementById('step-3'),
    document.getElementById('step-4')
  ];
  
  // Hide all steps
  steps.forEach(step => step && step.classList.add('hidden'));
  
  // Show current step
  if (steps[stepNumber - 1]) {
    steps[stepNumber - 1].classList.remove('hidden');
  }
  
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

// Display conflict warnings
function displayConflicts(conflicts) {
  const container = document.getElementById('conflict-warnings');
  if (!container || !conflicts || conflicts.length === 0) {
    if (container) container.style.display = 'none';
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

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showLoading,
    displaySystemInfo,
    showStep,
    addTerminalLine,
    clearTerminal,
    displayConflicts
  };
}
