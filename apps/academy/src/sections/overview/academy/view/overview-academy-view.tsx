'use client';

import useSWR from 'swr';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { fNumber } from 'src/utils/format-number';

import { useTranslate } from 'src/locales';
import { fetcher, endpoints } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';
import { SeoIllustration } from 'src/assets/illustrations';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { AppWelcome } from '../app-welcome';
import { AppFeatured } from '../app-featured';

// ----------------------------------------------------------------------

type DashboardData = {
  id: number;
  name: string;
  phone: string;
  invite_code: string;
  balance: string;
  is_active: boolean;
  active_members: string;
  total_members: string;
  total_income: string;
  contest_count: string;
  recent_income: string;
};


// ----------------------------------------------------------------------

function InviteCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip title={copied ? 'Nusxalandi!' : 'Bosib nusxalang'} placement="top">
      <Box
        onClick={handleCopy}
        sx={{
          mt: 2,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 0.875,
          borderRadius: 1.5,
          cursor: 'pointer',
          border: '1.5px dashed',
          borderColor: copied ? 'success.light' : 'primary.light',
          bgcolor: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.10)',
          transition: 'all 0.2s',
          '&:hover': { bgcolor: copied ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.18)' },
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 800, letterSpacing: 1.5, color: copied ? 'success.light' : 'common.white' }}
        >
          {code}
        </Typography>
        <Iconify
          icon={copied ? 'eva:checkmark-fill' : 'solar:copy-bold'}
          width={15}
          sx={{ color: copied ? 'success.light' : 'grey.400' }}
        />
      </Box>
    </Tooltip>
  );
}

// ----------------------------------------------------------------------

type StatCardProps = {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  suffix?: string;
};

function StatCard({ title, value, icon, color, suffix }: StatCardProps) {
  return (
    <Card sx={{ p: 3, position: 'relative' }}>
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 48,
          height: 48,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `${color}18`,
        }}
      >
        <Iconify icon={icon} width={28} sx={{ color }} />
      </Box>

      <Typography variant="subtitle2">{title}</Typography>

      <Typography variant="h3" sx={{ mt: 1.5, mb: 1 }}>
        {typeof value === 'number' ? fNumber(value) : value}
        {suffix && (
          <Box component="span" sx={{ typography: 'body2', color: 'text.secondary', ml: 0.5 }}>
            {suffix}
          </Box>
        )}
      </Typography>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function OverviewAcademyView() {
  const { user } = useAuthContext();
  const { t } = useTranslate();

  const FEATURED_ITEMS = [
    {
      id: '1',
      title: t('dashboard.featured1Title'),
      description: t('dashboard.featured1Desc'),
      coverUrl: '/assets/background/background-7.webp',
    },
    {
      id: '2',
      title: t('dashboard.featured2Title'),
      description: t('dashboard.featured2Desc'),
      coverUrl: '/assets/background/background-6.webp',
    },
    {
      id: '3',
      title: t('dashboard.featured3Title'),
      description: t('dashboard.featured3Desc'),
      coverUrl: '/assets/background/background-3.webp',
    },
  ];

  const { data } = useSWR<DashboardData>(endpoints.academy.dashboard, fetcher);

  const displayName = data?.name || user?.fullname || user?.username || 'Admin';
  const inviteCode = data?.invite_code || user?.invite_code;

  return (
    <DashboardContent maxWidth="xl">
      <Grid container spacing={3}>

        {/* Welcome banner */}
        <Grid size={{ xs: 12, md: 8 }} sx={{ width: 1 }}>
          <AppWelcome
            title={displayName}
            description={t('dashboard.welcomeDesc')}
            img={<SeoIllustration hideBackground />}
            action={inviteCode ? <InviteCodeChip code={inviteCode} /> : undefined}
          />
        </Grid>

        {/* Featured carousel */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: { xs: 'none', md: 'block' } }}>
          <AppFeatured list={FEATURED_ITEMS} />
        </Grid>

        {/* Stat cards */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title={t('dashboard.activeStudents')}
            value={Number(data?.active_members) || 0}
            icon="solar:users-group-rounded-bold-duotone"
            color="#22c55e"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title={t('dashboard.totalStudents')}
            value={Number(data?.total_members) || 0}
            icon="solar:users-group-two-rounded-bold-duotone"
            color="#3b82f6"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title={t('dashboard.contestCount')}
            value={Number(data?.contest_count) || 0}
            icon={"solar:cup-star-bold-duotone" as any}
            color="#f59e0b"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title={t('dashboard.totalIncome')}
            value={Math.round(Number(data?.total_income) || 0)}
            icon={"solar:wallet-money-bold-duotone" as any}
            color="#8b5cf6"
            suffix={t('dashboard.currency')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title={t('dashboard.recentIncome')}
            value={Math.round(Number(data?.recent_income) || 0)}
            icon="solar:chart-2-bold-duotone"
            color="#06b6d4"
            suffix={t('dashboard.currency')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title={t('dashboard.balance')}
            value={Math.round(Number(data?.balance) || 0)}
            icon="solar:card-bold-duotone"
            color="#ef4444"
            suffix={t('dashboard.currency')}
          />
        </Grid>

      </Grid>
    </DashboardContent>
  );
}
