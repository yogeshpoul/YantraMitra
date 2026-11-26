import { LOCALES } from '@yantramitra/shared-types';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { useLocaleState } from '@/i18n';
import { Button, Card, Chip, H1, Muted, s, Screen } from '@/ui';

/** Language is available to guests too, and is saved to the profile when signed in. */
export default function Profile() {
  const t = useTranslations();
  const { user, setUser, logout } = useAuth();
  const { locale, setLocale } = useLocaleState();

  const changeLanguage = (l: (typeof LOCALES)[number]) => {
    setLocale(l);
    if (user) api.users.update({ preferredLocale: l }).then(setUser, () => undefined);
  };

  return (
    <Screen>
      <H1>{t('profile.title')}</H1>
      <Card>
        <Text style={s.label}>{t('profile.language')}</Text>
        <View style={s.row}>{LOCALES.map((l) => <Chip key={l} label={t(`lang.${l}`)} selected={locale === l} onPress={() => changeLanguage(l)} />)}</View>
      </Card>
      {user ? (
        <>
          <Card>
            <Muted>{t('profile.name')}</Muted>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>{user.fullName}</Text>
            <Muted>{t('profile.mobile')}</Muted>
            <Text style={{ fontSize: 18 }}>{user.mobile}</Text>
          </Card>
          <Button variant="secondary" title={t('auth.changePasswordTitle')} onPress={() => router.push('/change-password')} />
          <Button variant="ghost" title={t('nav.logout')} onPress={() => void logout()} />
        </>
      ) : (
        <>
          <Button title={t('nav.login')} onPress={() => router.push('/login')} />
          <Button variant="secondary" title={t('nav.register')} onPress={() => router.push('/register')} />
        </>
      )}
      <Muted>{t('footer.about')}</Muted>
    </Screen>
  );
}
