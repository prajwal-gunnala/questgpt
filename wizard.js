#!/usr/bin/env node

const { exec, execSync, spawn } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');
const boxen = require('boxen');
const gradient = require('gradient-string');
const figlet = require('figlet');
const ora = require('ora');
require('dotenv').config();

// Import modules
const SystemDetector = require('./src/system-detector');
const GeminiInstaller = require('./src/gemini-installer');
const LogoProvider = require('./src/logo-provider');
const Installer = require('./src/installer');
const Verifier = require('./src/verifier');

// Initialize modules
const systemDetector = new SystemDetector();
const geminiInstaller = new GeminiInstaller();
const logoProvider = new LogoProvider();
const installer = new Installer();
const verifier = new Verifier();

// Global state
let systemInfo = null;
let selectedDependencies = [];
let installationResults = [];
let verificationResults = null;

// Theme colors
const theme = {
  primary: chalk.cyan,
  secondary: chalk.magenta,
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  muted: chalk.gray,
  highlight: chalk.white.bold
};

/**
 * Check and prompt for sudo password if needed
 */
async function checkSudoAccess() {
  try {
    // Check if sudo works without password
    execSync('sudo -n true', { stdio: 'ignore' });
    return true; // No password needed
  } catch (error) {
    // Password required
    console.log(theme.warning('\n🔒 This wizard needs sudo access to install packages.'));
    console.log(theme.muted('   You will be prompted for your password once.\n'));
    
    try {
      // Prompt for password and validate
      execSync('sudo -v', { stdio: 'inherit' });
      console.log(theme.success('✓ Sudo access granted\n'));
      return true;
    } catch (error) {
      console.log(theme.error('\n❌ Sudo access denied. Cannot proceed with installation.\n'));
      return false;
    }
  }
}

/**
 * Display banner
 */
function displayBanner() {
  console.clear();
  
  const banner = figlet.textSync('Gemini Wizard', {
    font: 'Standard',
    horizontalLayout: 'default'
  });
  
  console.log(gradient.pastel.multiline(banner));
  console.log(theme.primary.bold('\n  🧙‍♂️ AI-Powered Installation Wizard\n'));
}

/**
 * Display system info
 */
function displaySystemInfo() {
  console.log(boxen(
    theme.highlight('System Information\n\n') +
    theme.info('OS: ') + theme.muted(systemInfo.summary) + '\n' +
    theme.info('Package Manager: ') + theme.muted(systemInfo.packageManager) + '\n' +
    theme.info('Architecture: ') + theme.muted(systemInfo.specs.arch) + '\n' +
    theme.info('Memory: ') + theme.muted(`${systemInfo.specs.freeMemory}GB free / ${systemInfo.specs.totalMemory}GB total`),
    {
      padding: 1,
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ));
}

/**
 * STEP 1: User Request & Dependency Detection
 */
async function step1_Discovery() {
  console.log(theme.highlight('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(theme.primary.bold('  STEP 1: Discovery & Selection'));
  console.log(theme.highlight('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  // Get user input
  const { userRequest } = await inquirer.prompt([
    {
      type: 'input',
      name: 'userRequest',
      message: theme.primary('What would you like to install?'),
      prefix: '🔍',
      validate: (input) => {
        if (!input.trim()) {
          return 'Please enter your installation request';
        }
        return true;
      }
    }
  ]);

  // Analyze with Gemini
  const spinner = ora({
    text: 'Analyzing your request with Gemini AI...',
    color: 'cyan'
  }).start();

  try {
    const analysis = await geminiInstaller.analyzeRequest(userRequest, systemInfo);
    spinner.succeed('Analysis complete!');

    console.log('\n' + boxen(
      theme.info('Analysis: ') + theme.muted(analysis.analysis),
      {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        borderStyle: 'round',
        borderColor: 'blue'
      }
    ));

    // Handle stack options
    if (analysis.type === 'stack' && analysis.stack_options && analysis.stack_options.length > 0) {
      console.log('\n' + theme.highlight('📦 Available Stacks:\n'));
      
      const { selectedStack } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedStack',
          message: 'Choose a stack:',
          choices: analysis.stack_options.map(stack => ({
            name: `${stack.name} - ${stack.description}`,
            value: stack
          }))
        }
      ]);

      // Get dependencies for selected stack
      const stackDeps = selectedStack.dependencies.map(depName => {
        return analysis.dependencies.find(d => 
          d.name.toLowerCase() === depName.toLowerCase() ||
          d.display_name.toLowerCase() === depName.toLowerCase()
        );
      }).filter(Boolean);

      if (stackDeps.length > 0) {
        return await selectDependencies(stackDeps);
      }
    }

    // Single dependency or manual selection
    return await selectDependencies(analysis.dependencies);

  } catch (error) {
    spinner.fail('Failed to analyze request');
    console.log(theme.error('\n❌ Error: ') + error.message);
    
    if (error.message.includes('API')) {
      console.log(theme.warning('\n💡 Please check your GEMINI_API_KEY in .env file'));
    }
    
    process.exit(1);
  }
}

/**
 * Select dependencies from list
 */
async function selectDependencies(dependencies) {
  console.log('\n' + theme.highlight('📦 Detected Dependencies:\n'));

  // Display dependencies with logos
  dependencies.forEach((dep, idx) => {
    const emoji = logoProvider.getEmoji(dep.logo_key || dep.name);
    const color = chalk[logoProvider.getColor(dep.logo_key || dep.name)] || chalk.white;
    
    console.log(color(
      `  ${emoji}  ${dep.display_name || dep.name}` +
      theme.muted(` - ${dep.description || ''}`)
    ));
  });

  console.log('');

  // Let user select which ones to install
  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Select dependencies to install:',
      choices: dependencies.map(dep => ({
        name: `${logoProvider.getEmoji(dep.logo_key || dep.name)}  ${dep.display_name || dep.name}`,
        value: dep,
        checked: true
      })),
      validate: (answer) => {
        if (answer.length < 1) {
          return 'You must choose at least one dependency.';
        }
        return true;
      }
    }
  ]);

  selectedDependencies = selected;

  // Confirm selection
  console.log('\n' + theme.success('✅ Selected ' + selectedDependencies.length + ' dependencies\n'));
  
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Proceed with installation?',
      default: true
    }
  ]);

  if (!confirmed) {
    console.log(theme.warning('\n⚠️  Installation cancelled\n'));
    process.exit(0);
  }

  return selectedDependencies;
}

