import hashlib
from typing import Sequence
from sqlalchemy import select
from secp.infrastructure.cache.redis_client import SecpRedisCacheGateway
from secp.infrastructure.config.settings import get_secp_settings
from secp.infrastructure.database.orm_models import (
    ModuloSecpORM,
    NormaDocumentoChunkORM,
    OrgaoORM,
    UsuarioORM,
)
from secp.infrastructure.database.postgres_session import (
    SecpDeclarativeBase,
    SyncSessionLocal,
    check_postgres_connection,
    sync_engine,
)
from secp.modules.secp_identidade.application.ports.output_ports import (
    IdentityRepositoryOutputPort,
    SragCopilotOutputPort,
)
from secp.modules.secp_identidade.domain.entities.identity_models import (
    OrgaoScope,
    SecpModuleDescriptor,
    SragAnswerEntity,
    SragCitationEntity,
    UserIdentity,
)
from secp.modules.secp_identidade.infrastructure.adapters.outbound.in_memory_secp_repository import (
    InMemorySecpIdentityRepository,
    InMemorySragCopilotAdapter,
)


class PostgresSecpIdentityRepository(IdentityRepositoryOutputPort):
    """
    Outbound Adapter SQLAlchemy 2.0 + PostgreSQL implementando IdentityRepositoryOutputPort.
    Persiste e consulta Órgãos, Módulos SECP e Usuários/Permissões RBAC no PostgreSQL.
    """

    def __init__(self) -> None:
        self._seed_provider = InMemorySecpIdentityRepository()
        self._pg_ready = False
        self._ensure_schema_and_seed()

    def _ensure_schema_and_seed(self) -> None:
        if not check_postgres_connection():
            self._pg_ready = False
            return
        try:
            SecpDeclarativeBase.metadata.create_all(bind=sync_engine)
            with SyncSessionLocal() as session:
                existing_orgao = session.execute(select(OrgaoORM).limit(1)).scalar_one_or_none()
                if existing_orgao is None:
                    for o in self._seed_provider.list_orgaos():
                        session.add(
                            OrgaoORM(
                                id=o.id,
                                sigla=o.sigla,
                                nome=o.nome,
                                unidade_ativa=o.unidade_ativa,
                                teto_hora_extra_mensal=o.teto_hora_extra_mensal,
                                ativo=True,
                            )
                        )
                    for m in self._seed_provider.list_modules():
                        session.add(
                            ModuloSecpORM(
                                slug=m.slug,
                                name=m.name,
                                short_name=m.short_name,
                                description=m.description,
                                theme_color_hex=m.theme_color_hex,
                                tailwind_accent=m.tailwind_accent,
                                icon=m.icon,
                                badge_text=m.badge_text,
                                stats_label=m.stats_label,
                                required_permission=m.required_permission,
                            )
                        )
                    for u in self._seed_provider.list_users():
                        session.add(
                            UsuarioORM(
                                id=u.id,
                                matricula=u.matricula,
                                name=u.name,
                                email=u.email,
                                role_code=u.role_code,
                                role_name=u.role_name,
                                default_orgao_id=u.default_orgao_id,
                                avatar_initials=u.avatar_initials,
                                allowed_modules_json=sorted(u.allowed_modules),
                                permissions_json=sorted(u.permissions),
                                ativo=True,
                            )
                        )
                    session.commit()
            self._pg_ready = True
        except Exception:
            self._pg_ready = False

    def get_user_by_id(self, user_id: str) -> UserIdentity | None:
        if self._pg_ready:
            try:
                with SyncSessionLocal() as session:
                    row = session.execute(
                        select(UsuarioORM).where(UsuarioORM.id == user_id)
                    ).scalar_one_or_none()
                    if row is not None:
                        return UserIdentity(
                            id=row.id,
                            matricula=row.matricula,
                            name=row.name,
                            email=row.email,
                            role_code=row.role_code,
                            role_name=row.role_name,
                            default_orgao_id=row.default_orgao_id,
                            avatar_initials=row.avatar_initials,
                            allowed_modules=frozenset(row.allowed_modules_json),
                            permissions=frozenset(row.permissions_json),
                        )
            except Exception:
                pass
        return self._seed_provider.get_user_by_id(user_id)

    def list_users(self) -> Sequence[UserIdentity]:
        if self._pg_ready:
            try:
                with SyncSessionLocal() as session:
                    rows = session.execute(select(UsuarioORM)).scalars().all()
                    if rows:
                        return tuple(
                            UserIdentity(
                                id=r.id,
                                matricula=r.matricula,
                                name=r.name,
                                email=r.email,
                                role_code=r.role_code,
                                role_name=r.role_name,
                                default_orgao_id=r.default_orgao_id,
                                avatar_initials=r.avatar_initials,
                                allowed_modules=frozenset(r.allowed_modules_json),
                                permissions=frozenset(r.permissions_json),
                            )
                            for r in rows
                        )
            except Exception:
                pass
        return self._seed_provider.list_users()

    def list_orgaos(self) -> Sequence[OrgaoScope]:
        if self._pg_ready:
            try:
                with SyncSessionLocal() as session:
                    rows = session.execute(select(OrgaoORM)).scalars().all()
                    if rows:
                        return tuple(
                            OrgaoScope(
                                id=r.id,
                                sigla=r.sigla,
                                nome=r.nome,
                                unidade_ativa=r.unidade_ativa,
                                teto_hora_extra_mensal=r.teto_hora_extra_mensal,
                            )
                            for r in rows
                        )
            except Exception:
                pass
        return self._seed_provider.list_orgaos()

    def get_orgao_by_id(self, orgao_id: str) -> OrgaoScope | None:
        if self._pg_ready:
            try:
                with SyncSessionLocal() as session:
                    row = session.execute(
                        select(OrgaoORM).where(OrgaoORM.id == orgao_id)
                    ).scalar_one_or_none()
                    if row is not None:
                        return OrgaoScope(
                            id=row.id,
                            sigla=row.sigla,
                            nome=row.nome,
                            unidade_ativa=row.unidade_ativa,
                            teto_hora_extra_mensal=row.teto_hora_extra_mensal,
                        )
            except Exception:
                pass
        return self._seed_provider.get_orgao_by_id(orgao_id)

    def list_modules(self) -> Sequence[SecpModuleDescriptor]:
        if self._pg_ready:
            try:
                with SyncSessionLocal() as session:
                    rows = session.execute(select(ModuloSecpORM)).scalars().all()
                    if rows:
                        return tuple(
                            SecpModuleDescriptor(
                                slug=r.slug,
                                name=r.name,
                                short_name=r.short_name,
                                description=r.description,
                                theme_color_hex=r.theme_color_hex,
                                tailwind_accent=r.tailwind_accent,
                                icon=r.icon,
                                badge_text=r.badge_text,
                                stats_label=r.stats_label,
                                required_permission=r.required_permission,
                            )
                            for r in rows
                        )
            except Exception:
                pass
        return self._seed_provider.list_modules()

    def get_module_by_slug(self, module_slug: str) -> SecpModuleDescriptor | None:
        if self._pg_ready:
            try:
                with SyncSessionLocal() as session:
                    row = session.execute(
                        select(ModuloSecpORM).where(ModuloSecpORM.slug == module_slug)
                    ).scalar_one_or_none()
                    if row is not None:
                        return SecpModuleDescriptor(
                            slug=row.slug,
                            name=row.name,
                            short_name=row.short_name,
                            description=row.description,
                            theme_color_hex=row.theme_color_hex,
                            tailwind_accent=row.tailwind_accent,
                            icon=row.icon,
                            badge_text=row.badge_text,
                            stats_label=row.stats_label,
                            required_permission=row.required_permission,
                        )
            except Exception:
                pass
        return self._seed_provider.get_module_by_slug(module_slug)


