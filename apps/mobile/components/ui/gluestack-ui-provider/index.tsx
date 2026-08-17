import React from 'react';
import { config } from './config';
import { View, ViewProps } from 'react-native';
import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';

export type ModeType = 'light' | 'dark' | 'system';

export function GluestackUIProvider({
  mode = 'light',
  ...props
}: {
  mode?: 'light' | 'dark';
  children?: React.ReactNode;
  style?: ViewProps['style'];
}) {
  const resolvedMode: 'light' | 'dark' = mode === 'dark' ? 'dark' : 'light';

  // NativeWind ning setColorScheme ni chaqirmaymiz — "system" Android'da
  // Appearance.setColorScheme(null) qiladi va crash beradi.
  // Appearance ni theme-context o'zi to'g'ridan-to'g'ri boshqaradi.

  return (
    <View
      style={[
        config[resolvedMode],
        { flex: 1, height: '100%', width: '100%' },
        props.style,
      ]}
    >
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </View>
  );
}
