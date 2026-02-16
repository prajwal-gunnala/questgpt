const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

/**
 * Gemini Installer Module
 * Uses Gemini AI to analyze installation requests and return structured data
 */

class GeminiInstaller {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // Separate model for MCQ generation using same model
    this.genAI_MCQ = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GEMINI_MCQ_API_KEY);
    this.mcqModel = this.genAI_MCQ.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  }

  /**
   * Remove markdown code fences if present and return a clean JSON string.
   */
  cleanJsonText(text) {
    let cleaned = String(text ?? '').trim();
    cleaned = cleaned.replace(/^```json\n?/gm, '');
    cleaned = cleaned.replace(/^```\n?/gm, '');
    cleaned = cleaned.replace(/\n?```$/gm, '');
    return cleaned.trim();
  }

  /**
   * Parse a model response as JSON (generic).
   */
  parseJson(text) {
    const cleaned = this.cleanJsonText(text);
    try {
      return JSON.parse(cleaned);
    } catch (error) {
      throw new Error(
        `Failed to parse Gemini JSON: ${error.message}\nResponse: ${String(text).substring(0, 200)}`
      );
    }
  }

  /**
   * Create structured prompt for Gemini
   */
  createPrompt(userRequest, systemInfo) {
    // Detect OS type
    const osType = systemInfo.os.toLowerCase();
    const isWindows = osType.includes('win');
    const isMac = osType.includes('darwin') || osType.includes('mac');
    const isLinux = !isWindows && !isMac;
    const platform = isWindows ? 'WINDOWS' : isMac ? 'macOS' : 'LINUX';
    
    return `Package installation expert. Return ONLY valid JSON.

PLATFORM: ${platform} | PM: ${systemInfo.packageManager}
REQUEST: "${userRequest}"

${isWindows ? `WINDOWS RULES:
- NO sudo (doesn't exist on Windows)
- NO apt/yum/dnf/pacman/brew
- Use: winget install <PackageID> OR choco install <pkg> -y OR pip install <pkg>
- Verify: <cmd> --version

WINGET IDs (use: winget install <ID>):
Git→Git.Git | Python→Python.Python.3.12 | Node→OpenJS.NodeJS | VSCode→Microsoft.VisualStudioCode
Docker→Docker.DockerDesktop | PostgreSQL→PostgreSQL.PostgreSQL | MySQL→Oracle.MySQL
fd→sharkdp.fd | rg→BurntSushi.ripgrep.MSVC | bat→sharkdp.bat | dust→Bootandy.Dust | fzf→junegunn.fzf
Go→GoLang.Go | Rust→Rustlang.Rustup | Java→Microsoft.OpenJDK.17

HARDCODED (return EXACTLY these commands):
- dust: winget install Bootandy.Dust

CHOCO packages: git, nodejs, python, docker-desktop, postgresql, mysql, mongodb, redis, vim, neovim

Python libs: pip install <pkg> (pandas, numpy, requests, flask, django, etc.)
npm globals: npm install -g <pkg>` : isMac ? `macOS RULES:
- Use: brew install <pkg> OR brew install --cask <app> OR pip3 install <pkg>
- Verify: <cmd> --version

BREW packages: git, node, python@3, go, rust, postgresql, mysql, mongodb-community, redis, docker(--cask)
Python libs: pip3 install <pkg>` : `LINUX RULES (${systemInfo.packageManager}):
- Use: sudo ${systemInfo.packageManager} install -y <pkg> (apt/yum/dnf) OR sudo pacman -S <pkg> --noconfirm
- Python libs: Use system pkg (python3-pandas, NOT pip)
- Verify: <cmd> --version`}

JSON FORMAT:
{
  "type": "single",
  "analysis": "Brief explanation",
  "dependencies": [{
    "name": "Display Name",
    "display_name": "${isWindows ? 'Package.ID or choco-name' : 'package-name'}",
    "description": "What it does",
    "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/{name}/{name}-original.svg",
    "category": "system-package|python-library|cli-tool",
    "install_commands": ["${isWindows ? 'winget install Package.ID' : isMac ? 'brew install pkg' : 'sudo apt install -y pkg'}"],
    "verify_command": "cmd --version",
    "expected_pattern": "version pattern",
    "priority": 1
  }]
}

For stacks (multiple options): type="stack", add stack_options array with name/description/logo_url/dependencies.

LOGOS: Use https://cdn.jsdelivr.net/gh/devicons/devicon/icons/{name}/{name}-original.svg
(python, nodejs, docker, git, postgresql, mysql, react, mongodb, redis, nginx, rust, go)

Return ONLY valid JSON. No markdown.`;
  }

  detectPlatform(systemInfo = {}) {
    const osType = String(systemInfo.os || '').toLowerCase();
    if (osType.includes('win')) return 'windows';
    if (osType.includes('darwin') || osType.includes('mac')) return 'mac';
    if (osType.includes('linux')) return 'linux';

    if (process.platform === 'win32') return 'windows';
    if (process.platform === 'darwin') return 'mac';
    return 'linux';
  }

  getPrimaryPackageManager(systemInfo = {}) {
    return String(systemInfo.packageManager || '').toLowerCase();
  }

  isCommandForLinuxManager(cmdLower, packageManager) {
    if (packageManager === 'apt' || packageManager === 'apt-get') {
      return /\bapt(-get)?\b/.test(cmdLower);
    }
    if (packageManager === 'yum') return /\byum\b/.test(cmdLower);
    if (packageManager === 'dnf') return /\bdnf\b/.test(cmdLower);
    if (packageManager === 'pacman') return /\bpacman\b/.test(cmdLower);
    if (packageManager === 'zypper') return /\bzypper\b/.test(cmdLower);
    if (packageManager === 'snap') return /\bsnap\b/.test(cmdLower);
    return false;
  }

  classifyCommandPlatform(cmdLower) {
    if (/\b(choco|winget|scoop)\b/.test(cmdLower)) return 'windows';
    if (/\bbrew\b/.test(cmdLower)) return 'mac';
    if (/\b(apt|apt-get|yum|dnf|pacman|zypper|snap)\b/.test(cmdLower) || /\bsudo\b/.test(cmdLower)) return 'linux';
    return 'generic';
  }

  normalizeCommandsForSystem(commands, systemInfo) {
    const platform = this.detectPlatform(systemInfo);
    const packageManager = this.getPrimaryPackageManager(systemInfo);
    const uniqueCommands = Array.from(new Set((commands || []).filter(Boolean).map(c => String(c).trim()))).filter(Boolean);

    const genericAllowed = (cmdLower) => (
      /\b(pip3?|python(?:3)?\s+-m\s+pip)\b/.test(cmdLower) ||
      /\b(npm|npx|pnpm|yarn)\b/.test(cmdLower)
    );

    const platformCompatible = uniqueCommands.filter((cmd) => {
      const cmdLower = cmd.toLowerCase();
      const cmdPlatform = this.classifyCommandPlatform(cmdLower);

      if (platform === 'windows') {
        if (cmdPlatform === 'linux' || cmdPlatform === 'mac') return false;
        return true;
      }
      if (platform === 'mac') {
        if (cmdPlatform === 'windows' || cmdPlatform === 'linux') return false;
        return true;
      }
      if (platform === 'linux') {
        if (cmdPlatform === 'windows' || cmdPlatform === 'mac') return false;
        return true;
      }
      return true;
    });

    if (platform === 'windows') {
      const pmSpecific = platformCompatible.filter((cmd) => {
        const cmdLower = cmd.toLowerCase();
        if (genericAllowed(cmdLower)) return true;
        if (packageManager === 'winget') return /\bwinget\b/.test(cmdLower);
        if (packageManager === 'choco') return /\bchoco\b/.test(cmdLower);
        if (packageManager === 'scoop') return /\bscoop\b/.test(cmdLower);
        return /\b(choco|winget|scoop)\b/.test(cmdLower);
      });
      return pmSpecific.length > 0 ? pmSpecific : platformCompatible;
    }

    if (platform === 'mac') {
      const pmSpecific = platformCompatible.filter((cmd) => {
        const cmdLower = cmd.toLowerCase();
        return genericAllowed(cmdLower) || /\bbrew\b/.test(cmdLower);
      });
      return pmSpecific.length > 0 ? pmSpecific : platformCompatible;
    }

    // Linux: keep only distro manager commands + generic language package tools.
    const pmSpecific = platformCompatible.filter((cmd) => {
      const cmdLower = cmd.toLowerCase();
      return genericAllowed(cmdLower) || this.isCommandForLinuxManager(cmdLower, packageManager);
    });
    return pmSpecific.length > 0 ? pmSpecific : platformCompatible;
  }

  normalizeAnalysisForSystem(data, systemInfo) {
    const cloned = JSON.parse(JSON.stringify(data));

    cloned.dependencies = (cloned.dependencies || []).map((dep) => {
      const normalizedCommands = this.normalizeCommandsForSystem(dep.install_commands || [], systemInfo);
      return {
        ...dep,
        install_commands: normalizedCommands
      };
    });

    const invalidDeps = cloned.dependencies.filter((dep) => !dep.install_commands || dep.install_commands.length === 0);
    if (invalidDeps.length > 0) {
      const names = invalidDeps.map(d => d.display_name || d.name).join(', ');
      throw new Error(`No compatible install command found for current system: ${names}`);
    }

    return cloned;
  }

  /**
   * Parse and validate the analysis response (dependency detection).
   */
  parseAnalyzeResponse(text, systemInfo = {}) {
    const data = this.parseJson(text);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response: expected JSON object');
    }
    if (!data.type || !Array.isArray(data.dependencies)) {
      throw new Error('Invalid analysis response structure (expected type + dependencies[])');
    }

    return this.normalizeAnalysisForSystem(data, systemInfo);
  }

  /**
   * Parse and validate MCQ response.
   */
  parseMcqResponse(text) {
    const data = this.parseJson(text);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid MCQ response: expected JSON object');
    }
    if (!Array.isArray(data.questions)) {
      throw new Error('Invalid MCQ response structure (expected questions[])');
    }
    return data;
  }

  /**
   * Analyze installation request
   */
  async analyzeRequest(userRequest, systemInfo) {
    try {
      const prompt = this.createPrompt(userRequest, systemInfo);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseAnalyzeResponse(text, systemInfo);
    } catch (error) {
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * Get installation plan for a dependency
   */
  async getInstallationPlan(dependency, systemInfo) {
    const prompt = `Create installation commands for ${dependency} on ${systemInfo.os} with ${systemInfo.packageManager}.

Return ONLY JSON:
{
  "name": "${dependency}",
  "install_commands": ["command1", "command2"],
  "verify_command": "verification command",
  "expected_pattern": "regex pattern"
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseJson(text);
    } catch (error) {
      throw new Error(`Failed to get installation plan: ${error.message}`);
    }
  }

  /**
   * Generate MCQs separately to avoid overloading main analysis
   * This is called AFTER dependencies are selected
  * Uses Gemini 2.5 Flash-Lite for faster, cheaper question generation
   */
  async generateMCQs(dependencies) {
    // Generate exactly 5 questions total (simple and fast)
    const totalQuestions = 5;
    
    const prompt = `Generate exactly 5 simple, beginner-friendly multiple-choice questions about these technologies:

${dependencies.map((dep, i) => `${i + 1}. ${dep.name} - ${dep.description}`).join('\n')}

Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "dependency": "PostgreSQL",
      "question": "What is PostgreSQL primarily used for?",
      "options": ["Database management", "Image editing", "Video streaming", "Gaming"],
      "correct": 0,
      "explanation": "PostgreSQL is a powerful, open-source relational database system."
    }
  ]
}

CRITICAL RULES:
- Generate EXACTLY 5 questions total
- Make questions simple and beginner-friendly
- Each question should test basic understanding
- Options must be clearly different (no ambiguity)
- Correct answer index must be 0-3
- Keep explanations brief (1-2 sentences max)
- Return ONLY the JSON object, no markdown code blocks
- Include ALL 5 questions in response`;

    try {
      // Use the MCQ model (Gemini 2.5 Flash-Lite) - fast and cheap
      const result = await this.mcqModel.generateContent(prompt, {
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        }
      });
      const response = await result.response;
      const text = response.text();
      
      return this.parseMcqResponse(text);
    } catch (error) {
      throw new Error(`Failed to generate MCQs: ${error.message}`);
    }
  }
}

module.exports = GeminiInstaller;
