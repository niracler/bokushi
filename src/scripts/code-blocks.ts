/**
 * Code block enhancements: copy button and language labels
 * Automatically enhances all code blocks in .prose containers
 */

// Language name mappings for better display
const LANGUAGE_NAMES: Record<string, string> = {
    js: 'JavaScript',
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    jsx: 'JavaScript React',
    py: 'Python',
    rs: 'Rust',
    go: 'Go',
    rb: 'Ruby',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    cs: 'C#',
    php: 'PHP',
    sh: 'Shell',
    bash: 'Bash',
    zsh: 'Zsh',
    ps1: 'PowerShell',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    toml: 'TOML',
    xml: 'XML',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    md: 'Markdown',
    mdx: 'MDX',
    sql: 'SQL',
    graphql: 'GraphQL',
    vim: 'Vim',
    lua: 'Lua',
    r: 'R',
    swift: 'Swift',
    kt: 'Kotlin',
    dart: 'Dart',
    astro: 'Astro',
};

function getLanguageName(lang: string): string {
    return LANGUAGE_NAMES[lang.toLowerCase()] || lang.toUpperCase();
}

function createCopyButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'code-copy-button';
    button.setAttribute('aria-label', 'Copy code to clipboard');
    button.innerHTML = '<span>Copy</span>';
    return button;
}

function createCodeHeader(lang: string, copyButton: HTMLButtonElement): HTMLDivElement {
    const header = document.createElement('div');
    header.className = 'code-block-header';

    const langLabel = document.createElement('span');
    langLabel.className = 'code-block-lang';
    langLabel.textContent = getLanguageName(lang);

    header.appendChild(langLabel);
    header.appendChild(copyButton);

    return header;
}

async function copyToClipboard(text: string, button: HTMLButtonElement): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);

        // Update button state
        button.classList.add('copied');
        button.innerHTML = '<span>Copied!</span>';

        // Reset after 2 seconds
        setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = '<span>Copy</span>';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy code:', err);
        button.innerHTML = '<span>Failed</span>';

        setTimeout(() => {
            button.innerHTML = '<span>Copy</span>';
        }, 2000);
    }
}

function enhanceCodeBlock(pre: HTMLElement): void {
    // Skip if already enhanced
    if (pre.parentElement?.classList.contains('code-block-wrapper')) {
        return;
    }

    const code = pre.querySelector('code');
    if (!code) return;

    // Get language from data-language attribute (added by Shiki)
    const lang = pre.getAttribute('data-language') || 'text';

    // Get code text
    const codeText = code.textContent || '';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    // Create copy button
    const copyButton = createCopyButton();
    copyButton.addEventListener('click', () => copyToClipboard(codeText, copyButton));

    // Create header
    const header = createCodeHeader(lang, copyButton);

    // Insert wrapper before pre
    pre.parentNode?.insertBefore(wrapper, pre);

    // Move pre into wrapper and add header
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
}

function initCodeBlocks(): void {
    // Find all code blocks in prose content
    const proseContainers = document.querySelectorAll('.prose');

    proseContainers.forEach(prose => {
        const codeBlocks = prose.querySelectorAll('pre:has(code)');
        codeBlocks.forEach(pre => enhanceCodeBlock(pre as HTMLElement));
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCodeBlocks);
} else {
    // DOM already loaded
    initCodeBlocks();
}

// Also observe for dynamically added code blocks (e.g., from view transitions)
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
                // Check if the added node itself is a prose container
                if (node.classList.contains('prose')) {
                    const codeBlocks = node.querySelectorAll('pre:has(code)');
                    codeBlocks.forEach(pre => enhanceCodeBlock(pre as HTMLElement));
                }
                // Check for prose containers within the added node
                const proseContainers = node.querySelectorAll('.prose');
                proseContainers.forEach(prose => {
                    const codeBlocks = prose.querySelectorAll('pre:has(code)');
                    codeBlocks.forEach(pre => enhanceCodeBlock(pre as HTMLElement));
                });
            }
        });
    });
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true,
});
