document.addEventListener('DOMContentLoaded', function () {
  const commandInput = document.getElementById('command-input');
  const commandHistory = document.getElementById('command-history');
  const terminalContent = document.getElementById('terminal-content');
  const typedText = document.getElementById('typed-text');

  if (!commandInput || !commandHistory || !terminalContent || !typedText) {
    console.error('Terminal elements not found. Try again!');
    return;
  }

  // Identity is injected by Terminal.astro from env — never hardcoded here.
  const prompt = terminalContent.dataset.prompt || 'guest@orbit:~$';
  const links = {
    github: terminalContent.dataset.github || '',
    linkedin: terminalContent.dataset.linkedin || '',
    email: terminalContent.dataset.email || '',
    website: terminalContent.dataset.website || '',
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function link(href, label) {
    return `<a href="${href}" target="_blank" rel="noopener" class="underline underline-offset-4">${label}</a>`;
  }

  function contactLines() {
    const lines = [];
    if (links.github) lines.push(`  GitHub    ${link(links.github, links.github.replace(/^https?:\/\//, ''))}`);
    if (links.linkedin) lines.push(`  LinkedIn  ${link(links.linkedin, links.linkedin.replace(/^https?:\/\//, ''))}`);
    if (links.email) lines.push(`  Email     ${link(`mailto:${links.email}`, links.email)}`);
    if (links.website) lines.push(`  Website   ${link(links.website, links.website.replace(/^https?:\/\//, ''))}`);
    return lines.length ? lines.join('\n') : '  Contact details coming soon.';
  }

  // Proficiency bars render in a 10-block scale, columns aligned by padEnd.
  const skills = [
    ['Python', 90],
    ['AWS / GCP', 85],
    ['Kubernetes', 85],
    ['Terraform', 80],
    ['Docker', 85],
    ['CI/CD', 80],
    ['JavaScript', 70],
    ['SQL', 75],
  ];

  function skillBar(name, percent) {
    const filled = Math.round(percent / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    return `  ${name.padEnd(12)}${bar}  ${String(percent).padStart(3)}%`;
  }

  const commands = {
    help: () => `Available commands:

  help       Show this help message
  about      Who I am
  skills     Technical skills
  projects   Portfolio projects
  contact    Contact information
  resume     Download resume
  clear      Clear terminal
  ai-chat    Chat with an AI that knows my background`,

    about: () => `About me: (coming soon!)`,

    skills: () => `Technical skills:\n\n${skills.map(([n, p]) => skillBar(n, p)).join('\n')}`,

    projects: () => `Portfolio projects: (coming soon!)`,

    contact: () => `Contact:\n\n${contactLines()}`,

    resume: () => `(coming soon!)`,

    clear: () => 'CLEAR',

    'ai-chat': () => `AI chat coming soon!
  A local LLM with retrieval over my background will answer
  questions about my experience, projects, and interests.`,
  };

  function executeCommand(cmd) {
    const trimmedCmd = cmd.trim().toLowerCase();
    if (commands[trimmedCmd]) {
      return commands[trimmedCmd]();
    } else if (trimmedCmd === '') {
      return '';
    } else {
      return `Command not found: ${escapeHtml(trimmedCmd)}. Type 'help' for available commands.`;
    }
  }

  function addToHistory(command, output) {
    if (output === 'CLEAR') {
      commandHistory.innerHTML = '';
      return;
    }

    const historyEntry = document.createElement('div');
    historyEntry.className = 'mb-3';

    historyEntry.innerHTML = `
      <div><span class="text-term-blue">${prompt}</span> ${escapeHtml(command)}</div>
      <div class="whitespace-pre-wrap">${output}</div>
    `;

    commandHistory.appendChild(historyEntry);

    terminalContent.scrollTop = terminalContent.scrollHeight;
  }

  // Mirror the hidden input into the visible line so the block cursor
  // sits exactly where the next character will land.
  function syncTypedText() {
    typedText.textContent = commandInput.value;
  }

  commandInput.addEventListener('input', syncTypedText);

  commandInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const command = commandInput.value;
      const output = executeCommand(command);
      addToHistory(command, output);
      commandInput.value = '';
      syncTypedText();
    }
  });

  // Focus management: preventScroll stops the browser from yanking the
  // window around to reveal the visually hidden input. Refocus only on
  // clicks inside the terminal, and never while the user is selecting text.
  const terminalWindow = document.getElementById('terminal-window');

  function focusInput() {
    commandInput.focus({ preventScroll: true });
  }

  focusInput();

  (terminalWindow || terminalContent).addEventListener('click', function () {
    const selection = window.getSelection();
    if (selection && selection.toString()) return;
    focusInput();
  });
});
