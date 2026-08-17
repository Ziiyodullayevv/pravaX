'use client';

import type { IconButtonProps } from '@mui/material/IconButton';

import { useState } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { RouterLink } from 'src/routes/components';

import { getDefaultAvatar } from 'src/utils/avatar-utils';

import { useTranslate } from 'src/locales';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { AnimateBorder } from 'src/components/animate';

import { useAuthContext } from 'src/auth/hooks';

import { AccountButton } from './account-button';
import { SignOutButton } from './sign-out-button';

// ----------------------------------------------------------------------

export type AccountDrawerProps = IconButtonProps & {
  data?: {
    label: string;
    href: string;
    icon?: React.ReactNode;
    info?: React.ReactNode;
  }[];
};

export function AccountDrawer({ data = [], sx, ...other }: AccountDrawerProps) {
  const { user } = useAuthContext();
  const { t } = useTranslate();

  const displayName = user?.fullname || user?.username || '';
  const email = user?.email || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const avatarSrc = user?.photo_url || getDefaultAvatar(displayName) || undefined;

  const { value: open, onFalse: onClose, onTrue: onOpen } = useBoolean();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!user?.invite_code) return;
    try {
      await navigator.clipboard.writeText(user.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = user.invite_code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderAvatar = () => (
    <AnimateBorder
      sx={{ mb: 2, p: '6px', width: 96, height: 96, borderRadius: '50%' }}
      slotProps={{
        primaryBorder: { size: 120, sx: { color: 'primary.main' } },
      }}
    >
      <Avatar src={avatarSrc} alt={displayName} sx={{ width: 1, height: 1 }}>
        {avatarLetter}
      </Avatar>
    </AnimateBorder>
  );

  const renderList = () => (
    <MenuList
      disablePadding
      sx={[
        (theme) => ({
          py: 3,
          px: 2.5,
          borderTop: `dashed 1px ${theme.vars.palette.divider}`,
          borderBottom: `dashed 1px ${theme.vars.palette.divider}`,
          '& li': { p: 0 },
        }),
      ]}
    >
      {data.map((option) => (
        <MenuItem key={option.label}>
          <Link
            component={RouterLink}
            href={option.href}
            color="inherit"
            underline="none"
            onClick={onClose}
            sx={{
              p: 1,
              width: 1,
              display: 'flex',
              typography: 'body2',
              alignItems: 'center',
              color: 'text.secondary',
              '& svg': { width: 24, height: 24 },
              '&:hover': { color: 'text.primary' },
            }}
          >
            {option.icon}

            <Box component="span" sx={{ ml: 2 }}>
              {option.label}
            </Box>

            {option.info && (
              <Label color="error" sx={{ ml: 1 }}>
                {option.info}
              </Label>
            )}
          </Link>
        </MenuItem>
      ))}
    </MenuList>
  );

  return (
    <>
      <AccountButton
        onClick={onOpen}
        photoURL={avatarSrc}
        displayName={displayName}
        sx={sx}
        {...other}
      />

      <Drawer
        aria-hidden={!open}
        open={open}
        onClose={onClose}
        anchor="right"
        slotProps={{
          backdrop: { invisible: true },
          paper: { sx: { width: 320 } },
        }}
      >
        <IconButton
          onClick={onClose}
          sx={{ top: 12, left: 12, zIndex: 9, position: 'absolute' }}
        >
          <Iconify icon="mingcute:close-line" />
        </IconButton>

        <Scrollbar>
          <Box sx={{ pt: 8, display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
            {renderAvatar()}

            <Typography variant="subtitle1" noWrap sx={{ mt: 2 }}>
              {displayName}
            </Typography>

            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }} noWrap>
              {email}
            </Typography>
          </Box>

          {user?.invite_code && (
            <Box sx={{ px: 3, pt: 2, pb: 1, display: 'flex', justifyContent: 'center' }}>
              <Tooltip title={copied ? t('common.copied') : t('common.copyCode')} placement="top">
                <Box
                  onClick={handleCopyCode}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: '1px dashed',
                    borderColor: copied ? 'success.main' : 'primary.main',
                    bgcolor: copied ? 'success.lighter' : 'primary.lighter',
                    transition: 'all 0.2s',
                    '&:hover': { opacity: 0.85 },
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, color: copied ? 'success.dark' : 'primary.dark', letterSpacing: 1 }}
                  >
                    {user.invite_code}
                  </Typography>
                  <Iconify
                    icon={copied ? 'eva:checkmark-fill' : 'solar:copy-bold'}
                    width={14}
                    sx={{ color: copied ? 'success.dark' : 'primary.dark' }}
                  />
                </Box>
              </Tooltip>
            </Box>
          )}

          {renderList()}
        </Scrollbar>

        <Box sx={{ p: 2.5 }}>
          <SignOutButton onClose={onClose} />
        </Box>
      </Drawer>
    </>
  );
}
