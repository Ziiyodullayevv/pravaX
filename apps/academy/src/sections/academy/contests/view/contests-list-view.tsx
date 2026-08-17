'use client';

import useSWR from 'swr';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useTranslate } from 'src/locales';
import { fetcher, endpoints } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

type ContestItem = {
  id: number;
  title: string;
  description: string;
  contest_type: string;
  recurrence: string;
  status: 'upcoming' | 'active' | 'finished';
  start_time: string;
  end_time: string;
  entry_token: number;
  question_count: number;
  time_limit: number;
  participants_count: number;
};

// ----------------------------------------------------------------------

export function ContestsListView() {
  const { t } = useTranslate();

  const STATUS_COLOR: Record<string, 'warning' | 'success' | 'error'> = {
    upcoming: 'warning',
    active: 'success',
    finished: 'error',
  };

  const STATUS_LABEL: Record<string, string> = {
    upcoming: t('contests.upcoming'),
    active: t('common.active'),
    finished: t('contests.finished'),
  };

  const { data, isLoading, error } = useSWR<ContestItem[]>(endpoints.academy.contests, fetcher);

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
        <TableContainer sx={{ minWidth: 960 }}>
          <Table sx={{ minWidth: 960 }}>
            <TableHead>
              <TableRow sx={{ '& th': { whiteSpace: 'nowrap' } }}>
                <TableCell>{t('contests.name')}</TableCell>
                <TableCell>{t('contests.status')}</TableCell>
                <TableCell>{t('contests.startTime')}</TableCell>
                <TableCell>{t('contests.endTime')}</TableCell>
                <TableCell align="center">{t('contests.questionCount')}</TableCell>
                <TableCell align="center">{t('contests.participants')}</TableCell>
                <TableCell align="center">{t('contests.entryToken')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(data ?? []).map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2" noWrap sx={{ maxWidth: 200 }}>
                      {item.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Label color={STATUS_COLOR[item.status] ?? 'default'}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Label>
                  </TableCell>
                  <TableCell>{new Date(item.start_time).toLocaleString()}</TableCell>
                  <TableCell>{new Date(item.end_time).toLocaleString()}</TableCell>
                  <TableCell align="center">{item.question_count}</TableCell>
                  <TableCell align="center">{item.participants_count}</TableCell>
                  <TableCell align="center">{item.entry_token}</TableCell>
                  <TableCell>
                    <Button
                      component={RouterLink}
                      href={paths.academy.contests.ranking(item.id)}
                      size="small"
                      variant="outlined"
                    >
                      {t('contests.ranking')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!isLoading && (data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 0, border: 0 }}>
                    <EmptyContent title={t('contests.noContests')} sx={{ py: 6 }} />
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
        heading={t('contests.title')}
        links={[
          { name: t('nav.dashboard'), href: paths.dashboard.root },
          { name: t('contests.title') },
        ]}
        action={
          <Button
            component={RouterLink}
            href={paths.academy.contests.new}
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            {t('contests.newContest')}
          </Button>
        }
        sx={{ mb: 3 }}
      />
      <Card>{renderContent()}</Card>
    </DashboardContent>
  );
}
