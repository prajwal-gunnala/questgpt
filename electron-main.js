const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file (silent mode)
require('dotenv').config({
  path: path.join(__dirname, '.env'),
  silent: true
});

// Try to load API key from config.json if .env doesn't have it
function loadApiKey() {
  // First, check if .env has a valid key
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_api_key_here') {
    return;
  }
  
  // Try to load from config.json
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.GEMINI_API_KEY && config.GEMINI_API_KEY !== 'your_api_key_here') {
        process.env.GEMINI_API_KEY = config.GEMINI_API_KEY;
      }
    } catch (error) {
      console.error('Error reading config.json:', error);
    }
  }
}

loadApiKey();

// Import existing modules
const SystemDetector = require('./src/system-detector');
const GeminiInstaller = require('./src/gemini-installer');
const Installer = require('./src/installer');
const Verifier = require('./src/verifier');

// Stateful environment management modules
const StateManager = require('./src/state-manager');
const EnvironmentScanner = require('./src/environment-scanner');
const DecisionEngine = require('./src/decision-engine');
const UpdateDetector = require('./src/update-detector');
const Exporter = require('./src/exporter');

// New modules
const CommandClassifier = require('./src/command-classifier');
const ErrorAnalyzer = require('./src/error-analyzer');
const Uninstaller = require('./src/uninstaller');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('ui/index.html');
  // DevTools removed for production
  
  // Validate API key on startup
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_api_key_here') {
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'API Key Not Configured',
      'GEMINI_API_KEY is not configured in the .env file.\n\n' +
      'Please create or update the .env file in the application directory with:\n' +
      'GEMINI_API_KEY=your_actual_api_key_here\n\n' +
      'Get your API key from: https://makersuite.google.com/app/apikey'
    );
  }
}

// Initialization moved above

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
const systemDetector = new SystemDetector();
let geminiInstaller = new GeminiInstaller();
const installer = new Installer();
const verifier = new Verifier();
const commandClassifier = new CommandClassifier();
let errorAnalyzer = new ErrorAnalyzer();
let uninstaller = new Uninstaller();

// Stateful environment management instances
const stateManager = new StateManager();
let environmentScanner = null;
let decisionEngine = null;
let updateDetector = null;
let exporter = null;

// Initialize environment on app start
async function initializeEnvironment() {
  console.log('[Main] Initializing environment...');
  const systemInfo = systemDetector.getSystemInfo();
  
  // Create module instances
  environmentScanner = new EnvironmentScanner(systemInfo);
  decisionEngine = new DecisionEngine(stateManager);
  updateDetector = new UpdateDetector(systemInfo);
  exporter = new Exporter(stateManager);
  
  // Try to load existing state
  const existingState = await stateManager.loadState();
  
  if (!existingState) {
    // No state found - scan and initialize
    console.log('[Main] No existing state - performing initial scan...');
    const installedPackages = await environmentScanner.scanInstalledPackages();
    await stateManager.initializeState(systemInfo, installedPackages);
  } else {
    console.log('[Main] Loaded existing state from disk');
  }
  
  console.log('[Main] Environment initialized successfully');
}

// Call initialization when app is ready
app.whenReady().then(() => {
  createWindow();
  initializeEnvironment().catch(err => console.error('[Main] Environment init failed:', err));
});

// Detect system
ipcMain.handle('detect-system', async () => {
  const sysInfo = systemDetector.getSystemInfo();
  return sysInfo;
});

// Classify commands by risk level before installation
ipcMain.handle('classify-commands', async (event, dependencies) => {
  return commandClassifier.classifyAll(dependencies);
});

// Analyze installation error with AI
ipcMain.handle('analyze-error', async (event, errorContext) => {
  return await errorAnalyzer.analyzeError(errorContext);
});

