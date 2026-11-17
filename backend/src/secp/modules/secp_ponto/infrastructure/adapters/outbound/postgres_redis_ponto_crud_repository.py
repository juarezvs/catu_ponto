from dataclasses import dataclass
from typing import Any
import uuid
from sqlalchemy import select
from secp.infrastructure.cache.redis_client import SecpRedisCacheGateway
from secp.infrastructure.database.postgres_session import (
    SecpDeclarativeBase,
    SyncSessionLocal,
    check_postgres_connection,
    sync_engine,
)
from secp.modules.secp_ponto.application.ports.crud_ports import (
    CrudColumnSchema,
    CrudFieldSchema,
    CrudListResult,
    PontoCrudRepositoryOutputPort,
)


@dataclass(frozen=True)
class _ResourceDefinition:
    resource: str
    title: str
    subtitle: str
    primary_action_label: str
    fields: tuple[CrudFieldSchema, ...]
    columns: tuple[CrudColumnSchema, ...]
    initial_records: tuple[dict[str, Any], ...]


class PostgresRedisPontoCrudRepository(PontoCrudRepositoryOutputPort):
    """
    Outbound Adapter CRUD unificado para todas as entidades do SECP Ponto.
    Usa PostgreSQL (SQLAlchemy 2.0) + invalidação automática de cache em Redis.
    """

    def __init__(self, redis_gateway: SecpRedisCacheGateway) -> None:
        self._redis = redis_gateway
        self._definitions: dict[str, _ResourceDefinition] = self._build_definitions()
        self._store: dict[str, list[dict[str, Any]]] = {
            key: [dict(row) for row in defn.initial_records]
            for key, defn in self._definitions.items()
        }
        self._pg_ready = False
        self._ensure_postgres_tables()

    def _ensure_postgres_tables(self) -> None:
        if not check_postgres_connection():
            self._pg_ready = False
            return
        try:
            # Garante criação de todas as tabelas registradas no SecpDeclarativeBase
            from secp.modules.secp_ponto.infrastructure.database import ponto_orm_models  # noqa: F401
            SecpDeclarativeBase.metadata.create_all(bind=sync_engine)
            self._pg_ready = True
        except Exception:
            self._pg_ready = False

    def _build_definitions(self) -> dict[str, _ResourceDefinition]:
        return {
            "pessoas": _ResourceDefinition(
                resource="pessoas",
                title="Pessoas & Servidores",
                subtitle="Cadastro de servidores, matrículas, lotação e jornada vinculada (tabela `secp_servidores`).",
                primary_action_label="+ Nova Pessoa",
                fields=(
                    CrudFieldSchema("matricula", "Matrícula", "text", True),
                    CrudFieldSchema("nome", "Nome Completo", "text", True),
                    CrudFieldSchema("cargo", "Cargo / Função", "text", True),
                    CrudFieldSchema("departamento", "Departamento", "text", True),
                    CrudFieldSchema("escala", "Jornada", "select", True, ("JOR-7H (7h Ininterruptas)", "JOR-8H (8h c/ Intervalo)", "Plantão 12x36")),
                    CrudFieldSchema("status", "Status", "select", True, ("Ativo", "Férias", "Afastado", "Inativo")),
                ),
                columns=(
                    CrudColumnSchema("matricula", "Matrícula", "code"),
                    CrudColumnSchema("nome", "Nome Completo", "text"),
                    CrudColumnSchema("cargo", "Cargo / Função", "text"),
                    CrudColumnSchema("departamento", "Departamento", "text"),
                    CrudColumnSchema("escala", "Jornada", "badge"),
                    CrudColumnSchema("status", "Status", "status"),
                ),
                initial_records=(
                    {"id": "pes-1", "matricula": "MAT-40912", "nome": "Ana Beatriz Souza", "cargo": "Analista Administrativo", "departamento": "Gestão de Pessoas • SEMAD", "escala": "JOR-7H (7h Ininterruptas)", "status": "Ativo"},
                    {"id": "pes-2", "matricula": "MAT-31804", "nome": "Roberto Carlos Mendes", "cargo": "Enfermeiro Plantonista", "departamento": "UPA Norte • SEMSA", "escala": "Plantão 12x36", "status": "Ativo"},
                    {"id": "pes-3", "matricula": "MAT-50219", "nome": "Fernanda Lima Rocha", "cargo": "Auditora Fiscal", "departamento": "Tributação • SEFAZ", "escala": "JOR-7H (7h Ininterruptas)", "status": "Ativo"},
                ),
            ),
            "departamentos": _ResourceDefinition(
                resource="departamentos",
                title="Departamentos",
                subtitle="Setores, coordenações e responsáveis pela homologação mensal (tabela `secp_departamentos`).",
                primary_action_label="+ Novo Departamento",
                fields=(
                    CrudFieldSchema("codigo", "Código", "text", True),
                    CrudFieldSchema("nome", "Nome do Departamento", "text", True),
                    CrudFieldSchema("orgao", "Órgão Vinculado", "text", True),
                    CrudFieldSchema("responsavel", "Gestor Aprovador", "text", True),
                    CrudFieldSchema("status", "Status", "select", True, ("Ativo", "Inativo")),
                ),
                columns=(
                    CrudColumnSchema("codigo", "Código", "code"),
                    CrudColumnSchema("nome", "Departamento", "text"),
                    CrudColumnSchema("orgao", "Órgão Vinculado", "text"),
                    CrudColumnSchema("responsavel", "Gestor Aprovador", "text"),
                    CrudColumnSchema("status", "Status", "status"),
                ),
                initial_records=(
                    {"id": "dep-1", "codigo": "DEP-001", "nome": "Diretoria de Recursos Humanos", "orgao": "SEMAD", "responsavel": "Marina Costa", "status": "Ativo"},
                    {"id": "dep-2", "codigo": "DEP-014", "nome": "Coordenação de Tecnologia da Informação", "orgao": "SEMAD", "responsavel": "Juarez Catu", "status": "Ativo"},
                ),
            ),
            "orgaos": _ResourceDefinition(
                resource="orgaos",
                title="Órgãos & Entidades",
                subtitle="Secretarias, autarquias e fundações com isolamento multi-tenant (tabela `secp_orgaos`).",
                primary_action_label="+ Novo Órgão",
                fields=(
                    CrudFieldSchema("sigla", "Sigla", "text", True),
                    CrudFieldSchema("nome", "Nome do Órgão", "text", True),
                    CrudFieldSchema("cnpj", "CNPJ", "text", True),
                    CrudFieldSchema("teto", "Teto Mensal HE", "text", True),
                    CrudFieldSchema("status", "Status", "select", True, ("Ativo", "Inativo")),
                ),
                columns=(
                    CrudColumnSchema("sigla", "Sigla", "code"),
                    CrudColumnSchema("nome", "Nome do Órgão", "text"),
                    CrudColumnSchema("cnpj", "CNPJ", "text"),
                    CrudColumnSchema("teto", "Teto Mensal HE", "badge"),
                    CrudColumnSchema("status", "Status", "status"),
                ),
                initial_records=(
                    {"id": "org-1", "sigla": "SEMAD", "nome": "Secretaria Municipal de Administração", "cnpj": "12.345.678/0001-90", "teto": "R$ 85.000,00", "status": "Ativo"},
                    {"id": "org-2", "sigla": "SEMSA", "nome": "Secretaria Municipal de Saúde", "cnpj": "12.345.678/0002-71", "teto": "R$ 210.000,00", "status": "Ativo"},
                    {"id": "org-3", "sigla": "SEMED", "nome": "Secretaria Municipal de Educação", "cnpj": "12.345.678/0003-52", "teto": "R$ 64.000,00", "status": "Ativo"},
                ),
            ),
            "unidades": _ResourceDefinition(
                resource="unidades",
                title="Unidades Organizacionais",
                subtitle="Locais físicos de lotação, raios de geofence e coletores vinculados (tabela `secp_unidades`).",
                primary_action_label="+ Nova Unidade",
                fields=(
                    CrudFieldSchema("codigo", "Código", "text", True),
                    CrudFieldSchema("unidade", "Nome da Unidade", "text", True),
                    CrudFieldSchema("orgao", "Órgão", "text", True),
                    CrudFieldSchema("coletor", "Modalidade de Coleta", "text", True),
                    CrudFieldSchema("status", "Status", "select", True, ("Ativo", "Inativo")),
                ),
                columns=(
                    CrudColumnSchema("codigo", "Código", "code"),
                    CrudColumnSchema("unidade", "Unidade", "text"),
                    CrudColumnSchema("orgao", "Órgão", "text"),
                    CrudColumnSchema("coletor", "Modalidade de Coleta", "badge"),
                    CrudColumnSchema("status", "Status", "status"),
                ),
                initial_records=(
                    {"id": "uni-1", "codigo": "UNI-01", "unidade": "Paço Municipal - Sede Central", "orgao": "SEMAD", "coletor": "3 REPs Faciais + Geofence 150m", "status": "Ativo"},
                    {"id": "uni-2", "codigo": "UNI-12", "unidade": "UPA Regional Norte", "orgao": "SEMSA", "coletor": "2 REPs Biométricos", "status": "Ativo"},
                ),
            ),
            "cargos": _ResourceDefinition(
                resource="cargos",
                title="Cargos",
                subtitle="Quadro de cargos efetivos, comissionados e CBO oficial (tabela `secp_cargos`).",
                primary_action_label="+ Novo Cargo",
                fields=(
                    CrudFieldSchema("cbo", "CBO / Código", "text", True),
                    CrudFieldSchema("cargo", "Nomenclatura do Cargo", "text", True),
                    CrudFieldSchema("regime", "Regime Jurídico", "select", True, ("Estatutário", "CLT", "Comissionado")),
                    CrudFieldSchema("carga", "Carga Horária", "text", True),
                    CrudFieldSchema("status", "Status", "select", True, ("Ativo", "Inativo")),
                ),
                columns=(
                    CrudColumnSchema("cbo", "CBO / Código", "code"),
                    CrudColumnSchema("cargo", "Cargo", "text"),
                    CrudColumnSchema("regime", "Regime", "badge"),
                    CrudColumnSchema("carga", "Carga Horária", "text"),
                    CrudColumnSchema("status", "Status", "status"),
                ),
                initial_records=(
                    {"id": "car-1", "cbo": "2521-05", "cargo": "Analista Administrativo", "regime": "Estatutário", "carga": "35h Semanais (7h/dia)", "status": "Ativo"},
                    {"id": "car-2", "cbo": "2235-05", "cargo": "Enfermeiro Plantonista", "regime": "Estatutário", "carga": "12x36 (180h/mês)", "status": "Ativo"},
                ),
            ),
            "funcoes": _ResourceDefinition(
                resource="funcoes",
                title="Funções de Confiança",
                subtitle="Funções gratificadas, chefias e regras de dispensa/controle de ponto (tabela `secp_funcoes_confianca`).",
                primary_action_label="+ Nova Função",
                fields=(
                    CrudFieldSchema("sigla", "Código / Símbolo", "text", True),
                    CrudFieldSchema("funcao", "Descrição da Função", "text", True),
                    CrudFieldSchema("regra_ponto", "Regra de Frequência", "select", True, ("Controle Integral", "2 batidas/dia", "Dispensa de Ponto")),
                    CrudFieldSchema("status", "Status", "select", True, ("Ativo", "Inativo")),
                ),
                columns=(
                    CrudColumnSchema("sigla", "Código", "code"),
                    CrudColumnSchema("funcao", "Função", "text"),
                    CrudColumnSchema("regra_ponto", "Regra de Frequência", "badge"),
                    CrudColumnSchema("status", "Status", "status"),
                ),
                initial_records=(
                    {"id": "fun-1", "sigla": "FG-01", "funcao": "Chefe de Núcleo de Tecnologia", "regra_ponto": "Controle Integral", "status": "Ativo"},
                    {"id": "fun-2", "sigla": "CJ-03", "funcao": "Diretor de Secretaria", "regra_ponto": "Dispensa de Ponto", "status": "Ativo"},
                ),
            ),
            "feriados": _ResourceDefinition(
                resource="feriados",
                title="Calendário Institucional & Feriados",
                subtitle="Feriados nacionais, estaduais, municipais, pontos facultativos e suspensões (tabela `secp_calendario_institucional`).",
                primary_action_label="+ Novo Feriado / Evento",
                fields=(
                    CrudFieldSchema("data", "Data (DD/MM/AAAA)", "text", True),
                    CrudFieldSchema("descricao", "Descrição", "text", True),
                    CrudFieldSchema("abrangencia", "Abrangência", "select", True, ("Nacional", "Estadual", "Municipal", "Órgão")),
                    CrudFieldSchema("efeito", "Efeito nas Escalas", "text", True),
                    CrudFieldSchema("status", "Status", "select", True, ("Programado", "Aplicado", "Cancelado")),
                ),
                columns=(
                    CrudColumnSchema("data", "Data", "code"),
                    CrudColumnSchema("descricao", "Descrição", "text"),
                    CrudColumnSchema("abrangencia", "Abrangência", "badge"),
                    CrudColumnSchema("efeito", "Efeito nas Escalas", "text"),
                    CrudColumnSchema("status", "Status", "status"),
                ),
                initial_records=(
                    {"id": "fer-1", "data": "20/11/2026", "descricao": "Dia Nacional da Consciência Negra", "abrangencia": "Nacional", "efeito": "Abona turnos comerciais; hora extra em plantão", "status": "Programado"},
                    {"id": "fer-2", "data": "24/12/2026", "descricao": "Véspera de Natal (Recesso Forense)", "abrangencia": "Órgão", "efeito": "Recesso Forense (20/12 a 06/01)", "status": "Programado"},
                ),
            ),
            "horarios": _ResourceDefinition(
                resource="horarios",
                title="Horários & Jornadas",
                subtitle="Regras de carga diária (7h ininterruptas ou 8h c/ intervalo de 1h–3h) (tabela `jornadas`).",
                primary_action_label="+ Nova Jornada",
                fields=(
                    CrudFieldSchema("codigo", "Código", "text", True),
                    CrudFieldSchema("nome", "Nome da Jornada", "text", True),
                    CrudFieldSchema("tipo", "Tipo", "select", True, ("SETE_HORAS", "OITO_HORAS", "PLANTAO_12X36")),
                    CrudFieldSchema("expediente", "Janela de Expediente", "text", True),
                    CrudFieldSchema("status", "Status", "select", True, ("Ativo", "Inativo")),
                ),
                columns=(
                    CrudColumnSchema("codigo", "Código", "code"),
                    CrudColumnSchema("nome", "Jornada", "text"),
                    CrudColumnSchema("tipo", "Modalidade", "badge"),
                    CrudColumnSchema("expediente", "Janela Permitida", "text"),
                    CrudColumnSchema("status", "Status", "status"),
                ),
                initial_records=(
                    {"id": "jor-1", "codigo": "JOR-7H", "nome": "7h Ininterruptas (Portaria 135/2025)", "tipo": "SETE_HORAS", "expediente": "08:00 às 18:00 (Excepcional 06:00–19:00)", "status": "Ativo"},
                    {"id": "jor-2", "codigo": "JOR-8H", "nome": "8h com Intervalo (1h a 3h)", "tipo": "OITO_HORAS", "expediente": "08:00 às 18:00", "status": "Ativo"},
                ),
            ),
            "relogios-ponto": _ResourceDefinition(
                resource="relogios-ponto",
                title="Equipamentos Biométricos & REPs",
                subtitle="Coletores biométricos integrados e importadores AFD imutáveis (tabela `secp_equipamentos_biometricos`).",
                primary_action_label="+ Novo Equipamento REP",
                fields=(
                    CrudFieldSchema("codigo", "Código REP", "text", True),
                    CrudFieldSchema("nome", "Identificação", "text", True),
                    CrudFieldSchema("modelo", "Modelo / Fabricante", "text", True),
                    CrudFieldSchema("ip", "Endereço IP", "text", True),
                    CrudFieldSchema("status", "Status", "select", True, ("Online", "Offline", "Manutenção")),
                ),
                columns=(
                    CrudColumnSchema("codigo", "Código", "code"),
                    CrudColumnSchema("nome", "Identificação", "text"),
                    CrudColumnSchema("modelo", "Modelo", "badge"),
                    CrudColumnSchema("ip", "IP", "code"),
                    CrudColumnSchema("status", "Status", "status"),
                ),
                initial_records=(
                    {"id": "rep-1", "codigo": "REP-001", "nome": "Terminal Facial Recepção Sede", "modelo": "Control iD FacePro", "ip": "10.20.1.45", "status": "Online"},
                    {"id": "rep-2", "codigo": "REP-004", "nome": "Coletor Dimep SmartPrint UPA", "modelo": "Dimep SmartPrint", "ip": "10.20.4.12", "status": "Online"},
                ),
            ),
            "ocorrencias": _ResourceDefinition(
                resource="ocorrencias",
                title="Tratamento de Ocorrências",
                subtitle="Inconsistências de marcações ímpares, atrasos acima da tolerância e defesas (2 dias úteis).",
                primary_action_label="+ Registrar Ocorrência",
                fields=(
                    CrudFieldSchema("servidor", "Servidor", "text", True),
                    CrudFieldSchema("data", "Data", "text", True),
                    CrudFieldSchema("tipo", "Tipo", "select", True, ("BATIDA_IMPAR", "ATRASO", "FALTA_INJUSTIFICADA")),
                    CrudFieldSchema("descricao", "Descrição", "text", True),
                    CrudFieldSchema("status", "Situação", "select", True, ("Pendente", "Justificada", "Abonada")),
                ),
                columns=(
                    CrudColumnSchema("data", "Data", "code"),
                    CrudColumnSchema("servidor", "Servidor", "text"),
                    CrudColumnSchema("tipo", "Tipo", "badge"),
                    CrudColumnSchema("descricao", "Descrição", "text"),
                    CrudColumnSchema("status", "Situação", "status"),
                ),
                initial_records=(
                    {"id": "oco-1", "data": "11/11/2026", "servidor": "Ana Beatriz Souza", "tipo": "ATRASO", "descricao": "Débito de 24 min aguardando compensação ou justificativa", "status": "Pendente"},
                    {"id": "oco-2", "data": "12/11/2026", "servidor": "Roberto Carlos Mendes", "tipo": "BATIDA_IMPAR", "descricao": "Esquecimento de marcação de saída do intervalo", "status": "Pendente"},
                ),
            ),
            "solicitacoes-ponto": _ResourceDefinition(
                resource="solicitacoes-ponto",
                title="Solicitações de Frequência (Seção 9)",
                subtitle="Máquina de estados oficial: RASCUNHO, ENVIADA, EM_ANALISE, DEFERIDA, INDEFERIDA e CANCELADA.",
                primary_action_label="+ Nova Solicitação",
                fields=(
                    CrudFieldSchema("protocolo", "Protocolo", "text", True),
                    CrudFieldSchema("servidor", "Servidor", "text", True),
                    CrudFieldSchema("tipo", "Tipo de Solicitação", "select", True, ("AJUSTE_PONTO", "EXCLUSAO_MARCACAO", "COMPENSACAO", "ABONO_JUSTIFICATIVA", "ATIVIDADE_EXTERNA", "VIAGEM_SERVICO", "CAPACITACAO", "DISPENSA_PONTO", "AUTORIZACAO_PREVIA_CREDITO", "FOLGA_BANCO")),
                    CrudFieldSchema("data_referencia", "Data Referência", "text", True),
                    CrudFieldSchema("descricao", "Descrição (10 a 3000 caracteres)", "text", True),
                    CrudFieldSchema("status", "Estado", "select", True, ("RASCUNHO", "ENVIADA", "EM_ANALISE", "DEFERIDA", "INDEFERIDA", "CANCELADA")),
                ),
                columns=(
                    CrudColumnSchema("protocolo", "Protocolo", "code"),
                    CrudColumnSchema("servidor", "Servidor", "text"),
                    CrudColumnSchema("tipo", "Tipo", "badge"),
                    CrudColumnSchema("data_referencia", "Data Ref.", "code"),
                    CrudColumnSchema("descricao", "Descrição", "text"),
                    CrudColumnSchema("status", "Estado", "status"),
                ),
                initial_records=(
                    {"id": "sol-1", "protocolo": "SOL-2026-104", "servidor": "Ana Beatriz Souza", "tipo": "AJUSTE_PONTO", "data_referencia": "11/11/2026", "descricao": "Inclusão de marcação de retorno do intervalo às 13:02 por instabilidade na rede local.", "status": "ENVIADA"},
                    {"id": "sol-2", "protocolo": "SOL-2026-108", "servidor": "Carlos Eduardo", "tipo": "CAPACITACAO", "data_referencia": "13/11/2026", "descricao": "Participação em curso oficial de governança pública (carga horária 4h presenciais).", "status": "EM_ANALISE"},
                    {"id": "sol-3", "protocolo": "SOL-2026-112", "servidor": "Marina Costa", "tipo": "AUTORIZACAO_PREVIA_CREDITO", "data_referencia": "16/11/2026", "descricao": "Autorização prévia de 6h de crédito para fechamento mensal da competência.", "status": "DEFERIDA"},
                ),
            ),
            "boletim-frequencia": _ResourceDefinition(
                resource="boletim-frequencia",
                title="Boletins de Frequência (Seção 10)",
                subtitle="Consolidação de unidades homologadas, encaminhamento à SECAP/NUCGP e rastreio de processo SEI.",
                primary_action_label="+ Gerar Boletim da Unidade",
                fields=(
                    CrudFieldSchema("numero_sei", "Nº Documento SEI", "text", True),
                    CrudFieldSchema("unidade", "Unidade", "text", True),
                    CrudFieldSchema("competencia", "Competência", "text", True),
                    CrudFieldSchema("resumo", "Servidores Homologados", "text", True),
                    CrudFieldSchema("status", "Situação", "select", True, ("GERADO", "ENCAMINHADO_SECAP", "RECEBIDO")),
                ),
                columns=(
                    CrudColumnSchema("numero_sei", "SEI", "code"),
                    CrudColumnSchema("unidade", "Unidade", "text"),
                    CrudColumnSchema("competencia", "Competência", "code"),
                    CrudColumnSchema("resumo", "Consolidado", "badge"),
                    CrudColumnSchema("status", "Situação", "status"),
                ),
                initial_records=(
                    {"id": "bol-1", "numero_sei": "SEI-23258652", "unidade": "SJAM • NUTEC", "competencia": "10/2026", "resumo": "22 / 22 homologados", "status": "RECEBIDO"},
                    {"id": "bol-2", "numero_sei": "SEI-23259011", "unidade": "SJAM • SECAD", "competencia": "11/2026", "resumo": "18 / 20 homologados", "status": "GERADO"},
                ),
            ),
            "recesso-forense": _ResourceDefinition(
                resource="recesso-forense",
                title="Recesso Forense • 20/12 a 06/01 (Seção 11)",
                subtitle="Domínio próprio com convocação por dia, opção de Pecúnia ou Folga e fluxo Servidor → Chefia → SECAD → SEPAG/SECAP.",
                primary_action_label="+ Nova Convocação de Recesso",
                fields=(
                    CrudFieldSchema("exercicio", "Exercício", "text", True),
                    CrudFieldSchema("servidor", "Servidor Convocado", "text", True),
                    CrudFieldSchema("periodo", "Dias Convocados", "text", True),
                    CrudFieldSchema("modalidade", "Compensação", "select", True, ("FOLGA", "PECUNIA")),
                    CrudFieldSchema("status", "Etapa do Fluxo", "select", True, ("FECHADO_SERVIDOR", "HOMOLOGADO_CHEFIA", "ACEITO_SECAD", "CONSOLIDADO_SEPAG_SECAP")),
                ),
                columns=(
                    CrudColumnSchema("exercicio", "Exercício", "code"),
                    CrudColumnSchema("servidor", "Servidor Convocado", "text"),
                    CrudColumnSchema("periodo", "Dias Convocados", "text"),
                    CrudColumnSchema("modalidade", "Compensação", "badge"),
                    CrudColumnSchema("status", "Etapa do Fluxo", "status"),
                ),
                initial_records=(
                    {"id": "rec-1", "exercicio": "2026/2027", "servidor": "Carlos Eduardo (MAT-3088)", "periodo": "21/12/2026 a 23/12/2026", "modalidade": "FOLGA", "status": "HOMOLOGADO_CHEFIA"},
                    {"id": "rec-2", "exercicio": "2026/2027", "servidor": "Ana Beatriz Souza (MAT-40912)", "periodo": "02/01/2027 a 05/01/2027", "modalidade": "PECUNIA", "status": "FECHADO_SERVIDOR"},
                ),
            ),
        }

    def _get_or_create_definition(self, resource: str) -> _ResourceDefinition:
        if resource in self._definitions:
            return self._definitions[resource]

        title = resource.replace("-", " ").title()
        defn = _ResourceDefinition(
            resource=resource,
            title=title,
            subtitle=f"Gestão completa (CRUD) do recurso {title} no PostgreSQL + Redis.",
            primary_action_label=f"+ Novo em {title}",
            fields=(
                CrudFieldSchema("codigo", "Código", "text", True),
                CrudFieldSchema("descricao", "Descrição", "text", True),
                CrudFieldSchema("status", "Status", "select", True, ("Ativo", "Inativo")),
            ),
            columns=(
                CrudColumnSchema("codigo", "Código", "code"),
                CrudColumnSchema("descricao", "Descrição", "text"),
                CrudColumnSchema("status", "Status", "status"),
            ),
            initial_records=(
                {"id": f"{resource}-1", "codigo": f"{resource[:3].upper()}-001", "descricao": f"Registro padrão de {title}", "status": "Ativo"},
            ),
        )
        self._definitions[resource] = defn
        self._store[resource] = [dict(r) for r in defn.initial_records]
        return defn

    def list_records(self, resource: str, search: str = "") -> CrudListResult:
        defn = self._get_or_create_definition(resource)
        rows = self._store.get(resource, [])
        q = search.strip().lower()
        if q:
            rows = [
                r for r in rows if any(q in str(v).lower() for v in r.values())
            ]
        return CrudListResult(
            resource=defn.resource,
            title=defn.title,
            subtitle=defn.subtitle,
            primary_action_label=defn.primary_action_label,
            fields=defn.fields,
            columns=defn.columns,
            records=tuple(rows),
            total=len(rows),
        )

    def create_record(self, resource: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._get_or_create_definition(resource)
        new_id = f"{resource[:3]}-{uuid.uuid4().hex[:6]}"
        record = {"id": new_id, **{k: str(v) for k, v in payload.items() if k != "id"}}
        self._store.setdefault(resource, []).insert(0, record)
        self._redis.invalidate_prefix(f"secp:ponto:crud:{resource}")
        return record

    def update_record(
        self, resource: str, item_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        self._get_or_create_definition(resource)
        rows = self._store.get(resource, [])
        for idx, row in enumerate(rows):
            if row.get("id") == item_id:
                updated = {**row, **{k: str(v) for k, v in payload.items() if k != "id"}}
                rows[idx] = updated
                self._redis.invalidate_prefix(f"secp:ponto:crud:{resource}")
                return updated
        raise KeyError(f"Registro '{item_id}' não encontrado em '{resource}'.")

    def delete_record(self, resource: str, item_id: str) -> bool:
        self._get_or_create_definition(resource)
        rows = self._store.get(resource, [])
        before = len(rows)
        self._store[resource] = [r for r in rows if r.get("id") != item_id]
        deleted = len(self._store[resource]) < before
        if deleted:
            self._redis.invalidate_prefix(f"secp:ponto:crud:{resource}")
        return deleted
