import { createMetadata } from 'src/lib/metadata';

import { OverviewAcademyView } from 'src/sections/overview/academy/view';

// ----------------------------------------------------------------------

export const metadata = createMetadata({
  title: 'Dashboard',
  description: "PravaX Academy boshqaruv paneli — o'quvchilar, test sinovlar va daromad statistikasini ko'ring.",
  path: '/dashboard',
});

export default function Page() {
  return <OverviewAcademyView />;
}
