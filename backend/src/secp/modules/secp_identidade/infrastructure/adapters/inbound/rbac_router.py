from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from secp.modules.secp_identidade.application.ports.rbac_ports import (
    RbacManagementInputPort,
)
from secp.modules.secp_identidade.infrastructure.di_container import (
    get_rbac_management_use_case,
)

identidade_rbac_router = APIRouter(
    prefix="/api/v1/secp/identidade/rbac", tags=["SECP Identidade • RBAC Central"]
)


class PerfilDTO(BaseModel):
    id: str
    codigo: str
    nome: str
    descricao: str
    sistema: bool
    ativo: bool
    administrativo: bool
    globalScope: bool
    orgaoId: Optional[str] = None
    permissoesCodigos: list[str]


class PermissaoDTO(BaseModel):
    id: str
    codigo: str
    recurso: str
    acao: str
    escopo: str
    descricao: str


class OrgaoOverrideDTO(BaseModel):
    perfilId: str
    permissaoCodigo: str
    orgaoId: str
    permitida: bool


class UsuarioPerfilDTO(BaseModel):
    id: str
    usuarioId: str
    usuarioNome: str
    perfilId: str
    perfilCodigo: str
    perfilNome: str
    orgaoId: Optional[str] = None
    ativo: bool


class LiberacaoRotinaDTO(BaseModel):
    id: str
    tipo: str
    chave: str
    descricao: str
    liberada: bool


class RbacMatrixResponseDTO(BaseModel):
    perfis: list[PerfilDTO]
    permissoes: list[PermissaoDTO]
    orgaoOverrides: list[OrgaoOverrideDTO]
    usuariosPerfis: list[UsuarioPerfilDTO]
    rotinas: list[LiberacaoRotinaDTO]


class CreatePerfilRequestDTO(BaseModel):
    codigo: str
    nome: str
    descricao: str = ""
    administrativo: bool = False
    globalScope: bool = True


class TogglePerfilPermissaoDTO(BaseModel):
    permissao_codigo: str


class SetOrgaoOverrideDTO(BaseModel):
    orgao_id: str
    permissao_codigo: str
    permitida: Optional[bool] = None


class AssignUsuarioPerfilDTO(BaseModel):
    usuario_id: str
    perfil_id: str
    orgao_id: Optional[str] = None


@identidade_rbac_router.get("/matrix", response_model=RbacMatrixResponseDTO)
def get_rbac_matrix(
    use_case: RbacManagementInputPort = Depends(get_rbac_management_use_case),
) -> RbacMatrixResponseDTO:
    snap = use_case.get_full_matrix()
    return RbacMatrixResponseDTO(
        perfis=[
            PerfilDTO(
                id=p.id,
                codigo=p.codigo,
                nome=p.nome,
                descricao=p.descricao,
                sistema=p.sistema,
                ativo=p.ativo,
                administrativo=p.administrativo,
                globalScope=p.global_scope,
                orgaoId=p.orgao_id,
                permissoesCodigos=sorted(p.permissoes_codigos),
            )
            for p in snap.perfis
        ],
        permissoes=[
            PermissaoDTO(
                id=pm.id,
                codigo=pm.codigo,
                recurso=pm.recurso,
                acao=pm.acao,
                escopo=pm.escopo,
                descricao=pm.descricao,
            )
            for pm in snap.permissoes
        ],
        orgaoOverrides=[
            OrgaoOverrideDTO(
                perfilId=ov.perfil_id,
                permissaoCodigo=ov.permissao_codigo,
                orgaoId=ov.orgao_id,
                permitida=ov.permitida,
            )
            for ov in snap.orgao_overrides
        ],
        usuariosPerfis=[
            UsuarioPerfilDTO(
                id=up.id,
                usuarioId=up.usuario_id,
                usuarioNome=up.usuario_nome,
                perfilId=up.perfil_id,
                perfilCodigo=up.perfil_codigo,
                perfilNome=up.perfil_nome,
                orgaoId=up.orgao_id,
                ativo=up.ativo,
            )
            for up in snap.usuarios_perfis
        ],
        rotinas=[
            LiberacaoRotinaDTO(
                id=r.id,
                tipo=r.tipo,
                chave=r.chave,
                descricao=r.descricao,
                liberada=r.liberada,
            )
            for r in snap.rotinas
        ],
    )


