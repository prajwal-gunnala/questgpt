const { exec, execSync, spawn } = require('child_process');
const { promisify } = require('util');
const chalk = require('chalk');
const execAsync = promisify(exec);

/**
 * Installation Executor Module
 * Executes installation commands and streams output
 */

class Installer {
  constructor() {
    this.currentProcess = null;
  }

  /**
   * Execute a single command with real-time output streaming
   */
  async executeCommand(command, onOutput = null, sudoPassword = null) {
    return new Promise((resolve, reject) => {
      console.log(chalk.cyan(`\n🔧 Executing: ${command}\n`));
      
      // Send command to UI
      if (onOutput) {
        onOutput({ 
          type: 'output', 
          data: { type: 'info', text: `🔧 Executing: ${command}` } 
        });
        onOutput({ 
          type: 'output', 
          data: { type: 'normal', text: '' } 
        });
      }

      // If command needs sudo and we have password, pipe it
      let finalCommand = command;
      if (sudoPassword && command.includes('sudo')) {
        finalCommand = `echo '${sudoPassword}' | sudo -S ${command.replace(/^sudo\s+/, '')}`;
      }

      const child = exec(finalCommand, { maxBuffer: 1024 * 1024 * 10 });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data;
        const text = data.toString();
        console.log(chalk.gray(text));
        
        // Send every line to UI terminal
        if (onOutput) {
          text.split('\n').forEach(line => {
            if (line.trim()) {
              onOutput({ type: 'output', data: { type: 'normal', text: line } });
            }
          });
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data;
        const text = data.toString();
        console.log(chalk.yellow(text));
        
        // Send stderr to UI (usually progress info, not errors)
        if (onOutput) {
          text.split('\n').forEach(line => {
            if (line.trim()) {
              onOutput({ type: 'output', data: { type: 'normal', text: line } });
            }
          });
        }
      });

      child.on('close', (code) => {
        console.log(chalk.cyan(`\n✓ Command finished with exit code: ${code}\n`));
        
        if (onOutput) {
          onOutput({ 
            type: 'output', 
            data: { type: 'normal', text: '' } 
          });
          onOutput({ 
            type: 'output', 
            data: { type: code === 0 ? 'success' : 'error', text: `✓ Command finished with exit code: ${code}` } 
          });
          onOutput({ 
            type: 'output', 
            data: { type: 'normal', text: '' } 
          });
        }
        
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with exit code ${code}\n${stderr || stdout}`));
        }
      });

      child.on('error', (error) => {
        console.log(chalk.red(`\n✗ Command error: ${error.message}\n`));
        if (onOutput) {
          onOutput({ 
            type: 'output', 
            data: { type: 'error', text: `✗ Command error: ${error.message}` } 
          });
        }
        reject(error);
      });
    });
  }

  /**
   * Execute multiple commands in sequence
   */
  async executeCommands(commands, onProgress = null, sudoPassword = null) {
    const results = [];
    const total = commands.length;

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          command,
          percentage: Math.round(((i + 1) / total) * 100)
        });
      }

      try {
        const result = await this.executeCommand(command, (output) => {
          if (onProgress) {
            onProgress({
              current: i + 1,
              total,
              command,
              output: output.data,
              type: output.type
            });
          }
        }, sudoPassword);

        results.push({
          command,
          success: true,
          output: result.stdout
        });
        
        // Command succeeded, break out of loop
        break;
      } catch (error) {
        results.push({
          command,
          success: false,
          error: error.message
        });
        
        // Continue or stop based on error severity
        if (error.message.includes('Permission denied')) {
          throw new Error('Permission denied. Please run with sudo or as root.');
        }
        
        // If there are more commands to try, continue to next one
        if (i < commands.length - 1) {
          continue;
        }
      }
    }

    return results;
  }

  /**
   * Install a dependency
   */
  async installDependency(dependency, onProgress = null, sudoPassword = null) {
    const { name, install_commands } = dependency;

    if (onProgress) {
      onProgress({ 
        type: 'output',
        data: { type: 'info', text: `Starting installation of ${name}...` }
      });
    }

    try {
      const results = await this.executeCommands(install_commands, (progress) => {
        if (onProgress) {
          // Send actual terminal output
          if (progress.type === 'stdout' || progress.type === 'stderr') {
            onProgress({
              type: 'output',
              data: { 
                type: progress.type === 'stderr' ? 'error' : 'normal',
                text: progress.output ? progress.output.data.toString() : ''
              }
            });
          }
        }
      }, sudoPassword);

      const allSuccess = results.every(r => r.success);

      if (onProgress) {
        onProgress({
          type: 'output',
          data: { 
            type: allSuccess ? 'success' : 'error',
            text: allSuccess ? `✓ ${name} installed successfully` : `✗ ${name} installation failed`
          }
        });
      }

      return {
        success: allSuccess,
        name,
        results
      };
    } catch (error) {
      if (onProgress) {
        onProgress({
          type: 'output',
          data: { type: 'error', text: `Error installing ${name}: ${error.message}` }
        });
      }

      return {
        success: false,
        name,
        error: error.message
      };
    }
  }

  /**
   * Cancel current installation
   */
  cancel() {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
      return true;
    }
    return false;
  }

  /**
   * Check if a command exists
   */
  commandExists(command) {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if package is already installed
   */
  async isInstalled(packageName, verifyCommand = null) {
    console.log(chalk.cyan(`\n🔍 Checking if ${packageName} is installed...`));
    
    if (verifyCommand) {
      console.log(chalk.gray(`   Running: ${verifyCommand}`));
      try {
        const { stdout } = await execAsync(verifyCommand);
        console.log(chalk.green(`   ✓ Found: ${stdout.trim()}`));
        return { installed: true, version: stdout.trim() };
      } catch (error) {
        console.log(chalk.yellow(`   ✗ Not found or verification failed`));
        return { installed: false };
      }
    }

    // Fallback: check if command exists
    const isAvailable = this.commandExists(packageName);
    console.log(isAvailable ? chalk.green(`   ✓ Command exists`) : chalk.yellow(`   ✗ Command not found`));
    return { installed: isAvailable };
  }
}

module.exports = Installer;
