/**
 * Logo Provider Module
 * Provides ASCII art logos and CDN URLs for various technologies
 */

const LOGOS = {
  python: {
    ascii: `
    ____        __  __               
   / __ \\__  __/ /_/ /_  ____  ____ 
  / /_/ / / / / __/ __ \\/ __ \\/ __ \\
 / ____/ /_/ / /_/ / / / /_/ / / / /
/_/    \\__, /\\__/_/ /_/\\____/_/ /_/ 
      /____/                        `,
    emoji: '🐍',
    color: 'yellow',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg'
  },
  
  nodejs: {
    ascii: `
    _   __          __         _     
   / | / /___  ____/ /__      (_)____
  /  |/ / __ \\/ __  / _ \\    / / ___/
 / /|  / /_/ / /_/ /  __/   / (__  ) 
/_/ |_/\\____/\\__,_/\\___(_)_/ /____/  
                        /___/        `,
    emoji: '⬢',
    color: 'green',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg'
  },
  
  docker: {
    ascii: `
    ____             __             
   / __ \\____  _____/ /_____  _____ 
  / / / / __ \\/ ___/ //_/ _ \\/ ___/ 
 / /_/ / /_/ / /__/ ,< /  __/ /     
/_____/\\____/\\___/_/|_|\\___/_/      `,
    emoji: '🐳',
    color: 'blue',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg'
  },
  
  git: {
    ascii: `
   _______ __
  / ____(_) /_
 / / __/ / __/
/ /_/ / / /_  
\\____/_/\\__/  `,
    emoji: '🔀',
    color: 'red',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg'
  },
  
  postgresql: {
    ascii: `
    ____             __                 _____ ____    __ 
   / __ \\____  _____/ /_____ _________ / ___// __ \\  / / 
  / /_/ / __ \\/ ___/ __/ __ \`/ ___/ _ \\\\__ \\/ / / / / /  
 / ____/ /_/ (__  ) /_/ /_/ / /  /  __/__/ / /_/ / / /___
/_/    \\____/____/\\__/\\__, /_/   \\___/____/\\___\\_\\/_____/
                     /____/                               `,
    emoji: '🐘',
    color: 'blue',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg'
  },
  
  mongodb: {
    ascii: `
    __  ___                           ____  ____ 
   /  |/  /___  ____  ____ _____     / __ \\/ __ )
  / /|_/ / __ \\/ __ \\/ __ \`/ __ \\   / / / / __  |
 / /  / / /_/ / / / / /_/ / /_/ /  / /_/ / /_/ / 
/_/  /_/\\____/_/ /_/\\__, /\\____/  /_____/_____/  
                   /____/                        `,
    emoji: '🍃',
    color: 'green',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg'
  },
  
  java: {
    ascii: `
       __                 
      / /___ __   ______ _
 __  / / __ \`/ | / / __ \`/
/ /_/ / /_/ /| |/ / /_/ / 
\\____/\\__,_/ |___/\\__,_/  `,
    emoji: '☕',
    color: 'red',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg'
  },
  
  go: {
    ascii: `
   ______      
  / ____/___   
 / / __/ __ \\  
/ /_/ / /_/ /  
\\____/\\____/   `,
    emoji: '🐹',
    color: 'cyan',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original.svg'
  },
  
  rust: {
    ascii: `
    ____             __ 
   / __ \\__  _______/ /_
  / /_/ / / / / ___/ __/
 / _, _/ /_/ (__  ) /_  
/_/ |_|\\__,_/____/\\__/  `,
    emoji: '🦀',
    color: 'red',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-plain.svg'
  },
  
  mysql: {
    ascii: `
    __  ___      _______ ____    __ 
   /  |/  /_  __/ ___/ __ \\ / / /   
  / /|_/ / / / /\\__ \\/ / / / / /    
 / /  / / /_/ /___/ / /_/ / /___    
/_/  /_/\\__, //____/\\___\\_\\/_____/   
       /____/                        `,
    emoji: '🐬',
    color: 'blue',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg'
  },
  
  redis: {
    ascii: `
    ____           ___     
   / __ \\___  ____/ (_)____
  / /_/ / _ \\/ __  / / ___/
 / _, _/  __/ /_/ / (__  ) 
/_/ |_|\\___/\\__,_/_/____/  `,
    emoji: '🔴',
    color: 'red',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg'
  },
  
  vscode: {
    ascii: `
 _    _______ ______          __   
| |  / / ___// ____/___  ____/ /__ 
| | / /\\__ \\/ /   / __ \\/ __  / _ \\
| |/ /___/ / /___/ /_/ / /_/ /  __/
|___//____/\\____/\\____/\\__,_/\\___/ `,
    emoji: '💻',
    color: 'blue',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg'
  },
  
  nginx: {
    ascii: `
    _   __      _           
   / | / /___ _(_)___  _  __
  /  |/ / __ \`/ / __ \\| |/_/
 / /|  / /_/ / / / / />  <  
/_/ |_/\\__, /_/_/ /_/_/|_|  
      /____/                `,
    emoji: '🌐',
    color: 'green',
    url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nginx/nginx-original.svg'
  },
  
  default: {
    ascii: `
   _____     ______                 
  / ___/____/ __/ /__      ______ __________
  \\__ \\/ __  / /_/ / | /| / / __ \`/ ___/ _ \\
 ___/ / /_/ / __/ /| |/ |/ / /_/ / /  /  __/
/____/\\__,_/_/ /_/ |__/|__/\\__,_/_/   \\___/ `,
    emoji: '📦',
    color: 'white',
    url: ''
  }
};

class LogoProvider {
  /**
   * Get logo for a technology
   */
  getLogo(name) {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return LOGOS[key] || LOGOS.default;
  }

  /**
   * Get emoji for a technology
   */
  getEmoji(name) {
    const logo = this.getLogo(name);
    return logo.emoji;
  }

  /**
   * Get ASCII art for a technology
   */
  getAscii(name) {
    const logo = this.getLogo(name);
    return logo.ascii;
  }

  /**
   * Get color for a technology
   */
  getColor(name) {
    const logo = this.getLogo(name);
    return logo.color;
  }

  /**
   * Get URL for a technology logo
   */
  getUrl(name) {
    const logo = this.getLogo(name);
    return logo.url;
  }

  /**
   * Get all available logos
   */
  getAllLogos() {
    return Object.keys(LOGOS).filter(k => k !== 'default');
  }
}

module.exports = LogoProvider;
