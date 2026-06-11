// Command registry for the terminal. Pure logic, no DOM access — the UI
// layer (terminal.ts) renders whatever these return. Personal details are
// injected through CommandContext, never hardcoded here.

export interface CommandContext {
  links: {
    github: string;
    linkedin: string;
    email: string;
    website: string;
  };
}

export type CommandResult =
  | { type: 'output'; html: string }
  | { type: 'clear' }
  | { type: 'enter-chat'; html: string };

interface Command {
  description: string;
  run: (ctx: CommandContext) => CommandResult;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function output(html: string): CommandResult {
  return { type: 'output', html };
}

function link(href: string, label: string): string {
  return `<a href="${href}" target="_blank" rel="noopener" class="underline underline-offset-4">${label}</a>`;
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

// Proficiency bars render in a 10-block scale, columns aligned by padEnd.
const SKILLS: ReadonlyArray<readonly [string, number]> = [
  ['Python', 90],
  ['AWS / GCP', 85],
  ['Kubernetes', 85],
  ['Terraform', 80],
  ['Docker', 85],
  ['CI/CD', 80],
  ['JavaScript', 70],
  ['SQL', 75],
];

function skillBar(name: string, percent: number): string {
  const filled = Math.round(percent / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `  ${name.padEnd(12)}${bar}  ${String(percent).padStart(3)}%`;
}

function contactLines(links: CommandContext['links']): string {
  const lines: string[] = [];
  if (links.github) lines.push(`  GitHub    ${link(links.github, stripProtocol(links.github))}`);
  if (links.linkedin) lines.push(`  LinkedIn  ${link(links.linkedin, stripProtocol(links.linkedin))}`);
  if (links.email) lines.push(`  Email     ${link(`mailto:${links.email}`, links.email)}`);
  if (links.website) lines.push(`  Website   ${link(links.website, stripProtocol(links.website))}`);
  return lines.length ? lines.join('\n') : '  Contact details coming soon.';
}

const commands: Record<string, Command> = {
  help: {
    description: 'Show this help message',
    run: () => output(helpText()),
  },
  about: {
    description: 'Who I am',
    run: () => output('About me: (coming soon!)'),
  },
  skills: {
    description: 'Technical skills',
    run: () => output(`Technical skills:\n\n${SKILLS.map(([n, p]) => skillBar(n, p)).join('\n')}`),
  },
  projects: {
    description: 'Portfolio projects',
    run: () => output('Portfolio projects: (coming soon!)'),
  },
  contact: {
    description: 'Contact information',
    run: (ctx) => output(`Contact:\n\n${contactLines(ctx.links)}`),
  },
  resume: {
    description: 'Download resume',
    run: () => output('(coming soon!)'),
  },
  clear: {
    description: 'Clear terminal',
    run: () => ({ type: 'clear' }),
  },
  'ai-chat': {
    description: 'Chat with an AI that knows my background',
    run: () => ({
      type: 'enter-chat',
      html: `Entering AI chat. Ask about my experience, projects, or interests.\nType 'exit' to return to the terminal.`,
    }),
  },
};

function helpText(): string {
  const width = Math.max(...Object.keys(commands).map((name) => name.length)) + 3;
  const rows = Object.entries(commands).map(
    ([name, command]) => `  ${name.padEnd(width)}${command.description}`
  );
  return ['Available commands:', '', ...rows].join('\n');
}

export function commandNames(): string[] {
  return Object.keys(commands);
}

export function executeCommand(input: string, ctx: CommandContext): CommandResult {
  const name = input.trim().toLowerCase();
  if (!name) return output('');
  const command = commands[name];
  if (!command) {
    return output(`Command not found: ${escapeHtml(name)}. Type 'help' for available commands.`);
  }
  return command.run(ctx);
}
