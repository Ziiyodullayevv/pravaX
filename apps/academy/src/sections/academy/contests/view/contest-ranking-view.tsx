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

import { getDefaultAvatar } from 'src/utils/avatar-utils';

import { useTranslate } from 'src/locales';
import { fetcher, endpoints } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

type RankUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  photo_url: string;
  is_premium: boolean;
};

type RankingItem = {
  rank: number;
  user: RankUser;
  correct_count: number;
  wrong_count: number;
  duration_secs: number;
  finished_at: string;
};

type Props = { id: string };

const RANK_COLORS: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

// ----------------------------------------------------------------------

export function ContestRankingView({ id }: Props) {
  const { t } = useTranslate();
  const { data, isLoading, error } = useSWR<RankingItem[]>(
    endpoints.academy.contestRanking(id),
    fetcher
  );

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
                <TableCell width={64} align="center">{t('ranking.rank')}</TableCell>
                <TableCell>{t('ranking.user')}</TableCell>
                <TableCell>{t('ranking.phone')}</TableCell>
                <TableCell align="center">{t('ranking.correct')}</TableCell>
                <TableCell align="center">{t('ranking.wrong')}</TableCell>
                <TableCell align="center">{t('ranking.duration')}</TableCell>
                <TableCell>{t('ranking.finishedAt')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data ?? []).map((item) => {
                const fullName = [item.user.first_name, item.user.last_name].filter(Boolean).join(' ') || item.user.username;
                const avatarSrc = item.user.photo_url || getDefaultAvatar(fullName) || undefined;
                return (
                <TableRow key={item.user.id} hover>
                  <TableCell align="center">
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        mx: 'auto',
                        fontSize: 14,
                        fontWeight: 700,
                        bgcolor: RANK_COLORS[item.rank] ?? 'grey.300',
                        color: item.rank <= 3 ? '#000' : 'text.primary',
                      }}
                    >
                      {item.rank}
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar src={avatarSrc} alt={fullName} sx={{ width: 36, height: 36 }}>
                        {fullName.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {fullName}
                          {item.user.is_premium && (
                            <Label color="warning" sx={{ ml: 0.75, fontSize: 10 }}>Premium</Label>
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{item.user.username}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.user.phone_number || '—'}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Label color="success">{item.correct_count}</Label>
                  </TableCell>
                  <TableCell align="center">
                    <Label color="error">{item.wrong_count}</Label>
                  </TableCell>
                  <TableCell align="center">{formatDuration(item.duration_secs)}</TableCell>
                  <TableCell>
                    {new Date(item.finished_at).toLocaleString('uz-UZ')}
                  </TableCell>
                </TableRow>
                );
              })}

              {!isLoading && (data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
                    <EmptyContent title={t('ranking.noParticipants')} sx={{ py: 6 }} />
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
        heading={t('ranking.heading', { id })}
        links={[
          { name: t('nav.dashboard'), href: paths.dashboard.root },
          { name: t('contests.title'), href: paths.academy.contests.root },
          { name: t('ranking.title') },
        ]}
        sx={{ mb: 3 }}
      />

      <Card>{renderContent()}</Card>
    </DashboardContent>
  );
}
