/**
 * Global Application State
 * Centralized state management
 */

window.appState = {
  systemInfo: null,
  analysisResult: null,
  selectedDependencies: new Set(),
  selectedForUninstall: new Set(),
  currentMCQIndex: 0,
  mcqData: [],
  score: 0,
  allQuestions: [],
  sudoPassword: null,
  questionInterval: null,
  currentMode: 'full',
  pendingInstallDeps: null,
  installedPackagesHistory: [],
  pendingVerificationDeps: null,
  
  // Reset state
  reset() {
    this.selectedDependencies.clear();
    this.selectedForUninstall.clear();
    this.currentMCQIndex = 0;
    this.score = 0;
    this.allQuestions = [];
    this.pendingInstallDeps = null;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.appState;
}
