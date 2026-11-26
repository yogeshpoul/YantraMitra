import type { ListingCardDto } from '@yantramitra/shared-types';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useFormatter, useLocale, useTranslations } from 'use-intl';
import { Art } from './Art';
import { pickName, priceLabel } from './format';
import { colors, radius, space } from './theme';

export function ListingCard({ listing }: { listing: ListingCardDto }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const area = [listing.location.locality, listing.location.district].filter(Boolean).join(', ') || t('location.unknownArea');
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={listing.title} onPress={() => router.push(`/listing/${listing.id}`)}
      style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.soilBorder, padding: space.md, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 96, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.leafLight, borderRadius: radius.md }}>
        <Art iconKey={listing.type.iconKey} fallbackKey={listing.category.iconKey} height={56} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 13, color: colors.leaf, fontWeight: '600' }}>{pickName(listing.type.names, locale)}</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }} numberOfLines={2}>{listing.title}</Text>
        <Text style={{ fontSize: 17, fontWeight: '700' }}>{priceLabel(listing.pricing, t, locale)}</Text>
        <Text style={{ fontSize: 14, color: colors.muted }} numberOfLines={1}>
          📍 {area}{listing.distanceKm != null ? ` · ${t('listing.distance', { km: listing.distanceKm })}` : ''}
        </Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>{t(`terms.operatorValues.${listing.operatorTerm}`)}</Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>{t('listing.updated', { time: format.relativeTime(new Date(listing.location.updatedAt), new Date()) })}</Text>
        {listing.status !== 'active' && <Text style={{ fontSize: 13, color: colors.turmeric, fontWeight: '700' }}>{t(`listing.status.${listing.status}`)}</Text>}
      </View>
    </Pressable>
  );
}
