-- Hand-written: spatial / trigram indexes and constraints Prisma cannot express.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Geography GiST indexes
CREATE INDEX "equipment_listings_home_location_gist" ON "equipment_listings" USING GIST ("home_location");
CREATE INDEX "equipment_listings_current_location_gist" ON "equipment_listings" USING GIST ("current_location");
CREATE INDEX "equipment_listings_search_location_gist" ON "equipment_listings" USING GIST ("search_location");
CREATE INDEX "location_history_location_gist" ON "location_history" USING GIST ("location");
CREATE INDEX "places_settlement_point_gist" ON "places" USING GIST ("point") WHERE "kind" IN ('village', 'town', 'city');

-- Text search
CREATE INDEX "equipment_listings_title_trgm" ON "equipment_listings" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "places_search_text_trgm" ON "places" USING GIN ("search_text" gin_trgm_ops);
CREATE INDEX "equipment_listings_price_active" ON "equipment_listings" ("pricing_type", "price") WHERE "status" = 'active';

-- Data integrity
ALTER TABLE "users"
  ADD CONSTRAINT "users_mobile_e164" CHECK ("mobile" ~ '^\+[1-9][0-9]{6,14}$');

ALTER TABLE "equipment_listings"
  ADD CONSTRAINT "listing_price_matches_type" CHECK (("pricing_type" = 'contact_for_price' AND "price" IS NULL) OR ("pricing_type" <> 'contact_for_price' AND "price" > 0)),
  ADD CONSTRAINT "listing_year_range" CHECK ("manufacturing_year" IS NULL OR "manufacturing_year" BETWEEN 1950 AND 2100),
  ADD CONSTRAINT "listing_minimums_positive" CHECK (("min_hours" IS NULL OR "min_hours" > 0) AND ("min_acres" IS NULL OR "min_acres" > 0)),
  ADD CONSTRAINT "listing_current_not_hidden" CHECK ("current_visibility" <> 'hidden'),
  ADD CONSTRAINT "listing_home_visibility" CHECK ("home_visibility" IN ('hidden', 'locality_only')),
  ADD CONSTRAINT "listing_deleted_consistent" CHECK (("status" = 'deleted') = ("deleted_at" IS NOT NULL));

-- One unresolved report per user and listing
CREATE UNIQUE INDEX "listing_reports_one_open" ON "listing_reports" ("listing_id", "reporter_id") WHERE "status" IN ('open', 'reviewing');

-- The audit log is append-only
CREATE FUNCTION "forbid_audit_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_logs is append-only';
END $$;
CREATE TRIGGER "admin_audit_logs_append_only" BEFORE UPDATE OR DELETE ON "admin_audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "forbid_audit_change"();
