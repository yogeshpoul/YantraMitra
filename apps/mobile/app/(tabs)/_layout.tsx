import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useTranslations } from 'use-intl';
import { colors } from '@/theme';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color }}>{glyph}</Text>;

export default function TabsLayout() {
  const t = useTranslations('nav');
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.leaf, tabBarLabelStyle: { fontSize: 12, fontWeight: '600' }, headerTintColor: colors.leafDark }}>
      <Tabs.Screen name="index" options={{ title: t('explore'), tabBarIcon: icon('🔍') }} />
      <Tabs.Screen name="add" options={{ title: t('addEquipment'), tabBarIcon: icon('➕') }} />
      <Tabs.Screen name="my" options={{ title: t('myListings'), tabBarIcon: icon('🚜') }} />
      <Tabs.Screen name="saved" options={{ title: t('saved'), tabBarIcon: icon('♥') }} />
      <Tabs.Screen name="profile" options={{ title: t('profile'), tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
