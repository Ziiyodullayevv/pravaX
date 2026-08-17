// Gender detection based on common Uzbek/CIS names
// Returns 'female', 'male', or 'unknown'

const FEMALE_SUFFIXES = ['ra', 'iya', 'ya', 'noz', 'gul', 'oy', 'bibi', 'xon', 'oma', 'ima', 'ila', 'ida'];
const FEMALE_NAMES = [
  'malika', 'nilufar', 'zulfiya', 'gulnora', 'mohira', 'shahlo', 'feruza', 'dilorom',
  'sevinch', 'barno', 'hulkar', 'sabohat', 'maftuna', 'muazzam', 'nargiza', 'sarvinoz',
  'aziza', 'kamola', 'lobar', 'munira', 'nasiba', 'nodira', 'oydin', 'parizod',
  'robiya', 'sabina', 'sitora', 'umida', 'yulduz', 'zilola', 'zuhra', 'iroda',
  'gavhar', 'dildora', 'dilfuza', 'hulkar', 'lola', 'madina', 'manzura', 'marjona',
];

const MALE_SUFFIXES = ['bek', 'jon', 'din', 'xon', 'mir', 'qul', 'boy', 'voy', 'bir', 'fur', 'zod', 'loy'];
const MALE_NAMES = [
  'akobir', 'jasur', 'bobur', 'ulugbek', 'sardor', 'sherzod', 'firdavs', 'otabek',
  'sanjar', 'bekzod', 'nodir', 'jahongir', 'alisher', 'temur', 'sirojiddin', 'abdulloh',
  'muhammadali', 'islombek', 'umid', 'behruz', 'dilshod', 'eldor', 'farrux', 'hamid',
  'ilhom', 'javlon', 'kamol', 'laziz', 'mansur', 'nozim', 'oybek', 'ravshan', 'saidakbar',
  'tohir', 'vohid', 'xurshid', 'zafar', 'anvar', 'bahodir', 'doniyor', 'erkin',
];

export type Gender = 'male' | 'female' | 'unknown';

export function detectGender(fullName: string): Gender {
  if (!fullName) return 'unknown';

  const firstName = fullName.trim().split(' ')[0].toLowerCase();

  if (FEMALE_NAMES.includes(firstName)) return 'female';
  if (MALE_NAMES.includes(firstName)) return 'male';

  for (const suffix of FEMALE_SUFFIXES) {
    if (firstName.endsWith(suffix)) return 'female';
  }
  for (const suffix of MALE_SUFFIXES) {
    if (firstName.endsWith(suffix)) return 'male';
  }

  return 'unknown';
}

export function getDefaultAvatar(fullName: string): string | null {
  const gender = detectGender(fullName);
  if (gender === 'male') return '/assets/images/mock/avatar/avatar-2.webp';
  if (gender === 'female') return '/assets/images/mock/avatar/avatar-6.webp';
  return null;
}
