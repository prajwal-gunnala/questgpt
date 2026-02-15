/**
 * Command Classifier Module
 * Classifies shell commands by risk level before execution.
 * Used to show a safety preview to the user before installation begins.
 */

class CommandClassifier {
  constructor() {
    // Patterns ordered from most dangerous to safest
    this.rules = [
      // DANGEROUS — commands that can destroy data or brick the system
      {
        level: 'dangerous',
        label: '⛔ Dangerous',
        patterns: [
          /rm\s+(-rf|--recursive)\s+\//,        // rm -rf /
          /mkfs/,                                 // format disk
          /dd\s+if=/,                             // raw disk write
          />\s*\/dev\/sd/,                        // overwrite block device
          /chmod\s+-R\s+777\s+\//,               // world-writable root
          /format\s+[A-Za-z]:/i,                  // Windows: format C:
          /diskpart/i,                             // Windows: disk partitioning
          /del\s+\/[sq].*[A-Za-z]:\\/i,           // Windows: del /s /q C:\
          /Remove-Item.*-Recurse.*-Force.*[A-Za-z]:\\/i, // PowerShell destructive
        ],
        description: 'This command can cause irreversible damage to your system.'
      },

      // ELEVATED — requires sudo, modifies system directories
      {
        level: 'elevated',
        label: '🔒 Elevated (sudo/admin)',
        patterns: [
          /^sudo\s/,                              // any sudo command
          /DEBIAN_FRONTEND/,                      // apt non-interactive
          /\/etc\//,                               // system config files
          /systemctl\s+(enable|start|restart)/,   // service management
          /update-alternatives/,                  // system binary links
          /\bchoco\s+install/i,                   // Windows: Chocolatey install
          /\bwinget\s+install/i,                  // Windows: Winget install
          /\bscoop\s+install/i,                   // Windows: Scoop install
        ],
        description: 'Requires administrator privileges. Will modify system files.'
      },

      // MODERATE — installs global packages, modifies PATH
      {
        level: 'moderate',
        label: '⚠️ Moderate',
        patterns: [
          /npm\s+install\s+-g/,                   // global npm
          /pip\s+install(?!\s+--user)/,            // pip without --user
          /curl\s.*\|\s*(ba)?sh/,                 // pipe to shell
          /wget\s.*\|\s*(ba)?sh/,                 // pipe to shell
          /add-apt-repository/,                   // add PPA
          /apt-key\s+add/,                        // add GPG key
          /export\s+PATH/,                        // modify PATH
          /\.bashrc|\.profile|\.zshrc/,           // modify shell config
        ],
        description: 'Installs software globally or modifies your environment.'
      },

      // SAFE — read-only checks, local installs, version queries
      {
        level: 'safe',
        label: '✅ Safe',
        patterns: [
          /--version$/,                           // version check
          /--help$/,                              // help query
          /which\s/,                              // command lookup
          /echo\s/,                               // print
          /cat\s/,                                // read file
          /ls\s/,                                 // list dir
          /python3?\s+-c\s+'import/,              // import check
          /node\s+-e/,                            // node eval
          /command\s+-v/,                         // command exists check
        ],
        description: 'Read-only or local operation. No system changes.'
      }
    ];
  }

  /**
   * Classify a single command string.
   * @param {string} command - Shell command to classify
   * @returns {{ command: string, level: string, label: string, description: string }}
   */
  classifyCommand(command) {
    const trimmed = command.trim();

    for (const rule of this.rules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(trimmed)) {
          return {
            command: trimmed,
            level: rule.level,
            label: rule.label,
            description: rule.description
          };
        }
      }
    }

    // Default: treat unknown commands as moderate
    return {
      command: trimmed,
      level: 'moderate',
      label: '⚠️ Moderate',
      description: 'Unrecognized command — review before running.'
    };
  }

  /**
   * Classify all install commands for a list of dependencies.
   * @param {Array} dependencies - Array of dependency objects with install_commands[]
   * @returns {{ dependencies: Array, summary: { total: number, dangerous: number, elevated: number, moderate: number, safe: number } }}
   */
  classifyAll(dependencies) {
    const summary = { total: 0, dangerous: 0, elevated: 0, moderate: 0, safe: 0 };
    const classified = [];

    for (const dep of dependencies) {
      const commands = (dep.install_commands || []).map(cmd => this.classifyCommand(cmd));
      const highestRisk = this.getHighestRisk(commands);

      summary.total += commands.length;
      commands.forEach(c => { summary[c.level] = (summary[c.level] || 0) + 1; });

      classified.push({
        name: dep.display_name || dep.name,
        highestRisk,
        commands
      });
    }

    return { dependencies: classified, summary };
  }

  /**
   * Get the highest risk level from a list of classified commands.
   * @param {Array} classifiedCommands
   * @returns {string}
   */
  getHighestRisk(classifiedCommands) {
    const order = ['dangerous', 'elevated', 'moderate', 'safe'];
    for (const level of order) {
      if (classifiedCommands.some(c => c.level === level)) return level;
    }
    return 'safe';
  }
}

module.exports = CommandClassifier;
