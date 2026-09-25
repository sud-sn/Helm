import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Menu,
  Modal,
  Text,
  Tooltip,
  createTheme,
  localStorageColorSchemeManager,
} from '@mantine/core';
import { brandColors } from './tokens';

const sans =
  "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const mono =
  "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const colorSchemeManager = localStorageColorSchemeManager({ key: 'helm-color-scheme' });

export const theme = createTheme({
  primaryColor: 'helm',
  primaryShade: { light: 6, dark: 8 },
  colors: brandColors,
  fontFamily: sans,
  fontFamilyMonospace: mono,
  headings: {
    fontFamily: sans,
    fontWeight: '650',
    sizes: {
      h1: { fontSize: '1.625rem', lineHeight: '1.3' },
      h2: { fontSize: '1.3125rem', lineHeight: '1.35' },
      h3: { fontSize: '1.125rem', lineHeight: '1.4' },
      h4: { fontSize: '1rem', lineHeight: '1.45' },
    },
  },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Text: Text.extend({ defaultProps: { size: 'sm' } }),
    Button: Button.extend({ defaultProps: { size: 'sm' } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { variant: 'subtle', color: 'gray' } }),
    Badge: Badge.extend({ defaultProps: { radius: 'sm', variant: 'light' } }),
    Card: Card.extend({ defaultProps: { withBorder: true, padding: 'lg', radius: 'md' } }),
    Modal: Modal.extend({
      defaultProps: { centered: true, overlayProps: { backgroundOpacity: 0.45, blur: 2 } },
    }),
    Tooltip: Tooltip.extend({ defaultProps: { withArrow: true, openDelay: 300 } }),
    Menu: Menu.extend({ defaultProps: { shadow: 'md', withinPortal: true } }),
  },
});
