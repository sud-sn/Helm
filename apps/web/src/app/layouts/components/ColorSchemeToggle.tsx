import { ActionIcon, Tooltip, useMantineColorScheme } from '@mantine/core';
import { ActionIcons, ICON_STROKE } from '@/icons';

const NEXT = { light: 'dark', dark: 'auto', auto: 'light' } as const;
const LABEL = { light: 'Light theme', dark: 'Dark theme', auto: 'System theme' } as const;
const ICON = {
  light: ActionIcons.lightMode,
  dark: ActionIcons.darkMode,
  auto: ActionIcons.systemMode,
} as const;

export function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const Icon = ICON[colorScheme];
  return (
    <Tooltip label={`${LABEL[colorScheme]} — click to change`}>
      <ActionIcon
        variant="subtle"
        color="gray.0"
        size="lg"
        onClick={() => setColorScheme(NEXT[colorScheme])}
        aria-label={`${LABEL[colorScheme]}. Switch to ${LABEL[NEXT[colorScheme]]}`}
      >
        <Icon size={20} stroke={ICON_STROKE} />
      </ActionIcon>
    </Tooltip>
  );
}