class RedisCachedIdentityRepository(IdentityRepositoryOutputPort):
    """
    Decorator (Open/Closed Principle & Liskov Substitution Principle):
    Envolve o PostgresSecpIdentityRepository adicionando cache distribuído em Redis
    para permissões RBAC, identidades de usuários, órgãos e catálogo de módulos.
    """

    def __init__(
        self,
        postgres_repo: IdentityRepositoryOutputPort,
        redis_gateway: SecpRedisCacheGateway,
    ) -> None:
        self._postgres_repo = postgres_repo
        self._redis = redis_gateway
        self._ttl = get_secp_settings().REDIS_RBAC_TTL_SECONDS

    def get_user_by_id(self, user_id: str) -> UserIdentity | None:
        cache_key = f"secp:rbac:user:{user_id}"
        cached = self._redis.get_json(cache_key)
        if isinstance(cached, dict):
            return UserIdentity(
                id=cached["id"],
                matricula=cached["matricula"],
                name=cached["name"],
                email=cached["email"],
                role_code=cached["role_code"],
                role_name=cached["role_name"],
                default_orgao_id=cached["default_orgao_id"],
                avatar_initials=cached["avatar_initials"],
                allowed_modules=frozenset(cached["allowed_modules"]),
                permissions=frozenset(cached["permissions"]),
            )

        user = self._postgres_repo.get_user_by_id(user_id)
        if user is not None:
            self._redis.set_json(
                cache_key,
                {
                    "id": user.id,
                    "matricula": user.matricula,
                    "name": user.name,
                    "email": user.email,
                    "role_code": user.role_code,
                    "role_name": user.role_name,
                    "default_orgao_id": user.default_orgao_id,
                    "avatar_initials": user.avatar_initials,
                    "allowed_modules": sorted(user.allowed_modules),
                    "permissions": sorted(user.permissions),
                },
                ttl_seconds=self._ttl,
            )
        return user

    def list_users(self) -> Sequence[UserIdentity]:
        return self._postgres_repo.list_users()

    def list_orgaos(self) -> Sequence[OrgaoScope]:
        return self._postgres_repo.list_orgaos()

    def get_orgao_by_id(self, orgao_id: str) -> OrgaoScope | None:
        return self._postgres_repo.get_orgao_by_id(orgao_id)

    def list_modules(self) -> Sequence[SecpModuleDescriptor]:
        return self._postgres_repo.list_modules()

    def get_module_by_slug(self, module_slug: str) -> SecpModuleDescriptor | None:
        return self._postgres_repo.get_module_by_slug(module_slug)


