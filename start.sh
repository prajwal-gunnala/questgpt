#!/bin/bash

# Gemini Terminal Chatbot Quick Start Script

echo "🤖 Gemini Terminal Chatbot Setup"
echo "================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
fi

# Check if API key is set
if grep -q "^GEMINI_API_KEY=$" .env || grep -q "^GEMINI_API_KEY=your_api_key_here" .env; then
    echo "⚠️  GEMINI_API_KEY not set in .env file"
    echo ""
    echo "Please follow these steps:"
    echo "1. Go to: https://makersuite.google.com/app/apikey"
    echo "2. Create or copy your API key"
    echo "3. Edit .env file and add your key:"
    echo "   GEMINI_API_KEY=your_actual_api_key_here"
    echo ""
    read -p "Press Enter to open .env in nano editor (or Ctrl+C to exit)..."
    nano .env
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# Run the chatbot
echo "🚀 Starting Gemini Chatbot..."
echo ""
node chatbot.js
