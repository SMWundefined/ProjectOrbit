document.addEventListener('DOMContentLoaded', function () {
  const commandInput = document.getElementById('command-input');
  const commandHistory = document.getElementById('command-history');
  const terminalContent = document.getElementById('terminal-content');

  if (!commandInput || !commandHistory || !terminalContent) {
    console.error('Terminal elements not found. Try again!');
    return;
  }

  const commands = {
    help: () => `Available commands:
  help       - Show this help message
  about      - About Wadood Sultan
  skills     - Technical skills
  projects   - Portfolio projects
  contact    - Contact information
  resume     - Download resume
  clear      - Clear terminal
  wadoodllm  - Chat with me, about me!!! (coming soon!)`,

    about: () => `About Wadood Sultan: (coming soon!)`,

    skills: () => `Technical Skills: (coming soon!)`,

    projects: () => `Portfolio Projects: (coming soon!)`,

    contact: () => `Contact Information:
  GitHub: <a href="https://github.com/SMWundefined" style="text-decoration: underline;">github.com/SMWundefined</a>
  LinkedIn: <a href="https://linkedin.com/in/smw147" style="text-decoration: underline;">linkedin.com/in/smw147</a>
  Email:  <a href="mailto:wadoodsultanm@gmail.com@gmail.com" style="text-decoration: underline;">wadoodsultanm@gmail.com</a>
  Portfolio: <a href="http://www.wadoodsultan.com" style="text-decoration: underline;">wadoodsultan.com</a>`,

    resume: () => `(coming soon!)`,

    clear: () => 'CLEAR',

    'wadoodllm': () => `AI Assistant coming soon!
  This will be powered by Claude API trained on my resume and experience.
  Stay tuned for interactive AI conversations about my background!`,
  };

  function executeCommand(cmd) {
    const trimmedCmd = cmd.trim().toLowerCase();
    if (commands[trimmedCmd]) {
      return commands[trimmedCmd]();
    } else if (trimmedCmd === '') {
      return '';
    } else {
      return `Command not found: ${cmd}. Type 'help' for available commands.`;
    }
  }

  function addToHistory(command, output) {
    if (output === 'CLEAR') {
      commandHistory.innerHTML = '';
      return;
    }

    const historyEntry = document.createElement('div');
    historyEntry.className = 'mb-2';

    historyEntry.innerHTML = `
      <div class="text-blue-400">wadood@wadoodSultan-WSL ~ % ${command}</div>
      <div class="text-green-400 whitespace-pre-line ml-4">${output}</div>
    `;

    commandHistory.appendChild(historyEntry);

    terminalContent.scrollTop = terminalContent.scrollHeight;
  }

//TODO: Add command history navigation (up/down arrows) and auto-complete functionality

  commandInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const command = commandInput.value;
      const output = executeCommand(command);
      addToHistory(command, output);
      commandInput.value = '';
    }
  });

  // Keep input focused when clicking anywhere
  document.addEventListener('click', function () {
    commandInput.focus();
  });
});