#!/usr/bin/env node

const inquirer = require('inquirer');
const chalk = require('chalk');
const boxen = require('boxen');
const gradient = require('gradient-string');
const figlet = require('figlet');
const ora = require('ora');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
let model;
let chat;
let conversationHistory = [];

// Color themes matching QuestGPT
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

// Display ASCII art banner
function displayBanner() {
  console.clear();
  
  const banner = figlet.textSync('Gemini Chat', {
    font: 'Standard',
    horizontalLayout: 'default'
  });
  
  console.log(gradient.pastel.multiline(banner));
  console.log(theme.primary.bold('\n  🤖 AI-Powered Terminal Chatbot\n'));
  console.log(boxen(
    theme.muted('Powered by Google Gemini AI\n') +
    theme.info('Type your messages and get intelligent responses!\n') +
    theme.warning('Commands: /help, /clear, /history, /exit'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      backgroundColor: '#111111'
    }
  ));
}

// Initialize chat session
async function initializeChat() {
  try {
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    chat = model.startChat({
      history: conversationHistory,
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });
    return true;
  } catch (error) {
    console.log(theme.error('\n❌ Error initializing Gemini API:'), error.message);
    console.log(theme.warning('\n💡 Make sure your GEMINI_API_KEY is set in .env file'));
    return false;
  }
}

// Display welcome message
function displayWelcome() {
  console.log(theme.success('\n✅ Connected to Gemini AI successfully!\n'));
  console.log(theme.info('💬 Start chatting below. I\'m here to help!\n'));
}

// Format and display AI response
function displayResponse(message, isUser = false) {
  const timestamp = new Date().toLocaleTimeString();
  
  if (isUser) {
    console.log('\n' + boxen(
      theme.highlight('You') + theme.muted(` • ${timestamp}\n\n`) + 
      chalk.white(message),
      {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        margin: { top: 1, bottom: 0, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: 'magenta',
        backgroundColor: '#1a1a1a'
      }
    ));
  } else {
    console.log('\n' + boxen(
      theme.primary('🤖 Gemini') + theme.muted(` • ${timestamp}\n\n`) + 
      chalk.white(message),
      {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: 'cyan',
        backgroundColor: '#1a1a1a'
      }
    ));
  }
}

// Handle special commands
function handleCommand(input) {
  const command = input.toLowerCase().trim();
  
  switch (command) {
    case '/help':
      console.log(boxen(
        theme.highlight('Available Commands:\n\n') +
        theme.primary('/help') + ' - Show this help message\n' +
        theme.primary('/clear') + ' - Clear the screen\n' +
        theme.primary('/history') + ' - Show conversation history\n' +
        theme.primary('/new') + ' - Start a new conversation\n' +
        theme.primary('/exit') + ' - Exit the chatbot',
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'yellow'
        }
      ));
      return true;
      
    case '/clear':
      console.clear();
      displayBanner();
      return true;
      
    case '/history':
      if (conversationHistory.length === 0) {
        console.log(theme.warning('\n📭 No conversation history yet.'));
      } else {
        console.log(theme.highlight('\n📜 Conversation History:\n'));
        conversationHistory.forEach((msg, idx) => {
          const role = msg.role === 'user' ? theme.secondary('You') : theme.primary('Gemini');
          console.log(`${idx + 1}. ${role}: ${theme.muted(msg.parts[0].text.substring(0, 80) + '...')}`);
        });
      }
      return true;
      
    case '/new':
      conversationHistory = [];
      initializeChat();
      console.clear();
      displayBanner();
      console.log(theme.success('\n🆕 Started a new conversation!'));
      return true;
      
    case '/exit':
      console.log(gradient.pastel('\n👋 Goodbye! Thanks for chatting!\n'));
      process.exit(0);
      
    default:
      return false;
  }
}

// Main chat loop
async function chatLoop() {
  while (true) {
    try {
      const { message } = await inquirer.prompt([
        {
          type: 'input',
          name: 'message',
          message: theme.secondary('You:'),
          prefix: '\n💬',
          validate: (input) => {
            if (!input.trim()) {
              return 'Please enter a message or command';
            }
            return true;
          }
        }
      ]);

      const userInput = message.trim();
      
      // Check for commands
      if (userInput.startsWith('/')) {
        if (handleCommand(userInput)) {
          continue;
        }
      }

      // Display user message
      displayResponse(userInput, true);

      // Show loading spinner
      const spinner = ora({
        text: 'Gemini is thinking...',
        color: 'cyan',
        spinner: 'dots12'
      }).start();

      try {
        // Send message to Gemini
        const result = await chat.sendMessage(userInput);
        const response = await result.response;
        const text = response.text();

        // Update conversation history
        conversationHistory.push({
          role: 'user',
          parts: [{ text: userInput }]
        });
        conversationHistory.push({
          role: 'model',
          parts: [{ text: text }]
        });

        spinner.stop();

        // Display AI response
        displayResponse(text, false);

      } catch (error) {
        spinner.stop();
        console.log(theme.error('\n❌ Error getting response:'), error.message);
        
        if (error.message.includes('API key')) {
          console.log(theme.warning('\n💡 Please check your GEMINI_API_KEY in .env file'));
        }
      }

    } catch (error) {
      if (error.isTtyError) {
        console.log(theme.error('\nPrompt couldn\'t be rendered in the current environment'));
      } else {
        console.log(theme.error('\nUnexpected error:'), error.message);
      }
      break;
    }
  }
}

// Main function
async function main() {
  displayBanner();
  
  // Check for API key
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

  // Initialize chat
  const spinner = ora({
    text: 'Connecting to Gemini AI...',
    color: 'cyan'
  }).start();

  const initialized = await initializeChat();
  spinner.stop();

  if (!initialized) {
    process.exit(1);
  }

  displayWelcome();

  // Start chat loop
  await chatLoop();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(gradient.pastel('\n\n👋 Goodbye! Thanks for chatting!\n'));
  process.exit(0);
});

// Run the chatbot
main().catch(error => {
  console.log(theme.error('\n💥 Fatal error:'), error);
  process.exit(1);
});
