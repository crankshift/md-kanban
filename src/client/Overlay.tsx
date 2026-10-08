import { useRef, type ReactNode } from 'react';
import { Button, Dialog, Portal } from '@chakra-ui/react';

export function Overlay({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root
      initialFocusEl={() =>
        content.current?.querySelector<HTMLInputElement>('input:not(:disabled), textarea:not(:disabled)') ?? content.current
      }
      open={open}
      onOpenChange={(event) => {
        if (!event.open) onClose();
      }}
      placement="center"
      size="xl"
      scrollBehavior="inside"
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content ref={content} maxH="90dvh">
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
              <Button
                ms="auto"
                size="xs"
                variant="ghost"
                onClick={onClose}
                aria-label={`Close ${title}`}
              >
                Close
              </Button>
            </Dialog.Header>
            <Dialog.Body pb="6">{children}</Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
