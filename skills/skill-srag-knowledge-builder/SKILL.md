---
name: skill-srag-knowledge-builder
description: Padroniza a ingestão estruturada de legislação (CLT, Estatuto do Servidor, Portaria MTP 671, Regimentos Internos), busca híbrida (pgvector + BM25) e geração ancorada para o SECP Copiloto Normativo.
---

# Skill: SRAG Knowledge Builder (`skill-srag-knowledge-builder`)

Use esta skill ao indexar documentos normativos ou evoluir o motor **SRAG (Structured Retrieval-Augmented Generation)** do SECP.

## 1. Metadados Obrigatórios de Chunking Normativo
Todo chunk jurídico/administrativo deve preservar:
- `lei_codigo`, `artigo`, `paragrafo`, `inciso`, `orgao_id`, `vigencia_inicio`, `vigencia_fim`.

## 2. Geração Ancorada e Anti-Alucinação
- Toda resposta do Copiloto Normativo deve citar explicitamente `[Art. X, Lei Y]`.
- Se o score de relevância híbrida for inferior ao limiar mínimo ou não houver norma vigente para o `orgao_id`, o Copiloto deve recusar responder com suposições.
