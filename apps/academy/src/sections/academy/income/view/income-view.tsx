'use client';

import useSWR from 'swr';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
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

type IncomeItem = {
  id: number;
  user: { id: number; username: string };
  plan: string;
  amount_som: string;
  created_at: string;
};

// ----------------------------------------------------------------------

export function IncomeView() {
  const { t } = useTranslate();

  const { data, isLoading, error } = useSWR<IncomeItem[]>(endpoints.academy.income, fetcher);

  const total = (data ?? []).reduce((sum, item) => sum + parseFloat(item.amount_som || '0'), 0);

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
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>{t('income.student')}</TableCell>
                <TableCell>{t('income.plan')}</TableCell>
                <TableCell align="right">{t('income.amount')}</TableCell>
                <TableCell>{t('income.date')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data ?? []).map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>
                    <Typography variant="subtitle2">{item.user.username}</Typography>
                  </TableCell>
                  <TableCell>
                    <Label color={item.plan === 'Premium' ? 'warning' : 'default'}>
                      {item.plan}
                    </Label>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" color="success.main">
                      {Number(item.amount_som).toLocaleString()} {t('dashboard.currency')}
                    </Typography>
                  </TableCell>
                  <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}

              {!isLoading && (data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                    <EmptyContent title={t('income.noIncome')} sx={{ py: 6 }} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {(data ?? []).length > 0 && (
          <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1">
              {t('income.totalIncome')}: <strong>{total.toLocaleString()} {t('dashboard.currency')}</strong>
            </Typography>
          </Box>
        )}
      </Scrollbar>
    );
  };

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading={t('income.title')}
        links={[
          { name: t('nav.dashboard'), href: paths.dashboard.root },
          { name: t('income.title') },
        ]}
        sx={{ mb: 3 }}
      />
      <Card>{renderContent()}</Card>
    </DashboardContent>
  );
}
