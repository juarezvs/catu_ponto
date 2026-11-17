from typing import Sequence
from catuponto.adapters.outbound.persistence.cadastro_repository import (
    InMemoryCadastroRepository,
)
from catuponto.domain.entities.cadastro_item import (
    CadastroColumn,
    CadastroMetric,
    CadastroModuleData,
)
from secp.modules.secp_identidade.application.ports.output_ports import (
    IdentityRepositoryOutputPort,
    ModuleNavigationOutputPort,
    SragCopilotOutputPort,
)
from secp.modules.secp_identidade.domain.entities.identity_models import (
    MenuPrimaryItemEntity,
    MenuSectionEntity,
    MenuSubItemEntity,
    OrgaoScope,
    SecpModuleDescriptor,
    SragAnswerEntity,
    SragCitationEntity,
    UserIdentity,
)


class InMemorySecpIdentityRepository(IdentityRepositoryOutputPort):
    """Outbound Adapter implementando IdentityRepositoryOutputPort."""

    def __init__(self) -> None:
        self._orgaos: dict[str, OrgaoScope] = {
            "sjam": OrgaoScope(
                id="sjam",
                sigla="SJAM",
                nome="Seção Judiciária do Amazonas",
                unidade_ativa="Manaus • Sede (America/Manaus)",
                teto_hora_extra_mensal="R$ 180.000,00",
            ),
            "sjdf": OrgaoScope(
                id="sjdf",
                sigla="SJDF",
                nome="Seção Judiciária do Distrito Federal",
                unidade_ativa="Brasília • Sede (America/Sao_Paulo)",
                teto_hora_extra_mensal="R$ 240.000,00",
            ),
            "sjto": OrgaoScope(
                id="sjto",
                sigla="SJTO",
                nome="Seção Judiciária de Tocantins",
                unidade_ativa="Palmas • Sede (America/Sao_Paulo)",
                teto_hora_extra_mensal="R$ 95.000,00",
            ),
            "sjac": OrgaoScope(
                id="sjac",
                sigla="SJAC",
                nome="Seção Judiciária do Acre",
                unidade_ativa="Rio Branco • Sede (America/Rio_Branco)",
                teto_hora_extra_mensal="R$ 75.000,00",
            ),
            "sjma": OrgaoScope(
                id="sjma",
                sigla="SJMA",
                nome="Seção Judiciária do Maranhão",
                unidade_ativa="São Luís • Sede (America/Sao_Paulo)",
                teto_hora_extra_mensal="R$ 130.000,00",
            ),
            "jfam": OrgaoScope(
                id="jfam",
                sigla="JFAM",
                nome="Justiça Federal de Primeiro Grau no Amazonas",
                unidade_ativa="Manaus • 1º Grau (America/Manaus)",
                teto_hora_extra_mensal="R$ 110.000,00",
            ),
        }

        self._modules: tuple[SecpModuleDescriptor, ...] = (
            SecpModuleDescriptor(
                slug="secp-identidade",
                name="SECP Identidade",
                short_name="Identidade & RBAC",
                description="Gestão centralizada de usuários, perfis, papéis e permissões granulares via RBAC por módulo, órgão e unidade.",
                theme_color_hex="#4F46E5",
                tailwind_accent="indigo",
                icon="shield",
                badge_text="IAM • SSO • RBAC",
                stats_label="4 papéis • 18 órgãos • 1.248 identidades",
                required_permission="secp-identidade:access",
            ),
            SecpModuleDescriptor(
                slug="secp-ponto",
                name="SECP Ponto",
                short_name="Ponto Eletrônico",
                description="Sistema de ponto eletrônico, espelho de ponto, registro de batidas, abonos, justificativas, escalas e banco de horas.",
                theme_color_hex="#0891B2",
                tailwind_accent="cyan",
                icon="clock",
                badge_text="Portaria MTP 671",
                stats_label="94,2% presença hoje • 38 REPs online",
                required_permission="secp-ponto:access",
            ),
            SecpModuleDescriptor(
                slug="secp-folha",
                name="SECP Folha",
                short_name="Folha de Pagamento",
                description="Sistema de apoio à folha de pagamento, eventos financeiros, rubricas, conferência de cálculos e fechamento mensal.",
                theme_color_hex="#059669",
                tailwind_accent="emerald",
                icon="banknotes",
                badge_text="Competência 11/2026",
                stats_label="142 rubricas • Prévia 99,4% conciliada",
                required_permission="secp-folha:access",
            ),
            SecpModuleDescriptor(
                slug="secp-ferias",
                name="SECP Férias",
                short_name="Férias & Licenças",
                description="Gestão de períodos aquisitivos, programação, solicitação, aprovação e escala de férias, folgas e licenças.",
                theme_color_hex="#D97706",
                tailwind_accent="amber",
                icon="sun",
                badge_text="Escala Anual 2026/2027",
                stats_label="42 em gozo • 19 solicitações na fila",
                required_permission="secp-ferias:access",
            ),
            SecpModuleDescriptor(
                slug="secp-contracheque",
                name="SECP Contracheque",
                short_name="Portal Contracheque",
                description="Portal do servidor para consulta, visualização detalhada e emissão em PDF de contracheques e informes de rendimentos anuais.",
                theme_color_hex="#2563EB",
                tailwind_accent="blue",
                icon="document",
                badge_text="Assinatura ICP-Brasil",
                stats_label="Contracheque 11/2026 disponível",
                required_permission="secp-contracheque:access",
            ),
            SecpModuleDescriptor(
                slug="secp-hora-extra",
                name="SECP Hora Extra",
                short_name="Gestão de Hora Extra",
                description="Controle completo de horas extras, solicitação pelo servidor, aprovação hierárquica multinível, validação de teto orçamentário e integração folha/ponto.",
                theme_color_hex="#DC2626",
                tailwind_accent="red",
                icon="bolt",
                badge_text="Controle de Teto Orçamentário",
                stats_label="68,4% do teto utilizado • 9 pendentes",
                required_permission="secp-hora-extra:access",
            ),
        )

        self._users: dict[str, UserIdentity] = {
            "secp.master": UserIdentity(
                id="secp.master",
                matricula="SECP.MASTER",
                name="Administrador Geral do SECP",
                email="secp.master@trf1.jus.br",
                role_code="MASTER",
                role_name="MASTER (Administrador Raiz)",
                default_orgao_id="sjam",
                avatar_initials="SM",
                allowed_modules=frozenset({"*"}),
                permissions=frozenset({"*"}),
            ),
            "admin": UserIdentity(
                id="admin",
                matricula="MAT-0001",
                name="Juarez Catu",
                email="juarez@trf1.jus.br",
                role_code="ADMIN",
                role_name="Administrador do Sistema (Seccional)",
                default_orgao_id="sjam",
                avatar_initials="JC",
                allowed_modules=frozenset({"*"}),
                permissions=frozenset({"*"}),
            ),
            "chefia": UserIdentity(
                id="chefia",
                matricula="MAT-3088",
                name="Carlos Eduardo",
                email="carlos.chefia@trf1.jus.br",
                role_code="CHEFIA",
                role_name="Chefia/Gestor de Unidade",
                default_orgao_id="sjam",
                avatar_initials="CE",
                allowed_modules=frozenset(
                    {
                        "secp-ponto",
                        "secp-ferias",
                        "secp-contracheque",
                        "secp-hora-extra",
                    }
                ),
                permissions=frozenset(
                    {
                        "cadastros:pessoas:read",
                        "cadastros:departamentos:read",
                        "cadastros:unidades:read",
                        "cadastros:feriados:read",
                        "movimentacoes:read",
                        "relatorios:read",
                    }
                ),
            ),
            "secap": UserIdentity(
                id="secap",
                matricula="MAT-1042",
                name="Marina Costa",
                email="marina.secap@trf1.jus.br",
                role_code="SECAP",
                role_name="SECAP / NUCGP",
                default_orgao_id="sjam",
                avatar_initials="MC",
                allowed_modules=frozenset(
                    {
                        "secp-ponto",
                        "secp-folha",
                        "secp-ferias",
                        "secp-contracheque",
                        "secp-hora-extra",
                    }
                ),
                permissions=frozenset(
                    {
                        "cadastros:pessoas:read",
                        "cadastros:departamentos:read",
                        "cadastros:cargos:read",
                        "cadastros:funcoes:read",
                        "cadastros:feriados:read",
                        "cadastros:horarios:read",
                        "movimentacoes:read",
                        "relatorios:read",
                        "configuracoes:perfil:read",
                    }
                ),
            ),
            "servidor": UserIdentity(
                id="servidor",
                matricula="MAT-40912",
                name="Ana Beatriz Souza",
                email="ana.souza@trf1.jus.br",
                role_code="SERVIDOR",
                role_name="Servidor Público",
                default_orgao_id="sjto",
                avatar_initials="AB",
                allowed_modules=frozenset(
                    {
                        "secp-ponto",
                        "secp-ferias",
                        "secp-contracheque",
                    }
                ),
                permissions=frozenset(
                    {
                        "cadastros:feriados:read",
                        "movimentacoes:read",
                    }
                ),
            ),
        }

    def get_user_by_id(self, user_id: str) -> UserIdentity | None:
        return self._users.get(user_id)

    def list_users(self) -> Sequence[UserIdentity]:
        return tuple(self._users.values())

    def list_orgaos(self) -> Sequence[OrgaoScope]:
        return tuple(self._orgaos.values())

    def get_orgao_by_id(self, orgao_id: str) -> OrgaoScope | None:
        return self._orgaos.get(orgao_id)

    def list_modules(self) -> Sequence[SecpModuleDescriptor]:
        return self._modules

    def get_module_by_slug(self, module_slug: str) -> SecpModuleDescriptor | None:
        return next((m for m in self._modules if m.slug == module_slug), None)


