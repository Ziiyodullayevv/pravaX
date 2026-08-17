'use client';

import useSWR from 'swr';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { useTranslate } from 'src/locales';
import { fetcher, endpoints } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

type UserItem = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  is_premium: boolean;
  phone_number: string;
  photo_url: string;
};

type StudentItem = {
  id: number;
  user: UserItem;
  joined_at: string;
  is_active: boolean;
};

// ----------------------------------------------------------------------

export function StudentsView() {
  const { t } = useTranslate();

  const { data, isLoading, error } = useSWR<StudentItem[]>(endpoints.academy.students, fetcher);

  const renderContent = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return <EmptyContent error title={t('common.error')} description={t('common.errorDesc')} sx={{ py: 8 }} />;
    }

    return (
      <Scrollbar>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ '& th': { whiteSpace: 'nowrap' } }}>
                <TableCell>{t('students.student')}</TableCell>
                <TableCell>{t('students.username')}</TableCell>
                <TableCell>{t('students.email')}</TableCell>
                <TableCell>{t('students.phone')}</TableCell>
                <TableCell>{t('students.premium')}</TableCell>
                <TableCell>{t('students.status')}</TableCell>
                <TableCell>{t('students.joinedAt')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data ?? []).map((item) => {
                const fullName = [item.user.first_name, item.user.last_name]
                  .filter(Boolean)
                  .join(' ') || item.user.username;

                return (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar src={item.user.photo_url || undefined} alt={fullName} sx={{ width: 36, height: 36 }}>
                          {fullName[0]?.toUpperCase()}
                        </Avatar>
                        <Typography variant="subtitle2">{fullName}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{item.user.username}</TableCell>
                    <TableCell>{item.user.email || '—'}</TableCell>
                    <TableCell>{item.user.phone_number || '—'}</TableCell>
                    <TableCell>
                      <Label color={item.user.is_premium ? 'success' : 'default'}>
                        {item.user.is_premium ? t('common.premium') : t('common.standard')}
                      </Label>
                    </TableCell>
                    <TableCell>
                      <Label color={item.is_active ? 'success' : 'error'}>
                        {item.is_active ? t('common.active') : t('common.inactive')}
                      </Label>
                    </TableCell>
                    <TableCell>
                      {new Date(item.joined_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}

              {!isLoading && (data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
                    <EmptyContent title={t('students.noStudents')} sx={{ py: 6 }} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Scrollbar>
    );
  };

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading={t('students.title')}
        links={[
          { name: t('nav.dashboard'), href: paths.dashboard.root },
          { name: t('students.title') },
        ]}
        sx={{ mb: 3 }}
      />
      <Card>{renderContent()}</Card>
    </DashboardContent>
  );
}
