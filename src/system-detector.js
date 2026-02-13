const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');

/**
 * System Detection Module
 * Detects OS, distro, package manager, and system specs
 */

class SystemDetector {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
  }

  /**
   * Detect operating system
   */
  detectOS() {
    const platform = this.platform;
    
    switch (platform) {
      case 'linux':
        return 'Linux';
      case 'darwin':
        return 'macOS';
      case 'win32':
        return 'Windows';
      default:
        return 'unknown';
    }
  }

  /**
   * Detect Linux distribution
   */
  getDistro() {
    if (this.platform !== 'linux') {
      return null;
    }

    try {
      // Try /etc/os-release first (most modern distros)
      if (fs.existsSync('/etc/os-release')) {
        const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
        const idMatch = osRelease.match(/^ID=(.+)$/m);
        if (idMatch) {
          return idMatch[1].replace(/"/g, '').toLowerCase();
        }
      }

      // Fallback to lsb_release
      const lsbRelease = execSync('lsb_release -si 2>/dev/null || echo unknown', {
        encoding: 'utf8'
      }).trim().toLowerCase();
      
      return lsbRelease;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Detect package manager
   */
  getPackageManager() {
    // Windows package managers
    if (this.platform === 'win32') {
      const winManagers = [
        { cmd: 'choco', name: 'choco' },
        { cmd: 'winget', name: 'winget' },
        { cmd: 'scoop', name: 'scoop' }
      ];

      for (const manager of winManagers) {
        try {
          execSync(`where ${manager.cmd}`, { stdio: 'ignore' });
          return manager.name;
        } catch (error) {
          continue;
        }
      }
      
      // No package manager found on Windows - default to choco
      return 'choco'; // Default to chocolatey for Windows
    }

    // macOS package manager
    if (this.platform === 'darwin') {
      try {
        execSync('which brew', { stdio: 'ignore' });
        return 'brew';
      } catch (error) {
        return 'brew'; // Default to brew for macOS
      }
    }

    // Linux package managers
    const managers = [
      { cmd: 'apt', name: 'apt' },
      { cmd: 'apt-get', name: 'apt' },
      { cmd: 'yum', name: 'yum' },
      { cmd: 'dnf', name: 'dnf' },
      { cmd: 'pacman', name: 'pacman' },
      { cmd: 'zypper', name: 'zypper' },
      { cmd: 'snap', name: 'snap' }
    ];

    for (const manager of managers) {
      try {
        execSync(`which ${manager.cmd}`, { stdio: 'ignore' });
        return manager.name;
      } catch (error) {
        continue;
      }
    }

    return 'unknown';
  }

  /**
   * Get system specifications
   */
  getSystemSpecs() {
    return {
      platform: this.platform,
      arch: this.arch,
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024), // GB
      hostname: os.hostname(),
      uptime: Math.round(os.uptime() / 60 / 60) // hours
    };
  }

  /**
   * Check if running as sudo/root (Linux/Mac only)
   * For Windows, check if running as Administrator
   */
  isSudo() {
    // Windows: Check if running as Administrator
    if (this.platform === 'win32') {
      try {
        // Try to execute a command that requires admin privileges
        execSync('net session', { stdio: 'ignore' });
        return true; // Running as Administrator
      } catch (error) {
        return false; // Not running as Administrator
      }
    }
    
    // Linux/Mac: Check if root user
    try {
      return process.getuid && process.getuid() === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get complete system info
   */
  getSystemInfo() {
    const osType = this.detectOS();
    const distro = this.getDistro();
    const packageManager = this.getPackageManager();
    const specs = this.getSystemSpecs();

    return {
      os: osType,
      distro,
      packageManager,
      specs,
      isSudo: this.isSudo(),
      summary: `${osType}${distro ? ` (${distro})` : ''} with ${packageManager}`
    };
  }
}

module.exports = SystemDetector;