class InMemorySecpNavigationRepository(ModuleNavigationOutputPort):
    """Outbound Adapter que fornece a Sidebar Primária e Sidebar Secundária de cada módulo do SECP."""

    def __init__(self) -> None:
        self._base_cadastro_repo = InMemoryCadastroRepository()

    def get_module_menu_tree(self, module_slug: str) -> Sequence[MenuPrimaryItemEntity]:
        cadastros_sections = (
            MenuSectionEntity(
                id="estrutura-organizacional",
                title="ESTRUTURA ORGANIZACIONAL",
                items=(
                    MenuSubItemEntity(
                        id="pessoas",
                        label="Pessoas",
                        description="Servidores, colaboradores, matrículas e vínculos funcionais.",
                        required_permission="cadastros:pessoas:read",
                        badge="1.248",
                    ),
                    MenuSubItemEntity(
                        id="departamentos",
                        label="Departamentos",
                        description="Setores, coordenações e centros de custo internos.",
                        required_permission="cadastros:departamentos:read",
                        badge="64",
                    ),
                    MenuSubItemEntity(
                        id="orgaos",
                        label="Órgãos",
                        description="Secretarias, autarquias, fundações e entidades.",
                        required_permission="cadastros:orgaos:read",
                        badge="18",
                    ),
                    MenuSubItemEntity(
                        id="unidades",
                        label="Unidades",
                        description="Locais físicos de trabalho, prédios, escolas e postos.",
                        required_permission="cadastros:unidades:read",
                        badge="92",
                    ),
                ),
            ),
            MenuSectionEntity(
                id="carreira-lotacao",
                title="CARREIRA & LOTAÇÃO",
                items=(
                    MenuSubItemEntity(
                        id="cargos",
                        label="Cargos",
                        description="Quadro de cargos efetivos, comissionados e temporários.",
                        required_permission="cadastros:cargos:read",
                    ),
                    MenuSubItemEntity(
                        id="funcoes",
                        label="Funções",
                        description="Funções gratificadas, chefias e atribuições especiais.",
                        required_permission="cadastros:funcoes:read",
                    ),
                ),
            ),
            MenuSectionEntity(
                id="jornada-calendario",
                title="JORNADA & CALENDÁRIO",
                items=(
                    MenuSubItemEntity(
                        id="feriados",
                        label="Feriados",
                        description="Calendário nacional, estadual, municipal e pontos facultativos.",
                        required_permission="cadastros:feriados:read",
                    ),
                    MenuSubItemEntity(
                        id="horarios",
                        label="Horários e Escalas",
                        description="Turnos comerciais, plantões 12x36, 24x72 e jornadas flexíveis.",
                        required_permission="cadastros:horarios:read",
                    ),
                    MenuSubItemEntity(
                        id="justificativas",
                        label="Tipos de Justificativa",
                        description="Motivos de abono, afastamentos legais e ocorrências.",
                        required_permission="cadastros:justificativas:read",
                    ),
                ),
            ),
        )

        movimentacoes_items_by_module = {
            "secp-identidade": (
                MenuSubItemEntity(
                    id="usuarios-rbac",
                    label="Usuários & Vínculos RBAC",
                    description="Atribuição de papéis por módulo, órgão e unidade.",
                    required_permission="movimentacoes:read",
                    badge="Ativo",
                ),
                MenuSubItemEntity(
                    id="papeis-permissoes",
                    label="Matriz de Papéis e Permissões",
                    description="Configuração granular de escopos <modulo>:<recurso>:<acao>.",
                    required_permission="movimentacoes:read",
                ),
                MenuSubItemEntity(
                    id="tokens-sso",
                    label="Sessões Ativas & Auditoria SSO",
                    description="Monitoramento de logins únicos e tokens emitidos.",
                    required_permission="movimentacoes:read",
                ),
            ),
            "secp-ponto": (
                MenuSubItemEntity(
                    id="espelho",
                    label="Espelho de Ponto",
                    description="Conferência de batidas, saldo diário e assinatura digital.",
                    required_permission="movimentacoes:read",
                ),
                MenuSubItemEntity(
                    id="ocorrencias",
                    label="Tratamento de Ocorrências",
                    description="Abonos, esquecimentos de batida e justificativas.",
                    required_permission="movimentacoes:read",
                    badge="14",
                ),
                MenuSubItemEntity(
                    id="banco-horas",
                    label="Banco de Horas",
                    description="Compensação de créditos e débitos de jornada (limite 16h/mês).",
                    required_permission="movimentacoes:read",
                ),
                MenuSubItemEntity(
                    id="homologacao",
                    label="Homologação Mensal (Chefia)",
                    description="Fila de análise e homologação até o dia 10 / 2º dia útil.",
                    required_permission="movimentacoes:read",
                    badge="2",
                ),
                MenuSubItemEntity(
                    id="solicitacoes-ponto",
                    label="Solicitações de Frequência",
                    description="Ajustes, abonos, compensações e autorizações (RASCUNHO a DEFERIDA).",
                    required_permission="movimentacoes:read",
                    badge="3",
                ),
                MenuSubItemEntity(
                    id="boletim-frequencia",
                    label="Boletim de Frequência",
                    description="Consolidação e encaminhamento à SECAP/NUCGP.",
                    required_permission="movimentacoes:read",
                ),
                MenuSubItemEntity(
                    id="recesso-forense",
                    label="Recesso Forense (20/12–06/01)",
                    description="Domínio próprio de convocação, pecúnia ou folga.",
                    required_permission="movimentacoes:read",
                ),
            ),
            "secp-folha": (
                MenuSubItemEntity(
                    id="eventos-folha",
                    label="Eventos & Rubricas Mensais",
                    description="Importação de variáveis de ponto, horas extras e descontos.",
                    required_permission="movimentacoes:read",
                    badge="142",
                ),
                MenuSubItemEntity(
                    id="previa-calculo",
                    label="Conferência de Cálculos",
                    description="Auditoria automática de teto constitucional e consignados.",
                    required_permission="movimentacoes:read",
                ),
                MenuSubItemEntity(
                    id="fechamento-competencia",
                    label="Fechamento da Competência",
                    description="Bloqueio de folha e geração de remessa bancária.",
                    required_permission="movimentacoes:read",
                ),
            ),
            "secp-ferias": (
                MenuSubItemEntity(
                    id="periodos-aquisitivos",
                    label="Períodos Aquisitivos",
                    description="Controle de vencimento de períodos e saldo de dias.",
                    required_permission="movimentacoes:read",
                ),
                MenuSubItemEntity(
                    id="programacao-ferias",
                    label="Solicitação e Aprovação",
                    description="Fluxo de aprovação pela chefia e RH com substituição.",
                    required_permission="movimentacoes:read",
                    badge="19",
                ),
            ),
            "secp-contracheque": (
                MenuSubItemEntity(
                    id="holerites-mensais",
                    label="Meus Contracheques (PDF)",
                    description="Consulta detalhada de proventos, descontos e líquido.",
                    required_permission="movimentacoes:read",
                ),
                MenuSubItemEntity(
                    id="informe-rendimentos",
                    label="Informe de Rendimentos IRPF",
                    description="Comprovante anual de rendimentos pagos e IRRF.",
                    required_permission="movimentacoes:read",
                ),
            ),
            "secp-hora-extra": (
                MenuSubItemEntity(
                    id="solicitacao-he",
                    label="Solicitações de Hora Extra",
                    description="Pedidos fundamentados com validação prévia de escala.",
                    required_permission="movimentacoes:read",
                    badge="9",
                ),
                MenuSubItemEntity(
                    id="aprovacao-multinivel",
                    label="Aprovação Hierárquica (Nível 1 e 2)",
                    description="Despacho de chefia imediata e ordenador de despesa.",
                    required_permission="movimentacoes:read",
                ),
                MenuSubItemEntity(
                    id="teto-orcamentario",
                    label="Controle de Teto Orçamentário",
                    description="Consumo de cota financeira mensal por Órgão e Unidade.",
                    required_permission="movimentacoes:read",
                ),
            ),
        }

        module_movimentacoes = movimentacoes_items_by_module.get(
            module_slug, movimentacoes_items_by_module["secp-ponto"]
        )

        return (
            MenuPrimaryItemEntity(
                id="dashboard",
                label="Dashboard",
                icon="home",
                required_permission=None,
                sections=(),
            ),
            MenuPrimaryItemEntity(
                id="cadastros",
                label="Cadastros",
                icon="folder",
                sections=cadastros_sections,
            ),
            MenuPrimaryItemEntity(
                id="movimentacoes",
                label="Movimentações",
                icon="workflows",
                sections=(
                    MenuSectionEntity(
                        id="operacoes-modulo",
                        title="PROCESSOS DO MÓDULO",
                        items=module_movimentacoes,
                    ),
                ),
            ),
            MenuPrimaryItemEntity(
                id="relatorios",
                label="Relatórios",
                icon="analytics",
                sections=(
                    MenuSectionEntity(
                        id="relatorios-oficiais",
                        title="AUDITORIA & CONFORMIDADE",
                        items=(
                            MenuSubItemEntity(
                                id="espelho-fiscal",
                                label="Relatório Oficial Assinado",
                                description="Exportação com hash SHA-256 e trilha de auditoria.",
                                required_permission="relatorios:read",
                            ),
                            MenuSubItemEntity(
                                id="absenteismo",
                                label="Indicadores Gerenciais por Órgão",
                                description="Painel comparativo entre secretarias e unidades.",
                                required_permission="relatorios:read",
                            ),
                        ),
                    ),
                ),
            ),
            MenuPrimaryItemEntity(
                id="configuracoes",
                label="Configurações",
                icon="settings",
                sections=(
                    MenuSectionEntity(
                        id="parametros-modulo",
                        title="GOVERNANÇA & PARÂMETROS",
                        items=(
                            MenuSubItemEntity(
                                id="perfil",
                                label="Preferências e Assinatura",
                                description="Configurações de conta, notificações e token.",
                                required_permission="configuracoes:perfil:read",
                            ),
                            MenuSubItemEntity(
                                id="permissoes",
                                label="Regras RBAC do Módulo",
                                description="Inspeção de políticas de acesso ativas neste módulo.",
                                required_permission="configuracoes:permissoes:read",
                            ),
                        ),
                    ),
                ),
            ),
        )

    def get_subitem_content(self, module_slug: str, subitem_slug: str) -> CadastroModuleData:
        if subitem_slug == "dashboard":
            return self._build_module_dashboard(module_slug)

        if subitem_slug in ("usuarios-rbac", "papeis-permissoes", "tokens-sso"):
            return self._build_identity_subitem(subitem_slug)

        if subitem_slug in ("solicitacao-he", "aprovacao-multinivel", "teto-orcamentario"):
            return self._build_overtime_subitem(subitem_slug)

        base_data = self._base_cadastro_repo.get_module_by_slug(subitem_slug)
        if base_data is not None:
            return base_data

        return self._build_module_dashboard(module_slug)

    def _build_module_dashboard(self, module_slug: str) -> CadastroModuleData:
        dashboards: dict[str, CadastroModuleData] = {
            "secp-identidade": CadastroModuleData(
                slug="dashboard",
                title="Tela Principal • SECP Identidade (IAM & RBAC)",
                subtitle="Governança centralizada de identidades, SSO, papéis e permissões granulares por módulo, órgão e unidade.",
                category="SECP Identidade > Dashboard",
                primary_action_label="+ Novo Vínculo RBAC",
                required_permission="",
                metrics=(
                    CadastroMetric("Identidades Ativas (SSO)", "1.248", "100% com MFA ativo"),
                    CadastroMetric("Papéis RBAC Configurados", "4", "Escopo Módulo + Órgão + Unidade"),
                    CadastroMetric("Órgãos Integrados", "18", "Isolamento Multi-Tenant ativo"),
                    CadastroMetric("Bloqueios de Auditoria", "0", "Zero violações BOLA/IDOR"),
                ),
                columns=(
                    CadastroColumn("papel", "Papel RBAC", "code"),
                    CadastroColumn("escopo", "Escopo de Módulos Liberados", "text"),
                    CadastroColumn("cadastros", "Subitens Liberados em Cadastros", "badge"),
                    CadastroColumn("status", "Política", "status"),
                ),
                records=(
                    {
                        "papel": "ADMIN_GERAL",
                        "escopo": "Todos os 6 módulos (Identidade, Ponto, Folha, Férias, Contracheque, Hora Extra)",
                        "cadastros": "Acesso Total (9 subitens)",
                        "status": "Ativo",
                    },
                    {
                        "papel": "GESTOR_RH",
                        "escopo": "5 módulos (Ponto, Folha, Férias, Contracheque, Hora Extra)",
                        "cadastros": "Pessoas, Deptos, Cargos, Funções, Feriados, Horários",
                        "status": "Ativo",
                    },
                    {
                        "papel": "COORDENADOR_UNIDADE",
                        "escopo": "4 módulos (Ponto, Férias, Contracheque, Hora Extra)",
                        "cadastros": "Pessoas, Departamentos, Unidades, Feriados",
                        "status": "Ativo",
                    },
                    {
                        "papel": "SERVIDOR",
                        "escopo": "3 módulos (Ponto, Férias, Contracheque)",
                        "cadastros": "Somente consulta de Feriados",
                        "status": "Ativo",
                    },
                ),
            ),
            "secp-ponto": self._base_cadastro_repo.get_module_by_slug("visao-geral"),  # type: ignore[dict-item]
            "secp-folha": CadastroModuleData(
                slug="dashboard",
                title="Tela Principal • SECP Folha de Pagamento",
                subtitle="Processamento de eventos financeiros, rubricas, conciliação com o ponto eletrônico e fechamento mensal.",
                category="SECP Folha > Dashboard",
                primary_action_label="+ Processar Prévia da Folha",
                required_permission="",
                metrics=(
                    CadastroMetric("Folha Bruta (11/2026)", "R$ 8,42 Mi", "1.248 vínculos processados"),
                    CadastroMetric("Rubricas Automatizadas", "142", "Integradas ao SECP Ponto"),
                    CadastroMetric("Consistência de Cálculo", "99,4%", "Apenas 3 alertas pendentes"),
                ),
                columns=(
                    CadastroColumn("rubrica", "Rubrica", "code"),
                    CadastroColumn("descricao", "Descrição do Evento", "text"),
                    CadastroColumn("natureza", "Tipo", "badge"),
                    CadastroColumn("status", "Situação", "status"),
                ),
                records=(
                    {
                        "rubrica": "RUB-101",
                        "descricao": "Vencimento Base Estatutário",
                        "natureza": "Provento Fixo",
                        "status": "Conciliado",
                    },
                    {
                        "rubrica": "RUB-214",
                        "descricao": "Adicional de Hora Extra 50% (Integrado SECP Hora Extra)",
                        "natureza": "Provento Variável",
                        "status": "Conciliado",
                    },
                    {
                        "rubrica": "RUB-508",
                        "descricao": "Desconto de Falta Injustificada (Integrado SECP Ponto)",
                        "natureza": "Desconto",
                        "status": "Pendente Revisão",
                    },
                ),
            ),
            "secp-ferias": CadastroModuleData(
                slug="dashboard",
                title="Tela Principal • SECP Férias e Licenças",
                subtitle="Controle de períodos aquisitivos, escala anual de férias, abonos e licenças regulamentares.",
                category="SECP Férias > Dashboard",
                primary_action_label="+ Nova Programação de Férias",
                required_permission="",
                metrics=(
                    CadastroMetric("Em Gozo de Férias", "42", "3,3% do efetivo total"),
                    CadastroMetric("Solicitações na Fila", "19", "Aguardando aprovação"),
                    CadastroMetric("Períodos Críticos", "4", "Próximos do limite concessivo"),
                ),
                columns=(
                    CadastroColumn("matricula", "Matrícula", "code"),
                    CadastroColumn("servidor", "Servidor", "text"),
                    CadastroColumn("periodo", "Período de Gozo", "badge"),
                    CadastroColumn("status", "Status", "status"),
                ),
                records=(
                    {
                        "matricula": "MAT-19402",
                        "servidor": "Lucas Gabriel Ferreira • Coordenação de TI",
                        "periodo": "10/11/2026 a 29/11/2026 (20 dias)",
                        "status": "Em Gozo",
                    },
                    {
                        "matricula": "MAT-40912",
                        "servidor": "Ana Beatriz Souza • Gestão de Pessoas",
                        "periodo": "05/01/2027 a 03/02/2027 (30 dias)",
                        "status": "Programado",
                    },
                ),
            ),
            "secp-contracheque": CadastroModuleData(
                slug="dashboard",
                title="Tela Principal • SECP Contracheque",
                subtitle="Portal do servidor para consulta de demonstrativos mensais de pagamento e informes de rendimentos.",
                category="SECP Contracheque > Dashboard",
                primary_action_label="Emitir PDF Assinado (11/2026)",
                required_permission="",
                metrics=(
                    CadastroMetric("Última Competência", "11/2026", "Liberado para consulta"),
                    CadastroMetric("Informe IRPF", "Ano-Base 2025", "Disponível em PDF"),
                    CadastroMetric("Autenticidade", "ICP-Brasil", "QR Code + Hash SHA-256"),
                ),
                columns=(
                    CadastroColumn("competencia", "Competência", "code"),
                    CadastroColumn("bruto", "Total Bruto", "text"),
                    CadastroColumn("descontos", "Descontos", "badge"),
                    CadastroColumn("liquido", "Valor Líquido", "text"),
                    CadastroColumn("status", "Situação", "status"),
                ),
                records=(
                    {
                        "competencia": "11/2026",
                        "bruto": "R$ 9.850,00",
                        "descontos": "R$ 2.140,20",
                        "liquido": "R$ 7.709,80",
                        "status": "Disponível",
                    },
                    {
                        "competencia": "10/2026",
                        "bruto": "R$ 9.850,00",
                        "descontos": "R$ 2.140,20",
                        "liquido": "R$ 7.709,80",
                        "status": "Creditado",
                    },
                ),
            ),
            "secp-hora-extra": CadastroModuleData(
                slug="dashboard",
                title="Tela Principal • SECP Hora Extra",
                subtitle="Fluxo de solicitação, aprovação hierárquica em múltiplos níveis, controle de teto orçamentário por órgão e integração automática.",
                category="SECP Hora Extra > Dashboard",
                primary_action_label="+ Solicitar Hora Extra",
                required_permission="",
                metrics=(
                    CadastroMetric("Consumo do Teto Mensal", "68,4%", "R$ 58.140 de R$ 85.000"),
                    CadastroMetric("Aprovações Pendentes", "9", "Nível 1 (Chefia) e Nível 2 (Ordenador)"),
                    CadastroMetric("Limite Diário Legal", "2h / dia", "Trava automática ativa (Art. 74)"),
                ),
                columns=(
                    CadastroColumn("protocolo", "Protocolo", "code"),
                    CadastroColumn("servidor", "Servidor / Unidade", "text"),
                    CadastroColumn("horas", "Quantidade", "badge"),
                    CadastroColumn("impacto", "Impacto no Teto", "text"),
                    CadastroColumn("status", "Fluxo Hierárquico", "status"),
                ),
                records=(
                    {
                        "protocolo": "HE-2026-891",
                        "servidor": "Roberto Carlos Mendes • UPA Norte",
                        "horas": "12h (Plantão Extra)",
                        "impacto": "R$ 1.180,00 (Dentro do Teto)",
                        "status": "Homologado -> Enviado p/ Folha",
                    },
                    {
                        "protocolo": "HE-2026-894",
                        "servidor": "Fernanda Lima Rocha • Tributação",
                        "horas": "6h (Fechamento Fiscal)",
                        "impacto": "R$ 640,00 (Dentro do Teto)",
                        "status": "Pendente Nível 2 (Ordenador)",
                    },
                ),
            ),
        }
        return dashboards.get(module_slug, dashboards["secp-ponto"])

    def _build_identity_subitem(self, subitem_slug: str) -> CadastroModuleData:
        return CadastroModuleData(
            slug=subitem_slug,
            title="Gestão de Papéis e Vínculos RBAC",
            subtitle="Controle de acesso baseado em papéis com escopo por Módulo, Órgão e Unidade.",
            category="SECP Identidade > Movimentações",
            primary_action_label="+ Atribuir Papel RBAC",
            required_permission="movimentacoes:read",
            metrics=(
                CadastroMetric("Perfis Homologados", "4", "Menor privilégio ativo"),
                CadastroMetric("Cache RBAC (Redis)", "1,2 ms", "Latência média de validação"),
            ),
            columns=(
                CadastroColumn("usuario", "Usuário", "text"),
                CadastroColumn("papel", "Papel RBAC", "code"),
                CadastroColumn("orgao", "Escopo (Órgão / Unidade)", "badge"),
                CadastroColumn("status", "Status", "status"),
            ),
            records=(
                {
                    "usuario": "Juarez Catu (juarez@secp.gov.br)",
                    "papel": "ADMIN_GERAL",
                    "orgao": "Global • Todos os Órgãos",
                    "status": "Ativo",
                },
                {
                    "usuario": "Marina Costa (marina.rh@secp.gov.br)",
                    "papel": "GESTOR_RH",
                    "orgao": "SEMAD • Sede Central",
                    "status": "Ativo",
                },
                {
                    "usuario": "Carlos Eduardo (carlos.coord@secp.gov.br)",
                    "papel": "COORDENADOR_UNIDADE",
                    "orgao": "SEMSA • UPA Regional Norte",
                    "status": "Ativo",
                },
            ),
        )

    def _build_overtime_subitem(self, subitem_slug: str) -> CadastroModuleData:
        return CadastroModuleData(
            slug=subitem_slug,
            title="Governança de Hora Extra & Teto Orçamentário",
            subtitle="Acompanhamento de cotas financeiras por secretaria e despacho hierárquico em dois níveis.",
            category="SECP Hora Extra > Movimentações",
            primary_action_label="+ Nova Solicitação de Hora Extra",
            required_permission="movimentacoes:read",
            metrics=(
                CadastroMetric("Teto SEMAD", "R$ 85.000,00", "68,4% consumido"),
                CadastroMetric("Teto SEMSA", "R$ 210.000,00", "74,1% consumido"),
            ),
            columns=(
                CadastroColumn("orgao", "Órgão", "code"),
                CadastroColumn("teto", "Teto Mensal Autorizado", "text"),
                CadastroColumn("consumido", "Realizado na Competência", "badge"),
                CadastroColumn("status", "Situação Orçamentária", "status"),
            ),
            records=(
                {
                    "orgao": "SEMAD",
                    "teto": "R$ 85.000,00",
                    "consumido": "R$ 58.140,00 (68,4%)",
                    "status": "Regular",
                },
                {
                    "orgao": "SEMSA",
                    "teto": "R$ 210.000,00",
                    "consumido": "R$ 155.610,00 (74,1%)",
                    "status": "Regular",
                },
            ),
        )


