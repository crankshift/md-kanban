import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono/400.css';
export const system = createSystem(
  defaultConfig,
  defineConfig({
    globalCss: {
      html: { colorPalette: 'orange', bg: 'bg.subtle' },
      body: { fontSize: 'sm' },
      'button, a, input, textarea': {
        _focusVisible: {
          outline: '2px solid',
          outlineColor: 'colorPalette.focusRing',
          outlineOffset: '2px',
        },
      },
      'form fieldset': {
        display: 'flex',
        flexDirection: 'column',
        gap: '3',
        border: 0,
        minWidth: 0,
      },
      label: { display: 'flex', flexDirection: 'column', gap: '1' },
      'input:not([type=checkbox]), textarea': {
        borderWidth: '1px',
        borderColor: 'border',
        rounded: 'l2',
        p: '2',
        bg: 'bg.panel',
        width: 'full',
      },
      button: { cursor: 'pointer' },
      'button:disabled': { cursor: 'default', opacity: 0.5 },
      'form button, section[aria-label="Issue editor"] > div > button': {
        borderWidth: '1px',
        rounded: 'l2',
        px: '3',
        py: '1.5',
      },
      '[role=alert]': { color: 'fg.error', my: '2' },
    },
    theme: {
      semanticTokens: {
        colors: {
          orange: {
            solid: { value: { _light: '{colors.orange.600}', _dark: '{colors.orange.500}' } },
            contrast: { value: { _light: 'white', _dark: '{colors.gray.950}' } },
          },
        },
      },
      tokens: {
        fonts: {
          heading: { value: "'IBM Plex Sans Variable', system-ui, sans-serif" },
          body: { value: "'IBM Plex Sans Variable', system-ui, sans-serif" },
          mono: { value: "'IBM Plex Mono', monospace" },
        },
      },
    },
  }),
);
