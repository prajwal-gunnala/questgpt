/**
 * Uninstaller Module
 * Generates uninstall commands using Gemini AI and executes them safely.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class Uninstaller {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * Generate uninstall commands for installed packages using Gemini.
   * @param {Array<{ name: string, display_name: string, category: string }>} installedPackages
   * @param {object} systemInfo
   * @returns {Promise<Array<{ name: string, uninstall_commands: string[], warnings: string[] }>>}
   */
  async generateUninstallPlan(installedPackages, systemInfo) {
    const packageList = installedPackages.map(p => p.display_name || p.name).join(', ');
    
    // Detect platform
    const osType = systemInfo.os.toLowerCase();
    const isWindows = osType.includes('win');
    const isMac = osType.includes('darwin') || osType.includes('mac');
    const isLinux = !isWindows && !isMac;
    
    const prompt = `You are a cross-platform system administrator expert. Generate safe uninstall commands for these packages:

INSTALLED PACKAGES: ${packageList}

SYSTEM INFO:
- OS: ${systemInfo.os}
- Package Manager: ${systemInfo.packageManager}
- Platform Type: ${isWindows ? 'Windows' : isMac ? 'macOS' : 'Linux'}

Return ONLY valid JSON (no markdown, no explanations):
{
  "packages": [
    {
      "name": "package-name",
      "uninstall_commands": [
        ${isWindows ? '"choco uninstall package-name -y"' : isMac ? '"brew uninstall package-name"' : '"sudo apt-get remove -y package-name"'},
        ${isWindows ? '""' : isMac ? '"brew cleanup"' : '"sudo apt-get autoremove -y"'}
      ],
      "warnings": [
        "This will remove X but keep configuration files",
        ${isWindows ? '"Use choco uninstall with -n flag to skip auto-uninstall of dependencies"' : '"Run apt-get purge to remove config files too"'}
      ]
    }
  ]
}

PLATFORM-SPECIFIC RULES:

${isWindows ? `
=== WINDOWS UNINSTALL ===
- Chocolatey: "choco uninstall <package> -y"
- Winget: "winget uninstall <package-id>" (use exact Package ID)
- Scoop: "scoop uninstall <package>"
- npm global: "npm uninstall -g <package>"
- pip: "pip uninstall -y <package>"
- NEVER use sudo commands on Windows

**Winget Package ID Mapping (CRITICAL):**
⚠️ Use exact Package IDs for winget uninstall:
- Git: Git.Git
- Node.js: OpenJS.NodeJS
- Python: Python.Python.3.12 (or user's version)
- Docker: Docker.DockerDesktop
- VSCode: Microsoft.VisualStudioCode
- fd: sharkdp.fd
- ripgrep: BurntSushi.ripgrep.MSVC
- bat: sharkdp.bat
- PostgreSQL: PostgreSQL.PostgreSQL.15
- MySQL: Oracle.MySQL
- MongoDB: MongoDB.Server
- Java: Oracle.JDK.21
- Maven: Apache.Maven
- Gradle: Gradle.Gradle
- Rust: Rustlang.Rustup
- Go: GoLang.Go
- Terraform: HashiCorp.Terraform
- kubectl: Kubernetes.kubectl
- Redis: Redis.Redis
- Nginx: nginx.nginx
- fzf: junegunn.fzf
- jq: jqlang.jq
- httpie: httpie.cli
- GitHub CLI: GitHub.cli
- curl: cURL.cURL
- wget: GnuWin32.Wget

**Chocolatey/Scoop Package Names:**
- Most packages use simple lowercase names (git, python, nodejs, etc.)
- Some have dashes: docker-desktop
- Use the same name that was used for installation
` : isMac ? `
=== macOS UNINSTALL ===
- Homebrew: "brew uninstall <package>"
- Cask apps: "brew uninstall --cask <app>"
- npm global: "npm uninstall -g <package>"
- pip3: "pip3 uninstall -y <package>"
- Cleanup: "brew cleanup" (removes old versions)
` : `
=== LINUX UNINSTALL ===
- Use the correct package manager (${systemInfo.packageManager})
- apt: "sudo apt-get remove -y <package>" + "sudo apt-get autoremove -y"
- yum: "sudo yum remove -y <package>"
- dnf: "sudo dnf remove -y <package>"
- pacman: "sudo pacman -R <package> --noconfirm"
- npm global: "npm uninstall -g <package>"
- System Python packages only: "sudo apt-get remove python3-<package>"
`}

GENERAL RULES:
- Include cleanup commands (autoremove, cleanup, etc.)
- Warn about important files that will remain
- For global npm packages: npm uninstall -g <package>
- For pip packages: pip uninstall -y <package> (Windows/Mac) or package manager (Linux)
- Keep warnings short and actionable
- Use non-interactive flags (-y, --noconfirm, etc.)

Now generate uninstall plan for: ${packageList}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();
      
      // Clean markdown
      text = text.replace(/^```json\n?/gm, '').replace(/^```\n?/gm, '').replace(/\n?```$/gm, '').trim();
      
      const parsed = JSON.parse(text);
      return parsed.packages || [];
    } catch (error) {
      console.error('Failed to generate uninstall plan:', error);
      
      // Fallback: basic uninstall commands based on platform
      const isWindows = systemInfo.os.toLowerCase().includes('win');
      const isMac = systemInfo.os.toLowerCase().includes('darwin') || systemInfo.os.toLowerCase().includes('mac');
      
      return installedPackages.map(pkg => {
        // CRITICAL: Use display_name for package ID (e.g., "sharkdp.fd" for winget)
        const pkgName = pkg.display_name || pkg.name;
        const readableName = pkg.name || pkg.display_name;
        let uninstallCommands = [];
        
        if (isWindows) {
          // Windows uninstall commands - use display_name for proper package ID
          if (systemInfo.packageManager === 'choco') {
            uninstallCommands = [`choco uninstall ${pkgName} -y`];
          } else if (systemInfo.packageManager === 'winget') {
            // Winget requires exact Package ID (e.g., "sharkdp.fd", "Git.Git")
            uninstallCommands = [`winget uninstall ${pkgName}`];
          } else if (systemInfo.packageManager === 'scoop') {
            uninstallCommands = [`scoop uninstall ${pkgName}`];
          } else {
            uninstallCommands = [`choco uninstall ${pkgName} -y`];
          }
        } else if (isMac) {
          // macOS uninstall commands
          uninstallCommands = [`brew uninstall ${pkgName}`, 'brew cleanup'];
        } else {
          // Linux uninstall commands
          if (systemInfo.packageManager === 'apt' || systemInfo.packageManager === 'apt-get') {
            uninstallCommands = [
              `sudo ${systemInfo.packageManager} remove -y ${pkgName}`,
              `sudo ${systemInfo.packageManager} autoremove -y`
            ];
          } else if (systemInfo.packageManager === 'pacman') {
            uninstallCommands = [`sudo pacman -R ${pkgName} --noconfirm`];
          } else {
            uninstallCommands = [`sudo ${systemInfo.packageManager} remove -y ${pkgName}`];
          }
        }
        
        return {
          name: readableName,
          uninstall_commands: uninstallCommands,
          warnings: [`Uninstalling ${readableName}. Some configuration files may remain.`]
        };
      });
    }
  }
}

module.exports = Uninstaller;