class InMemorySragCopilotAdapter(SragCopilotOutputPort):
    """Outbound Adapter do SECP Copiloto Normativo (SRAG - Structured RAG) com citações obrigatórias."""

    def query_normative_knowledge(
        self, question: str, orgao_id: str, module_slug: str | None = None
    ) -> SragAnswerEntity:
        q_lower = question.lower()

        if any(k in q_lower for k in ("ignore previous", "system prompt", "cpf de todos")):
            return SragAnswerEntity(
                question=question,
                answer="Solicitação bloqueada pela camada de proteção Normativa e LGPD do SECP. O Copiloto Normativo responde exclusivamente consultas baseadas na legislação vigente do seu órgão [Política de Segurança SECP, Art. 4º].",
                citations=(
                    SragCitationEntity(
                        law_reference="[Política de Segurança da Informação e LGPD - SECP, Art. 4º]",
                        excerpt="É vedada a exfiltração de dados pessoais (PII) ou contorno de diretrizes de controle de acesso RBAC.",
                        orgao_scope=orgao_id.upper(),
                    ),
                ),
                confidence_score=0.99,
                guardrail_status="BLOCKED_PROMPT_INJECTION_OR_PII",
            )

        if "hora extra" in q_lower or "teto" in q_lower:
            return SragAnswerEntity(
                question=question,
                answer=(
                    f"No escopo do órgão {orgao_id.upper()}, a prestação de serviço extraordinário exige solicitação prévia, "
                    "aprovação em 1º nível pela chefia imediata e homologação em 2º nível pelo ordenador de despesa, "
                    "respeitado o limite máximo de 2 (duas) horas diárias [Art. 74, Estatuto do Servidor Municipal] e a "
                    "existência de saldo disponível no teto orçamentário mensal da unidade [Decreto Orçamentário nº 1.402/2025, Art. 12]."
                ),
                citations=(
                    SragCitationEntity(
                        law_reference="[Art. 74, Estatuto do Servidor Municipal - Lei nº 4.120/2022]",
                        excerpt="O serviço extraordinário será permitido para atender a situações excepcionais e temporárias, respeitado o limite máximo de 2 (duas) horas por jornada diária.",
                        orgao_scope=orgao_id.upper(),
                    ),
                    SragCitationEntity(
                        law_reference="[Decreto Orçamentário nº 1.402/2025, Art. 12, § 2º]",
                        excerpt="O sistema SECP Hora Extra bloqueará automaticamente aprovações cujo valor projetado ultrapasse o teto mensal fixado para o respectivo Órgão/Unidade.",
                        orgao_scope=orgao_id.upper(),
                    ),
                ),
                confidence_score=0.96,
                guardrail_status="VERIFIED_GROUNDED",
            )

        if "férias" in q_lower or "ferias" in q_lower:
            return SragAnswerEntity(
                question=question,
                answer=(
                    "O servidor adquirirá direito a 30 (trinta) dias de férias após cada período de 12 meses de efetivo exercício, "
                    "podendo ser parceladas em até 3 (três) etapas de no mínimo 10 dias cada, desde que requeridas com antecedência "
                    "mínima de 45 dias e aprovadas pela chefia da unidade [Art. 92, § 1º, Lei nº 4.120/2022]."
                ),
                citations=(
                    SragCitationEntity(
                        law_reference="[Art. 92, § 1º, Lei Municipal nº 4.120/2022]",
                        excerpt="As férias poderão ser parceladas em até 3 etapas, mediante interesse da Administração Pública.",
                        orgao_scope=orgao_id.upper(),
                    ),
                ),
                confidence_score=0.95,
                guardrail_status="VERIFIED_GROUNDED",
            )

        return SragAnswerEntity(
            question=question,
            answer=(
                "As marcações de ponto eletrônico no SECP são regidas pelo modelo REP-P, sendo admitida tolerância de até "
                "5 (cinco) minutos em cada batida, limitada a 10 (dez) minutos diários [Art. 58, § 1º, CLT]. "
                "Toda inclusão manual de batida esquecida exige justificativa formal do servidor e aceite da chefia no fluxo de ocorrências [Portaria MTP nº 671/2021, Art. 75]."
            ),
            citations=(
                SragCitationEntity(
                    law_reference="[Art. 58, § 1º, CLT]",
                    excerpt="Não serão descontadas nem computadas como jornada extraordinária as variações de horário no registro de ponto não excedentes de cinco minutos, observado o limite máximo de dez minutos diários.",
                    orgao_scope=orgao_id.upper(),
                ),
                SragCitationEntity(
                    law_reference="[Portaria MTP nº 671/2021, Art. 75]",
                    excerpt="O REP-P deve garantir integridade, assinatura eletrônica no espelho de ponto e rastreabilidade das marcações brutas (AFD).",
                    orgao_scope=orgao_id.upper(),
                ),
            ),
            confidence_score=0.94,
            guardrail_status="VERIFIED_GROUNDED",
        )
