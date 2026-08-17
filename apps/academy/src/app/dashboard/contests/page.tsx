import { createMetadata } from 'src/lib/metadata';

import { ContestsListView } from 'src/sections/academy/contests/view';

// ----------------------------------------------------------------------

export const metadata = createMetadata({
  title: 'Test sinovlar',
  description: "O'quvchilar uchun prava imtihon testlarini yarating va boshqaring.",
  path: '/dashboard/contests',
});

export default function Page() {
  return <ContestsListView />;
}