// Check for environment conflicts
ipcMain.handle('check-conflicts', async (event, dependencies) => {
  const conflicts = [];
  const names = dependencies.map(d => (d.name || '').toLowerCase());

  // Python 2 vs Python 3
  if (names.includes('python') || names.includes('python2') || names.includes('python3')) {
    try {
      const py2 = await verifier.verifyInstallation({ name: 'python2', verify_command: 'python2 --version' });
      const py3 = await verifier.verifyInstallation({ name: 'python3', verify_command: 'python3 --version' });
      if (py2.success && py3.success) {
        conflicts.push({
          type: 'warning',
          title: 'Python 2 & 3 coexist',
          message: 'Both Python 2 and Python 3 are installed. Make sure your PATH points to the correct version.',
          deps: ['python2', 'python3']
        });
      }
    } catch (e) { /* ignore */ }
  }

  // Node.js via nvm vs system apt
  if (names.includes('nodejs') || names.includes('node.js') || names.includes('node')) {
    try {
      const nvmNode = await verifier.verifyInstallation({ name: 'nvm-node', verify_command: 'bash -c "source ~/.nvm/nvm.sh 2>/dev/null && nvm current"' });
      const aptNode = await verifier.verifyInstallation({ name: 'apt-node', verify_command: '/usr/bin/node --version' });
      if (nvmNode.success && aptNode.success) {
        conflicts.push({
          type: 'warning',
          title: 'Multiple Node.js installations',
          message: 'Node.js found via both NVM and system package manager. This can cause PATH conflicts.',
          deps: ['nodejs']
        });
      }
    } catch (e) { /* ignore */ }
  }

  return conflicts;
});

// Generate uninstall plan
ipcMain.handle('generate-uninstall-plan', async (event, installedPackages, systemInfo) => {
  return await uninstaller.generateUninstallPlan(installedPackages, systemInfo);
});

// 
// Analyze request
ipcMain.handle('analyze-request', async (event, userRequest, systemInfo) => {
  try {
    // Validate API key before making the request
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_api_key_here') {
      throw new Error('GEMINI_API_KEY is not configured. Please set your API key in the .env file.');
    }
    
    const result = await geminiInstaller.analyzeRequest(userRequest, systemInfo);
    return result;
  } catch (error) {
    console.error('Error in analyze-request:', error);
    // Return a structured error that the UI can display
    return {
      error: true,
      message: error.message || 'Failed to analyze request',
      details: error.toString()
    };
  }
});

// Check if installed
ipcMain.handle('check-installed', async (event, dependency) => {
  return await verifier.verifyInstallation(dependency);
});

// Get API key status
ipcMain.handle('get-api-key-status', async () => {
  const hasKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_api_key_here');
  return {
    configured: hasKey,
    key: hasKey ? '***' + process.env.GEMINI_API_KEY.slice(-4) : null
  };
});

// Save API key to config.json
ipcMain.handle('save-api-key', async (event, apiKey) => {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const config = { GEMINI_API_KEY: apiKey };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    process.env.GEMINI_API_KEY = apiKey;
    
    // Recreate AI module instances with the new key
    geminiInstaller = new GeminiInstaller();
    errorAnalyzer = new ErrorAnalyzer();
    uninstaller = new Uninstaller();
    console.log('[Main] API key saved and AI modules reinitialized');
    
    return { success: true };
  } catch (error) {
    console.error('Error saving API key:', error);
    return { success: false, error: error.message };
  }
});


// Install dependency with progress
ipcMain.handle('install-dependency', async (event, dependency, sudoPassword) => {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    // Windows doesn't need sudo, check for Administrator instead
    const isWindows = process.platform === 'win32';
    const actualPassword = isWindows ? null : sudoPassword;
    
    // Check for Windows Administrator privileges
    if (isWindows) {
      const sysInfo = systemDetector.getSystemInfo();
      if (!sysInfo.isSudo) {
        // Warn but continue - some commands (pip, npm) might still work
        mainWindow.webContents.send('terminal-output', { 
          type: 'warning', 
          text: '⚠️ WARNING: Not running as Administrator. Some installations may fail.' 
        });
        mainWindow.webContents.send('terminal-output', { 
          type: 'info', 
          text: '💡 TIP: Right-click the app → "Run as Administrator" for best results.' 
        });
      }
    }
    
    // Send terminal output to renderer
    installer.installDependency(dependency, (progress) => {
      if (progress.type === 'output') {
        mainWindow.webContents.send('terminal-output', progress.data);
      } else if (progress.type === 'password-required' && !isWindows) {
        // Only request password on Linux/Mac
        mainWindow.webContents.send('sudo-password-required');
      }
    }, actualPassword).then(async result => {
      // Log installation to state manager
      const duration = (Date.now() - startTime) / 1000;
      await stateManager.logInstallation(
        dependency.name,
        'install',
        result.success ? 'success' : 'failed',
        duration,
        result.error || null
      );
      
      resolve(result);
    }).catch(async error => {
      // Log failed installation
      const duration = (Date.now() - startTime) / 1000;
      await stateManager.logInstallation(
        dependency.name,
        'install',
        'failed',
        duration,
        error.message
      );
      
      console.error('[Install] Installation failed:', error.message);
      reject(error);
    });
  });
});

