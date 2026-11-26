import { LOCALES } from '@yantramitra/shared-types';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { AuthProvider } from '@/auth';
import { I18nProvider, useLocaleState } from '@/i18n';
import { LocationProvider } from '@/location';
import { colors } from '@/theme';
import { Button, H1, Loading, Muted } from '@/ui';

/** First launch: ask for a language (Marathi is listed first as the suggested default). */
function LanguageGate({ children }: { children: React.ReactNode }) {
  const { chosen, ready, setLocale } = useLocaleState();
  const t = useTranslations();
  if (!ready) return <Loading />;
  if (chosen) return <>{children}</>;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.soil }}>
      <H1>{t('common.appName')}</H1>
      <Muted>{t('common.tagline')}</Muted>
      <Muted>{t('lang.choose')}</Muted>
      {LOCALES.map((l) => <Button key={l} title={t(`lang.${l}`)} variant={l === 'mr' ? 'primary' : 'secondary'} onPress={() => setLocale(l)} />)}
    </View>
  );
}

function Navigator() {
  const t = useTranslations();
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.leafDark, contentStyle: { backgroundColor: colors.soil } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="listing/[id]" options={{ title: '' }} />
      <Stack.Screen name="login" options={{ title: t('auth.loginTitle') }} />
      <Stack.Screen name="register" options={{ title: t('auth.registerTitle') }} />
      <Stack.Screen name="change-password" options={{ title: t('auth.changePasswordTitle') }} />
      <Stack.Screen name="edit/[id]" options={{ title: t('form.editTitle') }} />
      <Stack.Screen name="location/[id]" options={{ title: t('my.locationTitle') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <LanguageGate>
          <AuthProvider>
            <LocationProvider>
              <StatusBar style="dark" />
              <Navigator />
            </LocationProvider>
          </AuthProvider>
        </LanguageGate>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
