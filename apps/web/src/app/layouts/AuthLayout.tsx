import { Box, Card, Center, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Box
      mih="100vh"
      style={{
        background:
          'linear-gradient(160deg, var(--mantine-color-navy-9) 0%, var(--mantine-color-navy-8) 45%, var(--mantine-color-helm-9) 100%)',
      }}
    >
      <Center mih="100vh" p="md">
        <Stack w="100%" maw={420} gap="lg">
          <Center>
            <Logo onDark subtitle="BI/ETL delivery portal" />
          </Center>
          <Card shadow="xl" p="xl" radius="lg">
            <Stack gap={4} mb="lg">
              <Text fw={700} size="xl">
                {title}
              </Text>
              {subtitle ? (
                <Text c="dimmed" size="sm">
                  {subtitle}
                </Text>
              ) : null}
            </Stack>
            {children}
          </Card>
          <Text ta="center" size="xs" c="navy.2">
            Accounts are created by your administrator.
          </Text>
        </Stack>
      </Center>
    </Box>
  );
}
