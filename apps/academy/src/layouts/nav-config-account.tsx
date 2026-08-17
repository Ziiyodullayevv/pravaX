'use client';

import type { AccountDrawerProps } from './components/account-drawer';

import { paths } from 'src/routes/paths';

import { useTranslate } from 'src/locales';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export function useAccountNavData(): AccountDrawerProps['data'] {
  const { t } = useTranslate();

  return [
    {
      label: t('nav.dashboard'),
      href: paths.dashboard.root,
      icon: <Iconify icon="solar:home-angle-bold-duotone" />,
    },
    {
      label: t('nav.students'),
      href: paths.academy.students,
      icon: <Iconify icon="solar:users-group-rounded-bold-duotone" />,
    },
    {
      label: t('nav.contests'),
      href: paths.academy.contests.root,
      icon: <Iconify icon={"solar:cup-star-bold-duotone" as any} />,
    },
    {
      label: t('nav.income'),
      href: paths.academy.income,
      icon: <Iconify icon={"solar:wallet-money-bold-duotone" as any} />,
    },
  ];
}

export const _account: AccountDrawerProps['data'] = [];