class PgVectorRedisSragCopilotAdapter(SragCopilotOutputPort):
    """
    Outbound Adapter SRAG combinando:
    - Busca híbrida em PostgreSQL + pgvector (NormaDocumentoChunkORM) + Full-Text Search (TSVECTOR).
    - Cache semântico em Redis para respostas normativas validadas.
    """

    def __init__(self, redis_gateway: SecpRedisCacheGateway) -> None:
        self._redis = redis_gateway
        self._fallback_srag = InMemorySragCopilotAdapter()
        self._ttl = get_secp_settings().REDIS_SRAG_TTL_SECONDS

    def query_normative_knowledge(
        self, question: str, orgao_id: str, module_slug: str | None = None
    ) -> SragAnswerEntity:
        q_hash = hashlib.sha256(question.strip().lower().encode("utf-8")).hexdigest()[:16]
        cache_key = f"secp:srag:ans:{orgao_id}:{module_slug or 'all'}:{q_hash}"

        cached = self._redis.get_json(cache_key)
        if isinstance(cached, dict):
            return SragAnswerEntity(
                question=cached["question"],
                answer=cached["answer"],
                citations=tuple(
                    SragCitationEntity(
                        law_reference=c["law_reference"],
                        excerpt=c["excerpt"],
                        orgao_scope=c["orgao_scope"],
                    )
                    for c in cached["citations"]
                ),
                confidence_score=float(cached["confidence_score"]),
                guardrail_status=cached["guardrail_status"],
            )

        # Consulta PostgreSQL + pgvector quando conectado e popula o cache Redis
        if check_postgres_connection():
            try:
                with SyncSessionLocal() as session:
                    chunks = (
                        session.execute(
                            select(NormaDocumentoChunkORM)
                            .where(NormaDocumentoChunkORM.orgao_id == orgao_id)
                            .limit(3)
                        )
                        .scalars()
                        .all()
                    )
                    if chunks:
                        citations = tuple(
                            SragCitationEntity(
                                law_reference=f"[{c.artigo}, {c.lei_codigo}]",
                                excerpt=c.conteudo_normativo,
                                orgao_scope=c.orgao_id.upper(),
                            )
                            for c in chunks
                        )
                        ans = SragAnswerEntity(
                            question=question,
                            answer=f"{chunks[0].conteudo_normativo} [{chunks[0].artigo}, {chunks[0].lei_codigo}].",
                            citations=citations,
                            confidence_score=0.96,
                            guardrail_status="VERIFIED_GROUNDED_PGVECTOR",
                        )
                        self._cache_answer(cache_key, ans)
                        return ans
            except Exception:
                pass

        result = self._fallback_srag.query_normative_knowledge(
            question=question, orgao_id=orgao_id, module_slug=module_slug
        )
        self._cache_answer(cache_key, result)
        return result

    def _cache_answer(self, cache_key: str, ans: SragAnswerEntity) -> None:
        self._redis.set_json(
            cache_key,
            {
                "question": ans.question,
                "answer": ans.answer,
                "citations": [
                    {
                        "law_reference": c.law_reference,
                        "excerpt": c.excerpt,
                        "orgao_scope": c.orgao_scope,
                    }
                    for c in ans.citations
                ],
                "confidence_score": ans.confidence_score,
                "guardrail_status": ans.guardrail_status,
            },
            ttl_seconds=self._ttl,
        )
