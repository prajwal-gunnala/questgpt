const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

/**
 * Gemini Installer Module
 * Uses Gemini AI to analyze installation requests and return structured data
 */

class GeminiInstaller {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Separate model for MCQ generation using Gemini 2.5 Flash Lite
    this.genAI_MCQ = new GoogleGenerativeAI(process.env.GEMINI_MCQ_API_KEY);
    this.mcqModel = this.genAI_MCQ.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  }

  /**
   * Create structured prompt for Gemini
   */
  createPrompt(userRequest, systemInfo) {
    return `You are a Linux package installation expert. Analyze the user's request and return ONLY a valid JSON response.

USER REQUEST: "${userRequest}"

SYSTEM INFO:
- OS: ${systemInfo.os}
- Distribution: ${systemInfo.distro || 'unknown'}
- Package Manager: ${systemInfo.packageManager}
- Architecture: ${systemInfo.specs.arch}

TASK: Return a JSON object with installation details.

OUTPUT FORMAT (return ONLY valid JSON, no markdown, no explanations):

For SINGLE dependency:
{
  "type": "single",
  "analysis": "Brief explanation",
  "dependencies": [
    {
      "name": "Pandas",
      "display_name": "pandas",
      "description": "Python data analysis library",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pandas/pandas-original.svg",
      "category": "python-library",
      "install_commands": ["sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pandas"],
      "verify_command": "python3 -c 'import pandas'",
      "expected_pattern": "",
      "priority": 1
    }
  ]
}

For STACK (multiple options - user needs to choose):
{
  "type": "stack",
  "analysis": "Brief explanation of what was requested",
  "stack_options": [
    {
      "name": "MERN Stack",
      "description": "MongoDB, Express, React, Node.js",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg",
      "dependencies": ["MongoDB", "Node.js", "React"]
    },
    {
      "name": "MEAN Stack",
      "description": "MongoDB, Express, Angular, Node.js",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angularjs/angularjs-original.svg",
      "dependencies": ["MongoDB", "Node.js", "Angular"]
    },
    {
      "name": "Django + React",
      "description": "Django backend with React frontend",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/django/django-plain.svg",
      "dependencies": ["Python", "Django", "Node.js", "React"]
    }
  ],
  "dependencies": [
    {
      "name": "MongoDB",
      "display_name": "mongodb",
      "description": "NoSQL document database",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg",
      "category": "database",
      "install_commands": ["sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mongodb"],
      "verify_command": "mongod --version",
      "expected_pattern": "db version",
      "priority": 1
    },
    {
      "name": "Node.js",
      "display_name": "nodejs",
      "description": "JavaScript runtime for building servers",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg",
      "category": "runtime",
      "install_commands": ["sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs npm"],
      "verify_command": "node --version",
      "expected_pattern": "v",
      "priority": 1
    },
    {
      "name": "React",
      "display_name": "react",
      "description": "Frontend JavaScript library (installed via npm)",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
      "category": "framework",
      "install_commands": ["npm install -g create-react-app"],
      "verify_command": "npm list -g create-react-app --depth=0",
      "expected_pattern": "create-react-app@",
      "priority": 2
    },
    {
      "name": "Python",
      "display_name": "python3",
      "description": "Python programming language",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
      "category": "runtime",
      "install_commands": ["sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-pip"],
      "verify_command": "python3 --version",
      "expected_pattern": "Python 3",
      "priority": 1
    },
    {
      "name": "Django",
      "display_name": "django",
      "description": "Python web framework",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/django/django-plain.svg",
      "category": "framework",
      "install_commands": ["sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3-django"],
      "verify_command": "python3 -c 'import django; print(django.VERSION)'",
      "expected_pattern": "",
      "priority": 2
    },
    {
      "name": "Angular",
      "display_name": "angular",
      "description": "Frontend TypeScript framework",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angularjs/angularjs-original.svg",
      "category": "framework",
      "install_commands": ["npm install -g @angular/cli"],
      "verify_command": "ng version",
      "expected_pattern": "Angular CLI",
      "priority": 2
    }
  ]
}

RULES - MUST FOLLOW BASED ON DETECTED SYSTEM INFO:

0. **Logo URLs** - IMPORTANT:
   - ALWAYS provide "logo_url" field with actual CDN logo URL
   - Use DevIcons CDN: https://cdn.jsdelivr.net/gh/devicons/devicon/icons/{name}/{name}-original.svg
   - Common logos:
     * Python: https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg
     * Node.js: https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg
     * Docker: https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg
     * Git: https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg
     * PostgreSQL: https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg
     * MySQL: https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg
     * React: https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg
     * MongoDB: https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg
     * Redis: https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg
     * Nginx: https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nginx/nginx-original.svg
   - For Python libraries (pandas, numpy, etc), use Python logo
   - If logo not found, use a placeholder or generic icon

1. **Python Libraries** (pandas, numpy, matplotlib, requests, flask, django, etc.):
   - CURRENT SYSTEM: Package Manager = "${systemInfo.packageManager}"
   - If apt/apt-get (Debian/Ubuntu): "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3-<package>"
     * Package names: pandas → python3-pandas, numpy → python3-numpy, etc.
   - If yum (RHEL/CentOS): "sudo yum install -y python3-<package>"
     * Package names: pandas → python3-pandas, numpy → python3-numpy, etc.
   - If dnf (Fedora): "sudo dnf install -y python3-<package>"
     * Package names: pandas → python3-pandas, numpy → python3-numpy, etc.
   - If pacman (Arch): "sudo pacman -S python-<package> --noconfirm"
     * Package names: pandas → python-pandas, numpy → python-numpy, etc.
   - If zypper (openSUSE): "sudo zypper install -y python3-<package>"
   - NEVER use pip for system-wide installation (blocked by PEP 668 on modern systems)
   - Verification: "python3 -c 'import <package>'" (use actual import name, not package name)

2. **System Packages** (git, docker, nodejs, postgresql, mysql, etc.):
   - CURRENT SYSTEM: Package Manager = "${systemInfo.packageManager}"
   - If apt/apt-get: "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y <package>"
   - If yum: "sudo yum install -y <package>"
   - If dnf: "sudo dnf install -y <package>"
   - If pacman: "sudo pacman -S <package> --noconfirm"
   - If zypper: "sudo zypper install -y <package>"
   - Verification: "<package> --version" or "which <package>"

3. **Stack Detection Rules** - When to use "stack" type:
   - User asks for: "full stack", "web dev stack", "MERN", "MEAN", "development environment"
   - User mentions multiple technologies: "python and nodejs", "django react", "backend frontend"
   - ALWAYS provide stack_options when multiple valid combinations exist
   - **ALWAYS include Git in every stack** - it's essential for all development
   - Each stack_option MUST have:
     * name: "MERN Stack", "MEAN Stack", etc.
     * description: Brief explanation of what's included
     * logo_url: Representative logo for that stack
     * dependencies: Array of dependency names (MUST match names in dependencies array)
     * MUST include "Git" in dependencies array for ALL stacks
   
   Examples of stack requests:
   - "full stack web dev" → Show MERN, MEAN, Django+React, Flask+Vue (ALL must include Git)
   - "data science" → Show pandas/numpy/matplotlib, scikit-learn stack (ALL must include Git)
   - "devops tools" → Show Docker+K8s, CI/CD tools (ALL must include Git)
   - "database" → Show PostgreSQL, MySQL, MongoDB options (ALL must include Git)
   
4. **Package Name Mapping** (translate user request to package manager name):
   - Docker: docker.io (apt), docker (yum/dnf/pacman)
   - Node.js: nodejs (apt/yum), node (some distros)
   - PostgreSQL: postgresql (apt), postgresql-server (yum/dnf)
   
5. **Command Format**:
   - ALWAYS use non-interactive flags (DEBIAN_FRONTEND=noninteractive, -y, --noconfirm)
   - NEVER run apt update, yum update, or any update commands
   - Use exact commands that work on the detected system

6. Return structure:
   - type: "single" (one package) or "stack" (multiple options to choose from)
   - For stack: MUST include stack_options array with at least 2-3 choices
   - dependencies: Complete list of ALL possible dependencies across all stacks
   - Logo URLs: ALWAYS provide for better UI
   - Return ONLY valid JSON, no markdown, no explanations

EXAMPLES:

EXAMPLE 1 - Python Library on Ubuntu (apt):
System: Ubuntu, Package Manager: apt-get
Request: "Install pandas"
Response:
{
  "type": "single",
  "analysis": "User wants pandas Python library",
  "dependencies": [{
    "name": "Pandas",
    "display_name": "pandas",
    "description": "Python data analysis library",
    "logo_key": "python",
    "category": "python-library",
    "install_commands": ["sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pandas"],
    "verify_command": "python3 -c 'import pandas'",
    "priority": 1
  }]
}

EXAMPLE 2 - Python Library on Arch (pacman):
System: Arch Linux, Package Manager: pacman
Request: "Install numpy"
Response:
{
  "type": "single",
  "analysis": "User wants numpy Python library",
  "dependencies": [{
    "name": "NumPy",
    "display_name": "numpy",
    "description": "Python scientific computing library",
    "logo_key": "python",
    "category": "python-library",
    "install_commands": ["sudo pacman -S python-numpy --noconfirm"],
    "verify_command": "python3 -c 'import numpy'",
    "priority": 1
  }]
}

EXAMPLE 3 - Full Stack on Ubuntu (apt):
System: Ubuntu, Package Manager: apt-get
Request: "full stack web dev"
Response:
{
  "type": "stack",
  "analysis": "User wants a full stack web development environment",
  "dependencies": [
    {
      "name": "Python",
      "display_name": "python3",
      "description": "Python programming language",
      "logo_key": "python",
      "category": "system-package",
      "install_commands": ["sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-pip"],
      "verify_command": "python3 --version",
      "expected_pattern": "Python 3",
      "priority": 1
    },
    {
      "name": "Node.js",
      "display_name": "nodejs",
      "description": "JavaScript runtime",
      "logo_key": "nodejs",
      "category": "system-package",
      "install_commands": ["sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs npm"],
      "verify_command": "node --version",
      "expected_pattern": "v",
      "priority": 2
    },
    {
      "name": "Git",
      "display_name": "git",
      "description": "Version control system",
      "logo_key": "git",
      "category": "system-package",
      "install_commands": ["sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git"],
      "verify_command": "git --version",
      "expected_pattern": "git version",
      "priority": 3
    },
    {
      "name": "PostgreSQL",
      "display_name": "postgresql",
      "description": "Relational database",
      "logo_key": "postgresql",
      "category": "system-package",
      "install_commands": ["sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib"],
      "verify_command": "psql --version",
      "expected_pattern": "psql",
      "priority": 4
    }
  ],
  "stack_options": [
    {
      "name": "Python Full Stack",
      "description": "Python based full stack development environment",
      "dependencies": ["Git", "Python", "PostgreSQL"]
    },
    {
      "name": "MERN Stack",
      "description": "MongoDB, Express, React, Node.js",
      "dependencies": ["Git", "Node.js"]
    },
    {
      "name": "Full Stack (All)",
      "description": "Complete development environment with all tools",
      "dependencies": ["Git", "Python", "Node.js", "PostgreSQL"]
    }
  ]
}

Now analyze: "${userRequest}"`;
  }

  /**
   * Parse and clean Gemini response
   */
  parseResponse(text) {
    try {
      // Remove markdown code blocks if present
      let cleaned = text.trim();
      cleaned = cleaned.replace(/^```json\n?/gm, '');
      cleaned = cleaned.replace(/^```\n?/gm, '');
      cleaned = cleaned.replace(/\n?```$/gm, '');
      cleaned = cleaned.trim();

      // Parse JSON
      const data = JSON.parse(cleaned);

      // Validate structure
      if (!data.type || !data.dependencies) {
        throw new Error('Invalid response structure');
      }

      return data;
    } catch (error) {
      throw new Error(`Failed to parse Gemini response: ${error.message}\nResponse: ${text.substring(0, 200)}`);
    }
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

      return this.parseResponse(text);
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
      
      return this.parseResponse(text);
    } catch (error) {
      throw new Error(`Failed to get installation plan: ${error.message}`);
    }
  }

  /**
   * Generate MCQs separately to avoid overloading main analysis
   * This is called AFTER dependencies are selected
   * Uses Gemini 2.0 Flash Lite for faster, cheaper question generation
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
      // Use the MCQ model (Gemini 2.0 Flash Lite) - fast and cheap
      const result = await this.mcqModel.generateContent(prompt, {
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        }
      });
      const response = await result.response;
      const text = response.text();
      
      return this.parseResponse(text);
    } catch (error) {
      throw new Error(`Failed to generate MCQs: ${error.message}`);
    }
  }
}

module.exports = GeminiInstaller;
