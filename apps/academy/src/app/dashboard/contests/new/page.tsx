import type { Metadata } from 'next';

import { CONFIG } from 'src/global-config';

import { ContestCreateView } from 'src/sections/academy/contests/view';

// ----------------------------------------------------------------------

export const metadata: Metadata = { title: `Yangi Contest | ${CONFIG.appName}` };

export default function Page() {
  return <ContestCreateView />;
}