// Handle sudo password submission
ipcMain.handle('submit-sudo-password', async (event, password) => {
  return { success: true, password };
});

// Verify installation
ipcMain.handle('verify-installation', async (event, dependency) => {
  const result = await verifier.verifyInstallation(dependency);
  
  // Update state manager with verification result
  if (result.success && result.version) {
    await stateManager.updatePackageAfterVerification(
      dependency.name, 
      result.version,
      dependency.package_id
    );
  }
  
  return result;
});

// Scan environment for installed packages
ipcMain.handle('scan-environment', async () => {
  if (!environmentScanner) {
    return { error: 'Environment scanner not initialized' };
  }
  
  const systemInfo = systemDetector.getSystemInfo();
  const packages = await environmentScanner.scanInstalledPackages();
  await stateManager.initializeState(systemInfo, packages);
  return { packages, count: packages.length };
});

// Get installation statistics
ipcMain.handle('get-stats', async () => {
  return stateManager.getStats();
});

// Check decision for package (install/skip/update/repair)
ipcMain.handle('check-decision', async (event, packageName) => {
  if (!decisionEngine) {
    return { action: 'INSTALL', reason: 'Decision engine not ready' };
  }
  return decisionEngine.evaluatePackage(packageName);
});

// Get decision summary for all packages
ipcMain.handle('get-decision-summary', async (event, packageNames) => {
  if (!decisionEngine) {
    return { total: packageNames.length, to_install: packageNames.length };
  }
  return decisionEngine.getSummary(packageNames);
});

// Check for available updates
ipcMain.handle('check-updates', async () => {
  if (!updateDetector) {
    return [];
  }
  
  const updates = await updateDetector.checkForUpdates();
  
  // Update state manager with update availability
  for (const update of updates) {
    if (update.name && update.available) {
      await stateManager.markUpdateAvailable(update.name, update.available);
    }
  }
  
  return updates;
});

// Export environment context
ipcMain.handle('export-context', async (event, format = 'json') => {
  if (!exporter) {
    return { error: 'Exporter not initialized' };
  }
  
  const filePath = await exporter.saveToFile(format);
  return { success: true, filePath };
});

// Get all installed packages
ipcMain.handle('get-all-packages', async () => {
  return stateManager.getAllPackages();
});

// Uninstall a package (proper flow with Gemini + verification)
ipcMain.handle('execute-uninstall', async (event, packageInfo, sudoPassword = null) => {
  const startTime = Date.now();
  
  try {
    console.log(`[Main] Starting uninstall for: ${packageInfo.name}`);
    
    // Step 1: Generate uninstall plan via Gemini
    const sysInfo = systemDetector.getSystemInfo();
    const uninstallPlan = await uninstaller.generateUninstallPlan(
      [{ 
        name: packageInfo.name, 
        display_name: packageInfo.display_name || packageInfo.name,
        package_id: packageInfo.package_id || packageInfo.name
      }], 
      sysInfo
    );
    
    if (!uninstallPlan || uninstallPlan.length === 0) {
      throw new Error('Failed to generate uninstall plan');
    }
    
    const plan = uninstallPlan[0];
    console.log(`[Main] Generated ${plan.uninstall_commands.length} uninstall commands`);
    
    // Step 2: Execute uninstall commands
    const isWindows = process.platform === 'win32';
    const actualPassword = isWindows ? null : sudoPassword;
    
    const executeResults = await installer.executeCommands(
      plan.uninstall_commands,
      null, // Don't need progress callback for package manager
      actualPassword
    );
    
    // Check if execution succeeded
    const executionFailed = executeResults.some(r => !r.success);
    if (executionFailed) {
      const errors = executeResults.filter(r => !r.success).map(r => r.error).join('; ');
      throw new Error(`Uninstall commands failed: ${errors}`);
    }
    
    console.log(`[Main] Commands executed successfully, verifying removal...`);
    
    // Step 3: Verify package was actually removed
    const verifyResult = await verifier.verifyInstallation({
      name: packageInfo.name,
      display_name: packageInfo.display_name,
      package_id: packageInfo.package_id
    });
    
    // If verification shows it's still installed, uninstall failed
    if (verifyResult.success && verifyResult.installed) {
      throw new Error('Package still appears to be installed after uninstall');
    }
    
    console.log(`[Main] Verified package removed, updating state...`);
    
    // Step 4: Remove from state manager
    stateManager.removePackage(packageInfo.name);
    
    // Step 5: Log the uninstall
    const duration = (Date.now() - startTime) / 1000;
    await stateManager.logInstallation(
      packageInfo.name,
      'uninstall',
      'success',
      duration,
      null
    );
    
    return { 
      success: true, 
      message: `${packageInfo.display_name || packageInfo.name} uninstalled successfully`,
      commands_executed: plan.uninstall_commands
    };
    
  } catch (error) {
    console.error(`[Main] Uninstall failed:`, error);
    
    // Log failed uninstall
    const duration = (Date.now() - startTime) / 1000;
    await stateManager.logInstallation(
      packageInfo.name,
      'uninstall',
      'failed',
      duration,
      error.message
    );
    
    return { 
      success: false, 
      error: error.message,
      details: error.toString()
    };
  }
});

