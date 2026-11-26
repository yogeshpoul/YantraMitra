import { RADIUS_PRESETS_KM, type CategoryDto, type ListingCardDto, type OperationDto, type Paginated } from '@yantramitra/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useLocale, useTranslations } from 'use-intl';
import { api } from '@/api';
import { useErrors } from '@/errors';
import { pickName } from '@/format';
import { ListingCard } from '@/ListingCard';
import { useSearchLocation } from '@/location';
import { PlacePicker } from '@/PlacePicker';
import { colors, space } from '@/theme';
import { Banner, Button, Card, Chip, Field, Muted, s } from '@/ui';

export default function Explore() {
  const t = useTranslations();
  const locale = useLocale();
  const errors = useErrors();
  const { location, radiusKm, setLocation, setRadiusKm } = useSearchLocation();
  const [catalogue, setCatalogue] = useState<{ categories: CategoryDto[]; operations: OperationDto[] }>({ categories: [], operations: [] });
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState(false);
  const [data, setData] = useState<Paginated<ListingCardDto> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { Promise.all([api.catalogue.categories(), api.catalogue.operations()]).then(([categories, operations]) => setCatalogue({ categories, operations }), () => undefined); }, []);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.equipment.search({
        q: query || undefined, category: category ?? undefined, operation: operation ?? undefined, page, pageSize: 20,
        ...(location ? { lat: location.lat, lng: location.lng, radiusKm } : { sort: 'recent' as const }),
      });
      setData((prev) => (page > 1 && prev ? { ...r, items: [...prev.items, ...r.items] } : r));
    } catch (e) {
      setError(errors.api(e).message);
    } finally {
      setLoading(false);
    }
  }, [query, category, operation, location, radiusKm, errors]);

  useEffect(() => { void load(1); }, [load]);

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <Card>
        <Text style={s.hint}>{t('location.label')}</Text>
        <Text style={{ fontSize: 17, fontWeight: '700' }} numberOfLines={2}>{location?.label ?? t('location.anywhere')}</Text>
        <View style={s.row}>
          <Button variant="secondary" title={t('location.change')} onPress={() => setEditingLocation((x) => !x)} />
          {location && <Button variant="ghost" title={t('common.clear')} onPress={() => setLocation(null)} />}
        </View>
        {editingLocation && (
          <PlacePicker value={null} withMap={false} onChange={(p) => { setLocation({ label: p.label, lat: p.lat, lng: p.lng, slug: p.slug }); setEditingLocation(false); }} />
        )}
        {location && (
          <View style={s.row} accessibilityLabel={t('location.radius')}>
            {RADIUS_PRESETS_KM.map((km) => <Chip key={km} label={t('common.km', { value: km })} selected={radiusKm === km} onPress={() => setRadiusKm(km)} />)}
          </View>
        )}
      </Card>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Field label={t('search.keyword')} placeholder={t('home.searchPlaceholder')} value={q} onChangeText={setQ} returnKeyType="search" onSubmitEditing={() => setQuery(q.trim())} /></View>
        <Button title={t('common.search')} onPress={() => setQuery(q.trim())} />
      </View>
      <Text style={s.label}>{t('home.workTitle')}</Text>
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={catalogue.operations} keyExtractor={(o) => o.id} contentContainerStyle={{ gap: space.sm }}
        renderItem={({ item }) => <Chip label={pickName(item.names, locale)} selected={operation === item.slug} onPress={() => setOperation(operation === item.slug ? null : item.slug)} />} />
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={catalogue.categories} keyExtractor={(c) => c.id} contentContainerStyle={{ gap: space.sm }}
        renderItem={({ item }) => <Chip label={pickName(item.names, locale)} selected={category === item.slug} onPress={() => setCategory(category === item.slug ? null : item.slug)} />} />
      {error && <Banner tone="error">{error}</Banner>}
      {data && <Text style={{ fontSize: 16, fontWeight: '600', color: colors.muted }}>{t('search.results', { count: data.total })}</Text>}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.soil }}
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      data={data?.items ?? []}
      keyExtractor={(l) => l.id}
      renderItem={({ item }) => <ListingCard listing={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={data && !loading ? <Card><Text style={s.h2}>{t('search.emptyTitle')}</Text><Muted>{t('search.emptyText')}</Muted></Card> : undefined}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(1)} colors={[colors.leaf]} />}
      onEndReached={() => { if (data && !loading && data.page < data.totalPages) void load(data.page + 1); }}
      onEndReachedThreshold={0.4}
      keyboardShouldPersistTaps="handled"
    />
  );
}
