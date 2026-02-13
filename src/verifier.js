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
    const { name, display_name, verify_command, expected_pattern } = dependency;

    try {
      const isWindows = process.platform === 'win32';
      
      // Execute verification command with appropriate shell
      const execOptions = {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe']
      };
      
      // Use cmd.exe on Windows for better compatibility
      if (isWindows) {
        execOptions.shell = 'cmd.exe';
      }
      
      // Try the provided verify command first
      let output = '';
      let verificationSuccess = false;
      
      try {
        output = execSync(verify_command, execOptions).toString().trim();
        verificationSuccess = true;
      } catch (primaryError) {
        // Primary verification failed, try alternative methods
        if (isWindows) {
          // On Windows, try to find the command using 'where'
          const commandName = this.extractCommandName(verify_command);
          if (commandName) {
            try {
              const whereOutput = execSync(`where ${commandName}`, execOptions).toString().trim();
              if (whereOutput) {
                // Command exists, try to get version
                try {
                  output = execSync(`${commandName} --version`, execOptions).toString().trim();
                  verificationSuccess = true;
                } catch (versionError) {
                  // Some commands don't support --version, but they exist
                  output = `Found at: ${whereOutput}`;
                  verificationSuccess = true;
                }
              }
            } catch (whereError) {
              // Command not found
              output = '';
            }
          }
        }
        
        // If still failed, throw the original error
        if (!verificationSuccess) {
          throw primaryError;
        }
      }

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
        success: matches && verificationSuccess,
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
        message: 'Installation verification failed - package not found'
      };
    }
  }

  /**
   * Extract command name from a verification command
   * Examples: 
   *   "git --version" -> "git"
   *   "python -c \"import pandas\"" -> "python"
   *   "where fd" -> "fd"
   */
  extractCommandName(verifyCommand) {
    if (!verifyCommand) return null;
    
    // Remove common prefixes
    let cmd = verifyCommand.trim();
    cmd = cmd.replace(/^where\s+/, '');
    cmd = cmd.replace(/^which\s+/, '');
    
    // Get first word (the actual command)
    const firstWord = cmd.split(/\s+/)[0];
    return firstWord || null;
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
    const isWindows = process.platform === 'win32';
    const checkCmd = isWindows ? 'where' : 'which';
    
    try {
      execSync(`${checkCmd} ${command}`, { stdio: 'ignore' });
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
      const isWindows = process.platform === 'win32';
      
      const execOptions = {
        encoding: 'utf8',
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'pipe']
      };
      
      if (isWindows) {
        execOptions.shell = 'cmd.exe';
      }
      
      const output = execSync(`${command} ${versionFlag}`, execOptions).trim();

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
