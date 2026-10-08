import { Suspense, type ReactNode } from 'react';
import { Box, Tabs } from '@chakra-ui/react';
import { LazySafeMarkdown } from './LazySafeMarkdown';
export function MarkdownEditor({
  children,
  body,
  previewLabel,
}: {
  children: ReactNode;
  body: string;
  previewLabel: string;
}) {
  return (
    <Tabs.Root defaultValue="write" size="sm">
      <Tabs.List>
        <Tabs.Trigger value="write">Write</Tabs.Trigger>
        <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
        <Tabs.Indicator />
      </Tabs.List>
      <Box h="18rem" borderWidth="1px" rounded="l2" overflow="hidden">
        <Tabs.Content
          value="write"
          h="full"
          p="0"
          css={{ '& textarea': { height: '100%', resize: 'none', border: 0 } }}
        >
          {children}
        </Tabs.Content>
        <Tabs.Content value="preview" h="full" overflowY="auto" p="3" aria-label={previewLabel}>
          <Suspense fallback={null}>
            <LazySafeMarkdown>{body}</LazySafeMarkdown>
          </Suspense>
        </Tabs.Content>
      </Box>
    </Tabs.Root>
  );
}
