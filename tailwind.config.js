export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Repointed to CSS custom properties (src/styles/global.css) so the
        // dark-theme redesign updates every existing text-darbi-navy /
        // bg-darbi-navy / border-darbi-navy usage from one place.
        'darbi-navy': 'var(--darbi-navy)',
        'darbi-gold': 'var(--darbi-gold)',
        'darbi-purple': 'var(--darbi-purple)',
      },
    },
  },
  plugins: [],
};
