import { useState } from 'react';
import { Combobox, createListCollection, Stack, Text } from '@chakra-ui/react';
export type Choice = { value: string; label: string };
export function Picker({
  label,
  items,
  value,
  onChange,
  multiple = false,
  disabled = false,
  hideLabel = false,
  displayLabel,
}: {
  label: string;
  items: Choice[];
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  displayLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const selectedLabel = items.find((item) => item.value === value[0])?.label ?? '';
  const collection = createListCollection({
    items: items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
  });
  return (
    <Stack gap="1" onClick={(event) => event.stopPropagation()}>
      <Combobox.Root
        collection={collection}
        value={value}
        multiple={multiple}
        disabled={disabled}
        openOnClick
        size="sm"
        inputValue={multiple || editing ? query : selectedLabel}
        onOpenChange={(event) => {
          setEditing(event.open);
          if (!event.open) setQuery('');
        }}
        onInputValueChange={(event) => {
          if (event.reason === 'input-change') {
            setEditing(true);
            setQuery(event.inputValue);
          }
        }}
        onValueChange={(event) => {
          onChange(event.value);
          setQuery('');
        }}
      >
        <Combobox.Label srOnly={hideLabel}>{displayLabel ?? label}</Combobox.Label>
        <Combobox.Control>
          <Combobox.Input aria-label={label} placeholder="Type to filter…" />
          <Combobox.IndicatorGroup>
            <Combobox.Trigger aria-label={`Choose ${label}`} border="0" p="0" bg="transparent" rounded="0" />
          </Combobox.IndicatorGroup>
        </Combobox.Control>
        <Combobox.Positioner>
          <Combobox.Content maxH="60" overflowY="auto">
            <Combobox.Empty>No matches</Combobox.Empty>
            {collection.items.map((item) => (
              <Combobox.Item key={item.value} item={item}>
                {item.label}
                <Combobox.ItemIndicator />
              </Combobox.Item>
            ))}
          </Combobox.Content>
        </Combobox.Positioner>
      </Combobox.Root>
      {multiple && (
        <Text fontSize="xs">
          {value.map((id) => items.find((item) => item.value === id)?.label ?? id).join(', ') ||
            'No dependencies selected'}
        </Text>
      )}
    </Stack>
  );
}
export const choices = (values: readonly string[]): Choice[] =>
  values.map((value) => ({ value, label: value }));
