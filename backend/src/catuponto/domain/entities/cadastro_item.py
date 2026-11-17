from dataclasses import dataclass, field


@dataclass(frozen=True)
class CadastroColumn:
    key: str
    label: str
    type: str = "text"  # 'text' | 'badge' | 'code' | 'status'


@dataclass(frozen=True)
class CadastroMetric:
    label: str
    value: str
    trend: str


@dataclass(frozen=True)
class CadastroModuleData:
    """Entidade de domínio representando o conteúdo de uma página de cadastro ou módulo do CatuPonto."""

    slug: str
    title: str
    subtitle: str
    category: str
    primary_action_label: str
    required_permission: str
    metrics: tuple[CadastroMetric, ...] = field(default_factory=tuple)
    columns: tuple[CadastroColumn, ...] = field(default_factory=tuple)
    records: tuple[dict[str, str], ...] = field(default_factory=tuple)
