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
    
    return `You are a cross-platform package installation expert. Analyze the user's request and return ONLY a valid JSON response.

🔴 CRITICAL: THE USER IS ON ${isWindows ? 'WINDOWS' : isMac ? 'macOS' : 'LINUX'} - YOU MUST USE ${isWindows ? 'WINDOWS' : isMac ? 'macOS' : 'LINUX'} COMMANDS ONLY! 🔴

USER REQUEST: "${userRequest}"

SYSTEM INFO:
- OS: ${systemInfo.os}
- Distribution: ${systemInfo.distro || 'unknown'}
- Package Manager: ${systemInfo.packageManager}
- Architecture: ${systemInfo.specs.arch}
- Platform Type: ${isWindows ? 'WINDOWS' : isMac ? 'macOS' : 'LINUX'}

⚠️ MANDATORY REQUIREMENTS:
${isWindows ? `
- MUST use Windows commands (choco, winget, pip, npm)
- ABSOLUTELY NEVER use sudo - Windows doesn't use sudo, it uses Administrator privileges
- NEVER use apt-get, yum, dnf, pacman, brew, or any Linux/Mac commands
- Use "choco install <package> -y" or "winget install <package>" or "pip install <package>"
- For system packages: use choco or winget (user must run app as Administrator)
- For Python packages: use "pip install <package>" (no sudo, no admin needed)
- For npm packages: use "npm install -g <package>"
- Verification: use "where <command>" not "which"
- REMINDER: NO sudo command exists on Windows by default
` : isMac ? `
- MUST use macOS commands (brew, pip3, npm)
- Use "brew install <package>" for system packages
- Use "pip3 install <package>" for Python libraries
- Verification: use "which <command>"
` : `
- MUST use Linux commands for ${systemInfo.packageManager}
- Use "sudo ${systemInfo.packageManager} install -y <package>" for system packages
- Verification: use "which <command>"
`}

TASK: Return a JSON object with installation details FOR ${isWindows ? 'WINDOWS' : isMac ? 'macOS' : 'LINUX'} ONLY.

OUTPUT FORMAT (return ONLY valid JSON, no markdown, no explanations):

For SINGLE dependency on ${isWindows ? 'WINDOWS' : isMac ? 'macOS' : 'LINUX'}:
{
  "type": "single",
  "analysis": "Brief explanation",
  "dependencies": [
    {
      "name": "Example Package",
      "display_name": "example",
      "description": "Example description",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
      "category": "python-library",
      "install_commands": [${isWindows ? '"pip install example"' : isMac ? '"pip3 install example"' : '"sudo apt-get install -y python3-example"'}],
      "verify_command": ${isWindows ? '"python -c \\"import example\\""' : '"python3 -c \'import example\'"'},
      "expected_pattern": "",
      "priority": 1
    }
  ]
}

For STACK (multiple options - user needs to choose) on ${isWindows ? 'WINDOWS' : isMac ? 'macOS' : 'LINUX'}:
{
  "type": "stack",
  "analysis": "Brief explanation of what was requested",
  "stack_options": [
    {
      "name": "Example Stack Option 1",
      "description": "Description of stack 1",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg",
      "dependencies": ["Dependency1", "Dependency2"]
    }
  ],
  "dependencies": [
    {
      "name": "Example Dependency",
      "display_name": "example",
      "description": "Description",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg",
      "category": "runtime",
      "install_commands": [${isWindows ? '"choco install example -y"' : isMac ? '"brew install example"' : '"sudo apt-get install -y example"'}],
      "verify_command": ${isWindows ? '"where example"' : '"which example"'},
      "expected_pattern": "",
      "priority": 1
    }
  ]
}

⚠️ REMEMBER: You are generating commands for ${isWindows ? 'WINDOWS' : isMac ? 'macOS' : 'LINUX'} - DO NOT use commands from other platforms!
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

0. **PACKAGE VALIDATION** - 🚨 CRITICAL RULE 🚨:
   - ONLY suggest packages from the "Package Name Mapping" lists above
   - NEVER invent or guess package names - they MUST be in the verified list
   - If user asks for a package NOT in the list:
     * Suggest the closest alternative that IS in the list
     * Or clearly state the package is not available for this system
   - Example: If user asks for "notepad++" on macOS, suggest "sublime-text" or "visual-studio-code"
   - Example: If user asks for "apt-get" on Windows, explain it's Linux-only and suggest "choco" or "winget"
   - VERIFY every package name against the mapping list before including it
   - Better to return fewer packages that WORK than many that DON'T EXIST
   
1. **Logo URLs** - IMPORTANT:
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

2. **PLATFORM-SPECIFIC INSTALLATION COMMANDS**:
   
   CURRENT SYSTEM: ${isWindows ? 'WINDOWS' : isMac ? 'macOS' : 'LINUX'}
   Package Manager: "${systemInfo.packageManager}"
   
   ${isWindows ? `
   === WINDOWS COMMANDS ===
   
   **Python Libraries** (pandas, numpy, matplotlib, etc.):
   - Use pip: "pip install <package>"
   - Verification: "python -c \\"import <package>\\""
   - Examples:
     * pandas: "pip install pandas"
     * numpy: "pip install numpy"
     * matplotlib: "pip install matplotlib"
   
   **System Packages**:
   - If choco (Chocolatey): "choco install <package> -y"
     * Examples: "choco install git -y", "choco install nodejs -y", "choco install python -y"
   - If winget: "winget install <package>"
     * Examples: "winget install Git.Git", "winget install Python.Python.3", "winget install OpenJS.NodeJS"
   - If scoop: "scoop install <package>"
     * Examples: "scoop install git", "scoop install python", "scoop install nodejs"
   
   **Verification Commands**:
   - Use: "<package> --version" or "where <package>"
   - Python: "python --version"
   - Node: "node --version"
   - Git: "git --version"
   
   **Package Name Mapping** (Windows):
   ⚠️ CRITICAL: ONLY suggest packages from this VERIFIED list!
   ⚠️ Winget uses specific Package IDs (Publisher.Package format)
   ⚠️ If a package is NOT in this list, suggest the closest alternative or say it's not available
   
   **Programming Languages & Runtimes:**
   - Python: python (choco/scoop), Python.Python.3.12 (winget) → Command: python
   - Node.js: nodejs (choco), node (scoop), OpenJS.NodeJS (winget) → Command: node
   - Java (OpenJDK): openjdk (choco), openjdk (scoop), Microsoft.OpenJDK.17 (winget) → Command: java
   - Java (Oracle): ojdkbuild (choco), Oracle.JDK.21 (winget) → Command: java
   - Go: golang (choco), go (scoop), GoLang.Go (winget) → Command: go
   - Rust: rust (choco/scoop), Rustlang.Rustup (winget) → Command: cargo
   - Ruby: ruby (choco/scoop), RubyInstallerTeam.Ruby (winget) → Command: ruby
   - PHP: php (choco/scoop), XAMPP.XAMPP (winget for full stack) → Command: php
   - .NET SDK: dotnet-sdk (choco), dotnet (scoop), Microsoft.DotNet.SDK.8 (winget) → Command: dotnet
   - R: r.project (choco), R.R (winget) → Command: R
   - Julia: julia (choco/scoop), Julialang.Julia (winget) → Command: julia
   - Perl: strawberryperl (choco), StrawberryPerl.StrawberryPerl (winget) → Command: perl
   - Lua: lua (choco/scoop), DEVCOM.Lua (winget) → Command: lua
   
   **Version Control & Git:**
   - Git: git (choco/scoop), Git.Git (winget) → Command: git
   - GitHub CLI: gh (choco/scoop), GitHub.cli (winget) → Command: gh
   - GitLab CLI: glab (scoop), GLab.GLab (winget) → Command: glab
   - Mercurial: hg (choco/scoop), TortoiseHg.TortoiseHg (winget) → Command: hg
   - SVN: svn (choco), TortoiseSVN.TortoiseSVN (winget) → Command: svn
   
   **Code Editors & IDEs:**
   - VSCode: vscode (choco), vscode (scoop), Microsoft.VisualStudioCode (winget) → Command: code
   - Visual Studio: visualstudio2022community (choco), Microsoft.VisualStudio.2022.Community (winget) → Command: devenv
   - Sublime Text: sublimetext3 (choco), sublimetext (scoop), SublimeHQ.SublimeText.4 (winget) → Command: subl
   - Notepad++: notepadplusplus (choco), notepadplusplus (scoop), Notepad++.Notepad++ (winget) → Command: notepad++
   - Atom: atom (choco/scoop), GitHub.Atom (winget) → Command: atom
   - Vim: vim (choco/scoop), vim.vim (winget) → Command: vim
   - Neovim: neovim (choco/scoop), Neovim.Neovim (winget) → Command: nvim
   - IntelliJ IDEA: intellijidea-community (choco), JetBrains.IntelliJIDEA.Community (winget) → Command: idea
   - PyCharm: pycharm-community (choco), JetBrains.PyCharm.Community (winget) → Command: pycharm
   
   **Databases:**
   - PostgreSQL: postgresql (choco), postgresql (scoop), PostgreSQL.PostgreSQL.15 (winget) → Command: psql
   - MySQL: mysql (choco/scoop), Oracle.MySQL (winget) → Command: mysql
   - MongoDB: mongodb (choco), mongodb (scoop), MongoDB.Server (winget) → Command: mongod
   - Redis: redis (choco/scoop), Redis.Redis (winget) → Command: redis-server
   - MariaDB: mariadb (choco/scoop), MariaDB.Server (winget) → Command: mariadb
   - SQLite: sqlite (choco/scoop), SQLite.SQLite (winget) → Command: sqlite3
   - Microsoft SQL Server: sql-server-express (choco), Microsoft.SQLServer.2022.Express (winget) → Command: sqlcmd
   - CouchDB: couchdb (choco), Apache.CouchDB (winget) → Command: couchdb
   
   **Containers & Orchestration:**
   - Docker: docker-desktop (choco), docker (scoop), Docker.DockerDesktop (winget) → Command: docker
   - Kubernetes CLI: kubernetes-cli (choco), kubectl (scoop), Kubernetes.kubectl (winget) → Command: kubectl
   - Minikube: minikube (choco/scoop), Kubernetes.minikube (winget) → Command: minikube
   - Helm: kubernetes-helm (choco), helm (scoop), Helm.Helm (winget) → Command: helm
   - Podman: podman (scoop), RedHat.Podman (winget) → Command: podman
   
   **Build Tools & Package Managers:**
   - Maven: maven (choco/scoop), Apache.Maven (winget) → Command: mvn
   - Gradle: gradle (choco/scoop), Gradle.Gradle (winget) → Command: gradle
   - Make: make (choco/scoop), GnuWin32.Make (winget) → Command: make
   - CMake: cmake (choco/scoop), Kitware.CMake (winget) → Command: cmake
   - Ninja: ninja (choco/scoop), Ninja-build.Ninja (winget) → Command: ninja
   - Yarn: yarn (choco/scoop), Yarn.Yarn (winget) → Command: yarn
   - pnpm: pnpm (choco/scoop), pnpm.pnpm (winget) → Command: pnpm
   - Composer (PHP): composer (choco/scoop), Composer.Composer (winget) → Command: composer
   
   **Web Servers & Proxies:**
   - Nginx: nginx (choco/scoop), nginx.nginx (winget) → Command: nginx
   - Apache: apache-httpd (choco), apache (scoop), Apache.httpd (winget) → Command: httpd
   - Caddy: caddy (choco/scoop), Caddy.Caddy (winget) → Command: caddy
   
   **DevOps & Infrastructure:**
   - Terraform: terraform (choco/scoop), HashiCorp.Terraform (winget) → Command: terraform
   - Ansible: ansible (choco/scoop), Ansible.Ansible (winget) → Command: ansible
   - Vagrant: vagrant (choco/scoop), HashiCorp.Vagrant (winget) → Command: vagrant
   - Packer: packer (choco/scoop), HashiCorp.Packer (winget) → Command: packer
   - AWS CLI: awscli (choco/scoop), Amazon.AWSCLI (winget) → Command: aws
   - Azure CLI: azure-cli (choco/scoop), Microsoft.AzureCLI (winget) → Command: az
   - Google Cloud SDK: gcloudsdk (choco), Google.CloudSDK (winget) → Command: gcloud
   
   **CLI Tools:**
   - fd (find): fd (choco/scoop), sharkdp.fd (winget) → Command: fd
   - ripgrep (grep): ripgrep (choco/scoop), BurntSushi.ripgrep.MSVC (winget) → Command: rg
   - bat (cat): bat (choco/scoop), sharkdp.bat (winget) → Command: bat
   - exa (ls): exa (scoop), ogham.exa (winget) → Command: exa
   - fzf (fuzzy finder): fzf (choco/scoop), junegunn.fzf (winget) → Command: fzf
   - jq (JSON processor): jq (choco/scoop), jqlang.jq (winget) → Command: jq
   - yq (YAML processor): yq (choco/scoop), MikeFarah.yq (winget) → Command: yq
   - httpie (HTTP client): httpie (choco/scoop), httpie.cli (winget) → Command: http
   - curl: curl (choco/scoop), cURL.cURL (winget) → Command: curl
   - wget: wget (choco/scoop), GnuWin32.Wget (winget) → Command: wget
   - tree: tree (choco/scoop), GnuWin32.tree (winget) → Command: tree
   - htop: htop (scoop) → Command: htop
   - less: less (choco/scoop), jftuga.less (winget) → Command: less
   - grep: grep (choco/scoop), GnuWin32.grep (winget) → Command: grep
   - sed: sed (choco/scoop), GnuWin32.sed (winget) → Command: sed
   - awk: gawk (choco/scoop), GnuWin32.gawk (winget) → Command: awk
   - rsync: rsync (choco/scoop), RsyncProject.rsync (winget) → Command: rsync
   - zip: zip (choco/scoop), GnuWin32.Zip (winget) → Command: zip
   - 7zip: 7zip (choco), 7zip (scoop), 7zip.7zip (winget) → Command: 7z
   
   **Python Libraries (ALWAYS use pip, NOT package managers):**
   - pandas: pip install pandas → import pandas
   - numpy: pip install numpy → import numpy
   - matplotlib: pip install matplotlib → import matplotlib
   - requests: pip install requests → import requests
   - flask: pip install flask → import flask
   - django: pip install django → import django
   - fastapi: pip install fastapi → import fastapi
   - scipy: pip install scipy → import scipy
   - scikit-learn: pip install scikit-learn → import sklearn
   - tensorflow: pip install tensorflow → import tensorflow
   - pytorch: pip install torch → import torch
   - opencv-python: pip install opencv-python → import cv2
   - pillow: pip install pillow → import PIL
   - beautifulsoup4: pip install beautifulsoup4 → import bs4
   - selenium: pip install selenium → import selenium
   - pytest: pip install pytest → pytest command
   - black: pip install black → black command
   - pylint: pip install pylint → pylint command
   - jupyter: pip install jupyter → jupyter command
   
   **IMPORTANT FOR WINGET:**
   - ALWAYS use full Package ID (Publisher.Package format)
   - Verify command uses the actual command name, NOT the package ID
   - Example: Install "sharkdp.fd" but verify "fd --version"
   - Uninstall must use the same package ID as install
   
   **CRITICAL: display_name vs verify_command**
   - display_name: The package name used for installation/uninstallation
     * For winget: Use Package ID (e.g., "sharkdp.fd", "Git.Git")
     * For choco/scoop: Use package name (e.g., "fd", "git")
   - verify_command: The actual command to verify installation
     * ALWAYS use the command that will be available in PATH
     * Example: display_name="sharkdp.fd" → verify_command="fd --version"
     * Example: display_name="Git.Git" → verify_command="git --version"
     * Example: display_name="BurntSushi.ripgrep.MSVC" → verify_command="rg --version"
   ` : isMac ? `
   === macOS COMMANDS ===
   
   **Python Libraries** (pandas, numpy, matplotlib, etc.):
   - Use pip: "pip3 install <package>"
   - Verification: "python3 -c 'import <package>'"
   - Examples:
     * pandas: "pip3 install pandas"
     * numpy: "pip3 install numpy"
     * matplotlib: "pip3 install matplotlib"
   
   **System Packages** (Homebrew):
   - Install: "brew install <package>"
   - Verification: "<package> --version" or "which <package>"
   - Examples:
     * Git: "brew install git"
     * Node.js: "brew install node"
     * Python: "brew install python@3"
     * PostgreSQL: "brew install postgresql@15"
     * Docker: "brew install --cask docker"
   
   **Package Name Mapping** (macOS/Homebrew):
   ⚠️ CRITICAL: ONLY suggest packages from this VERIFIED list!
   ⚠️ Use --cask flag for GUI applications, regular install for CLI tools
   ⚠️ If a package is NOT in this list, suggest the closest alternative or say it's not available
   
   **Programming Languages & Runtimes:**
   - Python: python@3 or python@3.12 → Command: python3
   - Node.js: node → Command: node
   - Java: openjdk or openjdk@17 → Command: java
   - Go: go → Command: go
   - Rust: rust → Command: cargo
   - Ruby: ruby → Command: ruby
   - PHP: php → Command: php
   - .NET: dotnet → Command: dotnet
   - R: r → Command: R
   - Julia: julia → Command: julia
   - Perl: perl → Command: perl
   - Lua: lua → Command: lua
   
   **Version Control:**
   - Git: git → Command: git
   - GitHub CLI: gh → Command: gh
   - GitLab CLI: glab → Command: glab
   
   **Code Editors & IDEs:**
   - VSCode: visual-studio-code --cask → Command: code
   - Sublime Text: sublime-text --cask → Command: subl
   - Vim: vim → Command: vim
   - Neovim: neovim → Command: nvim
   - IntelliJ IDEA: intellij-idea-ce --cask → Command: idea
   - PyCharm: pycharm-ce --cask → Command: pycharm
   
   **Databases:**
   - PostgreSQL: postgresql@15 or postgresql → Command: psql
   - MySQL: mysql → Command: mysql
   - MongoDB: mongodb-community → Command: mongod
   - Redis: redis → Command: redis-server
   - MariaDB: mariadb → Command: mariadb
   - SQLite: sqlite → Command: sqlite3
   - CouchDB: couchdb → Command: couchdb
   
   **Containers & Orchestration:**
   - Docker: docker --cask → Command: docker
   - Kubernetes CLI: kubectl → Command: kubectl
   - Minikube: minikube → Command: minikube
   - Helm: helm → Command: helm
   - Podman: podman → Command: podman
   
   **Build Tools & Package Managers:**
   - Maven: maven → Command: mvn
   - Gradle: gradle → Command: gradle
   - Make: make → Command: make
   - CMake: cmake → Command: cmake
   - Ninja: ninja → Command: ninja
   - Yarn: yarn → Command: yarn
   - pnpm: pnpm → Command: pnpm
   - Composer: composer → Command: composer
   
   **Web Servers:**
   - Nginx: nginx → Command: nginx
   - Apache: httpd → Command: httpd
   - Caddy: caddy → Command: caddy
   
   **DevOps & Cloud:**
   - Terraform: terraform → Command: terraform
   - Ansible: ansible → Command: ansible
   - Vagrant: vagrant → Command: vagrant
   - Packer: packer → Command: packer
   - AWS CLI: awscli → Command: aws
   - Azure CLI: azure-cli → Command: az
   - Google Cloud SDK: google-cloud-sdk → Command: gcloud
   
   **CLI Tools:**
   - fd: fd → Command: fd
   - ripgrep: ripgrep → Command: rg
   - bat: bat → Command: bat
   - exa: exa → Command: exa
   - fzf: fzf → Command: fzf
   - jq: jq → Command: jq
   - yq: yq → Command: yq
   - httpie: httpie → Command: http
   - curl: curl → Command: curl
   - wget: wget → Command: wget
   - tree: tree → Command: tree
   - htop: htop → Command: htop
   
   **Python Libraries (ALWAYS use pip3, NOT brew):**
   - Use pip3 install <package> for ALL Python libraries
   - Examples: pandas, numpy, matplotlib, django, flask, requests, etc.
   ` : `
   === LINUX COMMANDS ===
   
   **Python Libraries** (pandas, numpy, matplotlib, requests, flask, django, etc.):
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

   **System Packages** (git, docker, nodejs, postgresql, mysql, etc.):
   - CURRENT SYSTEM: Package Manager = "${systemInfo.packageManager}"
   - If apt/apt-get: "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y <package>"
   - If yum: "sudo yum install -y <package>"
   - If dnf: "sudo dnf install -y <package>"
   - If pacman: "sudo pacman -S <package> --noconfirm"
   - If zypper: "sudo zypper install -y <package>"
   - Verification: "<package> --version" or "which <package>"
   
   **Package Name Mapping** (Linux):
   ⚠️ CRITICAL: ONLY suggest packages from this VERIFIED list!
   ⚠️ Package names vary by distro - use correct format for detected package manager
   ⚠️ If a package is NOT in this list, suggest the closest alternative or say it's not available
   
   **Programming Languages & Runtimes:**
   - Python: python3 python3-pip (apt/yum/dnf), python python-pip (pacman) → Command: python3
   - Node.js: nodejs npm (apt), nodejs (yum/dnf), nodejs npm (pacman) → Command: node
   - Java: default-jdk (apt), java-11-openjdk (yum/dnf), jdk-openjdk (pacman) → Command: java
   - Go: golang (apt/yum/dnf), go (pacman) → Command: go
   - Rust: rust-all (apt), rust cargo (yum/dnf/pacman) → Command: cargo
   - Ruby: ruby-full (apt), ruby (yum/dnf/pacman) → Command: ruby
   - PHP: php (apt/yum/dnf/pacman) → Command: php
   - .NET: dotnet-sdk-8.0 (apt/yum/dnf), dotnet-sdk (pacman) → Command: dotnet
   - R: r-base (apt), R (yum/dnf/pacman) → Command: R
   - Perl: perl (apt/yum/dnf/pacman) → Command: perl
   - Lua: lua5.4 (apt), lua (yum/dnf/pacman) → Command: lua
   
   **Version Control:**
   - Git: git (all) → Command: git
   - GitHub CLI: gh (requires repo setup on apt/yum/dnf), github-cli (pacman) → Command: gh
   
   **Code Editors:**
   - Vim: vim (all) → Command: vim
   - Neovim: neovim (all) → Command: nvim
   - Emacs: emacs (all) → Command: emacs
   
   **Databases:**
   - PostgreSQL: postgresql postgresql-contrib (apt), postgresql-server (yum/dnf), postgresql (pacman) → Command: psql
   - MySQL: mysql-server (apt/yum), mariadb (dnf/pacman) → Command: mysql
   - MongoDB: mongodb (apt requires repo), mongodb-org (yum/dnf), mongodb-bin (pacman) → Command: mongod
   - Redis: redis-server (apt), redis (yum/dnf/pacman) → Command: redis-server
   - MariaDB: mariadb-server (apt/yum/dnf), mariadb (pacman) → Command: mariadb
   - SQLite: sqlite3 (apt), sqlite (yum/dnf/pacman) → Command: sqlite3
   
   **Containers & Orchestration:**
   - Docker: docker.io (apt), docker (yum/dnf/pacman) → Command: docker
   - Kubernetes CLI: kubectl (requires repo setup) → Command: kubectl
   - Helm: helm (requires repo) → Command: helm
   - Podman: podman (apt/yum/dnf/pacman) → Command: podman
   
   **Build Tools:**
   - Maven: maven (all) → Command: mvn
   - Gradle: gradle (all) → Command: gradle
   - Make: build-essential (apt), make (yum/dnf/pacman) → Command: make
   - CMake: cmake (all) → Command: cmake
   
   **Web Servers:**
   - Nginx: nginx (all) → Command: nginx
   - Apache: apache2 (apt), httpd (yum/dnf/pacman) → Command: httpd or apache2
   
   **DevOps & Cloud:**
   - Terraform: terraform (requires HashiCorp repo) → Command: terraform
   - Ansible: ansible (all) → Command: ansible
   - AWS CLI: awscli (all) → Command: aws
   
   **CLI Tools:**
   - fd: fd-find (apt), fd (yum/dnf/pacman) → Command: fdfind or fd
   - ripgrep: ripgrep (all) → Command: rg
   - bat: bat (all) → Command: bat
   - fzf: fzf (all) → Command: fzf
   - jq: jq (all) → Command: jq
   - curl: curl (all) → Command: curl
   - wget: wget (all) → Command: wget
   - tree: tree (all) → Command: tree
   - htop: htop (all) → Command: htop
   
   **Python Libraries (Use system package manager, NOT pip):**
   - pandas: python3-pandas (apt/yum/dnf), python-pandas (pacman)
   - numpy: python3-numpy (apt/yum/dnf), python-numpy (pacman)
   - matplotlib: python3-matplotlib (apt/yum/dnf), python-matplotlib (pacman)
   - requests: python3-requests (apt/yum/dnf), python-requests (pacman)
   - flask: python3-flask (apt/yum/dnf), python-flask (pacman)
   - django: python3-django (apt/yum/dnf), python-django (pacman)
   - ** NEVER use pip install on Linux (blocked by PEP 668) **
   `}

3. **Command Format Rules**:
   ${isWindows ? `
   - Windows: Use forward slash (/) or no flags for package manager options
   - Chocolatey: Always add -y for non-interactive
   - Winget: Use exact package IDs (e.g., Git.Git, not just git)
   - PowerShell commands: Use appropriate syntax
   - NEVER run system updates (choco upgrade all, winget upgrade --all)
   ` : isMac ? `
   - macOS: Use brew install for CLI tools, brew install --cask for GUI apps
   - Always use non-interactive mode (brew install already does this)
   - NEVER run brew update or brew upgrade commands
   - Use python3 and pip3 (not python/pip) for Python commands
   ` : `
   - Linux: ALWAYS use non-interactive flags (DEBIAN_FRONTEND=noninteractive, -y, --noconfirm)
   - NEVER run apt update, yum update, or any update commands
   - Use exact commands that work on the detected system
   `}

4. **Stack Detection Rules** - When to use "stack" type:
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
   
5. **Return Structure**:
   - type: "single" (one package) or "stack" (multiple options to choose from)
   - For stack: MUST include stack_options array with at least 2-3 choices
   - dependencies: Complete list of ALL possible dependencies across all stacks
   - Logo URLs: ALWAYS provide for better UI
   - Return ONLY valid JSON, no markdown, no explanations

EXAMPLES FOR CURRENT PLATFORM (${isWindows ? 'WINDOWS' : isMac ? 'macOS' : 'LINUX'}):

${isWindows ? `
EXAMPLE 1 - Python Library on Windows (pip):
System: Windows, Package Manager: choco/winget
Request: "Install pandas"
Response:
{
  "type": "single",
  "analysis": "User wants pandas Python library",
  "dependencies": [{
    "name": "Pandas",
    "display_name": "pandas",
    "description": "Python data analysis library",
    "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
    "category": "python-library",
    "install_commands": ["pip install pandas"],
    "verify_command": "python -c \\"import pandas\\"",
    "priority": 1
  }]
}

