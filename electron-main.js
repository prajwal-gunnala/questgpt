const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
require('dotenv').config({
  path: path.join(__dirname, '.env')
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
      contextIsolation: false
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

app.whenReady().then(createWindow);

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
const geminiInstaller = new GeminiInstaller();
const installer = new Installer();
const verifier = new Verifier();
const commandClassifier = new CommandClassifier();
const errorAnalyzer = new ErrorAnalyzer();
const uninstaller = new Uninstaller();

// Detect system
ipcMain.handle('detect-system', async () => {
  return systemDetector.getSystemInfo();
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
    return await geminiInstaller.analyzeRequest(userRequest, systemInfo);
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
    return { success: true };
  } catch (error) {
    console.error('Error saving API key:', error);
    return { success: false, error: error.message };
  }
});


// Install dependency with progress
ipcMain.handle('install-dependency', async (event, dependency, sudoPassword) => {
  return new Promise((resolve, reject) => {
    // Send terminal output to renderer
    installer.installDependency(dependency, (progress) => {
      if (progress.type === 'output') {
        mainWindow.webContents.send('terminal-output', progress.data);
      } else if (progress.type === 'password-required') {
        mainWindow.webContents.send('sudo-password-required');
      }
    }, sudoPassword).then(result => {
      resolve(result);
    }).catch(error => {
      mainWindow.webContents.send('terminal-output', { type: 'error', text: error.message });
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
  return await verifier.verifyInstallation(dependency);
});

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

