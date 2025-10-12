const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import existing modules
const SystemDetector = require('./src/system-detector');
const GeminiInstaller = require('./src/gemini-installer');
const Installer = require('./src/installer');
const Verifier = require('./src/verifier');

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

// Detect system
ipcMain.handle('detect-system', async () => {
  return systemDetector.getSystemInfo();
});

// Analyze request
ipcMain.handle('analyze-request', async (event, userRequest, systemInfo) => {
  return await geminiInstaller.analyzeRequest(userRequest, systemInfo);
});

// Check if installed
ipcMain.handle('check-installed', async (event, dependency) => {
  return await verifier.verifyInstallation(dependency);
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

