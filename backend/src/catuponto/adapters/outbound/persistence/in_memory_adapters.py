from typing import Sequence
from catuponto.application.ports.outbound.repositories import (
    CadastroRepositoryPort,
    NavigationRepositoryPort,
    UserRepositoryPort,
)
from catuponto.domain.entities.cadastro_item import (
    CadastroColumn,
    CadastroMetric,
    CadastroModuleData,
)
from catuponto.domain.entities.navigation import (
    NavigationItem,
    NavigationSection,
    NavigationSubItem,
)
from catuponto.domain.entities.user import UserProfile


class InMemoryUserRepository(UserRepositoryPort):
    """Outbound Adapter implementando UserRepositoryPort."""

    def __init__(self) -> None:
        self._profiles: dict[str, UserProfile] = {
            "admin": UserProfile(
                id="admin",
                name="Juarez Catu",
                email="juarez@catuponto.gov.br",
                role_name="Administrador Geral",
                organization="Prefeitura & Autarquias • CatuPonto",
                avatar_initials="JC",
                permissions=frozenset({"*"}),
            ),
            "gestor-rh": UserProfile(
                id="gestor-rh",
                name="Marina Costa",
                email="marina.rh@catuponto.gov.br",
                role_name="Gestora de RH",
                organization="Secretaria de Administração",
                avatar_initials="MC",
                permissions=frozenset(
                    {
                        "visao-geral:read",
                        "cadastros:pessoas:read",
                        "cadastros:departamentos:read",
                        "cadastros:cargos:read",
                        "cadastros:funcoes:read",
                        "cadastros:feriados:read",
                        "cadastros:horarios:read",
                        "cadastros:justificativas:read",
                        "ponto:espelho:read",
                        "ponto:ocorrencias:read",
                        "ponto:banco-horas:read",
                        "solicitacoes:ajustes:read",
                        "solicitacoes:atestados:read",
                        "solicitacoes:ferias:read",
                        "relatorios:espelho-fiscal:read",
                        "relatorios:absenteismo:read",
                        "configuracoes:perfil:read",
                        "configuracoes:notificacoes:read",
                    }
                ),
            ),
            "coordenador": UserProfile(
                id="coordenador",
                name="Carlos Eduardo",
                email="carlos.coord@catuponto.gov.br",
                role_name="Coordenador de Unidade",
                organization="Unidade Regional Norte",
                avatar_initials="CE",
                permissions=frozenset(
                    {
                        "visao-geral:read",
                        "cadastros:pessoas:read",
                        "cadastros:departamentos:read",
                        "cadastros:unidades:read",
                        "cadastros:feriados:read",
                        "ponto:espelho:read",
                        "ponto:ocorrencias:read",
                        "solicitacoes:ajustes:read",
                        "configuracoes:perfil:read",
                    }
                ),
            ),
        }

    def get_by_id(self, user_id: str) -> UserProfile | None:
        return self._profiles.get(user_id)

    def list_profiles(self) -> Sequence[UserProfile]:
        return tuple(self._profiles.values())