// Search for packages in winget repository
ipcMain.handle('winget-search', async (event, query) => {
  try {
    console.log(`[Main] Searching winget for: ${query}`);
    
    // Windows: Use winget search
    const isWindows = process.platform === 'win32';
    
    if (!isWindows) {
      return []; // Winget only available on Windows
    }
    
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      
      // Execute winget search with query — disable interactivity for clean output
      exec(`winget search "${query}" --accept-source-agreements --disable-interactivity`, { timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error && !stdout) {
          console.error(`[Main] Winget search error:`, error);
          resolve([]); // Return empty array instead of rejecting
          return;
        }
        
        try {
          const packages = parseWingetSearchOutput(stdout);
          console.log(`[Main] Found ${packages.length} packages`);
          resolve(packages);
        } catch (parseError) {
          console.error(`[Main] Failed to parse winget output:`, parseError);
          resolve([]);
        }
      });
    });
    
  } catch (error) {
    console.error(`[Main] Winget search failed:`, error);
    return [];
  }
});

// Parse winget search output — handles Name, Id, Version, [Match], Source columns
function parseWingetSearchOutput(output) {
  const lines = output.split('\n');
  const packages = [];
  
  // Find the header line (contains "Name", "Id", "Version")
  // Note: LINE[0] often has progress-bar garbage before the header text,
  // so we locate the "Name" offset and strip everything before it.
  let headerIndex = -1;
  let headerOffset = 0;
  for (let i = 0; i < lines.length; i++) {
    const namePos = lines[i].indexOf('Name');
    if (namePos >= 0 && lines[i].indexOf('Id') > namePos && lines[i].includes('Version')) {
      headerIndex = i;
      headerOffset = namePos;
      break;
    }
  }
  
  if (headerIndex === -1) {
    console.log('[Main] Could not find winget output header');
    return [];
  }
  
  // Get clean header — column positions here match the data lines directly
  const cleanHeader = lines[headerIndex].substring(headerOffset);
  
  const nameIdx = 0;
  const idIdx = cleanHeader.indexOf('Id');
  const versionIdx = cleanHeader.indexOf('Version');
  const matchIdx = cleanHeader.indexOf('Match');   // may be -1
  const sourceIdx = cleanHeader.indexOf('Source');  // may be -1
  
  if (idIdx < 0 || versionIdx < 0) {
    console.log('[Main] Could not determine column positions');
    return [];
  }
  
  // Version ends at Match or Source (whichever exists first after Version)
  let versionEnd = -1;
  if (matchIdx > versionIdx) versionEnd = matchIdx;
  else if (sourceIdx > versionIdx) versionEnd = sourceIdx;
  
  // Find the separator line (------) to know where data starts
  let dataStartIdx = headerIndex + 1;
  for (let i = headerIndex + 1; i < Math.min(headerIndex + 4, lines.length); i++) {
    if (lines[i].match(/^-{5,}/)) {
      dataStartIdx = i + 1;
      break;
    }
  }
  
  // Parse each data line
  for (let i = dataStartIdx; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty, short, footer, or truncation lines
    if (!line.trim() || line.trim().length < 10) continue;
    if (line.match(/^\d+ package/i) || line.includes('additional entries')) continue;
    
    try {
      const name = line.substring(nameIdx, idIdx).trim();
      const id = line.substring(idIdx, versionIdx).trim();
      
      let version = 'Unknown';
      if (versionEnd > 0 && line.length >= versionEnd) {
        version = line.substring(versionIdx, versionEnd).trim() || 'Unknown';
      } else if (versionEnd > 0) {
        version = line.substring(versionIdx).trim().split(/\s+/)[0] || 'Unknown';
      } else {
        version = line.substring(versionIdx).trim().split(/\s+/)[0] || 'Unknown';
      }
      
      let source = 'winget';
      if (sourceIdx > 0 && line.length > sourceIdx) {
        const s = line.substring(sourceIdx).trim();
        if (s) source = s;
      }
      
      // Skip if essential fields are missing
      if (!name || !id) continue;
      
      packages.push({
        name: name.replace(/\u2026/g, '...'),
        id: id.replace(/\u2026/g, '...'),
        version,
        source
      });
    } catch (parseError) {
      console.log(`[Main] Failed to parse line ${i}: ${line}`);
      continue;
    }
  }
  
  return packages;
}

