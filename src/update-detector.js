const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Update Detector (MINIMAL VERSION)
 * Detects available updates for installed packages
 */
class UpdateDetector {
    constructor(systemInfo) {
        this.packageManager = systemInfo.packageManager;
        console.log(`[UpdateDetector] Initialized for ${this.packageManager}`);
    }

    /**
     * Check for available updates
     * @returns {Promise<Array>} Array of {name, current, available}
     */
    async checkForUpdates() {
        console.log('[UpdateDetector] Checking for updates...');
        
        try {
            const command = this.getUpdateCheckCommand();
            const { stdout } = await execAsync(command, { 
                timeout: 45000, // 45 second timeout
                maxBuffer: 5 * 1024 * 1024 
            });
            
            const updates = this.parseUpdateOutput(stdout);
            console.log(`[UpdateDetector] Found ${updates.length} updates available`);
            return updates;
        } catch (error) {
            console.error('[UpdateDetector] Update check failed:', error.message);
            return []; // Graceful degradation
        }
    }

    /**
     * Get update check command for package manager
     */
    getUpdateCheckCommand() {
        switch (this.packageManager) {
            case 'winget':
                return 'winget upgrade';
            case 'brew':
                return 'brew outdated';
            case 'apt':
                return 'apt list --upgradable 2>/dev/null';
            case 'dnf':
            case 'yum':
                return 'dnf check-update';
            default:
                throw new Error(`Update checking not supported for: ${this.packageManager}`);
        }
    }

    /**
     * Parse update output based on package manager
     */
    parseUpdateOutput(output) {
        if (!output || output.trim().length === 0) {
            return [];
        }

        switch (this.packageManager) {
            case 'winget':
                return this.parseWingetUpgrade(output);
            case 'brew':
                return this.parseBrewOutdated(output);
            case 'apt':
                return this.parseAptUpgradable(output);
            default:
                return [];
        }
    }

    /**
     * Parse winget upgrade output
     * Format: Name  Id  Version  Available
     */
    parseWingetUpgrade(output) {
        const lines = output.split('\n');
        const updates = [];
        
        let startIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Name') && lines[i].includes('Available')) {
                startIndex = i + 2;
                break;
            }
        }

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                const parts = line.split(/\s{2,}/);
                if (parts.length >= 4) {
                    updates.push({
                        name: parts[0]?.trim(),
                        package_id: parts[1]?.trim(),
                        current: parts[2]?.trim(),
                        available: parts[3]?.trim()
                    });
                }
            } catch (err) {
                continue;
            }
        }

        return updates.filter(u => u.name && u.available);
    }

    /**
     * Parse brew outdated output
     * Format: git (2.43.0) < 2.44.0
     */
    parseBrewOutdated(output) {
        return output.split('\n')
            .filter(line => line.includes('<'))
            .map(line => {
                const match = line.match(/^(\S+)\s+\(([^)]+)\)\s+<\s+(.+)$/);
                if (match) {
                    return {
                        name: match[1],
                        current: match[2],
                        available: match[3]
                    };
                }
                return null;
            })
            .filter(Boolean);
    }

    /**
     * Parse apt list --upgradable output
     * Format: git/stable 1:2.44.0-1 amd64 [upgradable from: 1:2.43.0-1]
     */
    parseAptUpgradable(output) {
        return output.split('\n')
            .filter(line => line.includes('upgradable'))
            .map(line => {
                const match = line.match(/^([^/]+).*\s+(\S+)\s+.*upgradable from:\s+(\S+)/);
                if (match) {
                    return {
                        name: match[1],
                        current: match[3],
                        available: match[2]
                    };
                }
                return null;
            })
            .filter(Boolean);
    }
}

module.exports = UpdateDetector;