EXAMPLE 2a - System Package on Windows (Chocolatey):
System: Windows, Package Manager: choco
Request: "Install Git"
Response:
{
  "type": "single",
  "analysis": "User wants Git version control",
  "dependencies": [{
    "name": "Git",
    "display_name": "git",
    "description": "Distributed version control system",
    "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg",
    "category": "system-package",
    "install_commands": ["choco install git -y"],
    "verify_command": "git --version",
    "expected_pattern": "git version",
    "priority": 1
  }]
}

EXAMPLE 2b - System Package on Windows (Winget):
System: Windows, Package Manager: winget
Request: "Install fd"
Response:
{
  "type": "single",
  "analysis": "User wants fd (fast find alternative)",
  "dependencies": [{
    "name": "fd",
    "display_name": "sharkdp.fd",
    "description": "Fast find alternative written in Rust",
    "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-plain.svg",
    "category": "cli-tool",
    "install_commands": ["winget install sharkdp.fd"],
    "verify_command": "fd --version",
    "expected_pattern": "fd",
    "priority": 1
  }]
}

EXAMPLE 2c - CLI Tool on Windows (Winget):
System: Windows, Package Manager: winget  
Request: "Install ripgrep"
Response:
{
  "type": "single",
  "analysis": "User wants ripgrep (fast grep alternative)",
  "dependencies": [{
    "name": "ripgrep",
    "display_name": "BurntSushi.ripgrep.MSVC",
    "description": "Fast recursive grep written in Rust",
    "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-plain.svg",
    "category": "cli-tool",
    "install_commands": ["winget install BurntSushi.ripgrep.MSVC"],
    "verify_command": "rg --version",
    "expected_pattern": "ripgrep",
    "priority": 1
  }]
}

