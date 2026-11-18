import json
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import bcrypt

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from secp.infrastructure.cache.redis_client import SecpRedisCacheGateway
from secp.infrastructure.database.postgres_session import ProdRealSyncSessionLocal
from secp.modules.secp_cadastros.domain.catalog import (
    CADASTROS_BY_SLUG,
    CADASTROS_LIST,
    CadastroDef,
    CadastroFieldDef,
)
from secp.modules.secp_cadastros.infrastructure.adapters.outbound.equipamentos_schema_bootstrap import (
    ensure_tipos_equipamento_schema,
)


class PostgresProdRealCadastroRepository:
    def __init__(self, redis_gateway: SecpRedisCacheGateway) -> None:
        self._redis = redis_gateway

    def _get_def(self, slug: str) -> CadastroDef:
        cdef = CADASTROS_BY_SLUG.get(slug)
        if cdef is None:
            raise ValueError(f"Cadastro '{slug}' não encontrado no catálogo.")
        return cdef

    @staticmethod
    def _validate_uuid_or_none(val: str | None) -> str | None:
        if not val:
            return None
        try:
            return str(uuid.UUID(val.strip()))
        except ValueError:
            return None

    def list_catalog(self) -> list[dict[str, Any]]:
        cache_key = "secp:prod_real:cadastros:catalog"
        cached = self._redis.get_json(cache_key)
        if isinstance(cached, list):
            return cached

        result: list[dict[str, Any]] = []
        with ProdRealSyncSessionLocal() as session:
            for cdef in CADASTROS_LIST:
                cnt = session.execute(
                    text(f'SELECT COUNT(*) FROM "{cdef.table_name}"')
                ).scalar_one()
                result.append(
                    {
                        "slug": cdef.slug,
                        "tableName": cdef.table_name,
                        "titulo": cdef.titulo,
                        "grupo": cdef.grupo,
                        "descricao": cdef.descricao,
                        "totalRegistros": int(cnt),
                    }
                )
        self._redis.set_json(cache_key, result, ttl_seconds=60)
        return result

    def list_municipios_by_uf(self, uf: str) -> list[dict[str, str]]:
        uf_clean = (uf or "").strip().upper()
        if not uf_clean:
            return []
        cache_key = f"secp:prod_real:cadastros:municipios:{uf_clean}"
        cached = self._redis.get_json(cache_key)
        if isinstance(cached, list):
            return cached

        with ProdRealSyncSessionLocal() as session:
            rows = (
                session.execute(
                    text(
                        """
                        SELECT c.nome::text AS value, c.nome::text AS label
                        FROM cidades c
                        JOIN estados e ON e.id = c.estado_id
                        WHERE UPPER(TRIM(e.sigla)) = :uf AND c.ativo = true
                        ORDER BY c.nome ASC
                        """
                    ),
                    {"uf": uf_clean},
                )
                .mappings()
                .all()
            )
            result = [{"value": str(r["value"]), "label": str(r["label"])} for r in rows]
        self._redis.set_json(cache_key, result, ttl_seconds=300)
        return result

    def get_organograma(self, orgao_sigla: str = "SJAM") -> dict[str, Any]:
        sigla_clean = (orgao_sigla or "SJAM").strip().upper()
        cache_key = f"secp:prod_real:cadastros:organograma:{sigla_clean}"
        cached = self._redis.get_json(cache_key)
        if isinstance(cached, dict):
            return cached

        with ProdRealSyncSessionLocal() as session:
            orgaos_rows = (
                session.execute(
                    text(
                        "SELECT id::text, sigla, nome, COALESCE(TRIM(uf), '') AS uf "
                        "FROM orgaos WHERE ativo = true ORDER BY sigla ASC"
                    )
                )
                .mappings()
                .all()
            )
            orgaos_list = [dict(o) for o in orgaos_rows]
            selected_orgao = next(
                (o for o in orgaos_list if o["sigla"].upper() == sigla_clean),
                orgaos_list[0] if orgaos_list else None,
            )
            if selected_orgao is None:
                return {"orgaos": [], "orgao": None, "root": None, "totalUnidades": 0}

            unit_rows = (
                session.execute(
                    text(
                        """
                        SELECT id::text, codigo, sigla, nome, tipo::text AS tipo,
                               unidade_pai_id::text AS pai_id,
                               COALESCE(NULLIF(TRIM(uf), ''), :org_uf) AS uf,
                               COALESCE(municipio, '') AS municipio
                        FROM unidades_organizacionais
                        WHERE orgao_id = CAST(:oid AS uuid)
                          AND ativo = true
                          AND (data_fim_sarh IS NULL OR data_fim_sarh >= CURRENT_DATE)
                        ORDER BY sigla ASC, nome ASC
                        """
                    ),
                    {"oid": selected_orgao["id"], "org_uf": selected_orgao["uf"]},
                )
                .mappings()
                .all()
            )

        nodes: dict[str, dict[str, Any]] = {}
        for r in unit_rows:
            nodes[r["id"]] = {
                "id": r["id"],
                "codigo": r["codigo"],
                "sigla": r["sigla"],
                "nome": r["nome"],
                "tipo": r["tipo"],
                "uf": r["uf"],
                "municipio": r["municipio"],
                "ativo": True,
                "pai_id": r["pai_id"],
                "children": [],
            }

        top_units: list[dict[str, Any]] = []
        for node in nodes.values():
            pid = node["pai_id"]
            if pid and pid in nodes and pid != node["id"]:
                nodes[pid]["children"].append(node)
            else:
                top_units.append(node)

        # Se houver uma unidade raiz com a mesma sigla do órgão (ex.: SJAM), usa ela como raiz;
        # caso contrário cria um nó raiz sintético do órgão agrupando as unidades de topo.
        orgao_root = next(
            (u for u in top_units if u["sigla"].upper() == selected_orgao["sigla"].upper()),
            None,
        )
        if orgao_root and len(top_units) == 1:
            root = orgao_root
        else:
            root = {
                "id": selected_orgao["id"],
                "codigo": selected_orgao["sigla"],
                "sigla": selected_orgao["sigla"],
                "nome": selected_orgao["nome"],
                "tipo": "ORGAO",
                "uf": selected_orgao["uf"],
                "municipio": "",
                "ativo": True,
                "pai_id": None,
                "children": top_units,
            }

        res = {
            "orgaos": orgaos_list,
            "orgao": selected_orgao,
            "root": root,
            "totalUnidades": len(nodes),
        }
        self._redis.set_json(cache_key, res, ttl_seconds=120)
        return res

    def get_schema(self, slug: str) -> dict[str, Any]:
        cdef = self._get_def(slug)
        fields_out: list[dict[str, Any]] = []

        with ProdRealSyncSessionLocal() as session:
            if slug in ("tipos-equipamento-biometrico", "equipamentos-biometricos"):
                ensure_tipos_equipamento_schema(session)
            for f in cdef.fields:
                options: list[dict[str, str]] = []
                if f.input_type == "enum":
                    enum_vals = (
                        session.execute(
                            text(
                                """
                                SELECT e.enumlabel
                                FROM pg_enum e
                                JOIN pg_type t ON e.enumtypid = t.oid
                                WHERE t.typname = :tname
                                ORDER BY e.enumsortorder
                                """
                            ),
                            {"tname": f.db_type},
                        )
                        .scalars()
                        .all()
                    )
                    options = [{"value": str(v), "label": str(v)} for v in enum_vals]
                elif f.input_type == "fk" and f.fk_table and f.fk_label_col:
                    fk_rows = (
                        session.execute(
                            text(
                                f'SELECT id::text AS value, ({f.fk_label_col})::text AS label '
                                f'FROM "{f.fk_table}" '
                                f'ORDER BY 2 ASC LIMIT 10000'
                            )
                        )
                        .mappings()
                        .all()
                    )
                    options = [
                        {"value": str(r["value"]), "label": str(r["label"] or r["value"])}
                        for r in fk_rows
                    ]
                elif f.input_type == "dynamic_select":
                    if f.db_type == "estados_uf":
                        uf_rows = (
                            session.execute(
                                text(
                                    "SELECT sigla::text AS value, (sigla || ' - ' || nome)::text AS label "
                                    "FROM estados WHERE ativo = true ORDER BY sigla ASC"
                                )
                            )
                            .mappings()
                            .all()
                        )
                        options = [
                            {"value": str(r["value"]).strip(), "label": str(r["label"])}
                            for r in uf_rows
                        ]
                    elif f.db_type == "fusos_valor":
                        fuso_rows = (
                            session.execute(
                                text(
                                    "SELECT valor::text AS value, (rotulo || ' (' || valor || ')')::text AS label "
                                    "FROM fusos_horarios WHERE ativo = true ORDER BY rotulo ASC"
                                )
                            )
                            .mappings()
                            .all()
                        )
                        options = [
                            {"value": str(r["value"]).strip(), "label": str(r["label"])}
                            for r in fuso_rows
                        ]
                    elif f.db_type == "icones_equipamento":
                        options = [
                            {"value": "facial", "label": "Rosto (Biometria Facial)"},
                            {"value": "relogio", "label": "Relógio (Relógio de Ponto / REP)"},
                            {"value": "computador", "label": "Computador (Sistema Web)"},
                            {"value": "celular", "label": "Celular (Smartphone / App)"},
                            {"value": "ajuste", "label": "Ajuste (Ajuste Administrativo)"},
                            {"value": "afd", "label": "Arquivo (Importação AFD)"},
                        ]

                fields_out.append(
                    {
                        "name": f.name,
                        "label": f.label,
                        "inputType": f.input_type,
                        "required": f.required,
                        "dbType": f.db_type,
                        "default": f.default,
                        "readOnly": f.read_only,
                        "options": options,
                    }
                )

        return {
            "slug": cdef.slug,
            "tableName": cdef.table_name,
            "titulo": cdef.titulo,
            "grupo": cdef.grupo,
            "descricao": cdef.descricao,
            "pkCol": cdef.pk_col,
            "pkType": cdef.pk_type,
            "columns": list(cdef.columns),
            "fields": fields_out,
        }

    @staticmethod
    def _resolve_ctx_orgao_id(orgao_id: str | None, orgao_sigla: str | None) -> str | None:
        uid = PostgresProdRealCadastroRepository._validate_uuid_or_none(orgao_id)
        if uid:
            return uid
        sigla = (orgao_sigla or "").strip().upper()
        if not sigla:
            return None
        with ProdRealSyncSessionLocal() as session:
            found = session.execute(
                text("SELECT id::text FROM orgaos WHERE UPPER(sigla) = :s LIMIT 1"),
                {"s": sigla},
            ).scalar_one_or_none()
            return str(found) if found else None

    def list_records(
        self,
        slug: str,
        search: str = "",
        page: int = 1,
        page_size: int = 20,
        filters_json: str = "",
        sort_by: str = "",
        sort_dir: str = "asc",
        orgao_id: str | None = None,
        orgao_sigla: str | None = None,
        perfil: str | None = None,
    ) -> dict[str, Any]:
        cdef = self._get_def(slug)
        if slug in ("tipos-equipamento-biometrico", "equipamentos-biometricos"):
            with ProdRealSyncSessionLocal() as session:
                ensure_tipos_equipamento_schema(session)
        ctx_orgao_id = self._resolve_ctx_orgao_id(orgao_id, orgao_sigla)
        is_master = (perfil or "").strip().upper() == "MASTER"
        if slug == "unidades-organizacionais":
            return self._list_unidades_organizacionais(
                cdef=cdef,
                search=search,
                page=page,
                page_size=page_size,
                filters_json=filters_json,
                sort_by=sort_by,
                sort_dir=sort_dir,
                orgao_id=None if is_master else ctx_orgao_id,
            )
        if slug == "identificadores-ponto":
            return self._list_identificadores_ponto(
                search=search,
                page=page,
                page_size=page_size,
                filters_json=filters_json,
                sort_by=sort_by,
                sort_dir=sort_dir,
                orgao_id=None if is_master else ctx_orgao_id,
            )
        clean_search = (search or "").strip()
        offset = max(0, (page - 1) * page_size)

        cols_to_select = [cdef.pk_col]
        for col in cdef.columns:
            if col not in cols_to_select:
                cols_to_select.append(col)
        for f in cdef.fields:
            if f.name not in cols_to_select:
                cols_to_select.append(f.name)

        select_sql = ", ".join(f'"{c}"' for c in cols_to_select)
        where_parts: list[str] = []
        params: dict[str, Any] = {"limit": page_size, "offset": offset}
        field_by_name = {f.name: f for f in cdef.fields}

        if ctx_orgao_id and not is_master:
            if cdef.table_name == "orgaos":
                where_parts.append(f'"{cdef.table_name}"."id" = CAST(:ctx_orgao_id AS uuid)')
                params["ctx_orgao_id"] = ctx_orgao_id
            elif "orgao_id" in field_by_name:
                if cdef.table_name in (
                    "jornadas",
                    "funcoes_confianca_referencias",
                    "categorias_pessoas",
                    "calendarios_institucionais",
                    "perfis",
                ):
                    where_parts.append(
                        f'("{cdef.table_name}"."orgao_id" IS NULL OR "{cdef.table_name}"."orgao_id" = CAST(:ctx_orgao_id AS uuid))'
                    )
                else:
                    where_parts.append(f'"{cdef.table_name}"."orgao_id" = CAST(:ctx_orgao_id AS uuid)')
                params["ctx_orgao_id"] = ctx_orgao_id
            elif "servidor_id" in field_by_name:
                where_parts.append(
                    f'EXISTS (SELECT 1 FROM servidores s_ctx WHERE s_ctx.id = "{cdef.table_name}"."servidor_id" AND s_ctx.orgao_id = CAST(:ctx_orgao_id AS uuid))'
                )
                params["ctx_orgao_id"] = ctx_orgao_id
            elif cdef.table_name == "usuarios":
                where_parts.append(
                    '(EXISTS (SELECT 1 FROM servidores s_ctx WHERE s_ctx.usuario_id = "usuarios"."id" AND s_ctx.orgao_id = CAST(:ctx_orgao_id AS uuid)) '
                    'OR EXISTS (SELECT 1 FROM usuarios_perfis up_ctx WHERE up_ctx.usuario_id = "usuarios"."id" AND up_ctx.orgao_id = CAST(:ctx_orgao_id AS uuid)))'
                )
                params["ctx_orgao_id"] = ctx_orgao_id
            elif cdef.table_name == "escalas":
                where_parts.append(
                    'EXISTS (SELECT 1 FROM jornadas j_ctx WHERE j_ctx.id = "escalas"."jornada_id" AND (j_ctx.orgao_id IS NULL OR j_ctx.orgao_id = CAST(:ctx_orgao_id AS uuid)))'
                )
                params["ctx_orgao_id"] = ctx_orgao_id

        if clean_search:
            searchable_cols = list(dict.fromkeys([*cdef.columns, *cdef.search_columns]))
            clauses: list[str] = []
            q_lower = clean_search.lower()

            for sc in searchable_cols:
                fdef = field_by_name.get(sc)
                if fdef and fdef.input_type == "password":
                    continue
                clauses.append(f'CAST("{sc}" AS text) ILIKE :pattern')
                if fdef and fdef.input_type == "fk" and fdef.fk_table and fdef.fk_label_col:
                    clauses.append(
                        f'EXISTS (SELECT 1 FROM "{fdef.fk_table}" AS fk_ref '
                        f'WHERE fk_ref."id" = "{cdef.table_name}"."{sc}" '
                        f'AND ({fdef.fk_label_col})::text ILIKE :pattern)'
                    )
                if fdef and fdef.db_type == "bool":
                    if q_lower in ("sim", "ativo", "sim / ativo"):
                        clauses.append(f'"{sc}" = true')
                    elif q_lower in ("nao", "não", "inativo", "não / inativo", "nao / inativo"):
                        clauses.append(f'"{sc}" = false')

            if clauses:
                where_parts.append("(" + " OR ".join(clauses) + ")")
                params["pattern"] = f"%{clean_search}%"

        if filters_json and filters_json.strip():
            try:
                raw_filters = json.loads(filters_json)
            except json.JSONDecodeError:
                raw_filters = []
            if isinstance(raw_filters, list):
                allowed_cols = set(cdef.columns) | {f.name for f in cdef.fields}
                for idx, flt in enumerate(raw_filters):
                    if not isinstance(flt, dict):
                        continue
                    col = str(flt.get("column") or "").strip()
                    val = str(flt.get("value") or "").strip()
                    op = str(flt.get("operator") or "contains").strip().lower()
                    if not col or not val or col not in allowed_cols:
                        continue
                    fdef = field_by_name.get(col)
                    if fdef and fdef.input_type == "password":
                        continue

                    pname = f"flt_{idx}"
                    if op == "equals":
                        params[pname] = val
                        expr = f'LOWER(TRIM(CAST("{col}" AS text))) = LOWER(:{pname})'
                    elif op == "starts_with":
                        params[pname] = f"{val}%"
                        expr = f'CAST("{col}" AS text) ILIKE :{pname}'
                    else:
                        params[pname] = f"%{val}%"
                        expr = f'CAST("{col}" AS text) ILIKE :{pname}'

                    if fdef and fdef.db_type == "bool":
                        vl = val.lower()
                        if vl in ("true", "1", "sim", "ativo", "sim / ativo"):
                            where_parts.append(f'"{col}" = true')
                            continue
                        if vl in ("false", "0", "nao", "não", "inativo", "não / inativo", "nao / inativo"):
                            where_parts.append(f'"{col}" = false')
                            continue

                    if fdef and fdef.input_type == "fk" and fdef.fk_table and fdef.fk_label_col:
                        fk_expr = (
                            f'EXISTS (SELECT 1 FROM "{fdef.fk_table}" AS fk_ref '
                            f'WHERE fk_ref."id" = "{cdef.table_name}"."{col}" '
                            f'AND ({fdef.fk_label_col})::text ILIKE :{pname})'
                        )
                        if op == "equals":
                            params[pname] = val
                            fk_expr = (
                                f'EXISTS (SELECT 1 FROM "{fdef.fk_table}" AS fk_ref '
                                f'WHERE fk_ref."id" = "{cdef.table_name}"."{col}" '
                                f'AND LOWER(TRIM(({fdef.fk_label_col})::text)) = LOWER(:{pname}))'
                            )
                        where_parts.append(f"({expr} OR {fk_expr})")
                    else:
                        where_parts.append(expr)

        where_sql = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""
        order_sql = cdef.order_by
        allowed_sort_cols = set(cdef.columns) | {f.name for f in cdef.fields}
        clean_sort = (sort_by or "").strip()
        if clean_sort and clean_sort in allowed_sort_cols:
            dir_sql = "DESC" if (sort_dir or "").strip().lower() == "desc" else "ASC"
            fdef = field_by_name.get(clean_sort)
            if fdef and fdef.input_type == "fk" and fdef.fk_table and fdef.fk_label_col:
                order_sql = (
                    f'(SELECT ({fdef.fk_label_col})::text FROM "{fdef.fk_table}" AS fk_s '
                    f'WHERE fk_s."id" = "{cdef.table_name}"."{clean_sort}" LIMIT 1) '
                    f"{dir_sql} NULLS LAST"
                )
            else:
                order_sql = f'"{clean_sort}" {dir_sql} NULLS LAST'

        with ProdRealSyncSessionLocal() as session:
            total = int(
                session.execute(
                    text(f'SELECT COUNT(*) FROM "{cdef.table_name}" {where_sql}'),
                    params,
                ).scalar_one()
            )
            rows = (
                session.execute(
                    text(
                        f'SELECT {select_sql} FROM "{cdef.table_name}" '
                        f"{where_sql} ORDER BY {order_sql} LIMIT :limit OFFSET :offset"
                    ),
                    params,
                )
                .mappings()
                .all()
            )

            fk_labels: dict[str, dict[str, str]] = {}
            for f in cdef.fields:
                if f.input_type == "fk" and f.fk_table and f.fk_label_col and rows:
                    ids = list({str(r[f.name]) for r in rows if r.get(f.name) is not None})
                    if ids:
                        lbl_rows = (
                            session.execute(
                                text(
                                    f'SELECT id::text AS k, ({f.fk_label_col})::text AS v '
                                    f'FROM "{f.fk_table}" WHERE id::text = ANY(:ids)'
                                ),
                                {"ids": ids},
                            )
                            .mappings()
                            .all()
                        )
                        fk_labels[f.name] = {str(lr["k"]): str(lr["v"]) for lr in lbl_rows}

        items = [self._serialize_row(dict(r)) for r in rows]
        total_pages = max(1, (total + page_size - 1) // page_size)
        return {
            "items": items,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
            "fkLabels": fk_labels,
        }

    def _list_unidades_organizacionais(
        self,
        cdef: CadastroDef,
        search: str = "",
        page: int = 1,
        page_size: int = 20,
        filters_json: str = "",
        sort_by: str = "",
        sort_dir: str = "asc",
        orgao_id: str | None = None,
    ) -> dict[str, Any]:
        clean_search = (search or "").strip()
        offset = max(0, (page - 1) * page_size)
        params: dict[str, Any] = {"limit": page_size, "offset": offset}
        where_parts: list[str] = []
        if orgao_id:
            where_parts.append("orgao_id = CAST(:ctx_orgao_id AS uuid)")
            params["ctx_orgao_id"] = orgao_id

        if clean_search:
            q_lower = clean_search.lower()
            params["pattern"] = f"%{clean_search}%"
            clauses = [
                "codigo ILIKE :pattern ESCAPE ''",
                "sigla_hierarquia ILIKE :pattern ESCAPE ''",
                "sigla ILIKE :pattern ESCAPE ''",
                "nome ILIKE :pattern ESCAPE ''",
                "CAST(tipo AS text) ILIKE :pattern ESCAPE ''",
                "COALESCE(uf_efetiva, '') ILIKE :pattern ESCAPE ''",
                "COALESCE(municipio, '') ILIKE :pattern ESCAPE ''",
            ]
            if q_lower in ("sim", "ativo", "sim / ativo"):
                clauses.append("ativo = true")
            elif q_lower in ("nao", "não", "inativo", "não / inativo", "nao / inativo"):
                clauses.append("ativo = false")
            where_parts.append("(" + " OR ".join(clauses) + ")")

        if filters_json and filters_json.strip():
            try:
                raw_filters = json.loads(filters_json)
            except json.JSONDecodeError:
                raw_filters = []
            if isinstance(raw_filters, list):
                col_expr_map = {
                    "codigo": "codigo",
                    "sigla": "sigla_hierarquia",
                    "nome": "nome",
                    "tipo": "CAST(tipo AS text)",
                    "uf": "COALESCE(uf_efetiva, '')",
                    "municipio": "COALESCE(municipio, '')",
                    "fuso_horario": "COALESCE(fuso_horario, '')",
                    "ativo": "ativo",
                }
                for idx, flt in enumerate(raw_filters):
                    if not isinstance(flt, dict):
                        continue
                    col = str(flt.get("column") or "").strip()
                    val = str(flt.get("value") or "").strip()
                    op = str(flt.get("operator") or "contains").strip().lower()
                    if not col or not val or col not in col_expr_map:
                        continue
                    if col == "ativo":
                        vl = val.lower()
                        if vl in ("true", "1", "sim", "ativo", "sim / ativo"):
                            where_parts.append("ativo = true")
                            continue
                        if vl in ("false", "0", "nao", "não", "inativo", "não / inativo", "nao / inativo"):
                            where_parts.append("ativo = false")
                            continue
                    expr_col = col_expr_map[col]
                    pname = f"flt_{idx}"
                    if op == "equals":
                        params[pname] = val
                        where_parts.append(f"LOWER(TRIM({expr_col})) = LOWER(:{pname})")
                    elif op == "starts_with":
                        params[pname] = f"{val}%"
                        where_parts.append(f"{expr_col} ILIKE :{pname} ESCAPE ''")
                    else:
                        params[pname] = f"%{val}%"
                        where_parts.append(f"{expr_col} ILIKE :{pname} ESCAPE ''")

        where_sql = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""
        cte_sql = r"""
            WITH RECURSIVE hier AS (
                SELECT u.id, u.id AS leaf_id, u.orgao_id, u.unidade_pai_id,
                       u.sigla::text AS curr_sigla,
                       u.sigla::text AS path_sigla, 0 AS depth, ARRAY[u.id] AS visited
                FROM unidades_organizacionais u
                UNION ALL
                SELECT p.id, h.leaf_id, h.orgao_id, p.unidade_pai_id,
                       p.sigla::text AS curr_sigla,
                       (p.sigla::text || chr(92) || h.path_sigla) AS path_sigla,
                       h.depth + 1, h.visited || p.id
                FROM hier h
                JOIN unidades_organizacionais p ON p.id = h.unidade_pai_id
                JOIN orgaos o ON o.id = h.orgao_id
                WHERE p.orgao_id = h.orgao_id
                  AND UPPER(h.curr_sigla) <> UPPER(o.sigla)
                  AND NOT (p.id = ANY(h.visited))
                  AND h.depth < 15
            ),
            roots AS (
                SELECT DISTINCT ON (leaf_id) leaf_id, path_sigla
                FROM hier
                ORDER BY leaf_id, depth DESC
            ),
            unidades_view AS (
                SELECT u.id, u.orgao_id, u.codigo, u.sigla, u.nome, u.tipo,
                       u.fuso_horario, u.uf, u.municipio, u.ativo,
                       CASE
                         WHEN UPPER(SPLIT_PART(r.path_sigla, chr(92), 1)) = UPPER(o.sigla) THEN r.path_sigla
                         ELSE o.sigla || chr(92) || r.path_sigla
                       END AS sigla_hierarquia,
                       COALESCE(NULLIF(TRIM(u.uf), ''), TRIM(o.uf)) AS uf_efetiva
                FROM unidades_organizacionais u
                JOIN orgaos o ON o.id = u.orgao_id
                JOIN roots r ON r.leaf_id = u.id
            )
        """

        order_sql = "sigla_hierarquia ASC, nome ASC"
        clean_sort = (sort_by or "").strip()
        dir_sql = "DESC" if (sort_dir or "").strip().lower() == "desc" else "ASC"
        sort_map = {
            "codigo": f"codigo {dir_sql} NULLS LAST",
            "sigla": f"sigla_hierarquia {dir_sql}, nome ASC",
            "nome": f"nome {dir_sql} NULLS LAST",
            "tipo": f"CAST(tipo AS text) {dir_sql} NULLS LAST",
            "uf": f"uf_efetiva {dir_sql} NULLS LAST",
            "municipio": f"municipio {dir_sql} NULLS LAST",
            "fuso_horario": f"fuso_horario {dir_sql} NULLS LAST",
            "ativo": f"ativo {dir_sql} NULLS LAST",
        }
        if clean_sort in sort_map:
            order_sql = sort_map[clean_sort]

        with ProdRealSyncSessionLocal() as session:
            total = int(
                session.execute(
                    text(f"{cte_sql} SELECT COUNT(*) FROM unidades_view {where_sql}"),
                    params,
                ).scalar_one()
            )
            rows = (
                session.execute(
                    text(
                        f"{cte_sql} SELECT * FROM unidades_view {where_sql} "
                        f"ORDER BY {order_sql} LIMIT :limit OFFSET :offset"
                    ),
                    params,
                )
                .mappings()
                .all()
            )

        items: list[dict[str, Any]] = []
        display_overrides: dict[str, dict[str, str]] = {}
        for r in rows:
            rd = dict(r)
            row_id = str(rd["id"])
            display_overrides[row_id] = {
                "sigla": str(rd.pop("sigla_hierarquia", rd.get("sigla") or "")),
                "uf": str(rd.pop("uf_efetiva", rd.get("uf") or "") or "--"),
            }
            items.append(self._serialize_row(rd))

        total_pages = max(1, (total + page_size - 1) // page_size)
        return {
            "items": items,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
            "fkLabels": {},
            "displayOverrides": display_overrides,
        }

    def _list_identificadores_ponto(
        self,
        search: str = "",
        page: int = 1,
        page_size: int = 20,
        filters_json: str = "",
        sort_by: str = "",
        sort_dir: str = "asc",
        orgao_id: str | None = None,
    ) -> dict[str, Any]:
        clean_search = (search or "").strip()
        offset = max(0, (page - 1) * page_size)
        params: dict[str, Any] = {"limit": page_size, "offset": offset}
        where_parts: list[str] = []
        if orgao_id:
            where_parts.append(
                "EXISTS (SELECT 1 FROM servidores s_ctx WHERE s_ctx.id = ident_view.servidor_id AND s_ctx.orgao_id = CAST(:ctx_orgao_id AS uuid))"
            )
            params["ctx_orgao_id"] = orgao_id

        if clean_search:
            q_lower = clean_search.lower()
            params["pattern"] = f"%{clean_search}%"
            clauses = [
                "servidor_label ILIKE :pattern",
                "valores_agrupados ILIKE :pattern",
            ]
            if q_lower in ("sim", "ativo", "sim / ativo"):
                clauses.append("principal = true OR ativo = true")
            elif q_lower in ("nao", "não", "inativo", "não / inativo", "nao / inativo"):
                clauses.append("principal = false OR ativo = false")
            where_parts.append("(" + " OR ".join(clauses) + ")")

        if filters_json and filters_json.strip():
            try:
                raw_filters = json.loads(filters_json)
            except json.JSONDecodeError:
                raw_filters = []
            if isinstance(raw_filters, list):
                col_expr_map = {
                    "servidor_id": "servidor_label",
                    "valor": "valores_agrupados",
                    "principal": "principal",
                    "ativo": "ativo",
                }
                for idx, flt in enumerate(raw_filters):
                    if not isinstance(flt, dict):
                        continue
                    col = str(flt.get("column") or "").strip()
                    val = str(flt.get("value") or "").strip()
                    op = str(flt.get("operator") or "contains").strip().lower()
                    if not col or not val or col not in col_expr_map:
                        continue
                    if col in ("principal", "ativo"):
                        vl = val.lower()
                        if vl in ("true", "1", "sim", "ativo", "sim / ativo"):
                            where_parts.append(f"{col} = true")
                            continue
                        if vl in ("false", "0", "nao", "não", "inativo", "não / inativo", "nao / inativo"):
                            where_parts.append(f"{col} = false")
                            continue
                    expr_col = col_expr_map[col]
                    pname = f"flt_{idx}"
                    if op == "equals":
                        params[pname] = val
                        where_parts.append(f"LOWER(TRIM({expr_col})) = LOWER(:{pname})")
                    elif op == "starts_with":
                        params[pname] = f"{val}%"
                        where_parts.append(f"{expr_col} ILIKE :{pname}")
                    else:
                        params[pname] = f"%{val}%"
                        where_parts.append(f"{expr_col} ILIKE :{pname}")

        where_sql = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""
        dir_sql = "DESC" if (sort_dir or "").strip().lower() == "desc" else "ASC"
        sort_map = {
            "servidor_id": f"servidor_label {dir_sql} NULLS LAST",
            "valor": f"valores_agrupados {dir_sql} NULLS LAST",
            "principal": f"principal {dir_sql}",
            "ativo": f"ativo {dir_sql}",
        }
        order_sql = sort_map.get((sort_by or "").strip(), "servidor_label ASC")

        cte_sql = """
            WITH ident_view AS (
                SELECT
                    (ARRAY_AGG(i.id::text ORDER BY i.principal DESC, i.criado_em ASC))[1] AS id,
                    i.servidor_id::text AS servidor_id,
                    (s.matricula || ' - ' || COALESCE(s.nome_funcional, s.matricula))::text AS servidor_label,
                    (ARRAY_AGG(i.valor ORDER BY i.principal DESC, i.criado_em ASC))[1] AS valor,
                    STRING_AGG(i.valor, ', ' ORDER BY i.principal DESC, i.valor ASC) AS valores_agrupados,
                    BOOL_OR(i.principal) AS principal,
                    BOOL_OR(i.ativo) AS ativo
                FROM identificadores_ponto_servidores i
                JOIN servidores s ON s.id = i.servidor_id
                GROUP BY i.servidor_id, s.matricula, s.nome_funcional
            )
        """

        with ProdRealSyncSessionLocal() as session:
            total = int(
                session.execute(
                    text(f"{cte_sql} SELECT COUNT(*) FROM ident_view {where_sql}"),
                    params,
                ).scalar_one()
            )
            rows = (
                session.execute(
                    text(
                        f"{cte_sql} SELECT * FROM ident_view {where_sql} "
                        f"ORDER BY {order_sql} LIMIT :limit OFFSET :offset"
                    ),
                    params,
                )
                .mappings()
                .all()
            )

        items: list[dict[str, Any]] = []
        fk_labels: dict[str, dict[str, str]] = {"servidor_id": {}}
        display_overrides: dict[str, dict[str, str]] = {}
        for r in rows:
            rd = dict(r)
            row_id = str(rd["id"])
            sid = str(rd["servidor_id"])
            fk_labels["servidor_id"][sid] = str(rd.pop("servidor_label", sid))
            display_overrides[row_id] = {
                "valor": str(rd.pop("valores_agrupados", rd.get("valor") or "")),
            }
            items.append(self._serialize_row(rd))

        total_pages = max(1, (total + page_size - 1) // page_size)
        return {
            "items": items,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
            "fkLabels": fk_labels,
            "displayOverrides": display_overrides,
        }

    def create_record(self, slug: str, payload: dict[str, Any]) -> dict[str, Any]:
        cdef = self._get_def(slug)
        cols: list[str] = []
        vals_sql: list[str] = []
        params: dict[str, Any] = {}

        with ProdRealSyncSessionLocal() as session:
            if cdef.pk_type == "uuid":
                new_id = str(uuid.uuid4())
                cols.append(f'"{cdef.pk_col}"')
                vals_sql.append("CAST(:pk_id AS uuid)")
                params["pk_id"] = new_id
            elif cdef.pk_type == "int":
                next_id = int(
                    session.execute(
                        text(f'SELECT COALESCE(MAX("{cdef.pk_col}"), 0) + 1 FROM "{cdef.table_name}"')
                    ).scalar_one()
                )
                cols.append(f'"{cdef.pk_col}"')
                vals_sql.append(":pk_id")
                params["pk_id"] = next_id
            elif cdef.pk_type == "str":
                new_id = str(payload.get(cdef.pk_col) or f"cfg-{uuid.uuid4().hex[:8]}")
                cols.append(f'"{cdef.pk_col}"')
                vals_sql.append(":pk_id")
                params["pk_id"] = new_id

            prepared = dict(payload)
            if slug == "identificadores-ponto":
                cols.append('"valor_normalizado"')
                vals_sql.append(":p_valor_normalizado")
                params["p_valor_normalizado"] = str(prepared.get("valor", "")).strip().upper()

            for f in cdef.fields:
                raw_val = prepared.get(f.name, f.default)
                if f.required and (raw_val is None or raw_val == ""):
                    raise ValueError(f"O campo obrigatório '{f.label}' não foi informado.")
                if raw_val is None or raw_val == "":
                    continue
                pname = f"p_{f.name}"
                cols.append(f'"{f.name}"')
                vals_sql.append(self._bind_expr(pname, f))
                params[pname] = self._coerce_value(raw_val, f)

            if cdef.has_created_at:
                cols.append('"criado_em"')
                vals_sql.append("NOW()")
            if cdef.has_updated_at:
                cols.append('"atualizado_em"')
                vals_sql.append("NOW()")

            sql = (
                f'INSERT INTO "{cdef.table_name}" ({", ".join(cols)}) '
                f'VALUES ({", ".join(vals_sql)}) RETURNING *'
            )
            try:
                row = session.execute(text(sql), params).mappings().first()
                session.commit()
            except IntegrityError as exc:
                session.rollback()
                raise ValueError(f"Erro de integridade ao criar registro: {exc.orig}") from exc

        self._redis.invalidate_prefix("secp:prod_real:cadastros:")
        return self._serialize_row(dict(row)) if row else {}

    def update_record(
        self, slug: str, record_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        cdef = self._get_def(slug)
        sets: list[str] = []
        params: dict[str, Any] = {
            "pk_id": int(record_id) if cdef.pk_type == "int" else record_id
        }

        prepared = dict(payload)
        if slug == "identificadores-ponto" and "valor" in prepared:
            sets.append('"valor_normalizado" = :p_valor_normalizado')
            params["p_valor_normalizado"] = str(prepared.get("valor", "")).strip().upper()

        for f in cdef.fields:
            if f.name not in prepared:
                continue
            raw_val = prepared[f.name]
            if f.required and (raw_val is None or raw_val == ""):
                raise ValueError(f"O campo obrigatório '{f.label}' não pode ficar vazio.")
            pname = f"p_{f.name}"
            if raw_val is None or raw_val == "":
                if f.input_type == "password":
                    continue
                sets.append(f'"{f.name}" = NULL')
            else:
                sets.append(f'"{f.name}" = {self._bind_expr(pname, f)}')
                params[pname] = self._coerce_value(raw_val, f)

        if cdef.has_updated_at:
            sets.append('"atualizado_em" = NOW()')

        if not sets:
            raise ValueError("Nenhum campo informado para atualização.")

        pk_expr = f'CAST(:pk_id AS uuid)' if cdef.pk_type == "uuid" else ":pk_id"
        sql = (
            f'UPDATE "{cdef.table_name}" SET {", ".join(sets)} '
            f'WHERE "{cdef.pk_col}" = {pk_expr} RETURNING *'
        )
        with ProdRealSyncSessionLocal() as session:
            try:
                row = session.execute(text(sql), params).mappings().first()
                session.commit()
            except IntegrityError as exc:
                session.rollback()
                raise ValueError(f"Erro de integridade ao atualizar registro: {exc.orig}") from exc

        if row is None:
            raise ValueError("Registro não encontrado para atualização.")
        self._redis.invalidate_prefix("secp:prod_real:cadastros:")
        return self._serialize_row(dict(row))

    def delete_record(self, slug: str, record_id: str) -> dict[str, Any]:
        cdef = self._get_def(slug)
        pk_expr = "CAST(:pk_id AS uuid)" if cdef.pk_type == "uuid" else ":pk_id"
        pk_val: Any = int(record_id) if cdef.pk_type == "int" else record_id

        with ProdRealSyncSessionLocal() as session:
            try:
                res = session.execute(
                    text(f'DELETE FROM "{cdef.table_name}" WHERE "{cdef.pk_col}" = {pk_expr}'),
                    {"pk_id": pk_val},
                )
                session.commit()
            except IntegrityError as exc:
                session.rollback()
                raise ValueError(
                    "Não é possível excluir este registro pois existem vínculos dependentes na base de dados."
                ) from exc

        if res.rowcount == 0:
            raise ValueError("Registro não encontrado para exclusão.")
        self._redis.invalidate_prefix("secp:prod_real:cadastros:")
        return {"deleted": True, "id": record_id}

    def get_perfil_permissoes(self, perfil_id: str) -> dict[str, Any]:
        pid = self._validate_uuid_or_none(perfil_id)
        if not pid:
            raise ValueError("Identificador de perfil inválido.")

        with ProdRealSyncSessionLocal() as session:
            perfil = session.execute(
                text("SELECT id::text AS id, codigo, nome, descricao FROM perfis WHERE id = CAST(:pid AS uuid)"),
                {"pid": pid},
            ).mappings().first()
            if not perfil:
                raise ValueError("Perfil não encontrado.")

            todas = session.execute(
                text(
                    """
                    SELECT id::text AS id, codigo, recurso, acao, escopo, COALESCE(descricao, '') AS descricao
                    FROM permissoes
                    ORDER BY recurso ASC, codigo ASC
                    """
                )
            ).mappings().all()

            vinculadas = session.execute(
                text("SELECT permissao_id::text FROM perfis_permissoes WHERE perfil_id = CAST(:pid AS uuid)"),
                {"pid": pid},
            ).scalars().all()

        return {
            "perfil": dict(perfil),
            "todasPermissoes": [dict(r) for r in todas],
            "permissoesIds": list(vinculadas),
        }

    def update_perfil_permissoes(
        self,
        perfil_id: str,
        permissoes_ids: list[str],
        actor_perfil: str | None = None,
    ) -> dict[str, Any]:
        actor = (actor_perfil or "").strip().upper()
        if actor and actor not in ("ADMIN", "MASTER"):
            raise PermissionError("Apenas perfis ADMIN ou MASTER podem alterar permissões de perfis.")

        pid = self._validate_uuid_or_none(perfil_id)
        if not pid:
            raise ValueError("Identificador de perfil inválido.")

        valid_ids = [
            uid for uid in (self._validate_uuid_or_none(x) for x in permissoes_ids) if uid is not None
        ]
        unique_ids = list(dict.fromkeys(valid_ids))

        with ProdRealSyncSessionLocal() as session:
            exists = session.execute(
                text("SELECT 1 FROM perfis WHERE id = CAST(:pid AS uuid)"),
                {"pid": pid},
            ).scalar_one_or_none()
            if not exists:
                raise ValueError("Perfil não encontrado.")

            session.execute(
                text("DELETE FROM perfis_permissoes WHERE perfil_id = CAST(:pid AS uuid)"),
                {"pid": pid},
            )
            for perm_id in unique_ids:
                session.execute(
                    text(
                        """
                        INSERT INTO perfis_permissoes (id, perfil_id, permissao_id, criado_em)
                        VALUES (CAST(:id AS uuid), CAST(:pid AS uuid), CAST(:perm_id AS uuid), NOW())
                        """
                    ),
                    {"id": str(uuid.uuid4()), "pid": pid, "perm_id": perm_id},
                )
            session.commit()

        self._redis.invalidate_prefix("secp:prod_real:")
        return {
            "perfilId": pid,
            "totalPermissoes": len(unique_ids),
            "permissoesIds": unique_ids,
        }

    @staticmethod
    def _bind_expr(pname: str, f: CadastroFieldDef) -> str:
        if f.input_type == "enum":
            return f'CAST(:{pname} AS "{f.db_type}")'
        if f.db_type == "uuid":
            return f"CAST(:{pname} AS uuid)"
        if f.db_type == "_text":
            return f"CAST(:{pname} AS text[])"
        return f":{pname}"

    @staticmethod
    def _coerce_value(val: Any, f: CadastroFieldDef) -> Any:
        if f.input_type == "password":
            pwd = str(val).strip()
            if len(pwd) < 6:
                raise ValueError("A senha local deve possuir no mínimo 6 caracteres.")
            return bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")
        if f.db_type == "int4":
            return int(val)
        if f.db_type == "numeric":
            return Decimal(str(val))
        if f.db_type == "bool":
            if isinstance(val, bool):
                return val
            return str(val).lower() in ("true", "1", "sim", "on")
        if f.db_type == "date":
            if isinstance(val, date):
                return val
            return date.fromisoformat(str(val)[:10])
        if f.db_type == "_text":
            if isinstance(val, list):
                return [str(x).strip() for x in val if str(x).strip()]
            return [x.strip() for x in str(val).split(",") if x.strip()]
        return str(val).strip()

    @staticmethod
    def _serialize_row(row: dict[str, Any]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for k, v in row.items():
            if k == "senha_hash":
                out[k] = ""
                continue
            if isinstance(v, (datetime, date)):
                out[k] = v.isoformat()
            elif isinstance(v, Decimal):
                out[k] = float(v)
            elif isinstance(v, uuid.UUID):
                out[k] = str(v)
            else:
                out[k] = v
        return out
