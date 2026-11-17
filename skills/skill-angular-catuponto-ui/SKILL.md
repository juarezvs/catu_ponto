---
name: skill-angular-catuponto-ui
description: Diretrizes para construção de interfaces Angular 18+ com Tailwind CSS no padrão visual CatuPonto/SECP (Header de ponta a ponta h-16, Sidebar Primária colapsável w-64/w-20, Sidebar Secundária contextual w-60 e Hub de Módulos em Cards).
---

# Skill: Angular CatuPonto UI (`skill-angular-catuponto-ui`)

Use esta skill ao criar componentes visuais, telas de módulos ou fluxos de navegação no Frontend Angular do **SECP**.

## 1. Regras da Anatomia Shell Layout
1. **Header Global (`h-16 w-full`)**:
   - Sempre fixa de ponta a ponta no topo.
   - Exibe o badge dinâmico com a cor temática do módulo ativo (`#4F46E5`, `#0891B2`, `#059669`, `#D97706`, `#2563EB`, `#DC2626`).
   - Contém obrigatoriamente os botões **"Tela Principal do Módulo"** e **"Trocar de Módulo / Hub"**, seletor de **Órgão/Unidade** e menu do usuário com **Logout**.
2. **Sidebar Primária (`w-64` expandida / `w-20` colapsada)**:
   - Transição suave `transition-all duration-200`.
   - Quando colapsada, oculta os rótulos e mantém os ícones centralizados com `title`/tooltip.
3. **Sidebar Secundária (`w-60`)**:
   - Abre adjacente à Sidebar Primária ao selecionar itens com subitens (ex.: *Cadastros -> Pessoas, Departamentos, Órgãos, Unidades, Cargos, Funções, Feriados, Horários/Escalas*).
   - Permite fixar (Pin) ou recolher (`X`).
