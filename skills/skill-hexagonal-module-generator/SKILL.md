---
name: skill-hexagonal-module-generator
description: Padrão arquitetural e gerador passo a passo para criar novos módulos do ecossistema SECP (Python/FastAPI e Angular) respeitando estritamente Arquitetura Hexagonal (Ports & Adapters), SOLID e Spec-Driven Development (SDD).
---

# Skill: Hexagonal Module Generator (`skill-hexagonal-module-generator`)

Use esta skill sempre que precisar criar ou expandir um módulo do ecossistema **SECP** (`secp_identidade`, `secp_ponto`, `secp_folha`, `secp_ferias`, `secp_contracheque`, `secp_hora_extra`) tanto no **Backend (Python 3.12+ / FastAPI)** quanto no **Frontend (Angular 18+ / Tailwind CSS)**.

---

## 1. Regras Arquiteturais Inegociáveis (Guardrails)

1. **Regra da Dependência Concêntrica**:
   - `domain` **NUNCA** importa nada de `application`, `adapters` ou `infrastructure`.
   - `domain` **PROÍBE** imports de `fastapi`, `sqlalchemy`, `pydantic`, `redis`, `httpx` ou `@angular/common/http`.
   - `application` importa apenas `domain` e define **Ports** (`InputPorts` e `OutputPorts` via `typing.Protocol` no Python e `InjectionToken<Interface>` no Angular).
   - `infrastructure` / `adapters` implementam as `OutputPorts` (Repositórios SQLAlchemy, Gateways HTTP, Cache Redis, Vector Store `pgvector`) e consomem as `InputPorts` (Routers FastAPI, Componentes Standalone Angular).
2. **Princípios SOLID Obrigatórios**:
   - **S (SRP)**: Cada Caso de Uso (`UseCase`) possui um único método público `execute()` e uma única razão de mudança.
   - **O (OCP)**: Novos módulos e regras de validação são adicionados registrando estratégias/adaptadores sem alterar casos de uso existentes.
   - **L (LSP)**: Qualquer `InMemoryRepositoryAdapter` (para testes unitários) e `SqlAlchemyRepositoryAdapter` (produção) devem ser 100% intercambiáveis no contrato da `OutputPort`.
   - **I (ISP)**: Segregue portas de leitura (`QueryPort`) e escrita (`CommandPort`) sempre que um consumidor não precisar de ambas.
   - **D (DIP)**: Routers FastAPI e Componentes Angular injetam exclusivamente abstrações (`Depends(get_use_case_port)` / `inject(USE_CASE_TOKEN)`).

---

## 2. Anatomia de um Módulo Hexagonal no Backend Python

Para cada módulo `<modulo_name>` (ex: `secp_identidade`), estruture:

```text
backend/src/secp/modules/<modulo_name>/
├── domain/
│   ├── entities/          # Dataclasses imutáveis (@dataclass(frozen=True))
│   ├── value_objects/     # Objetos de valor validados na construção (CPF, EscopoRBAC, RubricaCodigo)
│   ├── services/          # Regras de negócio puras entre múltiplas entidades
│   └── exceptions.py      # Exceções específicas de domínio
├── application/
│   ├── dtos/              # Objetos de transferência da camada de aplicação
│   ├── ports/
│   │   ├── input_ports.py # Protocols dos Casos de Uso (Driving Ports)
│   │   └── output_ports.py# Protocols de Repositórios/Gateways (Driven Ports)
│   └── use_cases/         # Implementações concretas das InputPorts
└── infrastructure/
    ├── adapters/
    │   ├── inbound/
    │   │   └── http_router.py                # FastAPI APIRouter + Pydantic Schemas
    │   └── outbound/
    │       ├── postgres_repository.py        # Repositório SQLAlchemy 2.0 + PostgreSQL (pgvector)
    │       ├── redis_cache_decorator.py      # Decorator Redis para cache RBAC/consultas (TTL)
    │       └── fake_repository.py            # Fake determinístico exclusivo para testes unitários
    └── di_container.py                       # Wiring de dependências (Postgres + Redis -> UseCases)
```

---

## 3. Template de Código Padrão (Backend Python)

### 3.1 Entidade e Value Object (`domain/entities/`)
```python
from dataclasses import dataclass, field


@dataclass(frozen=True)
class PermissionAtom:
    """Value Object imutável no formato <modulo>:<recurso>:<acao>."""
    module_slug: str
    resource: str
    action: str

    def __post_init__(self) -> None:
        if not self.module_slug or not self.resource or not self.action:
            raise ValueError("Permissão inválida: módulo, recurso e ação são obrigatórios.")

    @property
    def code(self) -> str:
        return f"{self.module_slug}:{self.resource}:{self.action}"
```

### 3.2 Output Port & Input Port (`application/ports/`)
```python
from typing import Protocol, Sequence
from secp.modules.secp_identidade.domain.entities.identity_models import (
    OrgaoScope,
    SecpModuleDescriptor,
    UserIdentity,
)


class IdentityRepositoryOutputPort(Protocol):
    """Driven Port para consulta de identidades, órgãos e catálogo de módulos."""
    def find_user_by_id(self, user_id: str) -> UserIdentity | None: ...
    def list_orgaos_for_user(self, user_id: str) -> Sequence[OrgaoScope]: ...
    def list_all_modules(self) -> Sequence[SecpModuleDescriptor]: ...


class AuthorizeHubModulesInputPort(Protocol):
    """Driving Port para retornar apenas os módulos do Hub autorizados pelo RBAC."""
    def execute(self, user_id: str, orgao_id: str) -> Sequence[SecpModuleDescriptor]: ...
```

### 3.3 Use Case (`application/use_cases/`)
```python
from typing import Sequence
from secp.modules.secp_identidade.application.ports.input_ports import AuthorizeHubModulesInputPort
from secp.modules.secp_identidade.application.ports.output_ports import IdentityRepositoryOutputPort
from secp.modules.secp_identidade.domain.entities.identity_models import SecpModuleDescriptor
from secp.domain.exceptions import EntityNotFoundException


class AuthorizeHubModulesUseCase(AuthorizeHubModulesInputPort):
    def __init__(self, identity_repo: IdentityRepositoryOutputPort) -> None:
        self._identity_repo = identity_repo

    def execute(self, user_id: str, orgao_id: str) -> Sequence[SecpModuleDescriptor]:
        user = self._identity_repo.find_user_by_id(user_id)
        if user is None:
            raise EntityNotFoundException(f"Usuário '{user_id}' não localizado.")
        all_modules = self._identity_repo.list_all_modules()
        return tuple(
            mod for mod in all_modules
            if user.can_access_module(mod.slug, orgao_id=orgao_id)
        )
```

---

## 4. Checklist de Verificação Pós-Geração

Antes de concluir a criação de qualquer módulo usando esta skill, verifique:
- [ ] Existe especificação formal correspondente em `/specs`?
- [ ] A camada `domain/` possui zero imports de frameworks externos?
- [ ] Os Casos de Uso em `application/use_cases/` recebem apenas `OutputPorts` via construtor (`__init__`)?
- [ ] O módulo possui testes unitários isolados em `backend/tests/unit/` injetando `Fake`/`InMemory` Adapters nas `OutputPorts`?
- [ ] As cores temáticas e tokens do módulo no Frontend respeitam a tabela oficial da `specs/00_PLATFORM_CORE_SPEC.md`?
