import type { Metadata } from 'next';

import { CONFIG } from 'src/global-config';

import { ContestRankingView } from 'src/sections/academy/contests/view';

// ----------------------------------------------------------------------

export const metadata: Metadata = { title: `Contest Reytingi | ${CONFIG.appName}` };

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;

  return <ContestRankingView id={id} />;
}