// Generate MCQs for a dependency (using MCQ model - Gemini 2.0 Flash Lite)
ipcMain.handle('generate-mcqs', async (event, dependency) => {
  const prompt = `Generate EXACTLY 1 simple multiple choice question about ${dependency.display_name || dependency.name}.

Keep it SIMPLE and PRACTICAL - something a beginner would understand.

Return ONLY valid JSON in this exact format:
{
  "name": "${dependency.display_name || dependency.name}",
  "description": "What it does in simple words (1-2 short sentences, casual tone)",
  "questions": [
    {
      "question": "Simple practical question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0
    }
  ]
}

Rules:
- Only 1 question per dependency
- Keep question simple and practical
- Options should be clear and beginner-friendly
- Description should be conversational and brief
- No technical jargon unless absolutely necessary`;

  try {
    // Use MCQ model (Gemini 2.0 Flash Lite) for question generation
    const result = await geminiInstaller.mcqModel.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();
    
    // Clean response
    text = text.replace(/^```json\n?/gm, '').replace(/^```\n?/gm, '').replace(/\n?```$/gm, '').trim();
    
    return JSON.parse(text);
  } catch (error) {
    return {
      name: dependency.display_name || dependency.name,
      description: "A useful tool for your projects.",
      questions: [{
        question: `What is ${dependency.display_name || dependency.name} mainly used for?`,
        options: ["General development", "Something else", "Not sure", "Depends on use case"],
        correct: 0
      }]
    };
  }
});

// Generate MCQs in batch (separate API call to avoid overload)
ipcMain.handle('generate-batch-mcqs', async (event, dependencies) => {
  try {
    const result = await geminiInstaller.generateMCQs(dependencies);
    console.log('✓ Batch MCQ generation successful:', result.questions.length, 'questions');
    return result;
  } catch (error) {
    console.error('✗ Batch MCQ generation failed:', error.message);
    
    // Fallback: Generate exactly 5 simple default questions
    const questions = [];
    const totalQuestions = 5;
    
    const questionTemplates = [
      {
        q: (name) => `What is ${name} primarily used for?`,
        opts: (cat) => [`${cat || 'Development'} tool`, "Gaming", "Social media", "Photo editing"]
      },
      {
        q: (name) => `Which category does ${name} belong to?`,
        opts: (cat) => [cat || "Development", "Entertainment", "Design", "Communication"]
      },
      {
        q: (name) => `${name} is commonly used by:`,
        opts: () => ["Developers", "Gamers", "Artists", "Writers"]
      },
      {
        q: (name) => `Why would you install ${name}?`,
        opts: () => ["To build projects", "For fun", "Required by law", "Random choice"]
      },
      {
        q: (name) => `${name} helps with:`,
        opts: (cat) => ["Software development", "Playing games", "Watching movies", "Online shopping"]
      }
    ];
    
    for (let i = 0; i < totalQuestions; i++) {
      const dep = dependencies[i % dependencies.length];
      const template = questionTemplates[i % questionTemplates.length];
      questions.push({
        dependency: dep.name,
        question: template.q(dep.display_name || dep.name),
        options: template.opts(dep.category),
        correct: 0,
        explanation: dep.description || `${dep.name} is a useful development tool.`
      });
    }
    
    console.log(`Using fallback questions: ${questions.length} total`);
    return { questions };
  }
});

