-- init-munchmates-db.sql
-- Creates the MunchMates application database and user
-- This runs automatically on first container start via docker-entrypoint-initdb.d

CREATE USER munchmates WITH PASSWORD 'munchmates_dev' CREATEDB;
CREATE DATABASE munchmates OWNER munchmates;
