from datetime import date, datetime
from typing import Optional
import uuid
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from secp.infrastructure.database.postgres_session import SecpDeclarativeBase


class JornadaORM(SecpDeclarativeBase):
    """Espelha `jornadas` do schema.prisma (7h ininterruptas ou 8h com intervalo)."""

    __tablename__ = "jornadas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    tipo_jornada: Mapped[str] = mapped_column(String(40), nullable=False)
    carga_diaria_minutos: Mapped[int] = mapped_column(Integer, nullable=False)
    intervalo_minimo_minutos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    intervalo_maximo_minutos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tolerancia_minutos: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("idx_jornadas_tipo_ativo", "tipo_jornada", "ativo"),
    )


class DepartamentoORM(SecpDeclarativeBase):
    """Setores e coordenações vinculadas a um Órgão/Unidade."""

    __tablename__ = "secp_departamentos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(180), nullable=False)
    orgao_sigla: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    gestor_nome: Mapped[str] = mapped_column(String(160), nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class CargoORM(SecpDeclarativeBase):
    """Espelha `cargos` do schema.prisma."""

    __tablename__ = "secp_cargos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    cbo: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    regime: Mapped[str] = mapped_column(String(40), nullable=False)  # ESTATUTARIO | CLT | COMISSIONADO
    carga_semanal: Mapped[int] = mapped_column(Integer, default=35, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class FuncaoConfiancaORM(SecpDeclarativeBase):
    """Espelha `funcoes_confianca_referencias` do schema.prisma."""

    __tablename__ = "secp_funcoes_confianca"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(180), nullable=False)
    regra_ponto: Mapped[str] = mapped_column(String(80), nullable=False)
    dispensa_ponto: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ServidorORM(SecpDeclarativeBase):
    """Espelha `servidores` do schema.prisma com índices compostos para apuração e lotação."""

    __tablename__ = "secp_servidores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    matricula: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    cargo: Mapped[str] = mapped_column(String(140), nullable=False)
    departamento: Mapped[str] = mapped_column(String(160), nullable=False)
    orgao_sigla: Mapped[str] = mapped_column(String(32), nullable=False)
    jornada_codigo: Mapped[str] = mapped_column(String(40), default="JOR-7H", nullable=False)
    dispensa_ponto: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="Ativo", nullable=False)

    __table_args__ = (
        Index("idx_servidores_orgao_status", "orgao_sigla", "status"),
        Index("idx_servidores_nome", "nome"),
    )


class CalendarioInstitucionalORM(SecpDeclarativeBase):
    """Espelha `calendarios_institucionais` (Feriados, Pontos Facultativos e Suspensões)."""

    __tablename__ = "secp_calendario_institucional"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    data_evento: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    descricao: Mapped[str] = mapped_column(String(200), nullable=False)
    tipo: Mapped[str] = mapped_column(String(48), nullable=False)  # FERIADO | PONTO_FACULTATIVO | SUSPENSAO_EXPEDIENTE
    abrangencia: Mapped[str] = mapped_column(String(32), nullable=False)  # NACIONAL | ESTADUAL | MUNICIPAL | ORGAO
    efeito_escalas: Mapped[str] = mapped_column(String(200), nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("idx_calendario_data_abrangencia", "data_evento", "abrangencia"),
    )


class EquipamentoBiometricoORM(SecpDeclarativeBase):
    """Espelha `equipamentos_biometricos` (REPs Faciais, Biométricos e Coletores AFD)."""

    __tablename__ = "secp_equipamentos_biometricos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    modelo: Mapped[str] = mapped_column(String(80), nullable=False)
    ip_endereco: Mapped[str] = mapped_column(String(64), nullable=False)
    unidade_nome: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="Online", nullable=False)


class SolicitacaoPontoORM(SecpDeclarativeBase):
    """Espelha `solicitacoes` do schema.prisma (Ajustes, Abonos, Justificativas)."""

    __tablename__ = "secp_solicitacoes_ponto"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    protocolo: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    servidor_nome: Mapped[str] = mapped_column(String(160), nullable=False)
    tipo: Mapped[str] = mapped_column(String(64), nullable=False)  # AJUSTE_BATIDA | ABONO_CAPACITACAO | JUSTIFICATIVA_ATRASO
    data_referencia: Mapped[str] = mapped_column(String(16), nullable=False)
    motivo: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="Pendente Chefia", nullable=False)

    __table_args__ = (
        Index("idx_solicitacoes_status_data", "status", "data_referencia"),
    )


class OcorrenciaFrequenciaORM(SecpDeclarativeBase):
    """Espelha `ocorrencias_frequencia` do schema.prisma."""

    __tablename__ = "ocorrencias_frequencia"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    servidor_nome: Mapped[str] = mapped_column(String(160), nullable=False)
    data_referencia: Mapped[str] = mapped_column(String(16), nullable=False)
    tipo: Mapped[str] = mapped_column(String(48), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    minutos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="Pendente", nullable=False)


