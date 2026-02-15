# QuestGPT — Full Code Audit Report

**Date:** February 15, 2026  
**Auditor:** Automated deep-code analysis  
**Scope:** Every source file, every IPC handler, every UI flow, every edge case  
**Method:** Line-by-line code reading of all 14 JS modules + HTML + CSS (≈5,500 lines total)

---

## Table of Contents

1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Security Audit](#2-security-audit)
3. [Module-by-Module Analysis](#3-module-by-module-analysis)
4. [Data Flow & IPC Analysis](#4-data-flow--ipc-analysis)
5. [Edge Cases & Failure Modes](#5-edge-cases--failure-modes)
6. [UI/UX Audit](#6-uiux-audit)
7. [Dependency & Build Audit](#7-dependency--build-audit)
8. [Performance Metrics](#8-performance-metrics)
9. [Limitations & Honest Assessment](#9-limitations--honest-assessment)
10. [Risk Matrix](#10-risk-matrix)
11. [Recommendations](#11-recommendations)

---

## 1. Project Overview & Architecture

**What QuestGPT is:** An Electron desktop app that uses Google Gemini AI to analyze user requests for software packages, generate install commands, execute them, verify installations, and quiz the user with MCQs during the process.

### File Metrics

| File | Lines | Role |
|------|-------|------|
| `electron-main.js` | 722 | Main process, IPC handlers |
| `src/gemini-installer.js` | 1,295 | AI prompt engineering, API calls |
| `src/installer.js` | ~280 | Command execution engine |
| `src/verifier.js` | ~210 | Installation verification |
| `src/state-manager.js` | ~250 | Persistent state (JSON file) |
| `src/environment-scanner.js` | ~270 | Package manager output parsing |
| `src/decision-engine.js` | ~150 | Install/skip/update/repair logic |
| `src/update-detector.js` | ~140 | Check for available updates |
| `src/command-classifier.js` | ~140 | Risk-level classification |
| `src/error-analyzer.js` | ~70 | AI error diagnosis |
| `src/uninstaller.js` | ~170 | AI-generated uninstall commands |
| `src/exporter.js` | ~95 | Export env context |
| `src/logo-provider.js` | 232 | ASCII art + CDN logos |
| `src/project-scanner.js` | ~65 | **Placeholder — not implemented** |
| `ui/renderer.js` | 2,006 | **Monolith** — all UI logic |
| `ui/index.html` | 320 | Single-page HTML |
| `ui/styles.css` | ~1,400+ | All styling |
| **Total** | **≈7,800+** | |

### Architecture Pattern

```
User Input → Gemini AI → JSON parse → Command Execution → Verification → State Update
                                          ↓
                                    MCQ Generation (parallel)
```

**Verdict:** Monolithic frontend (renderer.js = 2,006 lines), modular backend (good separation). The `ui/js/` folder with component loaders and handlers exists but is **dead code** — `index.html` loads `renderer.js` directly, not `renderer-new.js` or the component system.

---

## 2. Security Audit

### 2.1 — CRITICAL: API Keys Hardcoded in Repository

| Finding | Severity | Location |
|---------|----------|----------|
| **Gemini API key in `.env`** | 🔴 CRITICAL | `.env` line 1 |
| **Gemini API key in `config.json.example`** | 🔴 CRITICAL | `config.json.example` line 2 |

**Evidence:**
- `.env` contains: `GEMINI_API_KEY=AIzaSyAZFgIdj-INtDMoff7QrmEa6BfjEiMNAjQ`
- `config.json.example` contains: `GEMINI_API_KEY=AIzaSyAH3Fd5tGHoypOYrwO0NEuY8E52xvcYH9U`
- Both are **real API keys** (AIza prefix = valid Google API key format)
- The `.env` file is included in the build files list in `package.json` (line 36: `".env"`)
- This means the **API key ships with the built executable**

**Impact:** Anyone who downloads the app or inspects the source can extract and abuse the API key. Google will eventually revoke it, breaking the app for everyone.

### 2.2 — CRITICAL: `nodeIntegration: true` + `contextIsolation: false`

```js
// electron-main.js line 63-64
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false
}
```

**Impact:** Any content loaded in the renderer has full Node.js access. If any external URL or injected content runs in the window, it has access to `require('child_process')`, filesystem, etc. This is the #1 Electron security anti-pattern.

### 2.3 — HIGH: Arbitrary Command Execution

The entire app's purpose is executing shell commands. The flow is:

1. User types free text → sent to Gemini API
2. Gemini returns JSON with `install_commands: ["choco install git -y"]`
3. App executes those commands via `child_process.exec()` with `shell: 'cmd.exe'`
4. No sandboxing, no allowlist validation of actual commands

The `CommandClassifier` does pattern-match for dangerous commands (`rm -rf /`, `mkfs`, `dd`), but:
- It only **warns** — it blocks dangerous commands in the UI but the IPC handler `install-dependency` has **zero validation**
- The classifier regex patterns are Linux-centric; Windows destructive commands like `format`, `diskpart`, `del /s /q C:\` are **not checked**
- A malicious Gemini response (prompt injection) could return arbitrary commands

### 2.4 — HIGH: Sudo Password Handling

```js
// installer.js line 51
finalCommand = `echo '${sudoPassword}' | sudo -S ${command.replace(/^sudo\s+/, '')}`;
```

- Password is interpolated directly into a shell string with single quotes
- If the password contains a single quote (`'`), this becomes **shell injection**: `echo 'pass'word' | sudo -S ...`
- Password is stored in a plain JS variable (`sudoPassword`) on the renderer side — visible in DevTools
- No encryption, no secure storage, no clearing after use

### 2.5 — MEDIUM: `.env` Shipped in Build

```json
// package.json line 36
"files": [
  "electron-main.js",
  "ui/**/*",
  "src/**/*",
  "assets/**/*",
  "node_modules/**/*",
  ".env",                    // ← Ships with the executable
  "config.json.example"
]
```

The `.env` file (with real API key) is packaged into the distributable. Even though `asar: false`, the entire app directory is readable.

### 2.6 — MEDIUM: No Input Sanitization on User Search

```js
// renderer.js - quickWingetSearch
dependenciesGrid.innerHTML = '...Searching winget for "' + query + '"...';
```

User input (`query`) is concatenated directly into innerHTML. A crafted input like `<img src=x onerror=alert(1)>` would execute JavaScript (XSS). With `nodeIntegration: true`, this is an RCE vector.

Same issue in `renderNoResults()`:
```js
resultsList.innerHTML = `...No packages found for "${query}"...`;
```

And in `installSearchedPackage`:
```js
onclick="installSearchedPackage('${pkg.id}', '${pkg.name}')"
```
If `pkg.id` or `pkg.name` contains a single quote, this breaks and potentially injects code.

---

## 3. Module-by-Module Analysis

### 3.1 — `system-detector.js` (175 lines)

**What it does:** Detects OS, distro, package manager, system specs, admin status.

**Issues found:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | `getPackageManager()` defaults to `choco` on Windows even if choco is NOT installed. It tries `where choco`, `where winget`, `where scoop` in order — but on failure, returns `'choco'` anyway (line 92). This means the entire app will generate `choco install` commands for a system without Chocolatey. | 🟡 HIGH |
| 2 | `getPackageManager()` on macOS defaults to `brew` even if brew is not installed (line 101). Same problem. | 🟡 HIGH |
| 3 | `execSync` calls with `{ stdio: 'ignore' }` swallow all errors silently. If `where` or `which` hangs, the app freezes with no feedback. | 🟡 MEDIUM |
| 4 | `isSudo()` on Windows runs `net session` — this works but shows a CMD window flash on some Windows versions. | 🟠 LOW |

### 3.2 — `gemini-installer.js` (1,295 lines)

**What it does:** The brain of the app. Builds massive prompts (800+ lines of prompt template), sends to Gemini, parses JSON response.

**Issues found:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Prompt is ~1,000 lines long** with embedded package name mappings, examples, and rules. This consumes massive tokens per request. At Gemini 2.5 Flash pricing, each request costs significantly more than needed. Most of the prompt is static context that could be a system instruction. | 🟡 COST |
| 2 | The constructor creates `GoogleGenerativeAI` with `process.env.GEMINI_API_KEY` at module load time. If the key is set later (via `save-api-key` IPC), the `GeminiInstaller` instance still uses the OLD key (or undefined). The instances are created once at line 99-101 of `electron-main.js` and never re-created. | 🔴 CRITICAL BUG |
| 3 | `normalizeCommandsForSystem()` can throw `"No compatible install command found"` which propagates as an unhandled rejection if all commands are filtered out. This happens when Gemini returns commands for the wrong platform despite the prompt. | 🟡 HIGH |
| 4 | The MCQ model is `gemini-2.5-flash-lite` which may not exist or may have been renamed. Model availability changes. No fallback model. | 🟡 MEDIUM |
| 5 | `cleanJsonText()` strips markdown fences but doesn't handle cases where Gemini returns text before or after the JSON (e.g., "Here is the JSON:\n```json\n{...}\n```\nHope this helps!"). Only leading/trailing fences are stripped. | 🟡 MEDIUM |
| 6 | No retry logic. If Gemini API returns 429 (rate limit) or 503 (overloaded), the request fails permanently with one attempt. | 🟡 MEDIUM |
| 7 | No request timeout. If Gemini hangs, the app hangs indefinitely. | 🟡 MEDIUM |
| 8 | The prompt has a formatting error — there's raw JSON template text that appears to be duplicated/pasted incorrectly (around the Django/Angular example before the Linux section). This could confuse the model. | 🟠 LOW |

### 3.3 — `installer.js` (280 lines)

**What it does:** Executes shell commands via `child_process.exec()`.

**Issues found:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | **`chalk` is used but not in `package.json` dependencies.** It's installed as a transitive dependency (probably from electron-builder). Works now, will break when electron-builder updates or removes chalk. | 🟡 HIGH |
| 2 | `executeCommands()` has a `break` on first success (line 195). This means if 3 install commands are provided (e.g., try choco, try winget, try scoop), it stops after the first one succeeds. **This is actually correct behavior** (try alternatives). But it's undocumented and surprising. | 🟠 INFO |
| 3 | `maxBuffer: 1024 * 1024 * 10` (10MB) — generous but some package managers (especially `choco install` with verbose output) can exceed this. | 🟠 LOW |
| 4 | `this.currentProcess` is set in the constructor but never actually assigned in `executeCommand()`. The `cancel()` method checks `this.currentProcess` but it's always `null`. **Cancel functionality is broken.** | 🟡 HIGH |
| 5 | No command timeout. A hung `choco install` will block the app forever. The `exec` call has no `timeout` option set. | 🟡 HIGH |

### 3.4 — `verifier.js` (210 lines)

**What it does:** Runs verification commands to check if a package was installed successfully.

**Issues found:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | `timeout: 5000` (5 seconds) — too short for some verification commands. `python -c "import tensorflow"` can take 10-15 seconds on first import. | 🟡 MEDIUM |
| 2 | `extractCommandName()` handles `where` and `which` prefixes but not complex commands like `python -c "import pandas"`. It returns `python` which is correct, but then the fallback tries `python --version` which verifies Python, not pandas. | 🟡 MEDIUM |
| 3 | Version regex `(\d+\.?\d*\.?\d*)` is greedy and matches partial strings. "Python 3.12.1" → "3.12.1" ✓, but "v22.11.0" → "22.11.0" ✓. Edge case: "error code 127" → "127" (false version). | 🟠 LOW |

### 3.5 — `state-manager.js` (250 lines)

**What it does:** Persists environment state to `~/.questgpt/environment_context.json`.

**Issues found:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | `saveState()` uses synchronous `fs.writeFileSync()` despite being an `async` function. This blocks the main process during disk writes. For small JSON files this is fine, but the installation_history array grows unbounded. After hundreds of installs, this file could be megabytes. | 🟡 MEDIUM |
| 2 | No file locking. If two IPC handlers call `saveState()` concurrently (e.g., logging an install while updating verification), they could corrupt the JSON file. | 🟡 MEDIUM |
| 3 | `removePackage()` calls `this.saveState()` without `await`. Since `saveState` is async (even though it uses sync fs), the return value is a dangling promise. | 🟠 LOW |
| 4 | State file location is `~/.questgpt/` — this persists across app reinstalls, which is good. But there's no versioning/migration. If the state format changes, old state files will cause silent bugs. | 🟡 MEDIUM |
| 5 | `loadState()` catches JSON parse errors and returns `null`, triggering a full re-scan. This is correct but means a single corrupted byte destroys all history. No backup mechanism. | 🟠 LOW |

### 3.6 — `environment-scanner.js` (270 lines)

**What it does:** Parses output of `winget list`, `choco list`, `dpkg -l`, etc. to detect installed packages.

**Issues found:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | `parseWingetList()` splits by 2+ spaces — but winget uses fixed-width columns, not delimiters. Package names containing 2+ consecutive spaces (rare but possible) would be split incorrectly. The `parseWingetSearchOutput()` in `electron-main.js` uses column positions (correct approach). Inconsistency. | 🟡 MEDIUM |
| 2 | `timeout: 30000` (30s) for listing all packages. On systems with 1000+ packages via winget, this can time out. | 🟡 MEDIUM |
| 3 | `choco list --local-only` flag is deprecated in newer Chocolatey versions (v2+). The correct command is `choco list`. | 🟡 MEDIUM |
| 4 | RPM parsing regex `^(.+?)-(\d+[\d.]*-[\w.]+)$` fails for packages with numbers in the name (e.g., `lib32-glibc-2.38-1`). | 🟡 MEDIUM |
| 5 | No support for `snap`, `flatpak`, or `nix` package managers. | 🟠 INFO |

### 3.7 — `decision-engine.js` (150 lines)

**What it does:** Decides whether to install/skip/update/repair based on state.

**Issues found:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | `evaluatePackage()` does case-insensitive lookup against state (`packageName.toLowerCase()`) but the state keys come from different sources — sometimes display_name, sometimes package_id. "Node.js" vs "nodejs" vs "OpenJS.NodeJS" would all be different keys. Matching is unreliable. | 🟡 HIGH |
| 2 | No mechanism to detect "broken" status. `installed.status === 'broken'` is checked but nothing in the codebase ever sets status to `'broken'`. This code path is **dead code**. | 🟠 LOW |
| 3 | `getBadgeHTML()` returns raw HTML strings but is called from the main process. This is a design smell — main process shouldn't generate HTML. However, it's actually only used from renderer. | 🟠 LOW |

### 3.8 — `update-detector.js` (140 lines)

**What it does:** Runs `winget upgrade` / `brew outdated` to find available updates.

**Issues found:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | No support for `choco` updates (`choco outdated`). If the detected package manager is `choco`, `getUpdateCheckCommand()` throws. | 🟡 HIGH |
| 2 | No support for `scoop` updates (`scoop status`). Same issue. | 🟡 MEDIUM |
| 3 | `winget upgrade` on some Windows versions prompts for source agreement acceptance, which hangs in non-interactive mode. No `--accept-source-agreements` flag. | 🟡 MEDIUM |

### 3.9 — `command-classifier.js` (140 lines)

**What it does:** Classifies commands by risk level (dangerous/elevated/moderate/safe).

**Issues found:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Windows-blind.** All dangerous patterns are Linux-specific (`rm -rf /`, `mkfs`, `dd`). Windows equivalents (`format C:`, `diskpart`, `del /s /q C:\*`, `Remove-Item -Recurse -Force C:\`) are not checked. | 🟡 HIGH |
| 2 | `choco install` and `winget install` are not matched by any elevated pattern. They DO require admin but are classified as "moderate" (unknown command default). | 🟡 MEDIUM |
| 3 | `pip install` without `--user` is flagged as moderate — correct for Linux, but on Windows pip install is normal practice (not elevated). False positive on Windows. | 🟠 LOW |
| 4 | Default classification for unknown commands is "moderate" — this means every `choco`, `winget`, `scoop` command shows ⚠️. Adds noise. | 🟠 LOW |

### 3.10 — `error-analyzer.js` (70 lines)

**What it does:** Sends failed command output to Gemini for diagnosis.

**Issues found:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | Constructor hardcodes `process.env.GEMINI_API_KEY` at instantiation — same stale-key bug as gemini-installer. | 🟡 HIGH |
| 2 | Fallback suggested fixes mention `sudo apt-get update` regardless of OS. On Windows this is nonsensical. | 🟡 MEDIUM |
| 3 | Error output is truncated to 1,500 chars before sending to Gemini. Important context (like which package failed) may be at the end. | 🟠 LOW |

### 3.11 — `uninstaller.js` (170 lines)

**What it does:** Uses Gemini to generate uninstall commands for packages.

**Issues found:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | Same stale API key bug as above. | 🟡 HIGH |
| 2 | The `execute-uninstall` IPC handler (electron-main.js line 415) references `systemInfo` variable which is **not defined in that scope**. It should be `systemDetector.getSystemInfo()`. This will throw `ReferenceError: systemInfo is not defined`, making the entire uninstall-from-package-manager flow crash. | 🔴 CRITICAL BUG |
| 3 | Uninstall commands are executed via `installer.executeCommands()` but the installer has the `break` behavior (stops after first success). If uninstall requires multiple sequential commands (remove + cleanup), only the first runs. | 🟡 HIGH |

### 3.12 — `project-scanner.js` (65 lines)

**Status:** Placeholder. Both methods return empty/stub data. The module is imported nowhere in the app. **Dead code.**

### 3.13 — `logo-provider.js` (232 lines)

**Status:** Works fine. ASCII art + CDN URLs. **Not imported by electron-main.js** — the Gemini prompt asks the AI to provide logo_url directly. This module appears to be **unused dead code**.

---

## 4. Data Flow & IPC Analysis

### 4.1 — Complete IPC Handler Inventory

| IPC Channel | Direction | Validation | Notes |
|-------------|-----------|------------|-------|
| `detect-system` | Invoke | None needed | Read-only |
| `classify-commands` | Invoke | None | Processes user-selected deps |
| `analyze-error` | Invoke | None | Sends error context to Gemini |
| `check-conflicts` | Invoke | None | Hardcoded conflict patterns |
| `generate-uninstall-plan` | Invoke | None | Sends to Gemini |
| `analyze-request` | Invoke | API key check ✓ | Main AI analysis |
| `check-installed` | Invoke | None | Runs verification command |
| `get-api-key-status` | Invoke | None | Returns masked key |
| `save-api-key` | Invoke | **None** | Writes to disk, no validation |
| `install-dependency` | Invoke | **None** | ⚠️ Executes arbitrary commands |
| `submit-sudo-password` | Invoke | **None** | Returns password as plaintext |
| `verify-installation` | Invoke | None | Runs verify command |
| `scan-environment` | Invoke | None | Runs package list command |
| `get-stats` | Invoke | None | Read-only |
| `check-decision` | Invoke | None | Read-only |
| `get-decision-summary` | Invoke | None | Read-only |
| `check-updates` | Invoke | None | Runs upgrade command |
| `export-context` | Invoke | None | Writes file to disk |
| `get-all-packages` | Invoke | None | Read-only |
| `execute-uninstall` | Invoke | **None** | ⚠️ Has `systemInfo` bug |
| `winget-search` | Invoke | None | Runs winget search |
| `generate-mcqs` | Invoke | None | Single MCQ generation |
| `generate-batch-mcqs` | Invoke | None | Batch MCQ generation |
| `terminal-output` | Send | N/A | Main→Renderer |
| `sudo-password-required` | Send | N/A | Main→Renderer |

**Key finding:** `install-dependency` and `execute-uninstall` execute arbitrary commands with no validation. The security relies entirely on Gemini returning safe commands and the user clicking "Proceed" in the safety preview.

### 4.2 — State Mutations Flow

```
User Search → Gemini → parse → displayDependencies()
                                    ↓
User Click → selectedDependencies Set → handleInstall()
                                            ↓
                        CommandClassifier → Safety Preview Modal
                                            ↓ (user clicks Proceed)
                        proceedWithInstall() → generate-batch-mcqs (parallel)
                                            ↓
                        startInstallation() → for each dep:
                            check-installed → skip if yes
                            install-dependency → exec commands
                            stateManager.logInstallation()
                                            ↓
                        Complete Modal → runVerification()
                            verify-installation → stateManager.updatePackageAfterVerification()
                                            ↓
                        Show results (Step 4)
```

---

## 5. Edge Cases & Failure Modes

### 5.1 — Will Definitely Break

| Scenario | What Happens | Root Cause |
|----------|-------------|------------|
| User saves API key via modal, then searches | `GeminiInstaller`, `ErrorAnalyzer`, `Uninstaller` still use the old (undefined) key. API calls fail. | Instances created once at startup, never refreshed |
| User clicks "Uninstall" from Package Manager view | `ReferenceError: systemInfo is not defined` at electron-main.js line 415 | Variable `systemInfo` not in scope — should be `systemDetector.getSystemInfo()` |
| User has Chocolatey v2+ | `choco list --local-only` is deprecated and may fail | Deprecated flag |
| App built and shipped | API key is bundled in `.env` inside the executable | `.env` in build files list |

### 5.2 — Will Likely Break

| Scenario | What Happens | Root Cause |
|----------|-------------|------------|
| User's sudo password contains `'` | Shell injection: command breaks or executes unintended code | No escaping in password interpolation |
| Gemini returns malformed JSON | `JSON.parse` throws, user sees generic error | No retry, limited cleaning |
| Network goes down mid-install | `exec` command hangs (no timeout) → app unresponsive | No timeout on child_process.exec |
| User installs 100+ packages over time | State file grows large, `writeFileSync` blocks main process | No history pruning, sync write |
| Winget not accepting source agreements | `winget search` hangs waiting for user input | No `--accept-source-agreements` on all winget commands |
| `gemini-2.5-flash-lite` model deprecated | MCQ generation fails, falls back to hardcoded questions | No model version fallback |

### 5.3 — Subtle Edge Cases

| Scenario | Impact |
|----------|--------|
| Two packages with same name but different case (e.g., "Python" from choco vs "python" from pip) | State manager overwrites — last one wins |
| Package needs PATH reload after install (e.g., Node.js via choco) | Verification runs in same shell session — `where node` may fail even though install succeeded. Needs new terminal session. |
| User selects packages from multiple stack options | All selections accumulate in `selectedDependencies` Set — correct behavior but potentially confusing |
| MCQ `correct` field returns as string "A" instead of index 0 | `normalizeCorrectIndex()` handles this — good defensive coding |
| User closes app during installation | `exec` child process continues running. State file may be in inconsistent state (install logged as success but verification never ran) |
| Package already installed but at different path | `where` finds it, verification succeeds, but install commands would install a second copy |

---

## 6. UI/UX Audit

### 6.1 — Architecture Issues

| Issue | Details |
|-------|---------|
| **Monolithic renderer.js** | 2,006 lines in a single file. All state, all UI logic, all event handlers. Hard to maintain. |
| **Dead component system** | `ui/js/` folder has `component-loader.js`, `step1-handler.js`, `step2-handler.js`, `app-state.js`, `ui-helpers.js` (466 lines total). None are loaded by `index.html`. The HTML loads `renderer.js` directly. This was likely a refactoring attempt that was abandoned. |
| **Dead `renderer-new.js`** | 113 lines, also not loaded anywhere. Another abandoned refactor. |
| **Inline styles everywhere** | Dozens of `style="..."` attributes in dynamically generated HTML. Inconsistent with the CSS file. |
| **innerHTML with user data** | Multiple XSS vectors (see Security section). Should use `textContent` or DOM APIs. |

### 6.2 — Functional Issues

| Issue | Details |
|-------|---------|
| Welcome modal auto-closes after 3 seconds | User may not have finished reading. If API key modal shows, welcome is hidden — but the timeout still fires, doing nothing (benign). |
| `refreshEnvironment()` has a typo | Line 353: `refreshBtn.textConent = originalText` — missing 't' in `textContent`. The button text never resets after failure. |
| `installSearchedPackage()` calls `analyze-request` to install | But `analyze-request` returns analysis JSON, not an installation result. The function checks `result.success` which is never set by `analyze-request`. This entire flow is broken — clicking "Install" on a search result does nothing useful. |
| Progress bar animation is fake | `animateProgressBar()` increments width randomly up to 90%. It never reaches 100% and isn't tied to actual progress. |
| Terminal output not routed to UI in all cases | `ipcRenderer.on('terminal-output')` listener is commented out ("No terminal output listener needed anymore") but `mainWindow.webContents.send('terminal-output')` is still called from main process. These messages go nowhere. |
| Quiz auto-advances every 15 seconds | If user is reading, the question disappears. There's a "Next" button on answer, but the timer runs simultaneously. |

### 6.3 — Missing Features (Claimed but not implemented)

| Feature | Status |
|---------|--------|
| Chatbot ("Ask Quest GPT") | UI placeholder exists with "Coming Soon" badge. Input is disabled. |
| Project Scanner | Placeholder module, not wired up |
| Dark/light theme toggle | CSS appears dark-only |
| Export to clipboard | Only file export exists |

---

## 7. Dependency & Build Audit

### 7.1 — Package.json Dependencies

**Declared production dependencies (2):**
- `@google/generative-ai: ^0.24.1`
- `dotenv: ^17.2.3`

**Declared dev dependencies (2):**
- `electron: ^28.3.3`
- `electron-builder: ^24.9.1`

**Undeclared but used:**
- `chalk` — used in `installer.js` (`const chalk = require('chalk')`). Works because it's installed as a transitive dependency of electron-builder. **Will break if chalk is removed from electron-builder's deps.**

**Unused declared:** None — both production deps are used.

### 7.2 — Build Configuration

| Setting | Value | Concern |
|---------|-------|---------|
| `asar: false` | App is not packaged in ASAR archive | Source code is fully readable in installed app. Anyone can read/modify all JS files. |
| `requestedExecutionLevel: requireAdministrator` | Windows build requests admin on launch | This is heavy-handed — not all operations need admin. User is forced to UAC prompt every launch. |
| `node_modules` in build files | All 264 modules shipped | Massive app size. Could be optimized with webpack/rollup. |
| No code signing | N/A | App will trigger Windows SmartScreen warning |

### 7.3 — Version Concerns

- Electron 28.3.3 (released Jan 2024) — **2 years old**. Multiple security patches since then.
- `@google/generative-ai ^0.24.1` — the Gemini SDK has evolved significantly. Features like system instructions, structured output, etc. are available in newer versions.

---

## 8. Performance Metrics

### 8.1 — Startup Cost

1. `loadApiKey()` — sync file read (fast)
2. `SystemDetector.getSystemInfo()` — runs `where choco`, `where winget`, `where scoop`, `net session` — **4 synchronous exec calls** blocking the main process. ~500ms-2s total.
3. `initializeEnvironment()` — async, runs `winget list` (30s timeout). Good — doesn't block window creation.

**Total startup time:** Window appears in ~1-2s, environment scan runs in background.

### 8.2 — Per-Request Cost

1. `analyze-request` → Gemini API call with ~1,000-line prompt. **Input token estimate: 3,000-5,000 tokens.** Response: ~200-500 tokens. At Gemini 2.5 Flash pricing, this is cheap per request but adds up.
2. `generate-batch-mcqs` → Second Gemini API call. ~200 token prompt, ~500 token response.
3. Each `check-installed` → synchronous `execSync` with 5s timeout per package.
4. Each `install-dependency` → `exec` with no timeout. Duration depends entirely on the package.

### 8.3 — Memory

- Electron base: ~100-150MB
- No memory leaks detected in code review (no unbounded listeners, intervals are cleared)
- `questionInterval` is properly cleared in multiple places — good

---

## 9. Limitations & Honest Assessment

### What This App CANNOT Do

1. **Cannot guarantee Gemini returns correct commands.** The entire app depends on LLM output quality. If Gemini hallucinates a package name (`choco install nonexistent-package -y`), the install fails with a confusing error.

2. **Cannot handle packages that need interactive input.** MySQL, PostgreSQL, etc. often prompt for passwords/configuration during install. The `exec()` call will hang.

3. **Cannot guarantee verification accuracy.** Verifying `python -c "import pandas"` confirms the import works, but doesn't confirm the right version was installed. `where python` confirms Python exists but not that the newly installed version is on PATH.

4. **Cannot recover from partial installations.** If `choco install nodejs -y` installs Node but npm fails to register, the state shows "installed" but npm doesn't work.

5. **Cannot handle packages that need system restart.** Some Windows packages (Visual Studio, .NET SDK) need a restart to complete. The app will verify immediately and report failure.

6. **Cannot work offline.** Every search requires Gemini API. No local package database or cached results.

7. **Cannot install on non-admin Windows sessions properly.** The build requests admin, but if the user somehow runs without it, choco/winget system installs will fail. pip/npm may work.

8. **Cannot scale.** The monolithic renderer.js, lack of testing, and tight coupling between UI and IPC make adding features risky.

### What This App Does Well

1. **Cross-platform command generation** — The Gemini prompt is extremely thorough with platform-specific package mappings. The `normalizeCommandsForSystem()` filter is a good safety net.

2. **Progressive disclosure** — The 4-step wizard (Search → Select → Install/Learn → Done) is a clean UX pattern.

3. **Safety preview** — Showing users what commands will run before execution, with risk classification, is excellent practice.

4. **State persistence** — Remembering installed packages across sessions and showing skip/update badges is genuinely useful.

5. **Fallback handling** — MCQ generation, error analysis, and uninstall all have fallback paths when AI fails.

6. **Educational quiz** — Running MCQs during installation is a novel approach to making the wait productive.

---

## 10. Risk Matrix

| Risk | Probability | Impact | Priority |
|------|------------|--------|----------|
| API key abuse (shipped in build) | Certain | High (key revoked, app breaks) | P0 |
| `execute-uninstall` crash (undefined systemInfo) | Certain | Medium (feature broken) | P0 |
| Stale API key after save-api-key | High | High (all AI features break) | P0 |
| XSS via innerHTML + nodeIntegration | Medium | Critical (RCE possible) | P1 |
| Shell injection via sudo password | Low-Medium | Critical | P1 |
| chalk dependency vanishing | Medium | Medium (installer.js crashes) | P1 |
| Wrong package manager detected | Medium | High (wrong commands generated) | P1 |
| No command timeout (app hangs) | Medium | Medium | P2 |
| installSearchedPackage broken flow | Certain | Low (feature doesn't work) | P2 |
| Winget parsing inconsistency | Medium | Low (wrong package names) | P3 |

---

## 11. Recommendations

### Must Fix (P0)

1. **Remove API keys from repo and build.** Use `.env.example` with placeholder. Remove `.env` from package.json build files. Add `.env` to `.gitignore`.
2. **Fix `systemInfo` ReferenceError** in `execute-uninstall` — replace with `systemDetector.getSystemInfo()`.
3. **Recreate AI module instances** when API key is saved, or pass the key dynamically.

### Should Fix (P1)

4. **Enable `contextIsolation: true`** and use `contextBridge.exposeInMainWorld()` for IPC.
5. **Sanitize all user input** before inserting into DOM. Use `textContent` or a template sanitizer.
6. **Escape sudo password** in shell commands, or use `spawn` with `stdin.write()` instead.
7. **Add `chalk` to package.json** production dependencies.
8. **Fix package manager detection** — return `null` or `'none'` instead of defaulting when not found. Show user a setup guide.

### Should Improve (P2)

9. Add timeouts to all `exec()` calls.
10. Add retry logic with exponential backoff for Gemini API calls.
11. Fix fake progress bar to reflect actual status.
12. Wire up terminal output from main process to renderer.
13. Fix `installSearchedPackage()` to actually install (not just analyze).
14. Delete dead code: `renderer-new.js`, `ui/js/` folder, `project-scanner.js`, `logo-provider.js`.

### Nice to Have (P3)

15. Split `renderer.js` into modules.
16. Add automated tests.
17. Update Electron to latest LTS.
18. Use Gemini system instructions instead of cramming everything in the user prompt.
19. Add offline package database fallback.
20. Implement the chatbot.

---

*End of audit. Every finding in this report was derived from reading the actual source code, not documentation.*
