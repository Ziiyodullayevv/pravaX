'use client';

import type { BoxProps } from '@mui/material/Box';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { getDefaultAvatar } from 'src/utils/avatar-utils';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export function NavUpgrade({ sx, ...other }: BoxProps) {
  const { user } = useAuthContext();
  const [copied, setCopied] = useState(false);

  const displayName = user?.fullname || user?.username || '';
  const email = user?.email || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const avatarSrc = user?.photo_url || getDefaultAvatar(displayName) || undefined;

  const handleCopy = async () => {
    if (!user?.invite_code) return;
    try {
      await navigator.clipboard.writeText(user.invite_code);
    } catch {
      const el = document.createElement('textarea');
      el.value = user.invite_code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={[{ px: 2, py: 4, textAlign: 'center' }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 0.5 }}>

        <Avatar
          src={avatarSrc}
          alt={displayName}
          sx={{ width: 48, height: 48, mb: 0.5 }}
        >
          {avatarLetter}
        </Avatar>

        <Typography
          variant="subtitle2"
          noWrap
          sx={{ color: 'var(--layout-nav-text-primary-color)', maxWidth: 160 }}
        >
          {displayName}
        </Typography>

        <Typography
          variant="caption"
          noWrap
          sx={{ color: 'var(--layout-nav-text-disabled-color)', maxWidth: 160 }}
        >
          {email}
        </Typography>

        {user?.invite_code && (
          <Tooltip title={copied ? 'Nusxalandi!' : 'Nusxalash'} placement="top">
            <Box
              onClick={handleCopy}
              sx={{
                mt: 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.5,
                borderRadius: 1,
                cursor: 'pointer',
                border: '1px dashed',
                borderColor: copied ? 'success.main' : 'primary.main',
                bgcolor: copied ? 'success.lighter' : 'primary.lighter',
                transition: 'all 0.2s',
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, letterSpacing: 1, color: copied ? 'success.dark' : 'primary.dark' }}
              >
                {user.invite_code}
              </Typography>
              <Iconify
                icon={copied ? 'eva:checkmark-fill' : 'solar:copy-bold'}
                width={12}
                sx={{ color: copied ? 'success.dark' : 'primary.dark' }}
              />
            </Box>
          </Tooltip>
        )}

      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

export function UpgradeBlock({ sx, ...other }: BoxProps) {
  return <Box sx={sx} {...other} />;
}
