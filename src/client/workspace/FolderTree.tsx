import { Box, Button, HStack, IconButton, Text } from '@chakra-ui/react';
import { LuChevronRight, LuFolder } from 'react-icons/lu';
import type { Document } from './model';

export function FolderTree({ documents, folders, scope, collapsed, onCollapse, onScope }: { documents: Document[]; folders: string[]; scope: string; collapsed: string[]; onCollapse: (folders: string[]) => void; onScope: (folder: string) => void }) {
  return <Box as="nav" className="folder-tree" aria-label="Folder navigation" p="2" overflowY="auto" flex="1"><Text fontSize="xs" color="fg.muted" mb="2" px="2">Folders</Text>
    <Button size="sm" variant={!scope ? 'subtle' : 'ghost'} justifyContent="start" w="full" onClick={() => onScope('')} aria-current={!scope ? 'page' : undefined}><LuFolder />All files<Text ms="auto" fontSize="xs">{documents.length}</Text></Button>
    {folders.filter((folder) => ![...collapsed].some((parent) => folder.startsWith(parent + '/'))).map((folder) => {
      const children = folders.some((candidate) => candidate.startsWith(folder + '/'));
      const count = documents.filter((document) => document.path.startsWith(folder + '/')).length;
      return <HStack key={folder} gap="0" ps={`${(folder.split('/').length - 1) * 10}px`}>
        {children ? <IconButton variant="ghost" size="2xs" aria-label={`${collapsed.includes(folder) ? 'Expand' : 'Collapse'} ${folder}`} aria-expanded={!collapsed.includes(folder)} onClick={() => onCollapse(collapsed.includes(folder) ? collapsed.filter((path) => path !== folder) : [...collapsed, folder])}><LuChevronRight style={{ transform: collapsed.includes(folder) ? undefined : 'rotate(90deg)' }} /></IconButton> : <Box w="6" flexShrink="0" />}
        <Button title={folder} aria-label={`Scope ${folder}`} aria-current={scope === folder ? 'page' : undefined} size="xs" variant={scope === folder ? 'subtle' : 'ghost'} colorPalette={scope === folder ? 'orange' : 'gray'} minW="0" flex="1" justifyContent="start" onClick={() => onScope(folder)}><LuFolder /><Text truncate>{folder.split('/').at(-1)}</Text><Text ms="auto" color="fg.muted">{count}</Text></Button>
      </HStack>;
    })}</Box>;
}
