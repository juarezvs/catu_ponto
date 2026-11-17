-- Inicialização obrigatória do PostgreSQL 16 para o SECP (pgvector + pg_trgm + unaccent)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
