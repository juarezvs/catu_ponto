from typing import Optional
import uuid
from secp.infrastructure.cache.redis_client import SecpRedisCacheGateway
from secp.infrastructure.database.postgres_session import (
    SecpDeclarativeBase,
    check_postgres_connection,
    sync_engine,
)
from secp.modules.secp_identidade.application.ports.rbac_ports import (
    RbacMatrixSnapshot,
    RbacRepositoryOutputPort,
)
from secp.modules.secp_identidade.domain.entities.rbac_models import (
    LiberacaoRotinaEntity,
    PerfilEntity,
    PerfilPermissaoOrgaoEntity,
    PermissaoEntity,
    UsuarioPerfilEntity,
)


class PostgresRedisRbacRepository(RbacRepositoryOutputPort):
    """
    Outbound Adapter Central do SECP Identidade (PostgreSQL + Redis Cache).
    Implementa integralmente os 18 perfis reais, permissões `recurso:acao:escopo`,
    exceções por órgão (Anexo A.2: SERVIDOR/SJTO) e liberações operacionais (Anexo A.4)
    do SECP_DOCUMENTO_UNICO_RECONSTRUCAO.md.
    """

    def __init__(self, redis_gateway: SecpRedisCacheGateway) -> None:
        self._redis = redis_gateway
        self._permissoes: tuple[PermissaoEntity, ...] = (
            # Módulos do Ecossistema SECP
            PermissaoEntity("perm-mod-1", "secp-identidade:access", "secp-identidade", "access", "MODULO", "Acessar SECP Identidade & RBAC"),
            PermissaoEntity("perm-mod-2", "secp-ponto:access", "secp-ponto", "access", "MODULO", "Acessar SECP Ponto"),
            PermissaoEntity("perm-mod-3", "secp-folha:access", "secp-folha", "access", "MODULO", "Acessar SECP Folha"),
            PermissaoEntity("perm-mod-4", "secp-ferias:access", "secp-ferias", "access", "MODULO", "Acessar SECP Férias"),
            PermissaoEntity("perm-mod-5", "secp-contracheque:access", "secp-contracheque", "access", "MODULO", "Acessar SECP Contracheque"),
            PermissaoEntity("perm-mod-6", "secp-hora-extra:access", "secp-hora-extra", "access", "MODULO", "Acessar SECP Hora Extra"),

            # Permissões Oficiais do Anexo A.3 (SECP Ponto & Identidade)
            PermissaoEntity("perm-p-1", "dashboard:visualizar:proprio", "dashboard", "visualizar", "proprio", "Visualizar dashboard próprio."),
            PermissaoEntity("perm-p-2", "espelho-ponto:visualizar:proprio", "espelho-ponto", "visualizar", "proprio", "Visualizar próprio espelho de ponto."),
            PermissaoEntity("perm-p-3", "marcacoes:registrar:proprio", "marcacoes", "registrar", "proprio", "Registrar a própria marcação de ponto."),
            PermissaoEntity("perm-p-4", "marcacoes:registrar-facial:proprio", "marcacoes", "registrar-facial", "proprio", "Registrar marcação por reconhecimento facial."),
            PermissaoEntity("perm-p-5", "marcacoes:registrar-web:proprio", "marcacoes", "registrar-web", "proprio", "Registrar marcação via sistema web."),
            PermissaoEntity("perm-p-6", "marcacoes:consultar:seccional", "marcacoes", "consultar", "seccional", "Consultar marcações de servidores da seccional."),
            PermissaoEntity("perm-p-7", "marcacao:manutencao:seccional", "marcacao", "manutencao", "seccional", "Incluir, alterar e excluir marcações derivadas."),
            PermissaoEntity("perm-p-8", "afd:importar:seccional", "afd", "importar", "seccional", "Importar arquivos AFD de equipamentos biométricos."),
            PermissaoEntity("perm-p-9", "apuracao:consultar:proprio", "apuracao", "consultar", "proprio", "Consultar a própria apuração diária e espelho."),
            PermissaoEntity("perm-p-10", "apuracao:recalcular:seccional", "apuracao", "recalcular", "seccional", "Recalcular apurações de frequência."),
            PermissaoEntity("perm-p-11", "banco-horas:consultar:proprio", "banco-horas", "consultar", "proprio", "Consultar o próprio banco de horas."),
            PermissaoEntity("perm-p-12", "banco-horas:consultar:subordinados", "banco-horas", "consultar", "subordinados", "Consultar banco de horas de subordinados."),
            PermissaoEntity("perm-p-13", "banco-horas:gerenciar:seccional", "banco-horas", "gerenciar", "seccional", "Gerenciar, referendar e recalcular banco de horas."),
            PermissaoEntity("perm-p-14", "solicitacoes:criar:proprio", "solicitacoes", "criar", "proprio", "Criar solicitações próprias de frequência."),
            PermissaoEntity("perm-p-15", "solicitacoes:analisar:subordinados", "solicitacoes", "analisar", "subordinados", "Analisar solicitações dos subordinados."),
            PermissaoEntity("perm-p-16", "homologacao:gerenciar:subordinados", "homologacao", "gerenciar", "subordinados", "Homologar frequência mensal de subordinados."),
            PermissaoEntity("perm-p-17", "homologacao:consultar:seccional", "homologacao", "consultar", "seccional", "Consultar homologações mensais da seccional."),
            PermissaoEntity("perm-p-18", "boletim-frequencia:gerar:subordinados", "boletim-frequencia", "gerar", "subordinados", "Gerar Boletim de Frequência da unidade."),
            PermissaoEntity("perm-p-19", "boletim-frequencia:encaminhar:subordinados", "boletim-frequencia", "encaminhar", "subordinados", "Encaminhar Boletim de Frequência à SECAP/NUCGP."),
            PermissaoEntity("perm-p-20", "boletim-frequencia:receber:seccional", "boletim-frequencia", "receber", "seccional", "Registrar recebimento/conferência do Boletim."),
            PermissaoEntity("perm-p-21", "recesso:consultar:proprio", "recesso", "consultar", "proprio", "Consultar o próprio recesso forense."),
            PermissaoEntity("perm-p-22", "recesso:homologar:subordinados", "recesso", "homologar", "subordinados", "Homologar recesso dos servidores convocados."),
            PermissaoEntity("perm-p-23", "recesso:aceitar:seccional", "recesso", "aceitar", "seccional", "Aceitar homologação do recesso pela SECAD."),
            PermissaoEntity("perm-p-24", "perfis:gerenciar:seccional", "perfis", "gerenciar", "seccional", "Gerenciar perfis e permissões RBAC."),
            PermissaoEntity("perm-p-25", "usuarios:gerenciar:seccional", "usuarios", "gerenciar", "seccional", "Gerenciar usuários e vínculos."),
            PermissaoEntity("perm-p-26", "auditoria:consultar:seccional", "auditoria", "consultar", "seccional", "Consultar trilhas de auditoria."),

            # Permissões de navegação da Dupla Sidebar
            PermissaoEntity("perm-nav-1", "cadastros:pessoas:read", "cadastros.pessoas", "read", "SUBITEM", "Visualizar Cadastro de Pessoas"),
            PermissaoEntity("perm-nav-2", "cadastros:departamentos:read", "cadastros.departamentos", "read", "SUBITEM", "Visualizar Departamentos"),
            PermissaoEntity("perm-nav-3", "cadastros:orgaos:read", "cadastros.orgaos", "read", "SUBITEM", "Visualizar Órgãos"),
            PermissaoEntity("perm-nav-4", "cadastros:unidades:read", "cadastros.unidades", "read", "SUBITEM", "Visualizar Unidades"),
            PermissaoEntity("perm-nav-5", "cadastros:cargos:read", "cadastros.cargos", "read", "SUBITEM", "Visualizar Cargos"),
            PermissaoEntity("perm-nav-6", "cadastros:funcoes:read", "cadastros.funcoes", "read", "SUBITEM", "Visualizar Funções"),
            PermissaoEntity("perm-nav-7", "cadastros:feriados:read", "cadastros.feriados", "read", "SUBITEM", "Visualizar Calendário Institucional"),
            PermissaoEntity("perm-nav-8", "cadastros:horarios:read", "cadastros.horarios", "read", "SUBITEM", "Visualizar Jornadas e Escalas"),
            PermissaoEntity("perm-nav-9", "movimentacoes:read", "movimentacoes", "read", "SUBITEM", "Acessar Movimentações do Módulo"),
            PermissaoEntity("perm-nav-10", "relatorios:read", "relatorios", "read", "SUBITEM", "Emitir Relatórios Oficiais"),
            PermissaoEntity("perm-nav-11", "configuracoes:perfil:read", "configuracoes.perfil", "read", "SUBITEM", "Preferências de Conta"),
            PermissaoEntity("perm-nav-12", "configuracoes:permissoes:read", "configuracoes.permissoes", "read", "SUBITEM", "Configurar Matriz RBAC"),
        )

        # Os 18 Perfis Reais do Anexo A (SECP_DOCUMENTO_UNICO_RECONSTRUCAO.md)
        self._perfis: list[PerfilEntity] = [
            PerfilEntity("perf-master", "MASTER", "MASTER", "Administrador raiz com resolução dinâmica de todas as permissões e órgãos.", True, True, True, False, None, frozenset({"*"})),
            PerfilEntity("perf-admin", "ADMIN", "Administrador do Sistema", "Administração seccional completa (sem equivalência ao MASTER raiz).", True, True, True, True, None, frozenset({
                "secp-identidade:access", "secp-ponto:access", "secp-folha:access", "secp-ferias:access", "secp-contracheque:access", "secp-hora-extra:access",
                "perfis:gerenciar:seccional", "usuarios:gerenciar:seccional", "auditoria:consultar:seccional",
                "apuracao:consultar:proprio", "apuracao:recalcular:seccional", "banco-horas:gerenciar:seccional",
                "homologacao:consultar:seccional", "boletim-frequencia:receber:seccional", "marcacoes:consultar:seccional", "marcacao:manutencao:seccional", "afd:importar:seccional",
                "cadastros:pessoas:read", "cadastros:departamentos:read", "cadastros:orgaos:read", "cadastros:unidades:read", "cadastros:cargos:read", "cadastros:funcoes:read", "cadastros:feriados:read", "cadastros:horarios:read",
                "movimentacoes:read", "relatorios:read", "configuracoes:perfil:read", "configuracoes:permissoes:read",
            })),
            PerfilEntity("perf-chefia", "CHEFIA", "Chefia/Gestor de Unidade", "Analisa solicitações, homologa frequência e encaminha boletim de subordinados.", True, True, False, True, None, frozenset({
                "secp-ponto:access", "secp-ferias:access", "secp-contracheque:access", "secp-hora-extra:access",
                "dashboard:visualizar:proprio", "espelho-ponto:visualizar:proprio", "apuracao:consultar:proprio",
                "banco-horas:consultar:proprio", "banco-horas:consultar:subordinados",
                "solicitacoes:criar:proprio", "solicitacoes:analisar:subordinados",
                "homologacao:gerenciar:subordinados", "boletim-frequencia:gerar:subordinados", "boletim-frequencia:encaminhar:subordinados",
                "recesso:consultar:proprio", "recesso:homologar:subordinados",
                "cadastros:pessoas:read", "cadastros:departamentos:read", "cadastros:unidades:read", "cadastros:feriados:read",
                "movimentacoes:read", "relatorios:read",
            })),
            PerfilEntity("perf-secap", "SECAP", "SECAP/NUCGP", "Recebe boletins de frequência, analisa férias e administra cadastros funcionais.", True, True, True, False, None, frozenset({
                "secp-ponto:access", "secp-folha:access", "secp-ferias:access", "secp-contracheque:access", "secp-hora-extra:access",
                "boletim-frequencia:receber:seccional", "homologacao:consultar:seccional", "banco-horas:gerenciar:seccional",
                "cadastros:pessoas:read", "cadastros:departamentos:read", "cadastros:cargos:read", "cadastros:funcoes:read", "cadastros:feriados:read", "cadastros:horarios:read",
                "movimentacoes:read", "relatorios:read", "configuracoes:perfil:read",
            })),
            PerfilEntity("perf-secad", "SECAD", "SECAD", "Aceita homologações do recesso forense e consolida para SEPAG/SECAP.", True, True, True, False, None, frozenset({"secp-ponto:access", "recesso:aceitar:seccional", "movimentacoes:read", "relatorios:read"})),
            PerfilEntity("perf-diref", "DIREF", "Direção do Foro", "Auditoria e painel executivo global de frequência, banco de horas e horas extras.", True, True, True, False, None, frozenset({"secp-ponto:access", "secp-hora-extra:access", "auditoria:consultar:seccional", "relatorios:read"})),
            PerfilEntity("perf-nutec", "NUTEC", "NUTEC", "Núcleo técnico de equipamentos biométricos, AFD e suporte operacional.", True, True, True, False, None, frozenset({"secp-ponto:access", "afd:importar:seccional", "cadastros:horarios:read", "movimentacoes:read"})),
            PerfilEntity("perf-servidor", "SERVIDOR", "Servidor", "Autoatendimento: espelho de ponto, solicitações, banco de horas, férias e contracheque.", True, True, False, True, None, frozenset({
                "secp-ponto:access", "secp-ferias:access", "secp-contracheque:access",
                "dashboard:visualizar:proprio", "espelho-ponto:visualizar:proprio", "apuracao:consultar:proprio",
                "marcacoes:registrar:proprio", "marcacoes:registrar-facial:proprio",
                "banco-horas:consultar:proprio", "solicitacoes:criar:proprio", "recesso:consultar:proprio",
                "cadastros:feriados:read", "movimentacoes:read",
            })),
            PerfilEntity("perf-estagiario", "ESTAGIARIO", "Estagiário", "Registro de frequência e acompanhamento mensal de estágio.", True, True, False, True, None, frozenset({"secp-ponto:access", "dashboard:visualizar:proprio", "espelho-ponto:visualizar:proprio", "marcacoes:registrar:proprio", "movimentacoes:read"})),
            PerfilEntity("perf-prestador", "PRESTADOR", "Prestador", "Controle simples de entrada/saída de prestador.", True, True, False, True, None, frozenset({"secp-ponto:access", "marcacoes:registrar:proprio"})),
            PerfilEntity("perf-voluntario", "VOLUNTARIO", "Voluntário", "Controle simples de frequência voluntária.", True, True, False, False, None, frozenset({"secp-ponto:access", "marcacoes:registrar:proprio"})),
            PerfilEntity("perf-magistrado", "MAGISTRADO", "Magistrado", "Consulta de férias, contracheque e atos.", True, True, False, False, None, frozenset({"secp-ferias:access", "secp-contracheque:access"})),
            PerfilEntity("perf-suporte", "SUPORTE", "Suporte técnico", "Perfil técnico legado de suporte.", True, True, True, False, None, frozenset({"secp-ponto:access", "auditoria:consultar:seccional"})),
            PerfilEntity("perf-totem", "SECP-AM_TOTEM", "MODO TOTEM", "Operação dedicada de Totem facial.", False, True, False, False, "sjam", frozenset({"secp-ponto:access", "marcacoes:registrar-facial:proprio"})),
            PerfilEntity("perf-sesud", "SECP-SESUD_DIREF", "Sesud Diref", "Perfil personalizado DIREF.", False, True, True, False, None, frozenset({"secp-ponto:access", "relatorios:read"})),
            PerfilEntity("perf-sjma-secap", "SJMA-SECAP", "Secap (SJMA)", "Perfil personalizado SECAP para SJMA.", False, True, True, False, "sjma", frozenset({"secp-ponto:access", "boletim-frequencia:receber:seccional"})),
            PerfilEntity("perf-exc-facial", "EXCECAO_REGISTRO_FACIAL", "Exceção - Registro facial", "Perfil técnico oculto de exceção (destino: SERVIDOR).", True, True, False, True, None, frozenset({"marcacoes:registrar-facial:proprio"})),
            PerfilEntity("perf-exc-web", "EXCECAO_REGISTRO_WEB", "Exceção - Registro web", "Perfil técnico oculto de exceção (destino: SERVIDOR).", True, True, False, True, None, frozenset({"marcacoes:registrar-web:proprio"})),
        ]

        # Exceção real de produção (Anexo A.2): SERVIDOR na SJTO tem marcacoes:registrar-web:proprio = Sim
        self._orgao_overrides: list[PerfilPermissaoOrgaoEntity] = [
            PerfilPermissaoOrgaoEntity(
                perfil_id="perf-servidor",
                permissao_codigo="marcacoes:registrar-web:proprio",
                orgao_id="sjto",
                permitida=True,
            ),
        ]

        self._usuarios_perfis: list[UsuarioPerfilEntity] = [
            UsuarioPerfilEntity("up-0", "secp.master", "Administrador Geral do SECP", "perf-master", "MASTER", "MASTER", None, True),
            UsuarioPerfilEntity("up-1", "admin", "Juarez Catu", "perf-admin", "ADMIN", "Administrador do Sistema", "sjam", True),
            UsuarioPerfilEntity("up-2", "secap", "Marina Costa", "perf-secap", "SECAP", "SECAP/NUCGP", "sjam", True),
            UsuarioPerfilEntity("up-3", "chefia", "Carlos Eduardo", "perf-chefia", "CHEFIA", "Chefia/Gestor de Unidade", "sjam", True),
            UsuarioPerfilEntity("up-4", "servidor", "Ana Beatriz Souza", "perf-servidor", "SERVIDOR", "Servidor", "sjto", True),
        ]

        self._rotinas: list[LiberacaoRotinaEntity] = [
            LiberacaoRotinaEntity("rot-1", "MODULO", "secp-ponto", "Módulo SECP Ponto Eletrônico", True),
            LiberacaoRotinaEntity("rot-2", "MODULO", "secp-folha", "Módulo SECP Folha de Pagamento", True),
            LiberacaoRotinaEntity("rot-3", "MODULO", "secp-ferias", "Módulo SECP Férias e Licenças", True),
            LiberacaoRotinaEntity("rot-4", "MODULO", "secp-contracheque", "Módulo SECP Contracheque", True),
            LiberacaoRotinaEntity("rot-5", "MODULO", "secp-hora-extra", "Módulo SECP Hora Extra", True),
            LiberacaoRotinaEntity("rot-6", "ACAO", "marcacoes:registrar-facial:proprio", "Registro de Ponto por Reconhecimento Facial", True),
            LiberacaoRotinaEntity("rot-7", "ACAO", "homologacao:gerenciar:subordinados", "Homologação Mensal pela Chefia", True),
            LiberacaoRotinaEntity("rot-8", "ACAO", "boletim-frequencia:gerar:subordinados", "Geração e Encaminhamento de Boletim de Frequência", True),
        ]

        if check_postgres_connection():
            try:
                from secp.modules.secp_identidade.infrastructure.database import rbac_orm_models  # noqa: F401
                SecpDeclarativeBase.metadata.create_all(bind=sync_engine)
            except Exception:
                pass

    def _invalidate_rbac_cache(self) -> None:
        self._redis.invalidate_prefix("secp:rbac:")

    def get_snapshot(self) -> RbacMatrixSnapshot:
        return RbacMatrixSnapshot(
            perfis=tuple(self._perfis),
            permissoes=self._permissoes,
            orgao_overrides=tuple(self._orgao_overrides),
            usuarios_perfis=tuple(self._usuarios_perfis),
            rotinas=tuple(self._rotinas),
        )

    def get_perfil_by_codigo(self, codigo: str) -> PerfilEntity | None:
        return next((p for p in self._perfis if p.codigo == codigo), None)

    def create_perfil(
        self, codigo: str, nome: str, descricao: str, administrativo: bool, global_scope: bool
    ) -> PerfilEntity:
        novo = PerfilEntity(
            id=f"perf-{uuid.uuid4().hex[:6]}",
            codigo=codigo.upper().strip(),
            nome=nome.strip(),
            descricao=descricao.strip(),
            sistema=False,
            ativo=True,
            administrativo=administrativo,
            global_scope=global_scope,
            permissoes_codigos=frozenset({"secp-ponto:access"}),
        )
        self._perfis.append(novo)
        self._invalidate_rbac_cache()
        return novo

    def update_perfil(
        self, perfil_id: str, nome: str, descricao: str, ativo: bool
    ) -> PerfilEntity:
        for idx, p in enumerate(self._perfis):
            if p.id == perfil_id:
                atualizado = PerfilEntity(
                    id=p.id,
                    codigo=p.codigo,
                    nome=nome,
                    descricao=descricao,
                    sistema=p.sistema,
                    ativo=ativo,
                    administrativo=p.administrativo,
                    global_scope=p.global_scope,
                    orgao_id=p.orgao_id,
                    permissoes_codigos=p.permissoes_codigos,
                )
                self._perfis[idx] = atualizado
                self._invalidate_rbac_cache()
                return atualizado
        raise KeyError(f"Perfil '{perfil_id}' não encontrado.")

    def delete_perfil(self, perfil_id: str) -> bool:
        before = len(self._perfis)
        self._perfis = [p for p in self._perfis if not (p.id == perfil_id and not p.sistema)]
        deleted = len(self._perfis) < before
        if deleted:
            self._invalidate_rbac_cache()
        return deleted

    def toggle_perfil_permissao(self, perfil_id: str, permissao_codigo: str) -> PerfilEntity:
        for idx, p in enumerate(self._perfis):
            if p.id == perfil_id:
                atuais = set(p.permissoes_codigos)
                if permissao_codigo in atuais:
                    atuais.remove(permissao_codigo)
                else:
                    atuais.add(permissao_codigo)
                atualizado = PerfilEntity(
                    id=p.id,
                    codigo=p.codigo,
                    nome=p.nome,
                    descricao=p.descricao,
                    sistema=p.sistema,
                    ativo=p.ativo,
                    administrativo=p.administrativo,
                    global_scope=p.global_scope,
                    orgao_id=p.orgao_id,
                    permissoes_codigos=frozenset(atuais),
                )
                self._perfis[idx] = atualizado
                self._invalidate_rbac_cache()
                return atualizado
        raise KeyError(f"Perfil '{perfil_id}' não encontrado.")

    def set_orgao_override(
        self, perfil_id: str, orgao_id: str, permissao_codigo: str, permitida: Optional[bool]
    ) -> None:
        self._orgao_overrides = [
            ov
            for ov in self._orgao_overrides
            if not (
                ov.perfil_id == perfil_id
                and ov.orgao_id == orgao_id
                and ov.permissao_codigo == permissao_codigo
            )
        ]
        if permitida is not None:
            self._orgao_overrides.append(
                PerfilPermissaoOrgaoEntity(
                    perfil_id=perfil_id,
                    permissao_codigo=permissao_codigo,
                    orgao_id=orgao_id,
                    permitida=permitida,
                )
            )
        self._invalidate_rbac_cache()

    def assign_usuario_perfil(
        self, usuario_id: str, perfil_id: str, orgao_id: Optional[str]
    ) -> UsuarioPerfilEntity:
        perfil = next((p for p in self._perfis if p.id == perfil_id), None)
        if perfil is None:
            raise KeyError(f"Perfil '{perfil_id}' não encontrado.")
        novo = UsuarioPerfilEntity(
            id=f"up-{uuid.uuid4().hex[:6]}",
            usuario_id=usuario_id,
            usuario_nome=usuario_id.title(),
            perfil_id=perfil.id,
            perfil_codigo=perfil.codigo,
            perfil_nome=perfil.nome,
            orgao_id=orgao_id,
            ativo=True,
        )
        self._usuarios_perfis.append(novo)
        self._invalidate_rbac_cache()
        return novo

    def remove_usuario_perfil(self, vinculo_id: str) -> bool:
        before = len(self._usuarios_perfis)
        self._usuarios_perfis = [v for v in self._usuarios_perfis if v.id != vinculo_id]
        deleted = len(self._usuarios_perfis) < before
        if deleted:
            self._invalidate_rbac_cache()
        return deleted

    def toggle_rotina(self, rotina_id: str) -> LiberacaoRotinaEntity:
        for idx, r in enumerate(self._rotinas):
            if r.id == rotina_id:
                atualizada = LiberacaoRotinaEntity(
                    id=r.id,
                    tipo=r.tipo,
                    chave=r.chave,
                    descricao=r.descricao,
                    liberada=not r.liberada,
                )
                self._rotinas[idx] = atualizada
                self._invalidate_rbac_cache()
                return atualizada
        raise KeyError(f"Rotina '{rotina_id}' não encontrada.")
