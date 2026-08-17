import { createMetadata } from 'src/lib/metadata';

import { IncomeView } from 'src/sections/academy/income/view';

// ----------------------------------------------------------------------

export const metadata = createMetadata({
  title: 'Daromad',
  description: "Akademiyangizga tushgan daromadlar va to'lovlar tarixini kuzating.",
  path: '/dashboard/income',
});

export default function Page() {
  return <IncomeView />;
}