@identidade_rbac_router.post("/perfis", response_model=PerfilDTO)
def create_perfil(
    payload: CreatePerfilRequestDTO,
    use_case: RbacManagementInputPort = Depends(get_rbac_management_use_case),
) -> PerfilDTO:
    p = use_case.create_perfil(
        codigo=payload.codigo,
        nome=payload.nome,
        descricao=payload.descricao,
        administrativo=payload.administrativo,
        global_scope=payload.globalScope,
    )
    return PerfilDTO(
        id=p.id,
        codigo=p.codigo,
        nome=p.nome,
        descricao=p.descricao,
        sistema=p.sistema,
        ativo=p.ativo,
        administrativo=p.administrativo,
        globalScope=p.global_scope,
        orgaoId=p.orgao_id,
        permissoesCodigos=sorted(p.permissoes_codigos),
    )


@identidade_rbac_router.delete("/perfis/{perfil_id}")
def delete_perfil(
    perfil_id: str,
    use_case: RbacManagementInputPort = Depends(get_rbac_management_use_case),
) -> dict[str, bool]:
    deleted = use_case.delete_perfil(perfil_id)
    if not deleted:
        raise HTTPException(
            status_code=400,
            detail="Perfis de sistema protegidos não podem ser excluídos ou perfil não encontrado.",
        )
    return {"deleted": True}


@identidade_rbac_router.post("/perfis/{perfil_id}/permissoes/toggle", response_model=PerfilDTO)
def toggle_perfil_permissao(
    perfil_id: str,
    payload: TogglePerfilPermissaoDTO,
    use_case: RbacManagementInputPort = Depends(get_rbac_management_use_case),
) -> PerfilDTO:
    p = use_case.toggle_perfil_permissao(perfil_id, payload.permissao_codigo)
    return PerfilDTO(
        id=p.id,
        codigo=p.codigo,
        nome=p.nome,
        descricao=p.descricao,
        sistema=p.sistema,
        ativo=p.ativo,
        administrativo=p.administrativo,
        globalScope=p.global_scope,
        orgaoId=p.orgao_id,
        permissoesCodigos=sorted(p.permissoes_codigos),
    )


@identidade_rbac_router.post("/perfis/{perfil_id}/overrides")
def set_orgao_override(
    perfil_id: str,
    payload: SetOrgaoOverrideDTO,
    use_case: RbacManagementInputPort = Depends(get_rbac_management_use_case),
) -> dict[str, str]:
    use_case.set_orgao_override(
        perfil_id=perfil_id,
        orgao_id=payload.orgao_id,
        permissao_codigo=payload.permissao_codigo,
        permitida=payload.permitida,
    )
    return {"status": "updated"}


@identidade_rbac_router.post("/usuarios-perfis", response_model=UsuarioPerfilDTO)
def assign_usuario_perfil(
    payload: AssignUsuarioPerfilDTO,
    use_case: RbacManagementInputPort = Depends(get_rbac_management_use_case),
) -> UsuarioPerfilDTO:
    up = use_case.assign_usuario_perfil(
        usuario_id=payload.usuario_id,
        perfil_id=payload.perfil_id,
        orgao_id=payload.orgao_id,
    )
    return UsuarioPerfilDTO(
        id=up.id,
        usuarioId=up.usuario_id,
        usuarioNome=up.usuario_nome,
        perfilId=up.perfil_id,
        perfilCodigo=up.perfil_codigo,
        perfilNome=up.perfil_nome,
        orgaoId=up.orgao_id,
        ativo=up.ativo,
    )


@identidade_rbac_router.delete("/usuarios-perfis/{vinculo_id}")
def remove_usuario_perfil(
    vinculo_id: str,
    use_case: RbacManagementInputPort = Depends(get_rbac_management_use_case),
) -> dict[str, bool]:
    deleted = use_case.remove_usuario_perfil(vinculo_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado.")
    return {"deleted": True}


@identidade_rbac_router.post("/rotinas/{rotina_id}/toggle", response_model=LiberacaoRotinaDTO)
def toggle_rotina(
    rotina_id: str,
    use_case: RbacManagementInputPort = Depends(get_rbac_management_use_case),
) -> LiberacaoRotinaDTO:
    r = use_case.toggle_rotina(rotina_id)
    return LiberacaoRotinaDTO(
        id=r.id,
        tipo=r.tipo,
        chave=r.chave,
        descricao=r.descricao,
        liberada=r.liberada,
    )


@identidade_rbac_router.get("/authorize")
def authorize_permission(
    user_id: str = Query(...),
    orgao_id: str = Query(default="semad"),
    permission: str = Query(...),
    use_case: RbacManagementInputPort = Depends(get_rbac_management_use_case),
) -> dict[str, object]:
    allowed = use_case.check_authorization(
        user_id=user_id, orgao_id=orgao_id, permission_code=permission
    )
    return {
        "user_id": user_id,
        "orgao_id": orgao_id,
        "permission": permission,
        "allowed": allowed,
    }
