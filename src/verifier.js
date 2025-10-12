const { execSync } = require('child_process');

/**
 * Verification Module
 * Verifies installations by running verification commands
 */

class Verifier {
  /**
   * Verify a single installation
   */
  async verifyInstallation(dependency) {
    const { name, verify_command, expected_pattern } = dependency;

    try {
      // Execute verification command
      const output = execSync(verify_command, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe']
      }).trim();

      // Check if output matches expected pattern
      let matches = true;
      let actualVersion = output;

      if (expected_pattern) {
        const regex = new RegExp(expected_pattern, 'i');
        matches = regex.test(output);
        
        // Try to extract version
        const versionMatch = output.match(/(\d+\.?\d*\.?\d*)/);
        if (versionMatch) {
          actualVersion = versionMatch[0];
        }
      }

      return {
        name,
        success: matches,
        installed: true,
        expected: expected_pattern || 'Any version',
        actual: actualVersion,
        fullOutput: output,
        message: matches ? 'Installation verified successfully' : 'Version mismatch'
      };
    } catch (error) {
      // Command failed - not installed
      return {
        name,
        success: false,
        installed: false,
        expected: expected_pattern || 'Any version',
        actual: 'Not installed',
        error: error.message,
        message: 'Installation verification failed'
      };
    }
  }

  /**
   * Verify multiple installations
   */
  async verifyAll(dependencies, onProgress = null) {
    const results = [];
    const total = dependencies.length;

    for (let i = 0; i < dependencies.length; i++) {
      const dependency = dependencies[i];
      
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          name: dependency.name,
          status: 'verifying'
        });
      }

      const result = await this.verifyInstallation(dependency);
      results.push(result);

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          name: dependency.name,
          status: result.success ? 'success' : 'failed',
          result
        });
      }
    }

    return {
      results,
      allSuccess: results.every(r => r.success),
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length
    };
  }

  /**
   * Quick check if something is installed
   */
  isInstalled(command) {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get version of installed software
   */
  getVersion(command, versionFlag = '--version') {
    try {
      const output = execSync(`${command} ${versionFlag}`, {
        encoding: 'utf8',
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'pipe']
      }).trim();

      // Extract version number
      const versionMatch = output.match(/(\d+\.?\d*\.?\d*)/);
      return versionMatch ? versionMatch[0] : output;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate verification report
   */
  generateReport(verificationResults) {
    const { results, allSuccess, successCount, failedCount } = verificationResults;

    const report = {
      summary: {
        total: results.length,
        success: successCount,
        failed: failedCount,
        allSuccess
      },
      details: results.map(r => ({
        name: r.name,
        status: r.success ? '✅ SUCCESS' : '❌ FAILED',
        expected: r.expected,
        actual: r.actual,
        message: r.message
      })),
      timestamp: new Date().toISOString()
    };

    return report;
  }
}

module.exports = Verifier;
