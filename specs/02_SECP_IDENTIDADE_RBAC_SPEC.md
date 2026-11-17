# SPEC-02: Módulo SECP Identidade — Motor Central RBAC (Baseado no `secp_antigo`)

- **Identificador**: `SPEC-02-SECP-IDENTIDADE-RBAC`
- **Versão**: `1.0.0`
- **Módulo**: `secp-identidade` (Cor Temática: `#4F46E5` • Índigo)
- **Responsabilidade**: Motor central de autenticação, papéis, permissões granulares, overrides por órgão e liberação de rotinas consumido por **todos os módulos do SECP** (`Ponto`, `Folha`, `Férias`, `Contracheque`, `Hora Extra`).

---

## 1. Schemas do `secp_antigo` Identificados para o RBAC

Da análise do `prisma/schema.prisma` legado, o controle de acesso é garantido por **7 tabelas principais**:

1. **`perfis` (`Perfil`)**: Define os papéis (`codigo`, `nome`, `sistema`, `ativo`, `administrativo`, `excecao`, `global`, `orgao_id`).
2. **`permissoes` (`Permissao`)**: Define cada capacidade atômica (`codigo`, `recurso`, `acao`, `escopo`) com unicidade `(recurso, acao, escopo)`.
3. **`perfis_permissoes` (`PerfilPermissao`)**: Matriz base que atribui permissões a um perfil.
4. **`perfis_permissoes_orgaos` (`PerfilPermissaoOrgao`)**: Override seccional por Órgão (`permitida: true | false`), permitindo conceder ou revogar uma permissão apenas em um órgão específico.
5. **`usuarios_perfis` (`UsuarioPerfil`)**: Vincula um `Usuario` a um ou mais `Perfil` em um `Orgao` (ou globalmente quando `orgao_id IS NULL`). Apenas um perfil fica ativo por sessão.
6. **`rotinas_liberacoes` (`LiberacaoRotina`)**: Interruptor global (`liberada: true | false`) por `tipo` e `chave`. Se uma rotina estiver bloqueada aqui, ela é ocultada da UI e bloqueada na API para todos os usuários.
7. **`menus_grupos_perfil` & `menus_itens_perfil`**: Estrutura dinâmica da Sidebar Primária e Sidebar Secundária vinculada ao perfil.

---

## 2. Algoritmo de Resolução de Acesso Efetivo (`RbacPolicyEvaluator`)

Para qualquer requisição `(usuario_id, orgao_id, permissao_codigo, rotina_chave)`:

1. **Bloqueio Global de Rotina (`LiberacaoRotina`)**:
   - Se existir rotina vinculada com `liberada == False` $\rightarrow$ **NEGA (`False`)**.
2. **Vínculo Usuário × Perfil (`UsuarioPerfil`)**:
   - Verifica se o usuário possui perfil ativo (`ativo == True`) para o `orgao_id` ou perfil `global`.
3. **Override Seccional por Órgão (`PerfilPermissaoOrgao`)**:
   - Se houver registro em `perfis_permissoes_orgaos` para `(perfil_id, permissao_id, orgao_id)`:
     - Retorna exatamente `override.permitida` (`True` ou `False`), prevalecendo sobre a matriz base!
4. **Matriz Base (`PerfilPermissao`)**:
   - Caso não haja override para o órgão, verifica se `(perfil_id, permissao_id)` existe em `perfis_permissoes`.
5. **Cache Distribuído (Redis)**:
   - Permissões efetivas são cacheadas em Redis (`secp:rbac:effective:{user_id}:{orgao_id}`) e invalidadas automaticamente sempre que o administrador altera qualquer Perfil, Permissão, Override ou Liberação de Rotina no **SECP Identidade**.
