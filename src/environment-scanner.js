const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Environment Scanner
 * Detects installed packages on system by parsing package manager output
 */
class EnvironmentScanner {
    constructor(systemInfo) {
        this.os = systemInfo.os;
        this.packageManager = systemInfo.packageManager;
        this.platform = systemInfo.specs.platform;
    }

    /**
     * Scan and return all installed packages
     * @returns {Promise<Array>} Array of {name, version, source, package_id}
     */
    async scanInstalledPackages() {
        console.log(`[EnvironmentScanner] Scanning with ${this.packageManager}...`);
        
        try {
            const command = this.getListCommand();
            const { stdout } = await execAsync(command, { 
                timeout: 30000, // 30 second timeout
                maxBuffer: 5 * 1024 * 1024 // 5MB buffer for large lists
            });
            
            const packages = this.parseOutput(stdout);
            console.log(`[EnvironmentScanner] Found ${packages.length} installed packages`);
            return packages;
        } catch (error) {
            console.error(`[EnvironmentScanner] Scan failed:`, error.message);
            return []; // Return empty array on failure (graceful degradation)
        }
    }

    /**
     * Get the appropriate list command for this package manager
     */
    getListCommand() {
        switch (this.packageManager) {
            case 'winget':
                return 'winget list';
            case 'choco':
                return 'choco list';
            case 'scoop':
                return 'scoop list';
            case 'brew':
                return 'brew list --versions';
            case 'apt':
                return 'dpkg -l';
            case 'dnf':
            case 'yum':
                return 'rpm -qa';
            case 'pacman':
                return 'pacman -Q';
            default:
                throw new Error(`Unsupported package manager: ${this.packageManager}`);
        }
    }

    /**
     * Parse package manager output based on platform
     */
    parseOutput(output) {
        if (!output || output.trim().length === 0) {
            return [];
        }

        switch (this.packageManager) {
            case 'winget':
                return this.parseWingetList(output);
            case 'choco':
                return this.parseChocoList(output);
            case 'scoop':
                return this.parseScoopList(output);
            case 'brew':
                return this.parseBrewList(output);
            case 'apt':
                return this.parseDpkgList(output);
            case 'dnf':
            case 'yum':
                return this.parseRpmList(output);
            case 'pacman':
                return this.parsePacmanList(output);
            default:
                return [];
        }
    }

    /**
     * Parse Windows winget output
     * Format: Name  Id  Version  Source
     */
    parseWingetList(output) {
        const lines = output.split('\n');
        const packages = [];
        
        // Skip header lines (first 2-3 lines)
        let startIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Name') && lines[i].includes('Id')) {
                startIndex = i + 2; // Skip header and separator line
                break;
            }
        }

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                // Split by 2+ spaces (winget uses spaces for alignment)
                const parts = line.split(/\s{2,}/);
                
                if (parts.length >= 3) {
                    packages.push({
                        name: parts[0]?.trim(),
                        package_id: parts[1]?.trim(),
                        version: parts[2]?.trim(),
                        source: parts[3]?.trim() || 'winget'
                    });
                }
            } catch (err) {
                // Skip malformed lines
                continue;
            }
        }

        return packages.filter(pkg => pkg.name && pkg.version);
    }

    /**
     * Parse Chocolatey output
     * Format: packagename version
     */
    parseChocoList(output) {
        const lines = output.split('\n');
        const packages = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.includes('Chocolatey') || trimmed.includes('packages installed')) {
                continue;
            }

            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
                packages.push({
                    name: parts[0],
                    package_id: parts[0],
                    version: parts[1],
                    source: 'chocolatey'
                });
            }
        }

        return packages;
    }

    /**
     * Parse Scoop output
     * Format: name version
     */
    parseScoopList(output) {
        const lines = output.split('\n');
        const packages = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.includes('Installed apps')) continue;

            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
                packages.push({
                    name: parts[0],
                    package_id: parts[0],
                    version: parts[1],
                    source: 'scoop'
                });
            }
        }

        return packages;
    }

    /**
     * Parse Homebrew output
     * Format: name version1 version2 (can have multiple versions)
     */
    parseBrewList(output) {
        const lines = output.split('\n');
        const packages = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
                // Take the last version if multiple exist
                const versions = parts.slice(1);
                packages.push({
                    name: parts[0],
                    package_id: parts[0],
                    version: versions[versions.length - 1],
                    source: 'homebrew'
                });
            }
        }

        return packages;
    }

    /**
     * Parse dpkg output (Debian/Ubuntu)
     * Format: ii  name  version  arch  description
     */
    parseDpkgList(output) {
        const lines = output.split('\n');
        const packages = [];

        for (const line of lines) {
            // Only process lines starting with "ii" (installed)
            if (!line.startsWith('ii')) continue;

            try {
                const parts = line.split(/\s+/).filter(p => p);
                if (parts.length >= 3) {
                    packages.push({
                        name: parts[1],
                        package_id: parts[1],
                        version: parts[2],
                        source: 'apt'
                    });
                }
            } catch (err) {
                continue;
            }
        }

        return packages;
    }

    /**
     * Parse RPM output (Fedora/RHEL)
     * Format: name-version-release.arch
     */
    parseRpmList(output) {
        const lines = output.split('\n');
        const packages = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
                // Extract package name and version from format: name-version-release.arch
                const match = trimmed.match(/^(.+?)-(\d+[\d.]*-[\w.]+)$/);
                if (match) {
                    packages.push({
                        name: match[1],
                        package_id: match[1],
                        version: match[2],
                        source: 'dnf'
                    });
                }
            } catch (err) {
                continue;
            }
        }

        return packages;
    }

    /**
     * Parse Pacman output (Arch Linux)
     * Format: name version
     */
    parsePacmanList(output) {
        const lines = output.split('\n');
        const packages = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
                packages.push({
                    name: parts[0],
                    package_id: parts[0],
                    version: parts[1],
                    source: 'pacman'
                });
            }
        }

        return packages;
    }
}

module.exports = EnvironmentScanner;