/**
 * STEP 2: Installation
 */
async function step2_Installation() {
  console.log('\n' + theme.highlight('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(theme.primary.bold('  STEP 2: Installation'));
  console.log(theme.highlight('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  // Check sudo access before installation
  const hasSudoAccess = await checkSudoAccess();
  if (!hasSudoAccess) {
    console.log(theme.error('Installation cannot proceed without sudo access.'));
    process.exit(1);
  }

  const total = selectedDependencies.length;
  installationResults = [];

  // First check what's already installed
  console.log(theme.info('Checking which dependencies are already installed...\n'));
  
  for (let i = 0; i < selectedDependencies.length; i++) {
    const dep = selectedDependencies[i];
    const emoji = logoProvider.getEmoji(dep.logo_key || dep.name);
    
    // Quick check if already installed
    const isInstalled = await verifier.verifyInstallation(dep);
    if (isInstalled.success) {
      console.log(theme.success(`  ✅ ${emoji}  ${dep.display_name || dep.name} is already installed (${isInstalled.actual})`));
      installationResults.push({
        success: true,
        name: dep.name,
        alreadyInstalled: true,
        version: isInstalled.actual
      });
      selectedDependencies[i].skipInstall = true;
    } else {
      console.log(theme.muted(`  ⏳ ${emoji}  ${dep.display_name || dep.name} needs to be installed`));
    }
  }
  
  const needsInstall = selectedDependencies.filter(d => !d.skipInstall);
  
  if (needsInstall.length === 0) {
    console.log('\n' + theme.success('🎉 All dependencies are already installed!'));
    return;
  }
  
  console.log(theme.info(`\n📦 Installing ${needsInstall.length} dependencies...\n`));

  for (let i = 0; i < selectedDependencies.length; i++) {
    const dep = selectedDependencies[i];
    
    if (dep.skipInstall) {
      continue; // Skip already installed
    }
    
    const emoji = logoProvider.getEmoji(dep.logo_key || dep.name);
    
    console.log(theme.info(`\n[${i + 1}/${total}] ${emoji}  Installing ${dep.display_name || dep.name}...`));

    const spinner = ora({
      text: 'Running installation commands...',
      color: 'cyan'
    }).start();

    let showOutput = false;

    try {
      const result = await installer.installDependency(dep, (progress) => {
        if (progress.status === 'installing') {
          spinner.text = `${progress.command.substring(0, 50)}...`;
          
          // Show output for errors or important messages
          if (progress.output && (
            progress.output.includes('error') ||
            progress.output.includes('Error') ||
            progress.output.includes('failed')
          )) {
            if (!showOutput) {
              spinner.stop();
              showOutput = true;
            }
            process.stdout.write(theme.muted(progress.output));
          }
        }
      });

      if (result.success) {
        spinner.succeed(theme.success(`${dep.display_name || dep.name} installed successfully`));
      } else {
        spinner.fail(theme.error(`${dep.display_name || dep.name} installation failed`));
      }

      installationResults.push(result);

    } catch (error) {
      spinner.fail(theme.error(`${dep.display_name || dep.name} installation failed`));
      console.log(theme.error('  Error: ') + error.message);
      
      installationResults.push({
        success: false,
        name: dep.name,
        error: error.message
      });
    }
  }

  const successCount = installationResults.filter(r => r.success).length;
  
  console.log('\n' + boxen(
    theme.highlight('Installation Summary\n\n') +
    theme.success(`✅ Success: ${successCount}/${total}\n`) +
    theme.error(`❌ Failed: ${total - successCount}/${total}`),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: successCount === total ? 'green' : 'yellow'
    }
  ));

  // Ask if user wants to see terminal output
  if (total - successCount > 0) {
    const { showLogs } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'showLogs',
        message: 'Some installations failed. View detailed logs?',
        default: false
      }
    ]);

    if (showLogs) {
      installationResults.forEach(result => {
        if (!result.success && result.results) {
          console.log('\n' + theme.error(`\n=== ${result.name} Logs ===`));
          result.results.forEach(r => {
            if (!r.success) {
              console.log(theme.muted(r.error || r.output));
            }
          });
        }
      });
    }
  }

  // Wait before proceeding
  await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continue',
      message: 'Proceed to verification?',
      default: true
    }
  ]);
}

