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
    
    const prompt = `You are a Linux system administrator expert. Generate safe uninstall commands for these packages:

INSTALLED PACKAGES: ${packageList}

SYSTEM INFO:
- OS: ${systemInfo.os}
- Package Manager: ${systemInfo.packageManager}

Return ONLY valid JSON (no markdown, no explanations):
{
  "packages": [
    {
      "name": "package-name",
      "uninstall_commands": [
        "sudo apt-get remove -y package-name",
        "sudo apt-get autoremove -y"
      ],
      "warnings": [
        "This will remove X but keep configuration files",
        "Run apt-get purge to remove config files too"
      ]
    }
  ]
}

Rules:
- Use the correct package manager (apt, npm, pip, etc.)
- Include cleanup commands (autoremove, autoclean)
- Warn about important files that will remain
- For global npm packages: npm uninstall -g package
- For pip packages: pip uninstall -y package
- Keep warnings short and actionable`;

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
      // Fallback: basic uninstall commands
      return installedPackages.map(pkg => ({
        name: pkg.display_name || pkg.name,
        uninstall_commands: [`sudo ${systemInfo.packageManager} remove -y ${pkg.name}`],
        warnings: ['Manual uninstall command - review before running']
      }));
    }
  }
}

module.exports = Uninstaller;
