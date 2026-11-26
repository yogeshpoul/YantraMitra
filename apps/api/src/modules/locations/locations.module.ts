import { Controller, Get, Header, Inject, Module, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAX_RADIUS_KM, RADIUS_PRESETS_KM, type LocalityDto, type LocationConfigDto, type PlaceDetailDto, type PlaceDto } from '@yantramitra/shared-types';
import { placeSearchSchema, reverseSchema, type z } from '@yantramitra/shared-validation';
import { AppError } from '../../common/app-error.js';
import { Public } from '../../common/auth.decorators.js';
import { ApiZod, zod } from '../../common/zod.js';
import { ENV, type Env } from '../../config/env.js';
import { GoogleProvider, NominatimProvider } from './external-providers.js';
import { LOCATION_PROVIDER, type LocationProvider } from './location-provider.js';
import { PlacesService } from './places.service.js';

const ATTRIBUTION: Record<Env['LOCATION_PROVIDER'], string> = {
  local: 'Place names © GeoNames (CC BY 4.0)',
  nominatim: '© OpenStreetMap contributors',
  google: 'Google',
};

@ApiTags('locations')
@Public()
@Controller('locations')
export class LocationsController {
  constructor(
    @Inject(LOCATION_PROVIDER) private readonly provider: LocationProvider,
    private readonly places: PlacesService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('config')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Search radius presets and active provider' })
  config(): LocationConfigDto {
    return {
      searchProvider: this.env.LOCATION_PROVIDER,
      defaultRadiusKm: this.env.DEFAULT_SEARCH_RADIUS_KM,
      radiusPresetsKm: [...RADIUS_PRESETS_KM],
      maxRadiusKm: MAX_RADIUS_KM,
      attribution: ATTRIBUTION[this.env.LOCATION_PROVIDER],
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Find a village, town, taluka, district, state or PIN code' })
  @ApiZod({ query: placeSearchSchema })
  search(@Query(zod(placeSearchSchema)) q: z.output<typeof placeSearchSchema>): Promise<PlaceDto[]> {
    return this.provider.search(q.q, q.limit);
  }

  @Get('reverse')
  @ApiOperation({ summary: 'Nearest named place for coordinates (e.g. from GPS)' })
  @ApiZod({ query: reverseSchema })
  reverse(@Query(zod(reverseSchema)) q: z.output<typeof reverseSchema>): Promise<PlaceDto | null> {
    return this.provider.reverse(q);
  }

  @Get('places/:slug')
  @ApiOperation({ summary: 'Gazetteer place by slug, with same-name alternatives' })
  async place(@Param('slug') slug: string): Promise<PlaceDetailDto> {
    const place = /^[a-z0-9-]{1,160}$/i.test(slug) ? await this.places.detail(slug) : null;
    if (!place) throw new AppError(404, 'PLACE_NOT_FOUND', 'Place not found');
    return place;
  }

  @Get('localities')
  @Header('Cache-Control', 'public, max-age=600')
  @ApiOperation({ summary: 'Localities with enough listings for their own page (used for sitemaps)' })
  localities(): Promise<LocalityDto[]> {
    return this.places.localities();
  }
}

@Module({
  controllers: [LocationsController],
  providers: [
    PlacesService,
    {
      provide: LOCATION_PROVIDER,
      inject: [ENV, PlacesService],
      useFactory: (env: Env, places: PlacesService): LocationProvider => {
        if (env.LOCATION_PROVIDER === 'google') return new GoogleProvider(env.GOOGLE_MAPS_SERVER_KEY!);
        if (env.LOCATION_PROVIDER === 'nominatim') return new NominatimProvider(env.NOMINATIM_URL, env.NOMINATIM_USER_AGENT!);
        return places;
      },
    },
  ],
  exports: [PlacesService, LOCATION_PROVIDER],
})
export class LocationsModule {}
