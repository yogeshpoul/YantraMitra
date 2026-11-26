-- Runs once when the Docker database volume is first created.
-- The migrations also create these extensions; this makes a fresh test database usable immediately.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE DATABASE yantramitra_test;
\connect yantramitra_test
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