class InMemoryNavigationRepository(NavigationRepositoryPort):
    """Outbound Adapter implementando NavigationRepositoryPort com a estrutura de menus e submenus do CatuPonto."""

    def get_navigation_tree(self) -> Sequence[NavigationItem]:
        return (
            NavigationItem(
                id="visao-geral",
                label="Visão Geral",
                icon="home",
                route="/modulo/visao-geral",
                required_permission="visao-geral:read",
            ),
            NavigationItem(
                id="cadastros",
                label="Cadastros",
                icon="folder",
                sections=(
                    NavigationSection(
                        id="estrutura-organizacional",
                        title="ESTRUTURA ORGANIZACIONAL",
                        items=(
                            NavigationSubItem(
                                id="pessoas",
                                label="Pessoas",
                                route="/modulo/pessoas",
                                description="Servidores, colaboradores, matrículas e vínculos funcionais.",
                                required_permission="cadastros:pessoas:read",
                                badge="1.248",
                            ),
                            NavigationSubItem(
                                id="departamentos",
                                label="Departamentos",
                                route="/modulo/departamentos",
                                description="Setores, coordenações e centros de custo internos.",
                                required_permission="cadastros:departamentos:read",
                                badge="64",
                            ),
                            NavigationSubItem(
                                id="orgaos",
                                label="Órgãos",
                                route="/modulo/orgaos",
                                description="Secretarias, autarquias, fundações e entidades.",
                                required_permission="cadastros:orgaos:read",
                                badge="18",
                            ),
                            NavigationSubItem(
                                id="unidades",
                                label="Unidades",
                                route="/modulo/unidades",
                                description="Locais físicos de trabalho, prédios, escolas e postos.",
                                required_permission="cadastros:unidades:read",
                                badge="92",
                            ),
                        ),
                    ),
                    NavigationSection(
                        id="carreira-lotacao",
                        title="CARREIRA & LOTAÇÃO",
                        items=(
                            NavigationSubItem(
                                id="cargos",
                                label="Cargos",
                                route="/modulo/cargos",
                                description="Quadro de cargos efetivos, comissionados e temporários.",
                                required_permission="cadastros:cargos:read",
                            ),
                            NavigationSubItem(
                                id="funcoes",
                                label="Funções",
                                route="/modulo/funcoes",
                                description="Funções gratificadas, chefias e atribuições especiais.",
                                required_permission="cadastros:funcoes:read",
                            ),
                        ),
                    ),
                    NavigationSection(
                        id="jornada-calendario",
                        title="JORNADA & CALENDÁRIO",
                        items=(
                            NavigationSubItem(
                                id="feriados",
                                label="Feriados",
                                route="/modulo/feriados",
                                description="Calendário nacional, estadual, municipal e pontos facultativos.",
                                required_permission="cadastros:feriados:read",
                            ),
                            NavigationSubItem(
                                id="horarios",
                                label="Horários e Escalas",
                                route="/modulo/horarios",
                                description="Turnos comerciais, plantões 12x36, 24x72 e jornadas flexíveis.",
                                required_permission="cadastros:horarios:read",
                            ),
                            NavigationSubItem(
                                id="justificativas",
                                label="Tipos de Justificativa",
                                route="/modulo/justificativas",
                                description="Motivos de abono, afastamentos legais e ocorrências.",
                                required_permission="cadastros:justificativas:read",
                            ),
                        ),
                    ),
                    NavigationSection(
                        id="equipamentos-rep",
                        title="COLETORES & REP-P",
                        items=(
                            NavigationSubItem(
                                id="relogios-ponto",
                                label="Relógios de Ponto",
                                route="/modulo/relogios-ponto",
                                description="Equipamentos REP-C, REP-A e terminais biométricos/faciais.",
                                required_permission="cadastros:relogios-ponto:read",
                            ),
                            NavigationSubItem(
                                id="cercas-virtuais",
                                label="Cercas Virtuais",
                                route="/modulo/cercas-virtuais",
                                description="Perímetros de geolocalização para registro via aplicativo.",
                                required_permission="cadastros:cercas-virtuais:read",
                            ),
                        ),
                    ),
                ),
            ),
            NavigationItem(
                id="gestao-ponto",
                label="Gestão de Ponto",
                icon="clock",
                sections=(
                    NavigationSection(
                        id="apuracao-diaria",
                        title="APURAÇÃO & FREQUÊNCIA",
                        items=(
                            NavigationSubItem(
                                id="espelho",
                                label="Espelho de Ponto",
                                route="/modulo/espelho",
                                description="Consulta e conferência individual de cartões de ponto.",
                                required_permission="ponto:espelho:read",
                            ),
                            NavigationSubItem(
                                id="ocorrencias",
                                label="Tratamento de Ocorrências",
                                route="/modulo/ocorrencias",
                                description="Inconsistências, batidas ímpares, atrasos e faltas.",
                                required_permission="ponto:ocorrencias:read",
                                badge="14",
                            ),
                            NavigationSubItem(
                                id="marcacoes",
                                label="Marcações Brutas (AFD)",
                                route="/modulo/marcacoes",
                                description="Auditoria de registros originais coletados dos REPs.",
                                required_permission="ponto:marcacoes:read",
                            ),
                        ),
                    ),
                    NavigationSection(
                        id="compensacao",
                        title="SALDOS & ESCALAS",
                        items=(
                            NavigationSubItem(
                                id="banco-horas",
                                label="Banco de Horas",
                                route="/modulo/banco-horas",
                                description="Extrato de créditos, débitos e fechamento de ciclo.",
                                required_permission="ponto:banco-horas:read",
                            ),
                        ),
                    ),
                ),
            ),
            NavigationItem(
                id="solicitacoes",
                label="Solicitações",
                icon="workflows",
                sections=(
                    NavigationSection(
                        id="fluxo-aprovacao",
                        title="CENTRAL DE APROVAÇÕES",
                        items=(
                            NavigationSubItem(
                                id="ajustes",
                                label="Ajustes de Ponto",
                                route="/modulo/ajustes",
                                description="Inclusão manual de batidas esquecidas mediante justificativa.",
                                required_permission="solicitacoes:ajustes:read",
                                badge="7",
                            ),
                            NavigationSubItem(
                                id="atestados",
                                label="Atestados e Licenças",
                                route="/modulo/atestados",
                                description="Validação de documentos médicos e afastamentos.",
                                required_permission="solicitacoes:atestados:read",
                            ),
                            NavigationSubItem(
                                id="ferias",
                                label="Férias e Folgas",
                                route="/modulo/ferias",
                                description="Programação anual de férias e abonos de permanência.",
                                required_permission="solicitacoes:ferias:read",
                            ),
                        ),
                    ),
                ),
            ),
            NavigationItem(
                id="relatorios",
                label="Relatórios",
                icon="analytics",
                sections=(
                    NavigationSection(
                        id="portaria-671",
                        title="CONFORMIDADE & PORTARIA 671",
                        items=(
                            NavigationSubItem(
                                id="espelho-fiscal",
                                label="Espelho de Ponto Eletrônico",
                                route="/modulo/espelho-fiscal",
                                description="Emissão oficial com assinatura eletrônica e hash SHA-256.",
                                required_permission="relatorios:espelho-fiscal:read",
                            ),
                            NavigationSubItem(
                                id="arquivos-fiscais",
                                label="Exportação AFD / AEJ",
                                route="/modulo/arquivos-fiscais",
                                description="Geração de arquivos fiscais para auditoria do MTE.",
                                required_permission="relatorios:arquivos-fiscais:read",
                            ),
                        ),
                    ),
                    NavigationSection(
                        id="indicadores",
                        title="INDICADORES GERENCIAIS",
                        items=(
                            NavigationSubItem(
                                id="absenteismo",
                                label="Índice de Absenteísmo",
                                route="/modulo/absenteismo",
                                description="Análise comparativa de faltas e atrasos por órgão.",
                                required_permission="relatorios:absenteismo:read",
                            ),
                        ),
                    ),
                ),
            ),
            NavigationItem(
                id="configuracoes",
                label="Configurações",
                icon="settings",
                sections=(
                    NavigationSection(
                        id="pessoal",
                        title="PESSOAL",
                        items=(
                            NavigationSubItem(
                                id="perfil",
                                label="Meu Perfil",
                                route="/modulo/perfil",
                                description="Dados da conta, credenciais e assinatura eletrônica.",
                                required_permission="configuracoes:perfil:read",
                            ),
                            NavigationSubItem(
                                id="notificacoes",
                                label="Alertas e Notificações",
                                route="/modulo/notificacoes",
                                description="Preferências de avisos por e-mail e push.",
                                required_permission="configuracoes:notificacoes:read",
                            ),
                        ),
                    ),
                    NavigationSection(
                        id="organizacao",
                        title="ORGANIZAÇÃO & SEGURANÇA",
                        items=(
                            NavigationSubItem(
                                id="geral",
                                label="Parâmetros do Ponto",
                                route="/modulo/geral",
                                description="Tolerâncias de atraso, fechamento de folha e regras CLT/Estatutário.",
                                required_permission="configuracoes:geral:read",
                            ),
                            NavigationSubItem(
                                id="permissoes",
                                label="Perfis e Permissões",
                                route="/modulo/permissoes",
                                description="Matriz RBAC de acesso por módulo e escopo de unidade.",
                                required_permission="configuracoes:permissoes:read",
                            ),
                            NavigationSubItem(
                                id="sso",
                                label="Autenticação & SSO",
                                route="/modulo/sso",
                                description="Integração Gov.br, LDAP/Active Directory e SAML 2.0.",
                                required_permission="configuracoes:sso:read",
                            ),
                        ),
                    ),
                ),
            ),
        )
