# Gemini Terminal Chatbot 🤖

> A beautiful terminal-based chatbot powered by Google Gemini AI with QuestGPT theming

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- 🤖 **Powered by Google Gemini AI** - Get intelligent responses using Google's latest AI model
- 🎨 **Beautiful Terminal UI** - Styled with gradient colors, boxed messages, and ASCII art
- 💬 **Interactive Chat** - Natural conversation flow with context awareness
- 📜 **Conversation History** - Keep track of your chat history
- ⚡ **Fast & Responsive** - Real-time responses with loading indicators
- 🎯 **Simple Commands** - Easy-to-use slash commands for navigation
- 🌈 **QuestGPT Theme** - Matching the beautiful design of QuestGPT

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Google Gemini API key

### Installation

1. **Clone or navigate to the repository:**
   ```bash
   cd /home/prajwal/Documents/questgpt
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up your Gemini API key:**
   
   Edit the `.env` file and add your API key:
   ```bash
   nano .env
   ```
   
   Add your key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
   
   Get your API key from: [Google AI Studio](https://makersuite.google.com/app/apikey)

4. **Run the chatbot:**
   ```bash
   npm start
   ```
   
   Or:
   ```bash
   node chatbot.js
   ```

## 🎮 Usage

Once the chatbot starts, you'll see a beautiful ASCII art banner and can start chatting immediately!

### Chat Commands

The chatbot supports several slash commands:

- `/help` - Show available commands
- `/clear` - Clear the screen
- `/history` - View conversation history
- `/new` - Start a new conversation
- `/exit` - Exit the chatbot

### Example Conversation

```
💬 You: Hello! What can you help me with?

🤖 Gemini: Hello! I'm Gemini, a large language model from Google AI. 
I can help you with a wide range of tasks, including:
- Answering questions
- Generating creative content
- Translating languages
- And much more!

💬 You: Tell me a joke about programming

🤖 Gemini: Why do programmers prefer dark mode?
Because light attracts bugs! 😄
```

## 🎨 Theme & Design

The chatbot uses the same beautiful theme as QuestGPT:

- **Gradient ASCII Art** - Eye-catching pastel gradients
- **Boxed Messages** - Clean, boxed chat bubbles for user and AI
- **Color-coded Elements** - Different colors for different message types
- **Loading Spinners** - Smooth animations while waiting for responses
- **Dark Theme** - Easy on the eyes for long conversations

## 🛠️ Technology Stack

- **[@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)** - Google Gemini AI SDK
- **[inquirer](https://www.npmjs.com/package/inquirer)** - Interactive command-line prompts
- **[chalk](https://www.npmjs.com/package/chalk)** - Terminal string styling
- **[boxen](https://www.npmjs.com/package/boxen)** - Create boxes in the terminal
- **[gradient-string](https://www.npmjs.com/package/gradient-string)** - Beautiful gradients
- **[figlet](https://www.npmjs.com/package/figlet)** - ASCII art text
- **[ora](https://www.npmjs.com/package/ora)** - Elegant terminal spinners
- **[dotenv](https://www.npmjs.com/package/dotenv)** - Environment variable management

## 📁 Project Structure

```
questgpt/
├── chatbot.js         # Main chatbot application
├── package.json       # Project dependencies
├── .env               # Environment variables (API key)
├── .env.example       # Environment variables template
├── README.md          # This file
└── .gitignore         # Git ignore rules
```

## ⚙️ Configuration

### Gemini API Settings

You can customize the Gemini model behavior in `chatbot.js`:

```javascript
const model = genAI.getGenerativeModel({ 
  model: 'gemini-pro',
  generationConfig: {
    maxOutputTokens: 1000,
    temperature: 0.9,
    topP: 1,
  }
});
```

### Available Models

- `gemini-pro` - Text-only model (default)
- `gemini-pro-vision` - Multimodal model (text + images)

## 🔒 Security

- Never commit your `.env` file with your API key
- Keep your `GEMINI_API_KEY` private
- The `.gitignore` file is configured to exclude `.env`

## 🐛 Troubleshooting

### "GEMINI_API_KEY not found" error

Make sure you have:
1. Created a `.env` file in the project root
2. Added your API key: `GEMINI_API_KEY=your_key_here`
3. No extra spaces or quotes around the key

### "API key not valid" error

- Verify your API key is correct
- Check if your API key has the necessary permissions
- Ensure you're not exceeding the API quota

### Module not found errors

Run:
```bash
npm install
```

### Permission denied when running chatbot.js

Make the file executable:
```bash
chmod +x chatbot.js
```

## 🚀 Advanced Usage

### Run as a global command

You can make the chatbot available system-wide:

1. Add to `package.json`:
   ```json
   "bin": {
     "gemini-chat": "./chatbot.js"
   }
   ```

2. Link globally:
   ```bash
   npm link
   ```

3. Run from anywhere:
   ```bash
   gemini-chat
   ```

### Integration with shell

Add an alias to your `~/.bashrc` or `~/.zshrc`:

```bash
alias gchat='cd /home/prajwal/Documents/questgpt && node chatbot.js'
```

Then run from anywhere:
```bash
gchat
```

## 🤝 Contributing

Feel free to fork, improve, and submit pull requests!

## 📄 License

MIT License - feel free to use and modify!

## 🙏 Credits

- Powered by [Google Gemini AI](https://deepmind.google/technologies/gemini/)
- Inspired by [QuestGPT](https://github.com/prajwal-gunnala/questgpt)
- Built with love for the terminal ❤️

## 📞 Support

If you encounter any issues or have questions:
- Check the troubleshooting section above
- Review the [Gemini API documentation](https://ai.google.dev/docs)
- Open an issue on GitHub

---

**Happy chatting! 🚀**