EXAMPLE 2d - Multiple CLI Tools on Windows (Winget):
System: Windows, Package Manager: winget
Request: "Install bat and exa"
Response:
{
  "type": "single",
  "analysis": "User wants bat (cat alternative) and exa (ls alternative)",
  "dependencies": [
    {
      "name": "bat",
      "display_name": "sharkdp.bat",
      "description": "Cat clone with syntax highlighting",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-plain.svg",
      "category": "cli-tool",
      "install_commands": ["winget install sharkdp.bat"],
      "verify_command": "bat --version",
      "expected_pattern": "bat",
      "priority": 1
    },
    {
      "name": "exa",
      "display_name": "ogham.exa",
      "description": "Modern ls replacement",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-plain.svg",
      "category": "cli-tool",
      "install_commands": ["winget install ogham.exa"],
      "verify_command": "exa --version",
      "expected_pattern": "exa",
      "priority": 2
    }
  ]
}

EXAMPLE 3 - Full Stack on Windows:
System: Windows, Package Manager: choco
Request: "full stack web dev"
Response:
{
  "type": "stack",
  "analysis": "User wants a full stack web development environment",
  "stack_options": [
    {
      "name": "MERN Stack",
      "description": "MongoDB, Express, React, Node.js",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg",
      "dependencies": ["Git", "Node.js", "MongoDB"]
    },
    {
      "name": "Python Full Stack",
      "description": "Python with Django/Flask",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
      "dependencies": ["Git", "Python", "PostgreSQL"]
    }
  ],
  "dependencies": [
    {
      "name": "Git",
      "display_name": "git",
      "description": "Version control system",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg",
      "category": "system-package",
      "install_commands": ["choco install git -y"],
      "verify_command": "git --version",
      "expected_pattern": "git version",
      "priority": 1
    },
    {
      "name": "Node.js",
      "display_name": "nodejs",
      "description": "JavaScript runtime",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg",
      "category": "system-package",
      "install_commands": ["choco install nodejs -y"],
      "verify_command": "node --version",
      "expected_pattern": "v",
      "priority": 2
    },
    {
      "name": "Python",
      "display_name": "python",
      "description": "Python programming language",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
      "category": "system-package",
      "install_commands": ["choco install python -y"],
      "verify_command": "python --version",
      "expected_pattern": "Python 3",
      "priority": 3
    },
    {
      "name": "MongoDB",
      "display_name": "mongodb",
      "description": "NoSQL database",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg",
      "category": "database",
      "install_commands": ["choco install mongodb -y"],
      "verify_command": "mongod --version",
      "expected_pattern": "db version",
      "priority": 4
    },
    {
      "name": "PostgreSQL",
      "display_name": "postgresql",
      "description": "Relational database",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg",
      "category": "database",
      "install_commands": ["choco install postgresql -y"],
      "verify_command": "psql --version",
      "expected_pattern": "psql",
      "priority": 5
    }
  ]
}
` : isMac ? `
EXAMPLE 1 - Python Library on macOS (pip):
System: macOS, Package Manager: brew
Request: "Install pandas"
Response:
{
  "type": "single",
  "analysis": "User wants pandas Python library",
  "dependencies": [{
    "name": "Pandas",
    "display_name": "pandas",
    "description": "Python data analysis library",
    "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
    "category": "python-library",
    "install_commands": ["pip3 install pandas"],
    "verify_command": "python3 -c 'import pandas'",
    "priority": 1
  }]
}

