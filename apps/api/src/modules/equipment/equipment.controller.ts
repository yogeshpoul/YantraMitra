import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LISTING_STATUSES, type ContactDto, type ListingCardDto, type ListingDetailDto, type LocationHistoryDto, type OwnerListingDto, type Paginated } from '@yantramitra/shared-types';
import {
  contactEventSchema, createListingSchema, listingStatusSchema, nearbySchema, paginationShape, reportSchema, searchSchema,
  updateListingSchema, updateLocationSchema, z, type CreateListingData, type SearchData, type UpdateListingData,
} from '@yantramitra/shared-validation';
import { CurrentUser, Public, type AuthUser } from '../../common/auth.decorators.js';
import { ApiZod, uuidParam, zod } from '../../common/zod.js';
import { EngagementService } from './engagement.service.js';
import { EquipmentService } from './equipment.service.js';
import { SearchService } from './search.service.js';

@ApiTags('equipment')
@Controller('equipment')
export class EquipmentController {
  constructor(
    private readonly equipment: EquipmentService,
    private readonly searchService: SearchService,
    private readonly engagement: EngagementService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search listings. Without place or coordinates, all locations are searched.' })
  @ApiZod({ query: searchSchema })
  search(@Query(zod(searchSchema)) query: SearchData): Promise<Paginated<ListingCardDto>> {
    return this.searchService.search(query);
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Listings near coordinates, by current equipment location' })
  @ApiZod({ query: nearbySchema })
  nearby(@Query(zod(nearbySchema)) query: SearchData): Promise<Paginated<ListingCardDto>> {
    return this.searchService.search(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Public listing detail (no owner identity or exact location)' })
  detail(@Param('id', uuidParam) id: string): Promise<ListingDetailDto> {
    return this.searchService.detail(id);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a listing' })
  @ApiZod({ body: createListingSchema })
  create(@CurrentUser() user: AuthUser, @Body(zod(createListingSchema)) body: CreateListingData): Promise<OwnerListingDto> {
    return this.equipment.create(user, body);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Edit own listing (current location has its own endpoint)' })
  @ApiZod({ body: updateListingSchema })
  update(@CurrentUser() user: AuthUser, @Param('id', uuidParam) id: string, @Body(zod(updateListingSchema)) body: UpdateListingData): Promise<OwnerListingDto> {
    return this.equipment.update(user, id, body);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete own listing (soft delete)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', uuidParam) id: string): Promise<void> {
    return this.equipment.remove(user, id);
  }

  @ApiBearerAuth()
  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate, deactivate or mark unavailable' })
  @ApiZod({ body: listingStatusSchema })
  status(@CurrentUser() user: AuthUser, @Param('id', uuidParam) id: string, @Body(zod(listingStatusSchema)) body: z.output<typeof listingStatusSchema>): Promise<OwnerListingDto> {
    return this.equipment.setStatus(user, id, body.status);
  }

  @ApiBearerAuth()
  @Patch(':id/location')
  @ApiOperation({ summary: 'Update the current location; home location is not changed' })
  @ApiZod({ body: updateLocationSchema })
  location(@CurrentUser() user: AuthUser, @Param('id', uuidParam) id: string, @Body(zod(updateLocationSchema)) body: z.output<typeof updateLocationSchema>): Promise<OwnerListingDto> {
    return this.equipment.updateLocation(user, id, body);
  }

  @ApiBearerAuth()
  @Post(':id/favorite')
  @HttpCode(204)
  @ApiOperation({ summary: 'Save listing' })
  favorite(@CurrentUser() user: AuthUser, @Param('id', uuidParam) id: string): Promise<void> {
    return this.engagement.addFavorite(user, id);
  }

  @ApiBearerAuth()
  @Delete(':id/favorite')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove saved listing' })
  unfavorite(@CurrentUser() user: AuthUser, @Param('id', uuidParam) id: string): Promise<void> {
    return this.engagement.removeFavorite(user, id);
  }

  @ApiBearerAuth()
  @Get(':id/contact')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: "Reveal the owner's phone number (recorded, limited per day)" })
  contact(@CurrentUser() user: AuthUser, @Param('id', uuidParam) id: string): Promise<ContactDto> {
    return this.engagement.contact(user, id);
  }

  @ApiBearerAuth()
  @Post(':id/contact-events')
  @HttpCode(204)
  @ApiOperation({ summary: 'Record a call or WhatsApp tap' })
  @ApiZod({ body: contactEventSchema })
  contactEvent(@CurrentUser() user: AuthUser, @Param('id', uuidParam) id: string, @Body(zod(contactEventSchema)) body: z.output<typeof contactEventSchema>): Promise<void> {
    return this.engagement.contactEvent(user, id, body.type);
  }

  @ApiBearerAuth()
  @Post(':id/reports')
  @ApiOperation({ summary: 'Report a listing to moderators' })
  @ApiZod({ body: reportSchema })
  report(@CurrentUser() user: AuthUser, @Param('id', uuidParam) id: string, @Body(zod(reportSchema)) body: z.output<typeof reportSchema>): Promise<{ id: string }> {
    return this.engagement.report(user, id, body);
  }
}

const myListingsSchema = z.object({ ...paginationShape, status: z.enum(LISTING_STATUSES).exclude(['deleted']).optional() });
const pageSchema = z.object(paginationShape);

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
export class MyEquipmentController {
  constructor(
    private readonly equipment: EquipmentService,
    private readonly engagement: EngagementService,
  ) {}

  @Get('listings')
  @ApiOperation({ summary: 'Own listings, all statuses except deleted' })
  @ApiZod({ query: myListingsSchema })
  listings(@CurrentUser() user: AuthUser, @Query(zod(myListingsSchema)) q: z.output<typeof myListingsSchema>): Promise<Paginated<OwnerListingDto>> {
    return this.equipment.mine(user.id, q);
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Own listing with exact locations' })
  listing(@CurrentUser() user: AuthUser, @Param('id', uuidParam) id: string): Promise<OwnerListingDto> {
    return this.equipment.ownerView(id, user.id);
  }

  @Get('listings/:id/location-history')
  @ApiOperation({ summary: 'Current-location history of own listing' })
  history(@CurrentUser() user: AuthUser, @Param('id', uuidParam) id: string): Promise<LocationHistoryDto[]> {
    return this.equipment.history(user, id);
  }

  @Get('favorites')
  @ApiOperation({ summary: 'Saved listings' })
  @ApiZod({ query: pageSchema })
  favorites(@CurrentUser() user: AuthUser, @Query(zod(pageSchema)) q: z.output<typeof pageSchema>): Promise<Paginated<ListingCardDto>> {
    return this.engagement.favorites(user, q);
  }

  @Get('favorites/ids')
  @ApiOperation({ summary: 'IDs of saved listings' })
  favoriteIds(@CurrentUser() user: AuthUser): Promise<string[]> {
    return this.engagement.favoriteIds(user);
  }
}
