# SPEC-01: Módulo SECP Ponto (Inspirado no SECP Legado + Portaria SJAM-DIREF 135/2025)

- **Identificador**: `SPEC-01-SECP-PONTO`
- **Versão**: `1.0.0`
- **Módulo**: `secp-ponto` (Cor Temática: `#0891B2` • Azul Petróleo/Ciano)
- **Origem Normativa e de Dados**: Baseado nos schemas Prisma (`jornadas`, `marcacoes_brutas`, `marcacoes`, `apuracoes_diarias`, `banco_horas_saldos`, `banco_horas_movimentos`, `homologacoes_servidores_meses`, `boletins_frequencia`, `recessos_forenses`) e nas especificações UI/UX do sistema legado `secp_antigo`.

---

## 1. Regras de Negócio Nucleares (Domínio Puro)

1. **Classificação Dinâmica de Marcações (`RN-PONTO-01`)**:
   - O sistema nunca confia em rótulo manual prévio para a sequência ordinária; a ordem cronológica das marcações válidas do dia define dinamicamente:
     1. 1ª marcação $\rightarrow$ `ENTRADA`
     2. 2ª marcação $\rightarrow$ `SAIDA_INTERVALO` (ou `SAIDA` se jornada ininterrupta de 7h sem retorno)
     3. 3ª marcação $\rightarrow$ `RETORNO_INTERVALO`
     4. 4ª marcação $\rightarrow$ `SAIDA`
2. **Imutabilidade do Dado Bruto (`RN-PONTO-02`)**:
   - Toda batida (Biometria Facial, Web, Coletor REP/AFD) grava primeiro um registro imutável em `marcacoes_brutas` (com hash SHA-256) e só então origina uma `marcacao` calculada. Dados brutos jamais são editados ou excluídos.
3. **Jornada e Expediente (`RN-PONTO-03`)**:
   - Padrão de **7h ininterruptas** (`420 min`) ou **8h com intervalo de 1h a 3h** (`480 min`).
   - Expediente institucional: `08h às 18h` (excepcional `06h às 19h`).
4. **Banco de Horas e Teto de 16h Mensais (`RN-PONTO-04`)**:
   - Limite ordinário de **16h mensais (`960 min`)** de crédito para fruição futura.
   - Horas-crédito excedentes ao limite sem autorização excepcional são segregadas em `horas_acima_limite_minutos`.
   - Prazo de compensação de créditos e débitos: **até 3 meses**.
5. **Homologação Mensal e Boletim (`RN-PONTO-05`)**:
   - Chefia homologa a frequência mensal até o **2º dia útil** do mês subsequente.
   - Boletim de Frequência consolidado deve ser encaminhado até o **dia 10** de cada mês.
   - **Recesso Forense (`20/12 a 06/01`)**: Domínio separado; dias sem convocação são exibidos como `RECESSO_FORENSE`, nunca como falta.

---

## 2. Experiência Intuitiva de Interface (UX Herdada do `secp_antigo`)

1. **Dashboard do Servidor (Primeira Dobra)**:
   - **Card de Próxima Ação**: Indica claramente o próximo passo do servidor (*"Registrar Entrada (Biometria Facial)"*, *"Registrar Saída para Intervalo"*, *"Registrar Retorno"*, *"Registrar Saída Final"* ou *"Jornada do Dia Concluída"*).
   - **Timeline do Dia (4 posições)**: Entrada $\rightarrow$ Saída Intervalo $\rightarrow$ Retorno Intervalo $\rightarrow$ Saída Final.
   - **Fluxo de Registro Web/Facial**: Na 1ª marcação do dia, exibe painel simulado/preparado de **Reconhecimento Facial** ("Centralize seu rosto no círculo • Mantenha boa iluminação") e gera **Comprovante Digital com Hash SHA-256**.
2. **Espelho de Ponto Mensal**:
   - Colunas: Data, Jornada Prevista, Marcações, Trabalhado, Crédito, Débito, Situação (`Regular`, `Pendente de ajuste`, `Recesso forense`, `Feriado`, `Homologado`).
3. **Banco de Horas**:
   - KPIs de Saldo Atual, Créditos no Mês (com medidor do teto de `16h`), Débitos no Mês, Créditos a Vencer (`3 meses`) e Extrato cronológico.
4. **Homologação pela Chefia**:
   - Fila priorizada: `Críticos` $\rightarrow$ `Pendentes` $\rightarrow$ `Regulares` $\rightarrow$ `Homologados`, com destaque para o prazo do **2º dia útil** e ação direta de homologação.