EXAMPLE 2 - System Package on macOS (Homebrew):
System: macOS, Package Manager: brew
Request: "Install Git"
Response:
{
  "type": "single",
  "analysis": "User wants Git version control",
  "dependencies": [{
    "name": "Git",
    "display_name": "git",
    "description": "Distributed version control system",
    "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg",
    "category": "system-package",
    "install_commands": ["brew install git"],
    "verify_command": "git --version",
    "expected_pattern": "git version",
    "priority": 1
  }]
}

EXAMPLE 3 - Full Stack on macOS:
System: macOS, Package Manager: brew
Request: "full stack web dev"
Response:
{
  "type": "stack",
  "analysis": "User wants a full stack web development environment",
  "stack_options": [
    {
      "name": "MERN Stack",
      "description": "MongoDB, Express, React, Node.js",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg",
      "dependencies": ["Git", "Node.js", "MongoDB"]
    },
    {
      "name": "Python Full Stack",
      "description": "Python with Django/Flask",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
      "dependencies": ["Git", "Python", "PostgreSQL"]
    }
  ],
  "dependencies": [
    {
      "name": "Git",
      "display_name": "git",
      "description": "Version control system",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg",
      "category": "system-package",
      "install_commands": ["brew install git"],
      "verify_command": "git --version",
      "expected_pattern": "git version",
      "priority": 1
    },
    {
      "name": "Node.js",
      "display_name": "node",
      "description": "JavaScript runtime",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg",
      "category": "system-package",
      "install_commands": ["brew install node"],
      "verify_command": "node --version",
      "expected_pattern": "v",
      "priority": 2
    },
    {
      "name": "Python",
      "display_name": "python3",
      "description": "Python programming language",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
      "category": "system-package",
      "install_commands": ["brew install python@3"],
      "verify_command": "python3 --version",
      "expected_pattern": "Python 3",
      "priority": 3
    },
    {
      "name": "MongoDB",
      "display_name": "mongodb-community",
      "description": "NoSQL database",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg",
      "category": "database",
      "install_commands": ["brew tap mongodb/brew", "brew install mongodb-community"],
      "verify_command": "mongod --version",
      "expected_pattern": "db version",
      "priority": 4
    },
    {
      "name": "PostgreSQL",
      "display_name": "postgresql",
      "description": "Relational database",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg",
      "category": "database",
      "install_commands": ["brew install postgresql@15"],
      "verify_command": "psql --version",
      "expected_pattern": "psql",
      "priority": 5
    }
  ]
}
` : `
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
    "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
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
    "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
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
  "stack_options": [
    {
      "name": "Python Full Stack",
      "description": "Python based full stack development environment",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
      "dependencies": ["Git", "Python", "PostgreSQL"]
    },
    {
      "name": "MERN Stack",
      "description": "MongoDB, Express, React, Node.js",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg",
      "dependencies": ["Git", "Node.js"]
    },
    {
      "name": "Full Stack (All)",
      "description": "Complete development environment with all tools",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg",
      "dependencies": ["Git", "Python", "Node.js", "PostgreSQL"]
    }
  ],
  "dependencies": [
    {
      "name": "Python",
      "display_name": "python3",
      "description": "Python programming language",
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
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
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg",
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
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg",
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
      "logo_url": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg",
      "category": "system-package",
      "install_commands": ["sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib"],
      "verify_command": "psql --version",
      "expected_pattern": "psql",
      "priority": 4
    }
  ]
}
`}

CRITICAL REMINDERS:
🚨 MOST IMPORTANT: ONLY suggest packages from the verified Package Name Mapping lists above
- If a package is NOT in the mapping list, DON'T include it - suggest alternatives instead
- Every package name MUST match exactly what's in the mapping (check spelling, capitalization, format)
- For winget: Use Publisher.Package format (e.g., "Git.Git", "sharkdp.fd", "BurntSushi.ripgrep.MSVC")
- For choco/scoop: Use lowercase package names (e.g., "git", "fd", "ripgrep")
- For Python libraries: ALWAYS use pip/pip3, not system package managers on Windows/macOS
- For Linux Python: ALWAYS use system package manager (apt/yum/dnf/pacman), NEVER pip
- Detect platform: ${isWindows ? 'WINDOWS' : isMac ? 'macOS' : 'LINUX'}
- Use ONLY commands appropriate for this platform
- Return valid JSON only (no markdown, no code blocks)
- Include logo URLs for all dependencies
- For stacks, always include Git as a dependency
- VERIFY package names before responding - accuracy over quantity!

Now analyze this request for ${isWindows ? 'WINDOWS' : isMac ? 'macOS' : 'LINUX'}: "${userRequest}"`;
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
