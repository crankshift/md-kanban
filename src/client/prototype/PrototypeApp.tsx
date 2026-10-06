// PROTOTYPE — throwaway. Question: what should the Chakra board look like?
// Three structurally different variants on the real app route, switchable via ?variant=A|B|C (← / → keys or the bottom bar),
// with accent palette (?palette=) and colour mode toggles. Reads come from the local server; writes are in-memory stubs.
// Only bundled by `pnpm prototype` (vite --mode prototype); production builds never include this folder.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Box, Button, ChakraProvider, Checkbox, HStack, IconButton, Spinner, Text } from '@chakra-ui/react';
import { LuChevronLeft, LuChevronRight, LuMoon, LuSun } from 'react-icons/lu';
import { ColorModeProvider, useColorMode } from '../components/ui/color-mode';
import { Toaster } from '../components/ui/toaster';
import { useProtoBoard, type ProtoBoard, type Recovery } from './data';
import { palettes, paletteLabels, systemFor, type Palette } from './theme';
import * as A from './VariantA';
import * as B from './VariantB';
import * as C from './VariantC';

export type VariantProps = { board: ProtoBoard; recovery: Recovery | null; clearRecovery: () => void; reportOpen: (id: string | null) => void };

const variants = { A: { name: A.name, View: A.VariantA }, B: { name: B.name, View: B.VariantB }, C: { name: C.name, View: C.VariantC } } as const;
type Key = keyof typeof variants;
const keys = Object.keys(variants) as Key[];

function useParam<T extends string>(name: string, allowed: readonly T[], fallback: T): [T, (value: T) => void] {
  const read = () => { const value = new URLSearchParams(location.search).get(name); return allowed.includes(value as T) ? value as T : fallback; };
  const [value, setValue] = useState<T>(read);
  useEffect(() => { const onPop = () => setValue(read()); addEventListener('popstate', onPop); return () => removeEventListener('popstate', onPop); }, []);
  return [value, (next: T) => {
    const params = new URLSearchParams(location.search);
    params.set(name, next);
    history.replaceState(null, '', `?${params}`);
    setValue(next);
  }];
}

function Switcher({ variant, setVariant, palette, setPalette, failWrites, setFailWrites, onAgentEdit }: {
  variant: Key; setVariant: (key: Key) => void; palette: Palette; setPalette: (palette: Palette) => void;
  failWrites: boolean; setFailWrites: (fail: boolean) => void; onAgentEdit: () => void;
}) {
  const { colorMode, toggleColorMode } = useColorMode();
  const step = (delta: number) => setVariant(keys[(keys.indexOf(variant) + delta + keys.length) % keys.length]!);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable], [role=dialog], [role=menu], [role=combobox]')) return;
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  // Deliberately not themed by the variant: high-contrast pill that is clearly not part of the design.
  return <HStack position="fixed" bottom="4" left="50%" transform="translateX(-50%)" zIndex="max" gap="3" px="3" py="1.5"
    bg="gray.950" color="gray.50" rounded="full" boxShadow="xl" fontSize="xs" css={{ '& button': { color: 'gray.50' } }}>
    <IconButton size="xs" variant="ghost" rounded="full" aria-label="Previous variant" onClick={() => step(-1)} _hover={{ bg: 'gray.800' }}><LuChevronLeft /></IconButton>
    <Text minW="40" textAlign="center" fontWeight="medium">{variant} · {variants[variant].name}</Text>
    <IconButton size="xs" variant="ghost" rounded="full" aria-label="Next variant" onClick={() => step(1)} _hover={{ bg: 'gray.800' }}><LuChevronRight /></IconButton>
    <Box w="1px" h="5" bg="gray.700" />
    {palettes.map((value) => <Button key={value} size="2xs" rounded="full" variant={palette === value ? 'solid' : 'ghost'} colorPalette={value}
      _hover={{ bg: palette === value ? undefined : 'gray.800' }} onClick={() => setPalette(value)}>{paletteLabels[value]}</Button>)}
    <IconButton size="xs" variant="ghost" rounded="full" aria-label="Toggle colour mode" onClick={toggleColorMode} _hover={{ bg: 'gray.800' }}>{colorMode === 'dark' ? <LuSun /> : <LuMoon />}</IconButton>
    <Box w="1px" h="5" bg="gray.700" />
    <Checkbox.Root size="xs" colorPalette="red" checked={failWrites} onCheckedChange={(event) => setFailWrites(!!event.checked)}>
      <Checkbox.HiddenInput /><Checkbox.Control /><Checkbox.Label color="gray.50">Fail writes</Checkbox.Label></Checkbox.Root>
    <Button size="2xs" variant="outline" rounded="full" borderColor="gray.600" _hover={{ bg: 'gray.800' }} onClick={onAgentEdit}>Simulate agent edit</Button>
  </HStack>;
}

function Prototype({ palette, setPalette }: { palette: Palette; setPalette: (palette: Palette) => void }) {
  const [variant, setVariant] = useParam<Key>('variant', keys, 'B');
  const [failWrites, setFailWrites] = useState(false);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [openIssue, setOpenIssue] = useState<string | null>(null);
  const board = useProtoBoard({ failWrites, onReopen: setRecovery });
  const { View } = variants[variant];
  return <>
    {board.loaded ? <View key={variant} board={board} recovery={recovery} clearRecovery={() => setRecovery(null)} reportOpen={setOpenIssue} />
      : <HStack h="100dvh" justify="center"><Spinner /><Text color="fg.muted">Reading issues…</Text></HStack>}
    <Switcher variant={variant} setVariant={setVariant} palette={palette} setPalette={setPalette}
      failWrites={failWrites} setFailWrites={setFailWrites} onAgentEdit={() => board.simulateAgentEdit(openIssue)} />
    <Toaster />
  </>;
}

function Root() {
  const [palette, setPalette] = useParam<Palette>('palette', palettes, 'orange');
  return <ChakraProvider value={systemFor(palette)}>
    <ColorModeProvider><Prototype palette={palette} setPalette={setPalette} /></ColorModeProvider>
  </ChakraProvider>;
}

export function mountPrototype(element: HTMLElement) {
  createRoot(element).render(<StrictMode><Root /></StrictMode>);
}
