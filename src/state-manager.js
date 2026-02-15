const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * State Manager
 * Maintains persistent environment state tracking across sessions
 */
class StateManager {
    constructor() {
        // State file location: ~/.questgpt/environment_context.json
        this.stateDir = path.join(os.homedir(), '.questgpt');
        this.stateFile = path.join(this.stateDir, 'environment_context.json');
        
        // In-memory state cache
        this.state = null;
        
        // Ensure directory exists
        this.ensureStateDirectory();
        
        console.log(`[StateManager] Initialized - State file: ${this.stateFile}`);
    }

    /**
     * Ensure state directory exists
     */
    ensureStateDirectory() {
        if (!fs.existsSync(this.stateDir)) {
            fs.mkdirSync(this.stateDir, { recursive: true });
            console.log(`[StateManager] Created state directory: ${this.stateDir}`);
        }
    }

    /**
     * Initialize fresh state from environment scan
     */
    async initializeState(systemInfo, installedPackages) {
        console.log(`[StateManager] Initializing state with ${installedPackages.length} packages...`);
        
        this.state = {
            version: '1.0',
            last_scan: new Date().toISOString(),
            system: {
                os: systemInfo.os,
                package_manager: systemInfo.packageManager,
                arch: systemInfo.specs.arch,
                platform: systemInfo.specs.platform
            },
            installed_tools: {},
            installation_history: [],
            failed_installations: []
        };

        // Populate installed tools from scan
        installedPackages.forEach(pkg => {
            const key = (pkg.name || '').toLowerCase();
            if (key) {
                this.state.installed_tools[key] = {
                    display_name: pkg.name,
                    version: pkg.version,
                    source: pkg.source,
                    package_id: pkg.package_id || pkg.name,
                    status: 'installed',
                    detected_at: new Date().toISOString(),
                    update_available: false
                };
            }
        });

        await this.saveState();
        console.log(`[StateManager] State initialized with ${Object.keys(this.state.installed_tools).length} tools`);
        return this.state;
    }

    /**
     * Save state to disk (JSON file)
     */
    async saveState() {
        if (!this.state) {
            console.warn('[StateManager] No state to save');
            return false;
        }

        try {
            const json = JSON.stringify(this.state, null, 2);
            fs.writeFileSync(this.stateFile, json, 'utf8');
            console.log(`[StateManager] State saved successfully`);
            return true;
        } catch (error) {
            console.error('[StateManager] Failed to save state:', error.message);
            return false;
        }
    }

    /**
     * Load state from disk
     */
    async loadState() {
        if (!fs.existsSync(this.stateFile)) {
            console.log('[StateManager] No existing state file found');
            return null;
        }

        try {
            const json = fs.readFileSync(this.stateFile, 'utf8');
            this.state = JSON.parse(json);
            console.log(`[StateManager] State loaded - ${Object.keys(this.state.installed_tools || {}).length} tools tracked`);
            return this.state;
        } catch (error) {
            console.error('[StateManager] Failed to load state:', error.message);
            // If corrupted, return null (will trigger re-initialization)
            return null;
        }
    }

    /**
     * Check if package is installed
     */
    isInstalled(packageName) {
        if (!this.state) return false;
        const key = (packageName || '').toLowerCase();
        return key in this.state.installed_tools;
    }

    /**
     * Get package info
     */
    getPackageInfo(packageName) {
        if (!this.state) return null;
        const key = (packageName || '').toLowerCase();
        return this.state.installed_tools[key] || null;
    }

    /**
     * Log installation attempt
     */
    async logInstallation(packageName, action, result, duration, errorMessage = null) {
        if (!this.state) {
            console.warn('[StateManager] Cannot log - no state loaded');
            return;
        }

        const entry = {
            package: packageName,
            action: action, // 'install', 'update', 'repair'
            result: result, // 'success', 'failed'
            timestamp: new Date().toISOString(),
            duration_seconds: duration
        };

        if (result === 'failed') {
            entry.error = errorMessage;
            this.state.failed_installations.push({
                package: packageName,
                error: errorMessage,
                timestamp: entry.timestamp,
                attempted_command: action
            });
        }

        this.state.installation_history.push(entry);
        
        // Update installed_tools if successful install
        if (result === 'success' && action === 'install') {
            const key = packageName.toLowerCase();
            this.state.installed_tools[key] = {
                display_name: packageName,
                version: 'pending', // Will be updated by verifier
                status: 'installed',
                installed_at: entry.timestamp,
                update_available: false
            };
        }

        await this.saveState();
        console.log(`[StateManager] Logged ${action} of ${packageName}: ${result}`);
    }

    /**
     * Update package after verification
     */
    async updatePackageAfterVerification(packageName, version, packageId = null) {
        if (!this.state) return;
        
        const key = packageName.toLowerCase();
        if (this.state.installed_tools[key]) {
            this.state.installed_tools[key].version = version;
            this.state.installed_tools[key].status = 'installed';
            if (packageId) {
                this.state.installed_tools[key].package_id = packageId;
            }
            await this.saveState();
            console.log(`[StateManager] Updated ${packageName} to version ${version}`);
        }
    }

    /**
     * Mark package as having update available
     */
    async markUpdateAvailable(packageName, latestVersion) {
        if (!this.state) return;
        
        const key = packageName.toLowerCase();
        if (this.state.installed_tools[key]) {
            this.state.installed_tools[key].update_available = true;
            this.state.installed_tools[key].latest_version = latestVersion;
            this.state.installed_tools[key].status = 'outdated';
            await this.saveState();
        }
    }

    /**
     * Get installation statistics
     */
    getStats() {
        if (!this.state) {
            return {
                total_tools: 0,
                total_installations: 0,
                failed_installations: 0,
                last_scan: null,
                updates_available: 0
            };
        }

        const updatesAvailable = Object.values(this.state.installed_tools)
            .filter(tool => tool.update_available).length;

        return {
            total_tools: Object.keys(this.state.installed_tools).length,
            total_installations: this.state.installation_history.length,
            failed_installations: this.state.failed_installations.length,
            last_scan: this.state.last_scan,
            updates_available: updatesAvailable
        };
    }

    /**
     * Get all installed packages as array
     */
    getAllPackages() {
        if (!this.state || !this.state.installed_tools) {
            return [];
        }
        
        return Object.entries(this.state.installed_tools).map(([key, pkg]) => ({
            name: key,
            display_name: pkg.display_name || key,
            version: pkg.version || 'unknown',
            source: pkg.source || 'unknown',
            package_id: pkg.package_id || key,
            status: pkg.status || 'installed',
            update_available: pkg.update_available || false,
            latest_version: pkg.latest_version || null
        }));
    }

    /**
     * Remove a package from state (after uninstall)
     */
    removePackage(packageName) {
        const key = packageName.toLowerCase();
        if (this.state.installed_tools[key]) {
            delete this.state.installed_tools[key];
            console.log(`[StateManager] Removed package: ${packageName}`);
            this.saveState();
        }
    }

    /**
     * Export simple context (for compatibility)
     */
    getAll() {
        return this.state || {};
    }

    /**
     * Clear all state (reset)
     */
    async clear() {
        this.state = null;
        if (fs.existsSync(this.stateFile)) {
            fs.unlinkSync(this.stateFile);
            console.log('[StateManager] State file deleted');
        }
    }
}

module.exports = StateManager;
