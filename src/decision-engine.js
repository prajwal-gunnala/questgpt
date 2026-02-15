/**
 * Decision Engine
 * Evaluates package state and decides action (install/skip/update/repair)
 */
class DecisionEngine {
    constructor(stateManager) {
        this.stateManager = stateManager;
        console.log('[DecisionEngine] Initialized');
    }

    /**
     * Evaluate what action to take for a package
     * @returns {Object} { action, reason, current_version?, suggested_version? }
     */
    evaluatePackage(packageName) {
        const state = this.stateManager.state;
        
        // If no state loaded, default to install
        if (!state) {
            return { 
                action: 'INSTALL', 
                reason: 'No state available, will install',
                badge: 'new'
            };
        }

        const installed = this.stateManager.getPackageInfo(packageName);

        // Case 1: Not installed
        if (!installed) {
            return { 
                action: 'INSTALL', 
                reason: 'Package not currently installed',
                badge: 'new'
            };
        }

        // Case 2: Installed but broken
        if (installed.status === 'broken') {
            return { 
                action: 'REPAIR', 
                reason: `Installation broken, will repair`,
                current_version: installed.version,
                badge: 'repair'
            };
        }

        // Case 3: Update available
        if (installed.update_available) {
            return { 
                action: 'UPDATE', 
                reason: `Update available: ${installed.version} → ${installed.latest_version}`,
                current_version: installed.version,
                suggested_version: installed.latest_version,
                badge: 'update'
            };
        }

        // Case 4: Already installed and up-to-date
        return { 
            action: 'SKIP', 
            reason: `Already installed (v${installed.version})`,
            current_version: installed.version,
            badge: 'installed'
        };
    }

    /**
     * Evaluate multiple packages at once
     */
    evaluatePackages(packageNames) {
        return packageNames.map(name => ({
            package: name,
            ...this.evaluatePackage(name)
        }));
    }

    /**
     * Check if should proceed with installation
     */
    shouldInstall(packageName) {
        const decision = this.evaluatePackage(packageName);
        return ['INSTALL', 'UPDATE', 'REPAIR'].includes(decision.action);
    }

    /**
     * Get recommendation message for UI
     */
    getRecommendationMessage(packageName) {
        const decision = this.evaluatePackage(packageName);
        
        const messages = {
            'INSTALL': `📦 Will install ${packageName}`,
            'SKIP': `✅ ${packageName} already installed (${decision.current_version})`,
            'UPDATE': `🔄 Will update ${packageName} (${decision.current_version} → ${decision.suggested_version})`,
            'REPAIR': `🔧 Will repair ${packageName} (currently broken)`
        };

        return messages[decision.action] || `Processing ${packageName}`;
    }

    /**
     * Get badge HTML for UI
     */
    getBadgeHTML(action) {
        const badges = {
            'INSTALL': '<span class="decision-badge badge-install">NEW</span>',
            'SKIP': '<span class="decision-badge badge-skip">INSTALLED</span>',
            'UPDATE': '<span class="decision-badge badge-update">UPDATE</span>',
            'REPAIR': '<span class="decision-badge badge-repair">REPAIR</span>'
        };

        return badges[action] || '';
    }

    /**
     * Get summary of all packages to be processed
     */
    getSummary(packageNames) {
        const evaluations = this.evaluatePackages(packageNames);
        
        const summary = {
            total: evaluations.length,
            to_install: evaluations.filter(e => e.action === 'INSTALL').length,
            to_skip: evaluations.filter(e => e.action === 'SKIP').length,
            to_update: evaluations.filter(e => e.action === 'UPDATE').length,
            to_repair: evaluations.filter(e => e.action === 'REPAIR').length
        };

        summary.message = this.generateSummaryMessage(summary);
        return summary;
    }

    /**
     * Generate human-readable summary
     */
    generateSummaryMessage(summary) {
        const parts = [];
        
        if (summary.to_install > 0) {
            parts.push(`${summary.to_install} new installation${summary.to_install > 1 ? 's' : ''}`);
        }
        if (summary.to_update > 0) {
            parts.push(`${summary.to_update} update${summary.to_update > 1 ? 's' : ''}`);
        }
        if (summary.to_repair > 0) {
            parts.push(`${summary.to_repair} repair${summary.to_repair > 1 ? 's' : ''}`);
        }
        if (summary.to_skip > 0) {
            parts.push(`${summary.to_skip} already installed`);
        }

        if (parts.length === 0) {
            return 'No actions needed';
        }

        return parts.join(', ');
    }
}

module.exports = DecisionEngine;
