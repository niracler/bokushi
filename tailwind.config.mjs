/** @type {import('tailwindcss').Config} */
export default {
	content: ['src/**/*.{astro,tsx,ts,jsx,js,md,mdx}'],
	theme: {
		extend: {
			colors: {
				page: 'var(--color-bg-page)',
				surface: 'var(--color-bg-surface)',
				muted: 'var(--color-bg-muted)',
				text: {
					primary: 'var(--color-text-primary)',
					secondary: 'var(--color-text-secondary)',
					muted: 'var(--color-text-muted)',
					inverse: 'var(--color-text-inverse)',
				},
				accent: {
					DEFAULT: 'var(--color-accent)',
					dark: 'var(--color-accent-dark)',
					soft: 'var(--color-accent-soft)',
					tint: 'var(--color-accent-tint)',
				},
				border: {
					DEFAULT: 'var(--color-border)',
					soft: 'var(--color-border-soft)',
					subtle: 'var(--color-border-subtle)',
					strong: 'var(--color-border-strong)',
				},
				success: 'var(--color-success)',
				warning: 'var(--color-warning)',
				danger: 'var(--color-danger)',
			},
			boxShadow: {
				soft: 'var(--shadow-soft)',
				strong: 'var(--shadow-strong)',
			},
			spacing: {
				1: 'var(--space-1)',
				2: 'var(--space-2)',
				3: 'var(--space-3)',
				4: 'var(--space-4)',
				6: 'var(--space-6)',
				8: 'var(--space-8)',
				12: 'var(--space-12)',
			},
			borderRadius: {
				DEFAULT: 'var(--radius-md)',
				sm: 'var(--radius-sm)',
				md: 'var(--radius-md)',
				lg: 'var(--radius-lg)',
			},
		},
	},
	corePlugins: {
		container: false,
	},
};
