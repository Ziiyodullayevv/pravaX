const ROOTS = {
  AUTH: '/auth',
  DASHBOARD: '/dashboard',
};

// ----------------------------------------------------------------------

export const paths = {
  page404: '/error/404',
  // AUTH
  auth: {
    jwt: {
      signIn: `${ROOTS.AUTH}/jwt/sign-in`,
    },
  },
  // ACADEMY
  academy: {
    students: `${ROOTS.DASHBOARD}/students`,
    income: `${ROOTS.DASHBOARD}/income`,
    contests: {
      root: `${ROOTS.DASHBOARD}/contests`,
      new: `${ROOTS.DASHBOARD}/contests/new`,
      ranking: (id: string | number) => `${ROOTS.DASHBOARD}/contests/${id}/ranking`,
    },
  },
  // DASHBOARD
  dashboard: {
    root: ROOTS.DASHBOARD,
  },
};
