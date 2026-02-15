# 🗺️ QUESTGPT IMPLEMENTATION ROADMAP

**From Current State to Stateful Environment Management System**  
*Date: February 15, 2026 | Version: 1.0*

---

## TABLE OF CONTENTS

1. [Current System Status](#1-current-system-status)
2. [Vision: Stateful Environment Manager](#2-vision-stateful-environment-manager)
3. [Implementation Phases](#3-implementation-phases)
4. [Detailed Phase Breakdown](#4-detailed-phase-breakdown)
5. [Edge Cases Coverage](#5-edge-cases-coverage)
6. [Testing Strategy](#6-testing-strategy)
7. [Clarifications Needed](#7-clarifications-needed)
8. [Timeline & Milestones](#8-timeline--milestones)

---

# 1. CURRENT SYSTEM STATUS

## ✅ What's Already Implemented (Working & Tested)

### Core Modules (100% Complete)

| Module | File | Status | Functionality |
|--------|------|--------|---------------|
| **System Detector** | `src/system-detector.js` | ✅ Complete | Detects OS, distro, package manager, architecture, admin rights |
| **AI Package Analyzer** | `src/gemini-installer.js` | ✅ Complete | Analyzes requests, generates installation plans, 150+ package mappings |
| **Command Classifier** | `src/command-classifier.js` | ✅ Complete | Safety analysis (dangerous/elevated/moderate/safe) |
| **Installer** | `src/installer.js` | ✅ Complete | Cross-platform command execution (Windows/macOS/Linux) |
| **Verifier** | `src/verifier.js` | ✅ Complete | 3-level verification fallback, version extraction |
| **Uninstaller** | `src/uninstaller.js` | ✅ Complete | AI-powered uninstall command generation |
| **Error Analyzer** | `src/error-analyzer.js` | ✅ Complete | AI diagnosis of installation failures |
| **Logo Provider** | `src/logo-provider.js` | ✅ Complete | 100+ package icon mappings |

### User Interface (100% Complete)

| Component | File | Status | Functionality |
|-----------|------|--------|---------------|
| **4-Step Wizard** | `ui/index.html` | ✅ Complete | Search → Select → Install → Results |
| **Event Handlers** | `ui/renderer.js` | ✅ Complete | All button functionality fixed, IPC communication |
| **MCQ System** | `ui/renderer.js` | ✅ Complete | AI-generated questions, auto-cycle, scoring |
| **Terminal Output** | `ui/renderer.js` | ✅ Complete | Real-time command output, color coding |
| **Modal System** | `ui/index.html` | ✅ Complete | Welcome, safety preview, completion, API key config |
| **Styling** | `ui/styles.css` | ✅ Complete | Responsive design, animations |

### Integration (100% Complete)

| Feature | Status | Notes |
|---------|--------|-------|
| **Electron IPC** | ✅ Complete | 11 IPC handlers exposed |
| **Gemini AI Integration** | ✅ Complete | Dual model (flash + lite) |
| **Package Manager Support** | ✅ Complete | winget, choco, scoop, brew, apt, dnf, pacman |
| **Build System** | ✅ Complete | electron-builder configured, NSIS + portable |

---

## 🔄 What's Partially Implemented (Needs Completion)

### Placeholder Modules

| Module | File | Current State | What Exists | What's Missing |
|--------|------|---------------|-------------|----------------|
| **State Manager** | `src/state-manager.js` | 🟡 Placeholder (60 lines) | - In-memory Map<br>- Placeholder save/load methods<br>- Comments outlining vision | - File I/O for JSON persistence<br>- Environment scanning logic<br>- Update detection<br>- Decision engine<br>- History tracking |
| **Project Scanner** | `src/project-scanner.js` | 🟡 Placeholder (65 lines) | - Basic file scan structure<br>- TODO comments | - package.json parsing<br>- requirements.txt parsing<br>- Dependency extraction |
| **Exporter** | `src/exporter.js` | 🟡 Placeholder | - Basic export structure | - JSON/Markdown/Text formatters<br>- AI-readable context generation |

---

## ❌ What's Not Implemented (Needs Creation)

### Missing Modules (Critical for Stateful System)

| Module | Purpose | Priority | Estimated Complexity |
|--------|---------|----------|---------------------|
| **Environment Scanner** | Parse `winget list`, `brew list`, `dpkg -l` output to detect installed packages | 🔴 Critical | Medium (100-150 lines) |
| **Decision Engine** | Evaluate package state (install/skip/update/repair) | 🔴 Critical | Low (80-100 lines) |
| **Update Detector** | Compare installed vs latest versions | 🔴 Critical | Medium (120-150 lines) |
| **Dashboard Component** | UI to show environment state, installed tools, updates available | 🟡 Important | High (200+ lines HTML/CSS/JS) |

---

# 2. VISION: STATEFUL ENVIRONMENT MANAGER

## What We're Building

Transform QuestGPT from:
```
❌ Stateless AI Command Executor
   → User asks → AI generates → Execute → Done → Forget
```

To:
```
✅ Stateful Environment Management System
   → Scan environment → Track state → Smart decisions → 
   Execute → Verify → Update state → Persist to disk
```

## Core Innovation

### Before (Current Limitation)
- User: "install python"
- System: Executes `winget install Python.Python.3.12`
- **Problem**: If Python already installed, redundant installation

### After (Stateful System)
- User: "install python"
- System checks `environment_context.json`
- Finds: `python: { version: "3.12.1", status: "installed" }`
- Decision: **SKIP** → "Python 3.12.1 already installed ✅"

## Key Features to Implement

1. **Persistent State** → `~/.questgpt/environment_context.json`
2. **Environment Scanning** → Parse package manager output
3. **Smart Decisions** → Install / Skip / Update / Repair logic
4. **Lifecycle Tracking** → Log all installations (success/failure)
5. **Update Detection** → Compare installed vs latest versions
6. **Context Export** → Machine-readable environment for AI agents

---

# 3. IMPLEMENTATION PHASES

## Phase Overview (6 Phases, ~10 Days)

```
Phase 1: Environment Scanning Foundation (2 days)
   ↓
Phase 2: State Persistence Layer (2 days)
   ↓
Phase 3: Smart Decision Engine (2 days)
   ↓
Phase 4: Update Detection System (1 day)
   ↓
Phase 5: UI Integration & Dashboard (2 days)
   ↓
Phase 6: Context Export & Polish (1 day)
```

---

# 4. DETAILED PHASE BREAKDOWN

## PHASE 1: Environment Scanning Foundation

**Goal**: Detect all installed packages on system startup  
**Duration**: 2 days  
**Priority**: 🔴 Critical (Hackathon MVP)

### Tasks

#### Task 1.1: Create Environment Scanner Module
**File**: `src/environment-scanner.js`  
**Lines of Code**: ~120-150

**What It Does**:
```javascript
class EnvironmentScanner {
  constructor(systemInfo) {
    this.os = systemInfo.os;
    this.packageManager = systemInfo.packageManager;
  }

  async scanInstalledPackages() {
    // Returns: [{ name, version, source, package_id }]
  }
}
```

**Platform-Specific Parsing**:

1. **Windows (winget)**:
   ```bash
   # Command to execute
   winget list
   
   # Output format:
   Name               Id                    Version      Source
   Git                Git.Git               2.43.0       winget
   Python 3.12        Python.Python.3.12    3.12.1       winget
   
   # Parse logic:
   - Skip header lines (first 2 lines)
   - Split by whitespace (min 2 spaces)
   - Extract: name, id, version, source
   ```

2. **macOS (brew)**:
   ```bash
   # Command
   brew list --versions
   
   # Output:
   git 2.43.0
   python@3.12 3.12.1
   node 18.19.0
   
   # Parse logic:
   - Split by space
   - First token = name, second = version
   ```

3. **Linux (apt)**:
   ```bash
   # Command
   dpkg -l
   
   # Output:
   ii  git     1:2.43.0-1  amd64   fast, scalable distributed...
   ii  python3 3.12.1-1    amd64   interactive high-level...
   
   # Parse logic:
   - Filter lines starting with "ii" (installed)
   - Extract package name and version
   ```

**Implementation**:
```javascript
async scanInstalledPackages() {
  const command = this.getListCommand();
  const { stdout } = await execAsync(command);
  
  switch (this.packageManager) {
    case 'winget':
      return this.parseWingetList(stdout);
    case 'brew':
      return this.parseBrewList(stdout);
    case 'apt':
      return this.parseDpkgList(stdout);
    // ... other package managers
  }
}

parseWingetList(output) {
  const lines = output.split('\n').slice(2); // Skip header
  return lines
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split(/\s{2,}/); // Split by 2+ spaces
      return {
        name: parts[0]?.trim(),
        package_id: parts[1]?.trim(),
        version: parts[2]?.trim(),
        source: parts[3]?.trim() || 'winget'
      };
    })
    .filter(pkg => pkg.name && pkg.version);
}
```

**Edge Cases**:
- Command fails (package manager not found) → Return empty array
- Parsing fails (unexpected format) → Log warning, return partial results
- Timeout (large package list) → Set 30-second timeout

#### Task 1.2: Integrate Scanner on App Launch
**File**: `electron-main.js`

**Add IPC Handler**:
```javascript
ipcMain.handle('scan-environment', async () => {
  const systemInfo = systemDetector.getSystemInfo();
  const scanner = new EnvironmentScanner(systemInfo);
  const packages = await scanner.scanInstalledPackages();
  return packages;
});
```

**Call from Renderer**:
```javascript
// In renderer.js, after system detection
async function initializeEnvironment() {
  const systemInfo = await ipcRenderer.invoke('detect-system');
  const installedPackages = await ipcRenderer.invoke('scan-environment');
  
  console.log(`Detected ${installedPackages.length} installed packages`);
  // Display in UI: "12 tools detected on your system"
}
```

**Testing Checklist**:
- [ ] Windows: Parse `winget list` output correctly
- [ ] macOS: Parse `brew list --versions` output
- [ ] Linux: Parse `dpkg -l` output
- [ ] Handle empty package lists
- [ ] Handle command execution failures
- [ ] Verify package count matches manual count

---

## PHASE 2: State Persistence Layer

**Goal**: Save environment state to disk and load on startup  
**Duration**: 2 days  
**Priority**: 🔴 Critical (Hackathon MVP)

### Tasks

#### Task 2.1: Upgrade State Manager Module
**File**: `src/state-manager.js`  
**Lines of Code**: 60 → ~250 (add ~190 lines)

**Current Structure** (placeholder):
```javascript
class StateManager {
  constructor() {
    this.state = new Map(); // Only in-memory
  }
  
  save() {
    // TODO: Implement file persistence
  }
  
  load() {
    // TODO: Load from file
  }
}
```

**New Implementation**:
```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');

class StateManager {
  constructor() {
    // State file location
    this.stateDir = path.join(os.homedir(), '.questgpt');
    this.stateFile = path.join(this.stateDir, 'environment_context.json');
    
    // In-memory state
    this.state = null;
    
    // Ensure directory exists
    this.ensureStateDirectory();
  }

  ensureStateDirectory() {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }

  /**
   * Initialize state from environment scan
   */
  async initializeState(systemInfo, installedPackages) {
    this.state = {
      version: '1.0',
      last_scan: new Date().toISOString(),
      system: {
        os: systemInfo.os,
        package_manager: systemInfo.packageManager,
        arch: systemInfo.specs.arch,
        platform: systemInfo.specs.platform
      },
      installed_tools: {},
      installation_history: [],
      failed_installations: []
    };

    // Populate installed tools from scan
    installedPackages.forEach(pkg => {
      this.state.installed_tools[pkg.name.toLowerCase()] = {
        version: pkg.version,
        source: pkg.source,
        package_id: pkg.package_id,
        status: 'installed',
        installed_at: new Date().toISOString(),
        update_available: false
      };
    });

    await this.saveState();
    return this.state;
  }

  /**
   * Save state to disk (JSON file)
   */
  async saveState() {
    if (!this.state) {
      throw new Error('No state to save. Initialize first.');
    }

    try {
      const json = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(this.stateFile, json, 'utf8');
      console.log(`State saved to ${this.stateFile}`);
      return true;
    } catch (error) {
      console.error('Failed to save state:', error);
      return false;
    }
  }

  /**
   * Load state from disk
   */
  async loadState() {
    if (!fs.existsSync(this.stateFile)) {
      console.log('No existing state file found');
      return null;
    }

    try {
      const json = fs.readFileSync(this.stateFile, 'utf8');
      this.state = JSON.parse(json);
      console.log(`State loaded: ${Object.keys(this.state.installed_tools).length} tools tracked`);
      return this.state;
    } catch (error) {
      console.error('Failed to load state:', error);
      return null;
    }
  }

  /**
   * Check if package is installed
   */
  isInstalled(packageName) {
    if (!this.state) return false;
    const key = packageName.toLowerCase();
    return key in this.state.installed_tools;
  }

  /**
   * Get package info
   */
  getPackageInfo(packageName) {
    if (!this.state) return null;
    const key = packageName.toLowerCase();
    return this.state.installed_tools[key] || null;
  }

  /**
   * Log installation attempt
   */
  async logInstallation(packageName, action, result, duration, errorMessage = null) {
    if (!this.state) return;

    const entry = {
      package: packageName,
      action: action, // 'install', 'update', 'repair'
      result: result, // 'success', 'failed'
      timestamp: new Date().toISOString(),
      duration_seconds: duration
    };

    if (result === 'failed') {
      entry.error = errorMessage;
      this.state.failed_installations.push({
        package: packageName,
        error: errorMessage,
        timestamp: entry.timestamp,
        attempted_command: action
      });
    }

    this.state.installation_history.push(entry);
    
    // Update installed_tools if successful
    if (result === 'success' && action === 'install') {
      this.state.installed_tools[packageName.toLowerCase()] = {
        version: 'unknown', // Will be updated by verifier
        status: 'installed',
        installed_at: entry.timestamp,
        update_available: false
      };
    }

    await this.saveState();
  }

  /**
   * Update package after verification
   */
  async updatePackageAfterVerification(packageName, version) {
    if (!this.state) return;
    
    const key = packageName.toLowerCase();
    if (this.state.installed_tools[key]) {
      this.state.installed_tools[key].version = version;
      this.state.installed_tools[key].status = 'installed';
      await this.saveState();
    }
  }

  /**
   * Get installation statistics
   */
  getStats() {
    if (!this.state) return null;

    return {
      total_tools: Object.keys(this.state.installed_tools).length,
      total_installations: this.state.installation_history.length,
      failed_installations: this.state.failed_installations.length,
      last_scan: this.state.last_scan
    };
  }
}

module.exports = StateManager;
```

#### Task 2.2: Integrate State Manager into Electron Main
**File**: `electron-main.js`

**Add at top**:
```javascript
const StateManager = require('./src/state-manager');
const stateManager = new StateManager();
```

**Add IPC Handlers**:
```javascript
// Initialize state on app launch
ipcMain.handle('initialize-state', async () => {
  const systemInfo = systemDetector.getSystemInfo();
  const scanner = new EnvironmentScanner(systemInfo);
  const packages = await scanner.scanInstalledPackages();
  
  // Try to load existing state
  let state = await stateManager.loadState();
  
  // If no state exists, initialize new
  if (!state) {
    state = await stateManager.initializeState(systemInfo, packages);
  }
  
  return state;
});

// Get current state
ipcMain.handle('get-state', async () => {
  return stateManager.state;
});

// Get stats
ipcMain.handle('get-stats', async () => {
  return stateManager.getStats();
});
```

**Update Installation Flow**:
```javascript
ipcMain.handle('install-dependency', async (event, dependency, sudoPassword) => {
  const startTime = Date.now();
  
  try {
    const result = await installer.install(dependency, sudoPassword);
    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    // Log to state manager
    await stateManager.logInstallation(
      dependency.name,
      'install',
      result.success ? 'success' : 'failed',
      duration,
      result.success ? null : result.error
    );
    
    return result;
  } catch (error) {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    await stateManager.logInstallation(
      dependency.name,
      'install',
      'failed',
      duration,
      error.message
    );
    throw error;
  }
});

// Update after verification
ipcMain.handle('verify-installation', async (event, dependency) => {
  const result = await verifier.verify(dependency);
  
  if (result.success && result.version) {
    await stateManager.updatePackageAfterVerification(
      dependency.name,
      result.version
    );
  }
  
  return result;
});
```

**Testing Checklist**:
- [ ] State file created at `~/.questgpt/environment_context.json`
- [ ] Initial scan populates `installed_tools`
- [ ] Installation logged to `installation_history`
- [ ] Failed installation logged to `failed_installations`
- [ ] State persists across app restarts
- [ ] Stats accurately reflect state

---

## PHASE 3: Smart Decision Engine

**Goal**: Evaluate package state and decide action (install/skip/update/repair)  
**Duration**: 2 days  
**Priority**: 🔴 Critical (Hackathon MVP)

### Tasks

#### Task 3.1: Create Decision Engine Module
**File**: `src/decision-engine.js`  
**Lines of Code**: ~100

**Implementation**:
```javascript
class DecisionEngine {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Evaluate what action to take for a package
   * Returns: { action, reason, current_version?, suggested_version? }
   */
  evaluatePackage(packageName) {
    const state = this.stateManager.state;
    
    if (!state) {
      return { 
        action: 'INSTALL', 
        reason: 'No state available, will install' 
      };
    }

    const installed = this.stateManager.getPackageInfo(packageName);

    // Case 1: Not installed
    if (!installed) {
      return { 
        action: 'INSTALL', 
        reason: 'Package not currently installed' 
      };
    }

    // Case 2: Installed but broken
    if (installed.status === 'broken') {
      return { 
        action: 'REPAIR', 
        reason: `Installation broken (last verified: ${installed.last_verified})`,
        current_version: installed.version
      };
    }

    // Case 3: Update available
    if (installed.update_available) {
      return { 
        action: 'UPDATE', 
        reason: `Update available: ${installed.version} → ${installed.latest_version}`,
        current_version: installed.version,
        suggested_version: installed.latest_version
      };
    }

    // Case 4: Already installed and up-to-date
    return { 
      action: 'SKIP', 
      reason: `Already installed (version ${installed.version})`,
      current_version: installed.version
    };
  }

  /**
   * Evaluate multiple packages at once
   */
  evaluatePackages(packageNames) {
    return packageNames.map(name => ({
      package: name,
      ...this.evaluatePackage(name)
    }));
  }

  /**
   * Check if should proceed with installation
   */
  shouldInstall(packageName) {
    const decision = this.evaluatePackage(packageName);
    return ['INSTALL', 'UPDATE', 'REPAIR'].includes(decision.action);
  }

  /**
   * Get recommendation message for UI
   */
  getRecommendationMessage(packageName) {
    const decision = this.evaluatePackage(packageName);
    
    const messages = {
      'INSTALL': `📦 Will install ${packageName}`,
      'SKIP': `✅ ${packageName} already installed (${decision.current_version})`,
      'UPDATE': `🔄 Will update ${packageName} (${decision.current_version} → ${decision.suggested_version})`,
      'REPAIR': `🔧 Will repair ${packageName} (currently broken)`
    };

    return messages[decision.action] || `Processing ${packageName}`;
  }
}

module.exports = DecisionEngine;
```

#### Task 3.2: Integrate Decision Engine
**File**: `electron-main.js`

```javascript
const DecisionEngine = require('./src/decision-engine');
const decisionEngine = new DecisionEngine(stateManager);

// Add IPC handler
ipcMain.handle('evaluate-package', async (event, packageName) => {
  return decisionEngine.evaluatePackage(packageName);
});

ipcMain.handle('evaluate-packages', async (event, packageNames) => {
  return decisionEngine.evaluatePackages(packageNames);
});
```

#### Task 3.3: Update UI to Show Decisions
**File**: `ui/renderer.js`

**Before installation, show decision**:
```javascript
async function showSafetyPreview(dependencies) {
  // Evaluate each package
  const evaluations = await ipcRenderer.invoke(
    'evaluate-packages',
    dependencies.map(d => d.name)
  );

  // Display in safety modal
  evaluations.forEach(eval => {
    const message = getRecommendationMessage(eval);
    addDecisionBadge(eval.package, eval.action, message);
  });

  // Show modal
  safetyModal.style.display = 'block';
}

function addDecisionBadge(packageName, action, message) {
  const badges = {
    'INSTALL': '<span class="badge badge-install">NEW</span>',
    'SKIP': '<span class="badge badge-skip">INSTALLED</span>',
    'UPDATE': '<span class="badge badge-update">UPDATE</span>',
    'REPAIR': '<span class="badge badge-repair">REPAIR</span>'
  };

  // Add badge next to package name in UI
  const packageRow = document.querySelector(`[data-package="${packageName}"]`);
  if (packageRow) {
    packageRow.innerHTML += badges[action] + ` <small>${message}</small>`;
  }
}
```

**Testing Checklist**:
- [ ] Correctly identifies installed packages (SKIP)
- [ ] Correctly identifies new packages (INSTALL)
- [ ] Shows appropriate UI badges
- [ ] Decision messages make sense

---

## PHASE 4: Update Detection System

**Goal**: Detect when installed packages have newer versions available  
**Duration**: 1 day  
**Priority**: 🟡 Important (Hackathon Nice-to-Have)

### Tasks

#### Task 4.1: Create Update Detector
**File**: `src/update-detector.js`  
**Lines of Code**: ~120

**Implementation**:
```javascript
const { execAsync } = require('./utils');

class UpdateDetector {
  constructor(systemInfo) {
    this.packageManager = systemInfo.packageManager;
  }

  /**
   * Check for available updates
   * Returns: [{ name, current, available }]
   */
  async checkForUpdates() {
    const command = this.getUpdateCheckCommand();
    
    try {
      const { stdout } = await execAsync(command);
      return this.parseUpdateOutput(stdout);
    } catch (error) {
      console.error('Update check failed:', error);
      return [];
    }
  }

  getUpdateCheckCommand() {
    switch (this.packageManager) {
      case 'winget':
        return 'winget upgrade';
      case 'brew':
        return 'brew outdated';
      case 'apt':
        return 'apt list --upgradable';
      case 'dnf':
        return 'dnf check-update';
      default:
        throw new Error(`Unsupported package manager: ${this.packageManager}`);
    }
  }

  parseUpdateOutput(output) {
    switch (this.packageManager) {
      case 'winget':
        return this.parseWingetUpgrade(output);
      case 'brew':
        return this.parseBrewOutdated(output);
      case 'apt':
        return this.parseAptUpgradable(output);
      default:
        return [];
    }
  }

  parseWingetUpgrade(output) {
    // winget upgrade output:
    // Name         Id           Version    Available
    // Git          Git.Git      2.43.0     2.44.0
    const lines = output.split('\n').slice(2);
    return lines
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(/\s{2,}/);
        return {
          name: parts[0]?.trim(),
          package_id: parts[1]?.trim(),
          current: parts[2]?.trim(),
          available: parts[3]?.trim()
        };
      })
      .filter(pkg => pkg.name && pkg.available);
  }

  parseBrewOutdated(output) {
    // brew outdated output:
    // git (2.43.0) < 2.44.0
    return output.split('\n')
      .filter(line => line.includes('<'))
      .map(line => {
        const match = line.match(/^(\S+)\s+\(([^)]+)\)\s+<\s+(.+)$/);
        if (match) {
          return {
            name: match[1],
            current: match[2],
            available: match[3]
          };
        }
      })
      .filter(Boolean);
  }

  parseAptUpgradable(output) {
    // apt list --upgradable output:
    // git/stable 1:2.44.0-1 amd64 [upgradable from: 1:2.43.0-1]
    return output.split('\n')
      .filter(line => line.includes('upgradable'))
      .map(line => {
        const match = line.match(/^([^/]+).*\s+(\S+)\s+.*upgradable from:\s+(\S+)/);
        if (match) {
          return {
            name: match[1],
            current: match[3],
            available: match[2]
          };
        }
      })
      .filter(Boolean);
  }
}

module.exports = UpdateDetector;
```

#### Task 4.2: Integrate Update Detection
**File**: `src/state-manager.js`

**Add method**:
```javascript
async checkForUpdates(updateDetector) {
  if (!this.state) return;

  const updates = await updateDetector.checkForUpdates();
  
  updates.forEach(update => {
    const key = update.name.toLowerCase();
    if (this.state.installed_tools[key]) {
      this.state.installed_tools[key].update_available = true;
      this.state.installed_tools[key].latest_version = update.available;
    }
  });

  await this.saveState();
  return updates;
}
```

**File**: `electron-main.js`
```javascript
const UpdateDetector = require('./src/update-detector');

ipcMain.handle('check-updates', async () => {
  const systemInfo = systemDetector.getSystemInfo();
  const detector = new UpdateDetector(systemInfo);
  const updates = await stateManager.checkForUpdates(detector);
  return updates;
});
```

**Testing Checklist**:
- [ ] Detects outdated packages correctly
- [ ] Updates state with `update_available: true`
- [ ] Shows update count in UI

---

## PHASE 5: UI Integration & Dashboard

**Goal**: Display environment state, stats, updates in UI  
**Duration**: 2 days  
**Priority**: 🟡 Important (Visual Polish)

### Tasks

#### Task 5.1: Create Dashboard Component
**File**: `ui/components/dashboard.html`

```html
<div id="dashboard" class="dashboard-container">
  <div class="dashboard-header">
    <h2>🖥️ Environment Overview</h2>
    <button id="refresh-dashboard-btn" class="btn-icon">
      <i class="refresh-icon">🔄</i>
    </button>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-number" id="total-tools">0</div>
      <div class="stat-label">Tools Installed</div>
    </div>
    
    <div class="stat-card stat-updates">
      <div class="stat-number" id="updates-available">0</div>
      <div class="stat-label">Updates Available</div>
    </div>
    
    <div class="stat-card">
      <div class="stat-number" id="total-installs">0</div>
      <div class="stat-label">Total Installations</div>
    </div>
    
    <div class="stat-card stat-failed">
      <div class="stat-number" id="failed-installs">0</div>
      <div class="stat-label">Failed Installations</div>
    </div>
  </div>

  <div class="installed-tools-section">
    <h3>Installed Tools</h3>
    <div id="installed-tools-list" class="tools-grid">
      <!-- Populated by JavaScript -->
    </div>
  </div>

  <div class="actions-section">
    <button id="update-all-btn" class="btn btn-primary">
      Update All Outdated Packages
    </button>
    <button id="export-context-btn" class="btn btn-secondary">
      Export Environment Context
    </button>
  </div>
</div>
```

#### Task 5.2: Dashboard Logic
**File**: `ui/js/dashboard-handler.js`

```javascript
async function loadDashboard() {
  const stats = await ipcRenderer.invoke('get-stats');
  const state = await ipcRenderer.invoke('get-state');

  // Update stats cards
  document.getElementById('total-tools').textContent = stats.total_tools;
  document.getElementById('updates-available').textContent = 
    countUpdatesAvailable(state);
  document.getElementById('total-installs').textContent = 
    stats.total_installations;
  document.getElementById('failed-installs').textContent = 
    stats.failed_installations;

  // Populate installed tools list
  renderInstalledTools(state.installed_tools);
}

function countUpdatesAvailable(state) {
  return Object.values(state.installed_tools)
    .filter(tool => tool.update_available)
    .length;
}

function renderInstalledTools(tools) {
  const container = document.getElementById('installed-tools-list');
  container.innerHTML = '';

  Object.entries(tools).forEach(([name, info]) => {
    const toolCard = createToolCard(name, info);
    container.appendChild(toolCard);
  });
}

function createToolCard(name, info) {
  const card = document.createElement('div');
  card.className = 'tool-card';
  
  const statusBadge = info.update_available 
    ? '<span class="badge badge-update">Update Available</span>'
    : '<span class="badge badge-ok">Up to date</span>';

  card.innerHTML = `
    <div class="tool-icon">📦</div>
    <div class="tool-info">
      <div class="tool-name">${name}</div>
      <div class="tool-version">Version ${info.version}</div>
      ${statusBadge}
    </div>
  `;

  return card;
}

// Event listeners
document.getElementById('refresh-dashboard-btn')?.addEventListener('click', async () => {
  showLoading('Refreshing environment...');
  await ipcRenderer.invoke('check-updates');
  await loadDashboard();
  hideLoading();
});

document.getElementById('update-all-btn')?.addEventListener('click', async () => {
  const state = await ipcRenderer.invoke('get-state');
  const outdated = Object.entries(state.installed_tools)
    .filter(([_, info]) => info.update_available)
    .map(([name, _]) => name);

  if (outdated.length === 0) {
    alert('All packages are up to date!');
    return;
  }

  // Trigger batch update
  // TODO: Implement batch update flow
  console.log('Updating:', outdated);
});

// Load dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashboard')) {
    loadDashboard();
  }
});
```

#### Task 5.3: Styling
**File**: `ui/styles.css`

```css
.dashboard-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1.5rem;
  border-radius: 12px;
  color: white;
  text-align: center;
}

.stat-card.stat-updates {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-card.stat-failed {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.stat-number {
  font-size: 3rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.9rem;
  opacity: 0.9;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.tool-card {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.tool-icon {
  font-size: 2rem;
  margin-right: 1rem;
}

.tool-info {
  flex: 1;
}

.tool-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.tool-version {
  font-size: 0.85rem;
  color: #6c757d;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  margin-top: 0.5rem;
}

.badge-update {
  background: #ffc107;
  color: #000;
}

.badge-ok {
  background: #28a745;
  color: #fff;
}

.actions-section {
  margin-top: 2rem;
  display: flex;
  gap: 1rem;
}
```

**Testing Checklist**:
- [ ] Dashboard displays correct statistics
- [ ] Installed tools list populates
- [ ] Update badges show correctly
- [ ] Refresh button re-scans environment
- [ ] Responsive design works

---

## PHASE 6: Context Export & Polish

**Goal**: Export environment state for AI agents + final polish  
**Duration**: 1 day  
**Priority**: 🟢 Nice-to-Have

### Tasks

#### Task 6.1: Implement Context Exporter
**File**: `src/exporter.js`

```javascript
const fs = require('fs');
const path = require('path');

class ContextExporter {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Export as JSON
   */
  exportJSON() {
    const state = this.stateManager.state;
    if (!state) return null;

    return {
      environment: {
        os: state.system.os,
        package_manager: state.system.package_manager,
        arch: state.system.arch
      },
      capabilities: this.extractCapabilities(state),
      installed_tools: this.formatToolsList(state),
      outdated_tools: this.getOutdatedTools(state),
      missing_common_tools: this.detectMissingTools(state),
      summary: this.generateSummary(state)
    };
  }

  /**
   * Export as Markdown (human-readable)
   */
  exportMarkdown() {
    const data = this.exportJSON();
    
    return `
# Development Environment Context

**System**: ${data.environment.os} (${data.environment.arch})  
**Package Manager**: ${data.environment.package_manager}

## Installed Tools (${Object.keys(data.installed_tools).length})

${Object.entries(data.installed_tools).map(([name, info]) => 
  `- **${name}** (${info.version})${info.update_available ? ' 🔄 _update available_' : ''}`
).join('\n')}

## Capabilities

${data.capabilities.join(', ')}

## Recommendations

${data.outdated_tools.length > 0 
  ? `⚠️ ${data.outdated_tools.length} packages need updates:\n${data.outdated_tools.map(t => `- ${t}`).join('\n')}`
  : '✅ All packages up to date'
}

${data.missing_common_tools.length > 0
  ? `\n📦 Consider installing:\n${data.missing_common_tools.map(t => `- ${t}`).join('\n')}`
  : ''
}
`.trim();
  }

  /**
   * Export as plain text (AI-optimized)
   */
  exportText() {
    const data = this.exportJSON();
    
    return `This system is running ${data.environment.os} with ${data.environment.package_manager}. ` +
      `Installed tools: ${data.capabilities.join(', ')}. ` +
      (data.outdated_tools.length > 0 
        ? `Outdated: ${data.outdated_tools.join(', ')}. ` 
        : '') +
      (data.missing_common_tools.length > 0
        ? `Missing common tools: ${data.missing_common_tools.join(', ')}.`
        : 'Environment is complete.');
  }

  // Helper methods
  extractCapabilities(state) {
    return Object.keys(state.installed_tools);
  }

  formatToolsList(state) {
    const result = {};
    Object.entries(state.installed_tools).forEach(([name, info]) => {
      result[name] = {
        version: info.version,
        status: info.status,
        update_available: info.update_available
      };
    });
    return result;
  }

  getOutdatedTools(state) {
    return Object.entries(state.installed_tools)
      .filter(([_, info]) => info.update_available)
      .map(([name, _]) => name);
  }

  detectMissingTools(state) {
    const commonTools = ['git', 'node', 'python', 'docker', 'vscode'];
    const installed = Object.keys(state.installed_tools).map(k => k.toLowerCase());
    return commonTools.filter(tool => !installed.includes(tool));
  }

  generateSummary(state) {
    const total = Object.keys(state.installed_tools).length;
    const outdated = this.getOutdatedTools(state).length;
    
    if (outdated === 0) {
      return `Complete development environment with ${total} tools, all up-to-date.`;
    } else {
      return `Development environment with ${total} tools, ${outdated} need updates.`;
    }
  }

  /**
   * Save export to file
   */
  async saveToFile(format, filePath) {
    let content;
    
    switch (format) {
      case 'json':
        content = JSON.stringify(this.exportJSON(), null, 2);
        break;
      case 'markdown':
        content = this.exportMarkdown();
        break;
      case 'text':
        content = this.exportText();
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }
}

module.exports = ContextExporter;
```

#### Task 6.2: Add Export UI
**File**: `ui/renderer.js`

```javascript
document.getElementById('export-context-btn')?.addEventListener('click', async () => {
  const format = await showFormatSelectorModal(); // json, markdown, text
  
  if (!format) return;

  const result = await ipcRenderer.invoke('export-context', format);
  
  if (result.success) {
    alert(`Environment context exported to:\n${result.filePath}`);
  } else {
    alert(`Export failed: ${result.error}`);
  }
});
```

**File**: `electron-main.js`
```javascript
const ContextExporter = require('./src/exporter');
const exporter = new ContextExporter(stateManager);

ipcMain.handle('export-context', async (event, format) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `questgpt_environment_${timestamp}.${format}`;
    const filePath = path.join(app.getPath('documents'), fileName);
    
    await exporter.saveToFile(format, filePath);
    
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

**Testing Checklist**:
- [ ] JSON export contains all data
- [ ] Markdown export is readable
- [ ] Text export is AI-optimized
- [ ] File saved to correct location

---

# 5. EDGE CASES COVERAGE

## Environment Scanning Edge Cases

| Edge Case | How Handled | Implementation Location |
|-----------|-------------|------------------------|
| **Package manager command fails** | Return empty array, log warning | `environment-scanner.js` |
| **Output parsing fails** | Catch error, return partial results with warning | `environment-scanner.js` |
| **Unexpected output format** | Log warning, skip unparseable lines | `environment-scanner.js` |
| **Command timeout (>30s)** | Set timeout, return partial results | `environment-scanner.js` |
| **No packages installed** | Return empty array (valid state) | `environment-scanner.js` |

## State Persistence Edge Cases

| Edge Case | How Handled | Implementation Location |
|-----------|-------------|------------------------|
| **State file corrupted** | Catch JSON parse error, reinitialize state | `state-manager.js` |
| **State directory not writable** | Try alternative location (temp dir) | `state-manager.js` |
| **Disk full** | Catch write error, show warning to user | `state-manager.js` |
| **State file version mismatch** | Migrate old format to new | `state-manager.js` |
| **Concurrent write access** | File locking or timestamp-based resolution | `state-manager.js` |

## Decision Engine Edge Cases

| Edge Case | How Handled | Implementation Location |
|-----------|-------------|------------------------|
| **No state available** | Default to INSTALL action | `decision-engine.js` |
| **Package name mismatch** | Normalize to lowercase for comparison | `decision-engine.js` |
| **Version comparison fails** | Treat as unknown, default to INSTALL | `decision-engine.js` |
| **Broken status unknown** | Try verification, update status | `decision-engine.js` |

## Update Detection Edge Cases

| Edge Case | How Handled | Implementation Location |
|-----------|-------------|------------------------|
| **Update check command fails** | Return empty array, don't crash | `update-detector.js` |
| **Output format differs per OS** | Multiple parsing strategies per platform | `update-detector.js` |
| **Network timeout** | Set 30s timeout, handle gracefully | `update-detector.js` |
| **No updates available** | Return empty array (valid state) | `update-detector.js` |

## UI Integration Edge Cases

| Edge Case | How Handled | Implementation Location |
|-----------|-------------|------------------------|
| **State not loaded yet** | Show loading state, retry | `dashboard-handler.js` |
| **Stats are null** | Display 0 with info message | `dashboard-handler.js` |
| **Very large tool list (>100)** | Pagination or virtual scrolling | `dashboard-handler.js` |
| **Update check takes long** | Show progress indicator | `dashboard-handler.js` |

---

# 6. TESTING STRATEGY

## Unit Testing (Module-Level)

### Environment Scanner
```javascript
describe('EnvironmentScanner', () => {
  test('parses winget list output correctly', () => {
    const output = `
Name               Id                    Version      Source
Git                Git.Git               2.43.0       winget
Python 3.12        Python.Python.3.12    3.12.1       winget
    `.trim();
    
    const result = scanner.parseWingetList(output);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Git');
    expect(result[0].version).toBe('2.43.0');
  });

  test('handles empty output', () => {
    const result = scanner.parseWingetList('');
    expect(result).toEqual([]);
  });
});
```

### State Manager
```javascript
describe('StateManager', () => {
  test('initializes state correctly', async () => {
    const state = await stateManager.initializeState(systemInfo, packages);
    expect(state.installed_tools).toBeDefined();
    expect(state.installation_history).toEqual([]);
  });

  test('saves and loads state', async () => {
    await stateManager.saveState();
    const loaded = await stateManager.loadState();
    expect(loaded).toEqual(stateManager.state);
  });
});
```

### Decision Engine
```javascript
describe('DecisionEngine', () => {
  test('returns INSTALL for new package', () => {
    const decision = engine.evaluatePackage('newpackage');
    expect(decision.action).toBe('INSTALL');
  });

  test('returns SKIP for installed package', () => {
    // Mock state with installed package
    const decision = engine.evaluatePackage('git');
    expect(decision.action).toBe('SKIP');
  });
});
```

## Integration Testing

### End-to-End Flow
1. Launch app
2. Scan environment
3. Initialize state
4. Install new package
5. Verify state updated
6. Restart app
7. Verify state persisted
8. Check decision engine sees installed package

## Manual Testing Checklist

### Phase 1: Environment Scanning
- [ ] Windows: Run app, verify packages detected
- [ ] macOS: Run app, verify brew packages listed
- [ ] Linux: Run app, verify apt packages listed
- [ ] Empty system: Verify graceful handling
- [ ] Network offline: Verify error handling

### Phase 2: State Persistence
- [ ] Fresh install: State file created
- [ ] Install package: State updated
- [ ] Restart app: State loaded correctly
- [ ] Corrupt state file: Graceful recovery
- [ ] Manual state edit: Changes reflected

### Phase 3: Decision Engine
- [ ] New package: Shows INSTALL
- [ ] Installed package: Shows SKIP
- [ ] Broken package: Shows REPAIR
- [ ] Outdated package: Shows UPDATE

### Phase 4: Update Detection
- [ ] Outdated package: Detected correctly
- [ ] Up-to-date system: Shows 0 updates
- [ ] Mixed state: Some updated, some not

### Phase 5: Dashboard
- [ ] Stats display correctly
- [ ] Tools list populates
- [ ] Refresh works
- [ ] Update badges show

### Phase 6: Export
- [ ] JSON export valid
- [ ] Markdown readable
- [ ] Text concise
- [ ] File saved to Documents

---

# 7. CLARIFICATIONS NEEDED

## Questions for User

### 1. **Scope Confirmation**
**Question**: Should we implement ALL 6 phases for the hackathon, or prioritize Phases 1-3 (core stateful functionality) and defer Phases 4-6 (polish)?

**Current Recommendation**: 
- **MUST HAVE** (Hackathon Demo): Phases 1-3
- **NICE TO HAVE** (If time permits): Phases 4-6

### 2. **Update Management Behavior**
**Question**: When update is detected, should user:
- A) Be prompted to update immediately?
- B) See notification but update manually?
- C) Have option to auto-update on next installation?

**Current Recommendation**: Option B (notification + manual update)

### 3. **State File Location**
**Question**: Confirm state file location:
- Windows: `C:\Users\<name>\.questgpt\environment_context.json`
- macOS: `/Users/<name>/.questgpt/environment_context.json`
- Linux: `/home/<name>/.questgpt/environment_context.json`

**Is this acceptable?** (Hidden directory in user home)

### 4. **Dashboard Placement**
**Question**: Where should dashboard appear in UI?
- A) New tab in wizard (Step 0: Dashboard)
- B) Separate window/modal
- C) Home screen before search

**Current Recommendation**: Option A (add as Step 0)

### 5. **Batch Update Implementation**
**Question**: For "Update All" button:
- Should it update packages one-by-one sequentially?
- Should it show progress for each?
- Should it allow cancellation mid-process?

**Current Recommendation**: Yes to all three

### 6. **Package Name Normalization**
**Question**: How to handle package name variations?
- "Git" vs "git" vs "Git.Git"
- Should we maintain a mapping table?

**Current Recommendation**: Normalize to lowercase for state storage, maintain `package_id` separately

### 7. **Failed Installation Retry**
**Question**: Should system automatically retry failed installations?
- A) No retry, just log
- B) Retry once automatically
- C) Prompt user to retry

**Current Recommendation**: Option A (user can manually retry)

### 8. **Environment Scan Frequency**
**Question**: When to re-scan environment?
- A) Only on app launch
- B) Before every installation
- C) Manual refresh button only
- D) Periodic (e.g., every 1 hour)

**Current Recommendation**: Option A + C (launch + manual refresh)

---

# 8. TIMELINE & MILESTONES

## 10-Day Implementation Plan

### Week 1: Core Functionality

**Day 1-2: Phase 1 (Environment Scanning)**
- [ ] Create `environment-scanner.js`
- [ ] Implement Windows (winget) parsing
- [ ] Implement macOS (brew) parsing
- [ ] Implement Linux (apt) parsing
- [ ] Add IPC handlers
- [ ] Test on all 3 platforms (if possible)

**Day 3-4: Phase 2 (State Persistence)**
- [ ] Upgrade `state-manager.js`
- [ ] Implement JSON save/load
- [ ] Integrate with installation flow
- [ ] Add logging for installations
- [ ] Test state persistence across restarts

**Day 5-6: Phase 3 (Decision Engine)**
- [ ] Create `decision-engine.js`
- [ ] Implement evaluation logic
- [ ] Integrate with UI (badges)
- [ ] Test all decision paths (INSTALL/SKIP/UPDATE/REPAIR)

### Week 2: Polish & Advanced Features

**Day 7: Phase 4 (Update Detection)**
- [ ] Create `update-detector.js`
- [ ] Implement update checking
- [ ] Integrate with state manager
- [ ] Test update detection

**Day 8-9: Phase 5 (UI Dashboard)**
- [ ] Create dashboard component
- [ ] Implement statistics display
- [ ] Add installed tools list
- [ ] Add refresh functionality
- [ ] Style dashboard

**Day 10: Phase 6 (Export) + Final Testing**
- [ ] Implement context exporter
- [ ] Add export UI
- [ ] End-to-end testing
- [ ] Bug fixes
- [ ] Documentation

## Milestones

### Milestone 1: Basic Stateful System (Day 4)
- ✅ Environment can be scanned
- ✅ State persists to disk
- ✅ State loads on startup

### Milestone 2: Smart Decisions (Day 6)
- ✅ System skips already-installed packages
- ✅ User sees installation recommendations
- ✅ State updates after installations

### Milestone 3: Update Awareness (Day 7)
- ✅ System detects outdated packages
- ✅ Update badges show in UI

### Milestone 4: Complete Experience (Day 10)
- ✅ Dashboard shows environment overview
- ✅ Context can be exported
- ✅ All edge cases handled
- ✅ Ready for hackathon demo

---

## Success Criteria

### Minimum Viable Product (Hackathon Demo)
- [x] User launches app
- [x] System scans environment (5-10 seconds)
- [x] State saved to `~/.questgpt/environment_context.json`
- [x] User requests to install package
- [x] System shows: "Already installed ✅" or "Will install 📦"
- [x] After installation, state updates
- [x] Next launch, state persists

### Full Implementation (Post-Hackathon)
- [x] All 6 phases complete
- [x] Dashboard shows statistics
- [x] Update detection works
- [x] Context export available
- [x] All platforms tested (Windows/macOS/Linux)

---

**Document Version**: 1.0  
**Last Updated**: February 15, 2026  
**Author**: QuestGPT Development Team  
**Status**: Ready for Implementation
