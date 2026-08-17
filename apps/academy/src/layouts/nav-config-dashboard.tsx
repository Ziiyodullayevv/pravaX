'use client';

import type { NavSectionProps } from 'src/components/nav-section';

import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/global-config';
import { useTranslate } from 'src/locales';

import { SvgColor } from 'src/components/svg-color';

// ----------------------------------------------------------------------

const icon = (name: string) => (
  <SvgColor src={`${CONFIG.assetsDir}/assets/icons/navbar/${name}.svg`} />
);

const ICONS = {
  user: icon('ic-user'),
  course: icon('ic-course'),
  banking: icon('ic-banking'),
  dashboard: icon('ic-dashboard'),
};

// ----------------------------------------------------------------------

export function useNavData(): NavSectionProps['data'] {
  const { t } = useTranslate();

  return [
    {
      subheader: t('nav.general'),
      items: [
        { title: t('nav.dashboard'), path: paths.dashboard.root, icon: ICONS.dashboard },
      ],
    },
    {
      subheader: t('nav.management'),
      items: [
        {
          title: t('nav.students'),
          path: paths.academy.students,
          icon: ICONS.user,
        },
        {
          title: t('nav.contests'),
          path: paths.academy.contests.root,
          icon: ICONS.course,
          children: [
            { title: t('nav.contestsList'), path: paths.academy.contests.root },
            { title: t('nav.contestsNew'), path: paths.academy.contests.new },
          ],
        },
        {
          title: t('nav.income'),
          path: paths.academy.income,
          icon: ICONS.banking,
        },
      ],
    },
  ];
}

// Static fallback for non-hook contexts (SSR / layout)
export const navData: NavSectionProps['data'] = [
  {
    subheader: 'Umumiy',
    items: [
      { title: 'Dashboard', path: paths.dashboard.root, icon: icon('ic-dashboard') },
    ],
  },
  {
    subheader: 'Boshqaruv',
    items: [
      { title: "O'quvchilar", path: paths.academy.students, icon: icon('ic-user') },
      {
        title: 'Test sinovlar',
        path: paths.academy.contests.root,
        icon: icon('ic-course'),
        children: [
          { title: "Ro'yxat", path: paths.academy.contests.root },
          { title: 'Yangi test sinov', path: paths.academy.contests.new },
        ],
      },
      { title: 'Daromad', path: paths.academy.income, icon: icon('ic-banking') },
    ],
  },
];
