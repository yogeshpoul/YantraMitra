CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('mr', 'hi', 'en');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('active', 'inactive', 'unavailable', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('hourly', 'per_acre', 'per_day', 'fixed', 'contact_for_price');

-- CreateEnum
CREATE TYPE "FuelTerm" AS ENUM ('included', 'excluded', 'negotiated', 'not_applicable');

-- CreateEnum
CREATE TYPE "OperatorTerm" AS ENUM ('included', 'extra_cost', 'equipment_only', 'not_applicable');

-- CreateEnum
CREATE TYPE "TransportTerm" AS ENUM ('included', 'extra_cost', 'negotiated', 'not_applicable');

-- CreateEnum
CREATE TYPE "LocationVisibility" AS ENUM ('exact', 'approximate', 'locality_only', 'hidden');

-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('gps', 'map', 'search', 'manual');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('fake', 'wrong_information', 'not_available', 'duplicate', 'offensive', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ContactEventType" AS ENUM ('reveal', 'call_click', 'whatsapp_click');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('web', 'native');

-- CreateEnum
CREATE TYPE "PlaceKind" AS ENUM ('village', 'town', 'city', 'taluka', 'district', 'state', 'postal');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "preferred_locale" "Locale" NOT NULL DEFAULT 'mr',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "temp_password_expires_at" TIMESTAMPTZ(3),
    "password_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phone_verified_at" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_type" "ClientType" NOT NULL,
    "refresh_hash" TEXT NOT NULL,
    "previous_refresh_hash" TEXT,
    "rotated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_throttles" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMPTZ(3),

    CONSTRAINT "login_throttles_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "equipment_categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_mr" TEXT NOT NULL,
    "name_hi" TEXT NOT NULL,
    "icon_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "equipment_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_types" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_mr" TEXT NOT NULL,
    "name_hi" TEXT NOT NULL,
    "icon_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "equipment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_mr" TEXT NOT NULL,
    "name_hi" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_listings" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "equipment_type_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "manufacturing_year" INTEGER,
    "description" TEXT,
    "pricing_type" "PricingType" NOT NULL,
    "price" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "is_negotiable" BOOLEAN NOT NULL DEFAULT false,
    "min_hours" DECIMAL(6,2),
    "min_acres" DECIMAL(6,2),
    "fuel_term" "FuelTerm" NOT NULL,
    "operator_term" "OperatorTerm" NOT NULL,
    "transport_term" "TransportTerm" NOT NULL,
    "additional_conditions" TEXT,
    "home_location" geography(Point, 4326) NOT NULL,
    "home_label" TEXT NOT NULL,
    "home_visibility" "LocationVisibility" NOT NULL DEFAULT 'hidden',
    "home_place_id" UUID,
    "current_location" geography(Point, 4326) NOT NULL,
    "search_location" geography(Point, 4326) NOT NULL,
    "current_label" TEXT NOT NULL,
    "current_visibility" "LocationVisibility" NOT NULL DEFAULT 'approximate',
    "current_place_id" UUID,
    "current_locality" TEXT,
    "current_taluka" TEXT,
    "current_district" TEXT,
    "current_state" TEXT,
    "current_country_code" CHAR(2),
    "current_location_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contact_enabled" BOOLEAN NOT NULL DEFAULT true,
    "allow_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "status" "ListingStatus" NOT NULL DEFAULT 'active',
    "suspended_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "equipment_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_images" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "alt_text" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_operations" (
    "listing_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,

    CONSTRAINT "listing_operations_pkey" PRIMARY KEY ("listing_id","operation_id")
);

-- CreateTable
CREATE TABLE "location_history" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "location" geography(Point, 4326) NOT NULL,
    "label" TEXT NOT NULL,
    "source" "LocationSource" NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_reports" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "resolution_note" TEXT,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_events" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ContactEventType" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "places" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PlaceKind" NOT NULL,
    "taluka" TEXT,
    "district" TEXT,
    "state" TEXT,
    "country_code" CHAR(2) NOT NULL,
    "postal_code" TEXT,
    "point" geography(Point, 4326) NOT NULL,
    "population" INTEGER NOT NULL DEFAULT 0,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "search_text" TEXT NOT NULL,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_categories_slug_key" ON "equipment_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_types_slug_key" ON "equipment_types"("slug");

-- CreateIndex
CREATE INDEX "equipment_types_category_id_sort_order_idx" ON "equipment_types"("category_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_types_id_category_id_key" ON "equipment_types"("id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "operations_slug_key" ON "operations"("slug");

-- CreateIndex
CREATE INDEX "equipment_listings_owner_id_status_idx" ON "equipment_listings"("owner_id", "status");

-- CreateIndex
CREATE INDEX "equipment_listings_status_category_id_idx" ON "equipment_listings"("status", "category_id");

-- CreateIndex
CREATE INDEX "equipment_listings_status_equipment_type_id_idx" ON "equipment_listings"("status", "equipment_type_id");

-- CreateIndex
CREATE INDEX "equipment_listings_status_created_at_idx" ON "equipment_listings"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "equipment_listings_status_current_location_updated_at_idx" ON "equipment_listings"("status", "current_location_updated_at" DESC);

-- CreateIndex
CREATE INDEX "equipment_listings_status_current_state_current_district_idx" ON "equipment_listings"("status", "current_state", "current_district");

-- CreateIndex
CREATE INDEX "equipment_images_listing_id_sort_order_idx" ON "equipment_images"("listing_id", "sort_order");

-- CreateIndex
CREATE INDEX "listing_operations_operation_id_idx" ON "listing_operations"("operation_id");

-- CreateIndex
CREATE INDEX "location_history_listing_id_created_at_idx" ON "location_history"("listing_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_favorites_listing_id_idx" ON "user_favorites"("listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorites_user_id_listing_id_key" ON "user_favorites"("user_id", "listing_id");

-- CreateIndex
CREATE INDEX "listing_reports_status_created_at_idx" ON "listing_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "listing_reports_listing_id_idx" ON "listing_reports"("listing_id");

-- CreateIndex
CREATE INDEX "contact_events_user_id_type_created_at_idx" ON "contact_events"("user_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "contact_events_listing_id_created_at_idx" ON "contact_events"("listing_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_user_id_key" ON "admin_users"("user_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_audit_logs_entity_type_entity_id_idx" ON "admin_audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "places_slug_key" ON "places"("slug");

-- CreateIndex
CREATE INDEX "places_postal_code_idx" ON "places"("postal_code");

-- CreateIndex
CREATE INDEX "places_name_idx" ON "places"("name");

-- CreateIndex
CREATE UNIQUE INDEX "places_source_source_id_key" ON "places"("source", "source_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_types" ADD CONSTRAINT "equipment_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "equipment_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_listings" ADD CONSTRAINT "equipment_listings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_listings" ADD CONSTRAINT "equipment_listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "equipment_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_listings" ADD CONSTRAINT "equipment_listings_equipment_type_id_category_id_fkey" FOREIGN KEY ("equipment_type_id", "category_id") REFERENCES "equipment_types"("id", "category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_listings" ADD CONSTRAINT "equipment_listings_home_place_id_fkey" FOREIGN KEY ("home_place_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_listings" ADD CONSTRAINT "equipment_listings_current_place_id_fkey" FOREIGN KEY ("current_place_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_images" ADD CONSTRAINT "equipment_images_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "equipment_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_operations" ADD CONSTRAINT "listing_operations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "equipment_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_operations" ADD CONSTRAINT "listing_operations_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "equipment_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "equipment_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "equipment_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_events" ADD CONSTRAINT "contact_events_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "equipment_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_events" ADD CONSTRAINT "contact_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

