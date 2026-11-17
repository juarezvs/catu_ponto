from catuponto.application.ports.outbound.repositories import CadastroRepositoryPort
from catuponto.domain.entities.cadastro_item import (
    CadastroColumn,
    CadastroMetric,
    CadastroModuleData,
)


class InMemoryCadastroRepository(CadastroRepositoryPort):
    """Outbound Adapter que fornece os dados dos módulos e cadastros do CatuPonto."""

    def __init__(self) -> None:
        self._modules: dict[str, CadastroModuleData] = {
            "visao-geral": CadastroModuleData(
                slug="visao-geral",
                title="Visão Geral da Frequência",
                subtitle="Monitoramento em tempo real das marcações de ponto, presença por órgão e coletores REP.",
                category="Workspace > Visão Geral",
                primary_action_label="+ Nova Marcação / Abono",
                required_permission="visao-geral:read",
                metrics=(
                    CadastroMetric("Servidores Ativos", "1.248", "+18 neste mês"),
                    CadastroMetric("Presença Hoje", "94,2%", "1.175 presentes"),
                    CadastroMetric("Ocorrências Pendentes", "14", "Aguardando chefia"),
                    CadastroMetric("Relógios Online", "38 / 39", "97,4% disponibilidade"),
                ),
                columns=(
                    CadastroColumn("horario", "Horário", "code"),
                    CadastroColumn("servidor", "Servidor / Pessoa", "text"),
                    CadastroColumn("orgao", "Órgão / Unidade", "text"),
                    CadastroColumn("origem", "Coletor REP", "badge"),
                    CadastroColumn("status", "Situação", "status"),
                ),
                records=(
                    {
                        "horario": "07:58:12",
                        "servidor": "Ana Beatriz Souza (Mat. 40912)",
                        "orgao": "Secretaria de Educação • Sede Central",
                        "origem": "REP-P Facial #04",
                        "status": "Regular",
                    },
                    {
                        "horario": "08:01:44",
                        "servidor": "Roberto Carlos Mendes (Mat. 31804)",
                        "orgao": "Secretaria de Saúde • UPA Norte",
                        "origem": "Biometria #11",
                        "status": "Regular",
                    },
                    {
                        "horario": "08:14:05",
                        "servidor": "Fernanda Lima Rocha (Mat. 50219)",
                        "orgao": "Secretaria da Fazenda • Atendimento",
                        "origem": "App CatuPonto GPS",
                        "status": "Tolerância (+14m)",
                    },
                    {
                        "horario": "08:22:30",
                        "servidor": "Marcos Vinícius Alves (Mat. 28710)",
                        "orgao": "Procuradoria Geral • Gabinete",
                        "origem": "Web / IP Autorizado",
                        "status": "Pendente Aprovação",
                    },
                ),
            ),
            "pessoas": CadastroModuleData(
                slug="pessoas",
                title="Pessoas",
                subtitle="Gerencie o cadastro de servidores, colaboradores, matrículas, PIS/PASEP e vínculos de ponto.",
                category="Cadastros > Estrutura Organizacional",
                primary_action_label="+ Nova Pessoa",
                required_permission="cadastros:pessoas:read",
                metrics=(
                    CadastroMetric("Total de Pessoas", "1.248", "Ativos no ponto"),
                    CadastroMetric("Biometria Facial", "1.190", "95,3% cadastrados"),
                    CadastroMetric("Em Férias / Licença", "42", "3,3% do quadro"),
                ),
                columns=(
                    CadastroColumn("matricula", "Matrícula", "code"),
                    CadastroColumn("nome", "Nome Completo", "text"),
                    CadastroColumn("cargo", "Cargo / Função", "text"),
                    CadastroColumn("departamento", "Departamento / Órgão", "text"),
                    CadastroColumn("escala", "Jornada", "badge"),
                    CadastroColumn("status", "Status", "status"),
                ),
                records=(
                    {
                        "matricula": "MAT-40912",
                        "nome": "Ana Beatriz Souza",
                        "cargo": "Analista Administrativo",
                        "departamento": "Gestão de Pessoas • Sec. Administração",
                        "escala": "40h Semanais (08h-17h)",
                        "status": "Ativo",
                    },
                    {
                        "matricula": "MAT-31804",
                        "nome": "Roberto Carlos Mendes",
                        "cargo": "Enfermeiro Plantonista",
                        "departamento": "Urgência e Emergência • Sec. Saúde",
                        "escala": "Plantão 12x36 Diurno",
                        "status": "Ativo",
                    },
                    {
                        "matricula": "MAT-50219",
                        "nome": "Fernanda Lima Rocha",
                        "cargo": "Auditora Fiscal",
                        "departamento": "Tributação • Sec. Fazenda",
                        "escala": "30h Corridas (07h-13h)",
                        "status": "Ativo",
                    },
                    {
                        "matricula": "MAT-19402",
                        "nome": "Lucas Gabriel Ferreira",
                        "cargo": "Técnico de TI",
                        "departamento": "Infraestrutura e Redes • Sec. Administração",
                        "escala": "40h Flexível",
                        "status": "Férias",
                    },
                ),
            ),
            "departamentos": CadastroModuleData(
                slug="departamentos",
                title="Departamentos",
                subtitle="Estrutura de setores, coordenações, divisões internas e responsáveis pela aprovação de ponto.",
                category="Cadastros > Estrutura Organizacional",
                primary_action_label="+ Novo Departamento",
                required_permission="cadastros:departamentos:read",
                metrics=(
                    CadastroMetric("Departamentos Ativos", "64", "Distribuídos em 18 órgãos"),
                    CadastroMetric("Com Chefia Definida", "62", "96,8% cobertos"),
                    CadastroMetric("Média de Servidores", "19,5", "Por departamento"),
                ),
                columns=(
                    CadastroColumn("codigo", "Código", "code"),
                    CadastroColumn("nome", "Departamento", "text"),
                    CadastroColumn("orgao", "Órgão Vinculado", "text"),
                    CadastroColumn("responsavel", "Gestor Aprovador", "text"),
                    CadastroColumn("servidores", "Lotados", "badge"),
                    CadastroColumn("status", "Status", "status"),
                ),
                records=(
                    {
                        "codigo": "DEP-001",
                        "nome": "Diretoria de Recursos Humanos",
                        "orgao": "Secretaria Municipal de Administração",
                        "responsavel": "Marina Costa",
                        "servidores": "34 pessoas",
                        "status": "Ativo",
                    },
                    {
                        "codigo": "DEP-014",
                        "nome": "Coordenação de Tecnologia da Informação",
                        "orgao": "Secretaria Municipal de Administração",
                        "responsavel": "Juarez Catu",
                        "servidores": "22 pessoas",
                        "status": "Ativo",
                    },
                    {
                        "codigo": "DEP-029",
                        "nome": "Divisão de Vigilância Epidemiológica",
                        "orgao": "Secretaria Municipal de Saúde",
                        "responsavel": "Dr. Henrique Vasconcelos",
                        "servidores": "48 pessoas",
                        "status": "Ativo",
                    },
                ),
            ),
            "orgaos": CadastroModuleData(
                slug="orgaos",
                title="Órgãos",
                subtitle="Secretarias, autarquias, fundações públicas e entidades empregadoras configuradas no CatuPonto.",
                category="Cadastros > Estrutura Organizacional",
                primary_action_label="+ Novo Órgão",
                required_permission="cadastros:orgaos:read",
                metrics=(
                    CadastroMetric("Órgãos Cadastrados", "18", "Administração Direta e Indireta"),
                    CadastroMetric("CNPJs Vinculados", "6", "Emissão AFD/AEJ independente"),
                ),
                columns=(
                    CadastroColumn("sigla", "Sigla", "code"),
                    CadastroColumn("nome", "Nome do Órgão", "text"),
                    CadastroColumn("cnpj", "CNPJ", "text"),
                    CadastroColumn("unidades", "Unidades Físicas", "badge"),
                    CadastroColumn("status", "Status", "status"),
                ),
                records=(
                    {
                        "sigla": "SEMAD",
                        "nome": "Secretaria Municipal de Administração",
                        "cnpj": "12.345.678/0001-90",
                        "unidades": "8 unidades",
                        "status": "Ativo",
                    },
                    {
                        "sigla": "SEMSA",
                        "nome": "Secretaria Municipal de Saúde",
                        "cnpj": "12.345.678/0002-71",
                        "unidades": "34 unidades",
                        "status": "Ativo",
                    },
                    {
                        "sigla": "SEMED",
                        "nome": "Secretaria Municipal de Educação",
                        "cnpj": "12.345.678/0003-52",
                        "unidades": "42 unidades",
                        "status": "Ativo",
                    },
                ),
            ),
            "unidades": CadastroModuleData(
                slug="unidades",
                title="Unidades",
                subtitle="Endereços físicos, prédios administrativos, hospitais, escolas e postos de atendimento.",
                category="Cadastros > Estrutura Organizacional",
                primary_action_label="+ Nova Unidade",
                required_permission="cadastros:unidades:read",
                metrics=(
                    CadastroMetric("Unidades Físicas", "92", "Com cerca virtual ativa"),
                    CadastroMetric("Terminais REP Instalados", "39", "Sincronização automática"),
                ),
                columns=(
                    CadastroColumn("codigo", "Código", "code"),
                    CadastroColumn("unidade", "Unidade", "text"),
                    CadastroColumn("orgao", "Órgão", "text"),
                    CadastroColumn("coletor", "Modalidade de Coleta", "badge"),
                    CadastroColumn("status", "Status", "status"),
                ),
                records=(
                    {
                        "codigo": "UNI-01",
                        "unidade": "Paço Municipal - Sede Central",
                        "orgao": "SEMAD",
                        "coletor": "3 REPs Faciais + Geofence",
                        "status": "Ativo",
                    },
                    {
                        "codigo": "UNI-12",
                        "unidade": "Unidade de Pronto Atendimento Norte",
                        "orgao": "SEMSA",
                        "coletor": "2 REPs Biométricos",
                        "status": "Ativo",
                    },
                ),
            ),
            "cargos": CadastroModuleData(
                slug="cargos",
                title="Cargos",
                subtitle="Plano de cargos, carreiras, regime jurídico (Estatutário, CLT, Comissionado) e carga horária padrão.",
                category="Cadastros > Carreira & Lotação",
                primary_action_label="+ Novo Cargo",
                required_permission="cadastros:cargos:read",
                metrics=(
                    CadastroMetric("Cargos Ativos", "86", "Quadro geral"),
                    CadastroMetric("Regimes Jurídicos", "3", "Estatutário, CLT e Temporário"),
                ),
                columns=(
                    CadastroColumn("cbo", "CBO / Código", "code"),
                    CadastroColumn("cargo", "Nomenclatura do Cargo", "text"),
                    CadastroColumn("regime", "Regime", "badge"),
                    CadastroColumn("carga", "Carga Horária Padrão", "text"),
                    CadastroColumn("status", "Status", "status"),
                ),
                records=(
                    {
                        "cbo": "2521-05",
                        "cargo": "Analista Administrativo",
                        "regime": "Estatutário",
                        "carga": "40h Semanais",
                        "status": "Ativo",
                    },
                    {
                        "cbo": "2235-05",
                        "cargo": "Enfermeiro Plantonista",
                        "regime": "Estatutário",
                        "carga": "12x36 (180h Mensais)",
                        "status": "Ativo",
                    },
                ),
            ),
            "funcoes": CadastroModuleData(
                slug="funcoes",
                title="Funções",
                subtitle="Funções gratificadas (FG), cargos em comissão, direção, chefia e assessoramento.",
                category="Cadastros > Carreira & Lotação",
                primary_action_label="+ Nova Função",
                required_permission="cadastros:funcoes:read",
                metrics=(
                    CadastroMetric("Funções Cadastradas", "45", "FG e Direção"),
                    CadastroMetric("Dispensa de Ponto", "12", "Cargos de Direção Superior"),
                ),
                columns=(
                    CadastroColumn("sigla", "Código", "code"),
                    CadastroColumn("funcao", "Função", "text"),
                    CadastroColumn("regra_ponto", "Regra de Frequência", "badge"),
                    CadastroColumn("status", "Status", "status"),
                ),
                records=(
                    {
                        "sigla": "FG-01",
                        "funcao": "Chefe de Divisão de Folha e Frequência",
                        "regra_ponto": "Dedicação Integral (2 batidas/dia)",
                        "status": "Ativo",
                    },
                    {
                        "sigla": "DAS-03",
                        "funcao": "Diretor de Departamento",
                        "regra_ponto": "Controle por Assiduidade",
                        "status": "Ativo",
                    },
                ),
            ),
            "feriados": CadastroModuleData(
                slug="feriados",
                title="Feriados e Pontos Facultativos",
                subtitle="Calendário oficial de feriados nacionais, estaduais, municipais e suspensões de expediente.",
                category="Cadastros > Jornada & Calendário",
                primary_action_label="+ Novo Feriado",
                required_permission="cadastros:feriados:read",
                metrics=(
                    CadastroMetric("Feriados em 2026", "19", "11 nacionais + 8 locais"),
                    CadastroMetric("Próximo Feriado", "20/11", "Dia da Consciência Negra"),
                ),
                columns=(
                    CadastroColumn("data", "Data", "code"),
                    CadastroColumn("descricao", "Descrição do Feriado", "text"),
                    CadastroColumn("abrangencia", "Abrangência", "badge"),
                    CadastroColumn("efeito", "Regra para Escalas", "text"),
                    CadastroColumn("status", "Status", "status"),
                ),
                records=(
                    {
                        "data": "15/11/2026",
                        "descricao": "Proclamação da República",
                        "abrangencia": "Nacional",
                        "efeito": "Abona turnos comerciais; mantém plantão 12x36",
                        "status": "Aplicado",
                    },
                    {
                        "data": "20/11/2026",
                        "descricao": "Dia Nacional de Zumbi e da Consciência Negra",
                        "abrangencia": "Nacional",
                        "efeito": "Abona turnos comerciais; hora extra 100% em plantão",
                        "status": "Programado",
                    },
                    {
                        "data": "24/12/2026",
                        "descricao": "Véspera de Natal (Ponto Facultativo após 13h)",
                        "abrangencia": "Municipal",
                        "efeito": "Jornada reduzida meio expediente",
                        "status": "Programado",
                    },
                ),
            ),
        }

    def get_module_by_slug(self, slug: str) -> CadastroModuleData | None:
        if slug in self._modules:
            return self._modules[slug]

        # Mapa de permissões para módulos com fallback dinâmico
        permission_map = {
            "horarios": "cadastros:horarios:read",
            "justificativas": "cadastros:justificativas:read",
            "relogios-ponto": "cadastros:relogios-ponto:read",
            "cercas-virtuais": "cadastros:cercas-virtuais:read",
            "espelho": "ponto:espelho:read",
            "ocorrencias": "ponto:ocorrencias:read",
            "marcacoes": "ponto:marcacoes:read",
            "banco-horas": "ponto:banco-horas:read",
            "ajustes": "solicitacoes:ajustes:read",
            "atestados": "solicitacoes:atestados:read",
            "ferias": "solicitacoes:ferias:read",
            "espelho-fiscal": "relatorios:espelho-fiscal:read",
            "arquivos-fiscais": "relatorios:arquivos-fiscais:read",
            "absenteismo": "relatorios:absenteismo:read",
            "perfil": "configuracoes:perfil:read",
            "notificacoes": "configuracoes:notificacoes:read",
            "geral": "configuracoes:geral:read",
            "permissoes": "configuracoes:permissoes:read",
            "sso": "configuracoes:sso:read",
        }
        formatted_title = slug.replace("-", " ").title()
        return CadastroModuleData(
            slug=slug,
            title=formatted_title,
            subtitle=f"Gerenciamento e configuração do módulo {formatted_title} no ecossistema CatuPonto.",
            category=f"Workspace > {formatted_title}",
            primary_action_label=f"+ Novo Registro",
            required_permission=permission_map.get(slug, ""),
            metrics=(
                CadastroMetric("Registros Ativos", "24", "Sincronizados"),
                CadastroMetric("Conformidade Legal", "100%", "Portaria MTP 671"),
            ),
            columns=(
                CadastroColumn("codigo", "Código", "code"),
                CadastroColumn("descricao", "Descrição", "text"),
                CadastroColumn("atualizacao", "Última Atualização", "badge"),
                CadastroColumn("status", "Status", "status"),
            ),
            records=(
                {
                    "codigo": f"{slug[:3].upper()}-001",
                    "descricao": f"Configuração principal de {formatted_title}",
                    "atualizacao": "Hoje às 08:30",
                    "status": "Ativo",
                },
                {
                    "codigo": f"{slug[:3].upper()}-002",
                    "descricao": f"Regra secundária homologada para {formatted_title}",
                    "atualizacao": "Ontem às 17:15",
                    "status": "Ativo",
                },
            ),
        )