class RecessoForenseORM(SecpDeclarativeBase):
    """Espelha `recessos_forenses` (domínio separado 20/12 a 06/01)."""

    __tablename__ = "recessos_forenses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ano_exercicio: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    periodo: Mapped[str] = mapped_column(String(64), nullable=False)
    servidor_convocado: Mapped[str] = mapped_column(String(160), nullable=False)
    modalidade_compensacao: Mapped[str] = mapped_column(String(32), nullable=False)  # FOLGA | PECUNIA
    status: Mapped[str] = mapped_column(String(32), default="Ativo", nullable=False)


class MarcacaoBrutaORM(SecpDeclarativeBase):
    """Tabela imutável `marcacoes_brutas` (AFD / REP / Biometria Facial / Web)."""

    __tablename__ = "marcacoes_brutas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    data_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fonte: Mapped[str] = mapped_column(String(40), nullable=False)
    hash_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    ip: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    metadados: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_marcacoes_brutas_hash", "hash_sha256"),
        Index("idx_marcacoes_brutas_usuario_hora", "usuario_id", "data_hora"),
    )


class MarcacaoORM(SecpDeclarativeBase):
    """Espelha `marcacoes` com classificação dinâmica sequencial do dia."""

    __tablename__ = "marcacoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    marcacao_bruta_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("marcacoes_brutas.id", ondelete="RESTRICT"), nullable=True
    )
    data_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    data_referencia: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    fuso_horario: Mapped[str] = mapped_column(String(80), default="America/Manaus", nullable=False)
    tipo: Mapped[str] = mapped_column(String(32), nullable=False)
    fonte: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="VALIDA", nullable=False)
    observacao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_marcacoes_usuario_data_status", "usuario_id", "data_referencia", "status", "data_hora"),
    )


class ApuracaoDiariaORM(SecpDeclarativeBase):
    """Espelha `apuracoes_diarias` com consolidado diário e 4 posições da timeline."""

    __tablename__ = "apuracoes_diarias"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    data_referencia: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    carga_prevista_minutos: Mapped[int] = mapped_column(Integer, default=420, nullable=False)
    minutos_trabalhados: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    minutos_intervalo: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    minutos_credito: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    minutos_debito: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    resultado: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="CALCULADA", nullable=False)
    primeira_entrada: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    saida_intervalo: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    retorno_intervalo: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    ultima_saida: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    observacao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("usuario_id", "data_referencia", name="uq_apuracao_usuario_data"),
        Index("idx_apuracoes_resultado_data", "resultado", "data_referencia"),
    )


class BancoHorasSaldoORM(SecpDeclarativeBase):
    """Espelha `banco_horas_saldos` com segregação de teto 16h/mês e horas não autorizadas."""

    __tablename__ = "banco_horas_saldos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    saldo_minutos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    creditos_mes_minutos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    debitos_mes_minutos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    creditos_a_vencer_minutos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    horas_acima_limite_minutos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    horas_nao_autorizadas_minutos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MovimentoBancoHorasORM(SecpDeclarativeBase):
    """Espelha `banco_horas_movimentos` com prazo de compensação de 3 meses."""

    __tablename__ = "banco_horas_movimentos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    data_referencia: Mapped[date] = mapped_column(Date, nullable=False)
    minutos: Mapped[int] = mapped_column(Integer, nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    expira_em: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    __table_args__ = (
        Index("idx_bh_mov_usuario_status_data", "usuario_id", "status", "data_referencia"),
    )


class HomologacaoServidorMesORM(SecpDeclarativeBase):
    """Espelha `homologacoes_servidores_meses` para fluxo de decisão da chefia até o 2º dia útil."""

    __tablename__ = "homologacoes_servidores_meses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    servidor_nome: Mapped[str] = mapped_column(String(160), nullable=False)
    matricula: Mapped[str] = mapped_column(String(32), nullable=False)
    unidade: Mapped[str] = mapped_column(String(120), nullable=False)
    ano_referencia: Mapped[int] = mapped_column(Integer, nullable=False)
    mes_referencia: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    carga_prevista_minutos: Mapped[int] = mapped_column(Integer, nullable=False)
    minutos_trabalhados: Mapped[int] = mapped_column(Integer, nullable=False)
    minutos_credito: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    minutos_debito: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    faltas: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pendencias_resumo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    homologado_por: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    homologado_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("usuario_id", "ano_referencia", "mes_referencia", name="uq_homologacao_mes"),
        Index("idx_homologacao_competencia_status", "ano_referencia", "mes_referencia", "status"),
    )
