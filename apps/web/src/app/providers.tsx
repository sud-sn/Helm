import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@/styles/global.css';

import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryClient } from '@/lib/query-client';
import { colorSchemeManager, theme } from '@/theme/theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider
      theme={theme}
      colorSchemeManager={colorSchemeManager}
      defaultColorScheme="auto"
    >
      <DatesProvider settings={{ firstDayOfWeek: 1 }}>
        <Notifications position="bottom-right" limit={4} />
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
