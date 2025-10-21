module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Disable all ESLint rules
    'no-unused-vars': 'off',
    'prefer-const': 'off',
    'no-var': 'off',
    'no-unreachable': 'off',
    'no-case-declarations': 'off',
    'no-empty': 'off',
    'no-undef': 'off',
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/no-static-element-interactions': 'off',
    'jsx-a11y/no-noninteractive-element-interactions': 'off',
    'jsx-a11y/mouse-events-have-key-events': 'off',
    'jsx-a11y/media-has-caption': 'off',
    'react/no-unknown-property': 'off'
  }
};