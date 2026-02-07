#!/bin/bash

# Interactive API Key Setup Script

echo "🔑 Gemini API Key Setup"
echo "======================="
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "📄 Found existing .env file"
    
    # Check if API key is already set
    if grep -q "^GEMINI_API_KEY=AIza" .env; then
        echo "✅ API key appears to be configured!"
        echo ""
        read -p "Do you want to replace it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Keeping existing API key. Exiting..."
            exit 0
        fi
    fi
else
    echo "📝 Creating new .env file..."
    cp .env.example .env
fi

echo ""
echo "📋 How to get your Gemini API key:"
echo "1. Open: https://makersuite.google.com/app/apikey"
echo "2. Sign in with your Google account"
echo "3. Click 'Create API Key' or 'Get API Key'"
echo "4. Copy the key (starts with 'AIza...')"
echo ""

# Open browser automatically (optional)
read -p "Open browser to get API key? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    if command -v xdg-open > /dev/null; then
        xdg-open "https://makersuite.google.com/app/apikey" 2>/dev/null &
        echo "🌐 Opening browser..."
        sleep 2
    else
        echo "⚠️  Could not open browser automatically"
        echo "Please visit: https://makersuite.google.com/app/apikey"
    fi
fi

echo ""
echo "🔑 Please paste your API key below:"
read -p "API Key: " api_key

# Validate API key format (basic check)
if [[ ! $api_key =~ ^AIza[A-Za-z0-9_-]+$ ]]; then
    echo ""
    echo "⚠️  Warning: API key doesn't match expected format (should start with 'AIza')"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 1
    fi
fi

# Save to .env file
echo "GEMINI_API_KEY=$api_key" > .env
echo ""
echo "✅ API key saved to .env file!"
echo ""

# Test the API key
read -p "Test the API key now? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo "🧪 Testing API key..."
    
    # Create a simple test script
    node -e "
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    require('dotenv').config();
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    async function test() {
      try {
        const result = await model.generateContent('Say hello');
        const response = await result.response;
        const text = response.text();
        console.log('\n✅ API key is valid!');
        console.log('📝 Test response:', text.substring(0, 100) + '...');
        return true;
      } catch (error) {
        console.log('\n❌ API key test failed:', error.message);
        return false;
      }
    }
    
    test();
    " 2>/dev/null || echo "⚠️  Could not test API key (dependencies may not be installed)"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: npm install (if not already done)"
echo "2. Run: npm start"
echo "3. Start chatting with Gemini!"
echo ""
