---
name: skill-rbac-guard-enforcer
description: Padroniza a aplicação de controle de acesso RBAC multi-órgão no FastAPI (Depends) e no Angular (Route Guards e Signals de permissão).
---

# Skill: RBAC Guard Enforcer (`skill-rbac-guard-enforcer`)

Use esta skill para proteger endpoints FastAPI e rotas/componentes Angular usando permissões granulares no formato `<modulo>:<recurso>:<acao>` com escopo por `orgao_id` e `unidade_id`.

## 1. Regra de Ouro de Segurança (Zero Trust UI + API)
- Ocultar um item na Sidebar Secundária ou no Hub de Módulos é apenas ergonomia visual; **todo endpoint no FastAPI deve revalidar a permissão RBAC no Caso de Uso** antes de retornar dados ou executar mutações (prevenção contra BOLA/IDOR).
