// PROTOTYPE — throwaway. Chakra system per accent palette, so portaled overlays inherit the accent too.
import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

export const palettes = ['indigo', 'blue', 'orange', 'gray'] as const;
export type Palette = (typeof palettes)[number];
export const paletteLabels: Record<Palette, string> = { indigo: 'Indigo', blue: 'Blue', orange: 'Orange', gray: 'Mono' };

const indigo = {
  50: '#eef0ff', 100: '#e0e4ff', 200: '#c6cdfd', 300: '#a3acf9', 400: '#7f86f3', 500: '#6164ea',
  600: '#4d4bd9', 700: '#403cbd', 800: '#353398', 900: '#2f2f78', 950: '#1c1b46',
};

function config(palette: Palette) {
  return defineConfig({
    globalCss: {
      html: { colorPalette: palette, bg: 'bg.subtle' },
      body: { fontFeatureSettings: '"ss01", "tnum"' },
    },
    theme: {
      tokens: {
        fonts: {
          heading: { value: "'IBM Plex Sans Variable', system-ui, sans-serif" },
          body: { value: "'IBM Plex Sans Variable', system-ui, sans-serif" },
          mono: { value: "'IBM Plex Mono', ui-monospace, monospace" },
        },
        colors: { indigo: Object.fromEntries(Object.entries(indigo).map(([key, value]) => [key, { value }])) },
      },
      semanticTokens: {
        colors: {
          indigo: {
            solid: { value: { _light: '{colors.indigo.600}', _dark: '{colors.indigo.500}' } },
            contrast: { value: 'white' },
            fg: { value: { _light: '{colors.indigo.700}', _dark: '{colors.indigo.300}' } },
            muted: { value: { _light: '{colors.indigo.100}', _dark: '{colors.indigo.900}' } },
            subtle: { value: { _light: '{colors.indigo.50}', _dark: '{colors.indigo.950}' } },
            emphasized: { value: { _light: '{colors.indigo.200}', _dark: '{colors.indigo.800}' } },
            focusRing: { value: { _light: '{colors.indigo.500}', _dark: '{colors.indigo.400}' } },
          },
        },
      },
    },
  });
}

const systems = new Map<Palette, ReturnType<typeof createSystem>>();
export function systemFor(palette: Palette) {
  let system = systems.get(palette);
  if (!system) { system = createSystem(defaultConfig, config(palette)); systems.set(palette, system); }
  return system;
}
