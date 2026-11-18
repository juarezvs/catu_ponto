from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from catuponto.adapters.inbound.http.controllers import router
from secp.modules.secp_identidade.infrastructure.adapters.inbound.http_router import (
    secp_router,
)
from secp.modules.secp_identidade.infrastructure.adapters.inbound.rbac_router import (
    identidade_rbac_router,
)
from secp.modules.secp_ponto.infrastructure.adapters.inbound.http_router import (
    ponto_router,
)
from secp.modules.secp_ponto.infrastructure.adapters.inbound.real_ponto_router import (
    real_ponto_router,
)
from secp.modules.secp_cadastros.infrastructure.adapters.inbound.cadastros_router import (
    cadastros_router,
)
from secp.contexts.compliance_router import compliance_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="SECP • Sistema de Controle e Processos (Padrão CatuPonto)",
        description="Ecossistema Modular em Python FastAPI com Arquitetura Hexagonal (Ports & Adapters), RBAC Multi-Órgão e Copiloto Normativo SRAG.",
        version="2.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)
    app.include_router(secp_router)
    app.include_router(identidade_rbac_router)
    app.include_router(ponto_router)
    app.include_router(real_ponto_router)
    app.include_router(cadastros_router)
    app.include_router(compliance_router)
    return app


app = create_app()
