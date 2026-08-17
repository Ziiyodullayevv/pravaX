'use client';

import { useTranslate } from 'src/locales';
import { AuthSplitLayout } from 'src/layouts/auth-split';

import { GuestGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  const { t } = useTranslate();

  return (
    <GuestGuard>
      <AuthSplitLayout
        slotProps={{
          section: {
            title: t('auth.welcomeBack'),
            subtitle: t('auth.welcomeBackDesc'),
          },
        }}
      >
        {children}
      </AuthSplitLayout>
    </GuestGuard>
  );
}