/**
 * STEP 3: Verification
 */
async function step3_Verification() {
  console.log('\n' + theme.highlight('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(theme.primary.bold('  STEP 3: Verification'));
  console.log(theme.highlight('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const spinner = ora({
    text: 'Verifying installations...',
    color: 'cyan'
  }).start();

  try {
    verificationResults = await verifier.verifyAll(selectedDependencies, (progress) => {
      spinner.text = `Verifying ${progress.name}... (${progress.current}/${progress.total})`;
    });

    spinner.stop();

    // Display results
    console.log('');
    verificationResults.results.forEach(result => {
      const emoji = logoProvider.getEmoji(result.name);
      
      if (result.success) {
        console.log(theme.success(`✅ ${emoji}  ${result.name}`));
        console.log(theme.muted(`   Expected: ${result.expected}`));
        console.log(theme.info(`   Actual: ${result.actual}\n`));
      } else {
        console.log(theme.error(`❌ ${emoji}  ${result.name}`));
        console.log(theme.muted(`   Expected: ${result.expected}`));
        console.log(theme.error(`   Actual: ${result.actual}`));
        console.log(theme.muted(`   ${result.message}\n`));
      }
    });

    // Summary
    const report = verifier.generateReport(verificationResults);
    
    console.log(boxen(
      theme.highlight('Verification Complete!\n\n') +
      theme.success(`✅ Verified: ${report.summary.success}/${report.summary.total}\n`) +
      theme.error(`❌ Failed: ${report.summary.failed}/${report.summary.total}\n\n`) +
      (report.summary.allSuccess 
        ? theme.success.bold('🎉 All installations verified successfully!') 
        : theme.warning('⚠️  Some verifications failed. Check details above.')),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: report.summary.allSuccess ? 'green' : 'yellow'
      }
    ));

  } catch (error) {
    spinner.fail('Verification failed');
    console.log(theme.error('\n❌ Error: ') + error.message);
  }
}

/**
 * Main wizard flow
 */
async function runWizard() {
  displayBanner();

  // Check API key
  if (!process.env.GEMINI_API_KEY) {
    console.log(boxen(
      theme.error('❌ GEMINI_API_KEY not found!\n\n') +
      theme.info('Please set your Gemini API key in .env file:\n') +
      theme.muted('GEMINI_API_KEY=your_api_key_here\n\n') +
      theme.info('Get your API key from:\n') +
      theme.primary('https://makersuite.google.com/app/apikey'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'red'
      }
    ));
    process.exit(1);
  }

  // Detect system
  const spinner = ora({
    text: 'Detecting system information...',
    color: 'cyan'
  }).start();

  systemInfo = systemDetector.getSystemInfo();
  spinner.succeed('System detected!');

  displaySystemInfo();

  try {
    // Step 1: Discovery
    await step1_Discovery();

    // Step 2: Installation
    await step2_Installation();

    // Step 3: Verification
    await step3_Verification();

    // Final message
    console.log(gradient.pastel('\n✨ Wizard complete! Thank you for using Gemini Wizard.\n'));

  } catch (error) {
    console.log(theme.error('\n💥 Wizard error: ') + error.message);
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(gradient.pastel('\n\n👋 Wizard cancelled. Goodbye!\n'));
  installer.cancel();
  process.exit(0);
});

// Run the wizard
runWizard().catch(error => {
  console.log(theme.error('\n💥 Fatal error: ') + error.message);
  process.exit(1);
});
