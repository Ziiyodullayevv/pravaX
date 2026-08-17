import { createMetadata } from 'src/lib/metadata';

import { StudentsView } from 'src/sections/academy/students/view';

// ----------------------------------------------------------------------

export const metadata = createMetadata({
  title: "O'quvchilar",
  description: "Akademiyangizga qo'shilgan barcha o'quvchilarni boshqaring va kuzating.",
  path: '/dashboard/students',
});

export default function Page() {
  return <StudentsView />;
}
