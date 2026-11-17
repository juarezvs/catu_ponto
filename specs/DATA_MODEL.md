# DATA_MODEL: Modelo Relacional, RBAC Multi-Tenant e Vector Store (SRAG)

- **Identificador**: `SPEC-00-DATA-MODEL`
- **Banco de Dados Alvo**: PostgreSQL 16+ com extensão `pgvector` + Redis 7 (Cache RBAC)
- **ORM / Migrações**: SQLAlchemy 2.0 (Async) + Alembic

---

## 1. Diagrama Entidade-Relacionamento (Mermaid ER)

```mermaid
erDiagram
    ORGAO ||--o{ UNIDADE : "possui"
    ORGAO ||--o{ DEPARTAMENTO : "estrutura"
    ORGAO ||--o{ NORMA_DOCUMENTO_CHUNK : "rege (SRAG)"
    UNIDADE ||--o{ PESSOA_VINCULO : "lota"
    USUARIO ||--o{ USUARIO_PAPEL_ESCOPO : "recebe acesso"
    PAPEL ||--o{ USUARIO_PAPEL_ESCOPO : "atribuido em"
    PAPEL ||--o{ PAPEL_PERMISSAO : "agrega"
    PERMISSAO ||--o{ PAPEL_PERMISSAO : "concede"
    MODULO_SECP ||--o{ PERMISSAO : "define escopo"
    MODULO_SECP ||--o{ ITEM_MENU : "possui"
    ITEM_MENU ||--o{ SUBITEM_MENU : "abre na 2a sidebar"

    ORGAO {
        uuid id PK
        string sigla UK
        string nome
        string cnpj UK
        numeric teto_hora_extra_mensal
        boolean ativo
    }

    UNIDADE {
        uuid id PK
        uuid orgao_id FK
        string codigo UK
        string nome
        numeric raio_geofence_metros
    }

    USUARIO {
        uuid id PK
        string matricula UK
        string cpf_hash UK
        string nome
        string email UK
        boolean ativo
    }

    PAPEL {
        uuid id PK
        string codigo UK "ADMIN_GERAL | GESTOR_RH | COORDENADOR_UNIDADE | SERVIDOR"
        string nome
        string descricao
    }

    PERMISSAO {
        uuid id PK
        string modulo_slug FK
        string codigo UK "ex: secp-ponto:cadastros.pessoas:read"
        string descricao
    }

    USUARIO_PAPEL_ESCOPO {
        uuid id PK
        uuid usuario_id FK
        uuid papel_id FK
        uuid orgao_id FK
        uuid unidade_id FK "Nullable (acesso ao orgao inteiro)"
    }

    NORMA_DOCUMENTO_CHUNK {
        uuid id PK
        uuid orgao_id FK
        string lei_codigo "ex: Lei Municipal 4.120/2022 | Portaria MTP 671"
        string artigo "ex: Art. 44"
        string paragrafo "ex: § 2º"
        string inciso "ex: Inciso III"
        date vigencia_inicio
        date vigencia_fim "Nullable se vigente"
        text conteudo_normativo
        vector_1536 embedding "pgvector HNSW index"
        tsvector tsv_lexical "GIN Full-Text Search BM25"
    }
```

---

## 2. Estratégia de Indexação Híbrida para o SRAG (`pgvector` + FTS)

1. **Índice Vetorial Denso (HNSW)**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE INDEX idx_norma_chunk_embedding_hnsw
   ON norma_documento_chunk USING hnsw (embedding vector_cosine_ops)
   WITH (m = 16, ef_construction = 64);
   ```
2. **Índice Lexical e Metadados Estruturados**:
   ```sql
   CREATE INDEX idx_norma_chunk_metadata
   ON norma_documento_chunk (orgao_id, vigencia_inicio, vigencia_fim);

   CREATE INDEX idx_norma_chunk_fts
   ON norma_documento_chunk USING gin (tsv_lexical);
   ```
