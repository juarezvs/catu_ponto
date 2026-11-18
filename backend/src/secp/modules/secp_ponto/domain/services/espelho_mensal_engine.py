import calendar
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

DIAS_SEMANA_PT = (
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo",
)


@dataclass(frozen=True)
class RegraOrgaoMes:
    carga_diaria_padrao_min: int = 420
    intervalo_minimo_8h_min: int = 60
    limite_credito_mensal_min: int = 960
    exige_autorizacao_previa: bool = True
    percentual_sabado: int = 50
    percentual_domingo_feriado: int = 100
    percentual_recesso: int = 100


@dataclass(frozen=True)
class EventoCalendarioInput:
    data_iso: str
    tipo: str  # FERIADO | PONTO_FACULTATIVO | SUSPENSAO | RECESSO
    descricao: str
    parcial_minutos: int | None = None


@dataclass(frozen=True)
class AfastamentoSarhInput:
    data_inicio: date
    data_fim: date
    categoria: str  # FERIAS | LICENCA | VIAGEM | TELETRABALHO | DISPENSA | ABONO | COMPENSACAO | ATIVIDADE_EXTERNA
    situacao: str   # MARCADA | GOZADA | CANCELADA | SUSPENSA | ADIADA | INTERROMPIDA | ATIVA
    descricao: str
    minutos_parciais: int | None = None
    exige_frequencia_manual: bool = False


@dataclass(frozen=True)
class ApuracaoPersistidaInput:
    id: str
    data_iso: str
    carga_prevista_minutos: int
    minutos_trabalhados: int
    minutos_intervalo: int
    minutos_credito: int
    minutos_debito: int
    resultado: str
    status: str
    observacao: str | None = None
    excedente_autorizado_minutos: int = 0
    excedente_pendente_minutos: int = 0
    compensado_minutos: int = 0


def _parse_hhmm_to_minutes(hhmm: str) -> int:
    parts = hhmm.split(":")
    h = int(parts[0])
    m = int(parts[1]) if len(parts) > 1 else 0
    return h * 60 + m


def calcular_minutos_por_marcacoes(
    marcacoes: list[dict[str, Any]],
    carga_prevista_min: int,
    intervalo_minimo_min: int = 60,
    limite_virada_madrugada_min: int = 240,  # 04:00
) -> tuple[int, int, bool, bool]:
    """
    Calcula (trabalhado_min, intervalo_min, intervalo_inferido, incompleta) a partir
    das marcações ordenadas do dia, tratando virada após meia-noite e intervalo inferido.
    """
    if not marcacoes:
        return 0, 0, False, False

    tempos: list[int] = []
    for idx, m in enumerate(marcacoes):
        t = _parse_hhmm_to_minutes(m["horario"])
        # Se saída após a meia-noite (ex: 01:30 depois de entrada 19:00), soma 24h
        if idx > 0 and t < tempos[-1] and t <= limite_virada_madrugada_min:
            t += 1440
        elif idx > 0 and t < tempos[-1]:
            t += 1440
        tempos.append(t)

    if len(tempos) % 2 == 1:
        # Dia em andamento ou incompleto: pares fechados + parcial aberto? Retorna pares fechados
        trab_parcial = 0
        for i in range(0, len(tempos) - 1, 2):
            trab_parcial += max(0, tempos[i + 1] - tempos[i])
        return trab_parcial, 0, False, True

    trab = 0
    intervalo = 0
    intervalo_inferido = False
    for i in range(0, len(tempos), 2):
        trab += max(0, tempos[i + 1] - tempos[i])
        if i + 2 < len(tempos):
            intervalo += max(0, tempos[i + 2] - tempos[i + 1])

    # Dedução automática de intervalo mínimo quando jornada > 7h (ex: 8h), há apenas 2 batidas
    # e a amplitude comporta carga + intervalo mínimo
    if (
        len(tempos) == 2
        and carga_prevista_min >= 480
        and intervalo == 0
        and trab >= carga_prevista_min + intervalo_minimo_min
    ):
        intervalo = intervalo_minimo_min
        trab -= intervalo_minimo_min
        intervalo_inferido = True

    return trab, intervalo, intervalo_inferido, False


def montar_espelho_mensal_completo(
    *,
    ano: int,
    mes: int,
    hoje_referencia: date,
    regra: RegraOrgaoMes,
    marc_by_day: dict[str, list[dict[str, Any]]],
    ap_by_day: dict[str, ApuracaoPersistidaInput],
    calendario_by_day: dict[str, EventoCalendarioInput] | None = None,
    afastamentos: list[AfastamentoSarhInput] | None = None,
    solicitacoes_mes: list[dict[str, Any]] | None = None,
    sem_jornada_vigente: bool = False,
    status_competencia: str = "ABERTA",
    status_competencia_label: str = "Em andamento",
    unidade_label: str = "",
    chefia_nome: str = "",
) -> dict[str, Any]:
    cal_map = calendario_by_day or {}
    afast_list = afastamentos or []
    sol_list = solicitacoes_mes or []
    _, num_days = calendar.monthrange(ano, mes)

    dias: list[dict[str, Any]] = []
    ocorrencias: list[dict[str, Any]] = []

    total_prev = 0
    total_trab = 0
    total_cred = 0
    total_deb = 0
    total_exc_aut = 0
    total_exc_pend = 0
    inconsistencias = 0
    dias_com_jornada = 0

    # Acumuladores para as 9 categorias de Totais por tipo
    cat_regs = {
        "ATIVIDADES_EXTERNAS": [0, 0],
        "AUSENCIAS": [0, 0],
        "BANCO_HORAS": [0, 0],
        "CREDITO": [0, 0],
        "DEBITO": [0, 0],
        "EXTRAS_AUTORIZADAS": [0, 0],
        "EXTRAS_NAO_AUTORIZADAS": [0, 0],
        "JORNADA_REGULAR": [0, 0],
        "VIAGENS": [0, 0],
    }

    for day_num in range(1, num_days + 1):
        dt = date(ano, mes, day_num)
        d_iso = dt.isoformat()
        is_weekend = dt.weekday() >= 5
        is_today = dt == hoje_referencia
        is_future = dt > hoje_referencia
        contabilizavel = dt < hoje_referencia

        marcacoes_dia = marc_by_day.get(d_iso, [])
        ap = ap_by_day.get(d_iso)
        cal_ev = cal_map.get(d_iso)

        # Verifica afastamentos SARH vigentes neste dia
        # Férias MARCADA/GOZADA prevalecem sobre dispensa administrativa; CANCELADA/SUSPENSA/etc. ficam sem efeito
        ferias_validas = None
        outro_afast = None
        for af in afast_list:
            if af.data_inicio <= dt <= af.data_fim:
                sit = af.situacao.upper()
                cat = af.categoria.upper()
                if cat == "FERIAS":
                    if sit in ("MARCADA", "GOZADA", "ATIVA"):
                        ferias_validas = af
                elif sit in ("MARCADA", "GOZADA", "ATIVA", "DEFERIDA"):
                    outro_afast = af

        evento_institucional: str | None = None
        tipo_dia = "NORMAL"

        if ap is not None:
            prev = int(ap.carga_prevista_minutos)
            trab = int(ap.minutos_trabalhados)
            intervalo = int(ap.minutos_intervalo)
            cred = int(ap.minutos_credito)
            deb = int(ap.minutos_debito)
            exc_aut = int(ap.excedente_autorizado_minutos)
            exc_pend = int(ap.excedente_pendente_minutos)

            # Se houver trabalho acima da carga sem crédito/autorização explícita, calcula pendente
            if exc_aut == 0 and exc_pend == 0 and trab > prev and cred == 0:
                exc_pend = trab - prev
            elif exc_aut == 0 and cred > 0:
                exc_aut = cred

            res_raw = ap.resultado.upper()
            if prev > 0:
                dias_com_jornada += 1

            status_ui, status_label = _map_resultado_ui(res_raw, cred, deb, exc_pend)
            if status_ui in ("INCOMPLETA", "DEBITO"):
                inconsistencias += 1

            if exc_pend > 0:
                conf_status = "EXCEDENTE_PENDENTE"
            elif status_ui in ("INCOMPLETA", "DEBITO"):
                conf_status = "INCONSISTENTE"
            elif status_ui == "ABONADA_FERIAS_RECESSO":
                conf_status = "DISPENSADA"
            else:
                conf_status = "CALCULADA"

            if cal_ev:
                evento_institucional = cal_ev.descricao
                tipo_dia = cal_ev.tipo
            elif ferias_validas:
                evento_institucional = ferias_validas.descricao
                tipo_dia = "FERIAS"
            elif outro_afast:
                evento_institucional = outro_afast.descricao
                tipo_dia = outro_afast.categoria
            elif is_weekend:
                tipo_dia = "DESCANSO"

            if contabilizavel or (ano < hoje_referencia.year or (ano == hoje_referencia.year and mes < hoje_referencia.month)):
                total_prev += prev
                total_trab += trab
                total_cred += cred
                total_deb += deb
                total_exc_aut += exc_aut
                total_exc_pend += exc_pend
            else:
                total_prev += prev

            obs_list = [ap.observacao] if ap.observacao else []
            regra_portaria = f"Resultado oficial apurado: {res_raw}"
        else:
            # Montagem sintética para dias sem apuração persistida
            if sem_jornada_vigente and not is_weekend and not cal_ev:
                prev = 0
                trab = 0
                intervalo = 0
                cred = 0
                deb = 0
                exc_aut = 0
                exc_pend = 0
                status_ui = "INCOMPLETA"
                status_label = "Sem jornada vigente"
                conf_status = "INCONSISTENTE"
                tipo_dia = "SEM_JORNADA"
                obs_list = ["Servidor sem escala/jornada vigente na data."]
                regra_portaria = "Ausência de jornada vigente"
            elif ferias_validas:
                prev = 0
                trab = 0
                intervalo = 0
                cred = 0
                deb = 0
                exc_aut = 0
                exc_pend = 0
                status_ui = "ABONADA_FERIAS_RECESSO"
                status_label = "Férias"
                conf_status = "DISPENSADA"
                tipo_dia = "FERIAS"
                evento_institucional = ferias_validas.descricao
                obs_list = [f"Férias SARH ({ferias_validas.situacao})"]
                regra_portaria = "Dispensa por férias homologadas"
            elif cal_ev and cal_ev.parcial_minutos is None:
                prev = 0
                intervalo = 0
                trab, intervalo, _, _ = calcular_minutos_por_marcacoes(
                    marcacoes_dia, 0, regra.intervalo_minimo_8h_min
                )
                cred = 0
                deb = 0
                exc_aut = 0
                exc_pend = trab
                status_ui = "ABONADA_FERIAS_RECESSO"
                status_label = cal_ev.descricao
                conf_status = "EXCEDENTE_PENDENTE" if exc_pend > 0 else "DISPENSADA"
                tipo_dia = cal_ev.tipo
                evento_institucional = cal_ev.descricao
                obs_list = [cal_ev.descricao]
                regra_portaria = f"Calendário institucional: {cal_ev.tipo}"
            elif is_weekend:
                prev = 0
                trab, intervalo, _, _ = calcular_minutos_por_marcacoes(
                    marcacoes_dia, 0, regra.intervalo_minimo_8h_min
                )
                cred = 0
                deb = 0
                exc_aut = 0
                exc_pend = trab
                status_ui = "REGULAR"
                status_label = "Descanso semanal"
                conf_status = "EXCEDENTE_PENDENTE" if exc_pend > 0 else "DISPENSADA"
                tipo_dia = "DESCANSO"
                obs_list = []
                regra_portaria = "Descanso semanal remunerado"
            else:
                # Dia útil normal (ou feriado parcial / teletrabalho / afastamento)
                prev = cal_ev.parcial_minutos if (cal_ev and cal_ev.parcial_minutos is not None) else regra.carga_diaria_padrao_min
                if cal_ev and cal_ev.parcial_minutos is not None:
                    evento_institucional = cal_ev.descricao
                    tipo_dia = cal_ev.tipo

                dias_com_jornada += 1
                if outro_afast and outro_afast.categoria == "TELETRABALHO":
                    trab = prev
                    intervalo = 0
                    cred = 0
                    deb = 0
                    exc_aut = 0
                    exc_pend = 0
                    status_ui = "REGULAR"
                    status_label = "Teletrabalho"
                    conf_status = "DISPENSADA"
                    tipo_dia = "TELETRABALHO"
                    evento_institucional = outro_afast.descricao
                    obs_list = ["Carga computada automaticamente conforme regime de teletrabalho."]
                    regra_portaria = "Teletrabalho sem exigência de marcação"
                elif outro_afast and outro_afast.categoria in ("DISPENSA", "ABONO", "VIAGEM", "ATIVIDADE_EXTERNA", "LICENCA") and not outro_afast.exige_frequencia_manual:
                    coberto = outro_afast.minutos_parciais if outro_afast.minutos_parciais is not None else prev
                    trab_marc, intervalo, _, _ = calcular_minutos_por_marcacoes(
                        marcacoes_dia, prev, regra.intervalo_minimo_8h_min
                    )
                    trab = min(prev, trab_marc + coberto) if outro_afast.minutos_parciais is not None else prev
                    cred = 0
                    deb = max(0, prev - trab) if contabilizavel else 0
                    exc_aut = 0
                    exc_pend = max(0, trab_marc - prev)
                    status_ui = "ABONADA_FERIAS_RECESSO" if deb == 0 else "DEBITO"
                    status_label = outro_afast.descricao
                    conf_status = "DISPENSADA" if deb == 0 else "INCONSISTENTE"
                    tipo_dia = outro_afast.categoria
                    evento_institucional = outro_afast.descricao
                    obs_list = [f"Cobertura: {outro_afast.descricao}"]
                    regra_portaria = f"Cobertura institucional ({outro_afast.categoria})"
                elif is_future or is_today:
                    # Dia atual ou futuro não fecha falta/débito/crédito
                    trab_marc, intervalo, inf_brk, incomp = calcular_minutos_por_marcacoes(
                        marcacoes_dia, prev, regra.intervalo_minimo_8h_min
                    )
                    trab = min(prev, trab_marc) if is_today and marcacoes_dia else 0
                    cred = 0
                    deb = 0
                    exc_aut = 0
                    exc_pend = 0
                    status_ui = "INCOMPLETA" if (is_today and marcacoes_dia) else "REGULAR"
                    status_label = "Em andamento" if (is_today and marcacoes_dia) else ("Dia atual" if is_today else "Dia futuro")
                    conf_status = "AGUARDANDO"
                    tipo_dia = "NORMAL" if is_today else "FUTURO"
                    obs_list = ["Intervalo mínimo inferido." ] if inf_brk else []
                    regra_portaria = "Dia em aberto (aguardando encerramento)" if is_today else "Planejamento futuro"
                else:
                    # Dia útil passado sem apuração persistida
                    trab, intervalo, inf_brk, incomp = calcular_minutos_por_marcacoes(
                        marcacoes_dia, prev, regra.intervalo_minimo_8h_min
                    )
                    cred = 0
                    exc_aut = 0
                    exc_pend = max(0, trab - prev)
                    deb = max(0, prev - trab)
                    if not marcacoes_dia:
                        status_ui = "INCOMPLETA"
                        status_label = "Sem marcação"
                        conf_status = "INCONSISTENTE"
                        inconsistencias += 1
                    elif incomp:
                        status_ui = "INCOMPLETA"
                        status_label = "Incompleta / Sem saída"
                        conf_status = "INCONSISTENTE"
                        inconsistencias += 1
                    elif exc_pend > 0:
                        status_ui = "REGULAR"
                        status_label = "Regular (excedente pendente)"
                        conf_status = "EXCEDENTE_PENDENTE"
                    elif deb > 0:
                        status_ui = "DEBITO"
                        status_label = f"Débito (-{deb // 60:02d}:{deb % 60:02d})"
                        conf_status = "INCONSISTENTE"
                        inconsistencias += 1
                    else:
                        status_ui = "REGULAR"
                        status_label = "Regular"
                        conf_status = "CALCULADA"
                    obs_list = ["Intervalo mínimo inferido automaticamente."] if inf_brk else []
                    regra_portaria = "Apuração pela sequência de marcações"

            total_prev += prev
            if contabilizavel or is_today:
                total_trab += trab
                total_cred += cred
                total_deb += deb
                total_exc_aut += exc_aut
                total_exc_pend += exc_pend

        saldo_dia = cred - deb

        # Alimenta categorias de totais
        if trab > 0:
            cat_regs["JORNADA_REGULAR"][0] += 1
            cat_regs["JORNADA_REGULAR"][1] += trab
        if exc_aut > 0:
            cat_regs["EXTRAS_AUTORIZADAS"][0] += 1
            cat_regs["EXTRAS_AUTORIZADAS"][1] += exc_aut
        if exc_pend > 0:
            cat_regs["EXTRAS_NAO_AUTORIZADAS"][0] += 1
            cat_regs["EXTRAS_NAO_AUTORIZADAS"][1] += exc_pend
        if cred > 0:
            cat_regs["CREDITO"][0] += 1
            cat_regs["CREDITO"][1] += cred
            cat_regs["BANCO_HORAS"][0] += 1
            cat_regs["BANCO_HORAS"][1] += cred
        if deb > 0:
            cat_regs["DEBITO"][0] += 1
            cat_regs["DEBITO"][1] += deb
            cat_regs["BANCO_HORAS"][0] += 1
            cat_regs["BANCO_HORAS"][1] -= deb
        if status_ui in ("INCOMPLETA", "DEBITO") and prev > 0 and trab == 0 and contabilizavel:
            cat_regs["AUSENCIAS"][0] += 1
            cat_regs["AUSENCIAS"][1] += prev
        if tipo_dia == "ATIVIDADE_EXTERNA":
            cat_regs["ATIVIDADES_EXTERNAS"][0] += 1
            cat_regs["ATIVIDADES_EXTERNAS"][1] += prev
        if tipo_dia == "VIAGEM":
            cat_regs["VIAGENS"][0] += 1
            cat_regs["VIAGENS"][1] += prev

        # Alimenta ocorrências do mês
        if deb > 0 or exc_pend > 0 or status_ui == "INCOMPLETA" or evento_institucional:
            if status_ui == "INCOMPLETA" and not marcacoes_dia and contabilizavel:
                oc_tipo, oc_cat, oc_dur = "Falta / Sem marcação", "FALTA", prev
            elif status_ui == "INCOMPLETA":
                oc_tipo, oc_cat, oc_dur = status_label, "OUTRA", 0
            elif exc_pend > 0:
                oc_tipo, oc_cat, oc_dur = "Excedente sem autorização", "EXTRA", exc_pend
            elif deb > 0:
                oc_tipo, oc_cat, oc_dur = "Débito de jornada", "ATRASO", deb
            else:
                oc_tipo, oc_cat, oc_dur = evento_institucional or status_label, "AFASTAMENTO", prev

            ocorrencias.append(
                {
                    "id": f"oc-{d_iso}",
                    "dataIso": d_iso,
                    "dataFormatada": dt.strftime("%d/%m/%Y"),
                    "diaSemana": DIAS_SEMANA_PT[dt.weekday()],
                    "tipo": oc_tipo,
                    "categoria": oc_cat,
                    "periodo": dt.strftime("%d/%m/%Y"),
                    "duracaoMinutos": oc_dur,
                    "duracaoCobertaMinutos": prev if tipo_dia in ("FERIAS", "AFASTAMENTO", "TELETRABALHO") else oc_dur,
                    "situacao": status_label,
                    "justificativa": obs_list[0] if obs_list else (evento_institucional or "-"),
                    "origem": "CALENDARIO" if cal_ev else ("SARH" if (ferias_validas or outro_afast) else "APURACAO"),
                    "podeEditar": False,
                    "podeSolicitarAutorizacao": exc_pend > 0,
                    "podeExcluir": False,
                }
            )

        dias.append(
            {
                "id": ap.id if ap else f"cal-{d_iso}",
                "dataIso": d_iso,
                "dataFormatada": dt.strftime("%d/%m/%Y"),
                "diaSemana": DIAS_SEMANA_PT[dt.weekday()],
                "diaUtil": not is_weekend,
                "cargaPrevistaMinutos": prev,
                "trabalhadoMinutos": trab,
                "intervaloMinutos": intervalo,
                "creditoMinutos": cred,
                "debitoMinutos": deb,
                "excedenteAutorizadoMinutos": exc_aut,
                "excedentePendenteMinutos": exc_pend,
                "saldoMinutos": saldo_dia,
                "status": status_ui,
                "statusLabel": status_label,
                "conferenciaStatus": conf_status,
                "tipoDia": tipo_dia,
                "contabilizavel": contabilizavel,
                "eventoInstitucional": evento_institucional,
                "marcacoes": marcacoes_dia,
                "memoriaCalculo": {
                    "jornadaAplicada": f"{prev // 60}h ({prev} min)" if prev > 0 else "Sem exigência",
                    "janelaExpediente": "Portaria SJAM-DIREF 135/2025 (08:00–15:00)",
                    "intervaloExigidoMinutos": 0 if prev <= 420 else regra.intervalo_minimo_8h_min,
                    "intervaloRealizadoMinutos": intervalo,
                    "toleranciaAplicadaMinutos": 0,
                    "regraPortaria": regra_portaria,
                    "observacoes": obs_list,
                },
            }
        )

    def _pct(mins: int) -> float:
        if total_prev <= 0:
            return 0.0
        return round((abs(mins) / total_prev) * 100.0, 1)

    totais_por_tipo = sorted(
        [
            {
                "codigo": "ATIVIDADES_EXTERNAS",
                "label": "Atividades externas",
                "cor": "#0284c7",
                "quantidadeRegistros": cat_regs["ATIVIDADES_EXTERNAS"][0],
                "totalMinutos": cat_regs["ATIVIDADES_EXTERNAS"][1],
                "participacaoPct": _pct(cat_regs["ATIVIDADES_EXTERNAS"][1]),
                "saldoObservacao": "Atividades externas registradas",
            },
            {
                "codigo": "AUSENCIAS",
                "label": "Ausências",
                "cor": "#dc2626",
                "quantidadeRegistros": cat_regs["AUSENCIAS"][0],
                "totalMinutos": cat_regs["AUSENCIAS"][1],
                "participacaoPct": _pct(cat_regs["AUSENCIAS"][1]),
                "saldoObservacao": "Faltas ou dias sem registro",
            },
            {
                "codigo": "BANCO_HORAS",
                "label": "Banco de horas",
                "cor": "#003b80",
                "quantidadeRegistros": cat_regs["BANCO_HORAS"][0],
                "totalMinutos": cat_regs["BANCO_HORAS"][1],
                "participacaoPct": _pct(cat_regs["BANCO_HORAS"][1]),
                "saldoObservacao": "Movimentação líquida na competência",
            },
            {
                "codigo": "CREDITO",
                "label": "Crédito",
                "cor": "#15803d",
                "quantidadeRegistros": cat_regs["CREDITO"][0],
                "totalMinutos": cat_regs["CREDITO"][1],
                "participacaoPct": _pct(cat_regs["CREDITO"][1]),
                "saldoObservacao": "Crédito reconhecido",
            },
            {
                "codigo": "DEBITO",
                "label": "Débito",
                "cor": "#e11d48",
                "quantidadeRegistros": cat_regs["DEBITO"][0],
                "totalMinutos": cat_regs["DEBITO"][1],
                "participacaoPct": _pct(cat_regs["DEBITO"][1]),
                "saldoObservacao": "Débito líquido apurado",
            },
            {
                "codigo": "EXTRAS_AUTORIZADAS",
                "label": "Horas extras autorizadas",
                "cor": "#059669",
                "quantidadeRegistros": cat_regs["EXTRAS_AUTORIZADAS"][0],
                "totalMinutos": cat_regs["EXTRAS_AUTORIZADAS"][1],
                "participacaoPct": _pct(cat_regs["EXTRAS_AUTORIZADAS"][1]),
                "saldoObservacao": "Horas excedentes autorizadas",
            },
            {
                "codigo": "EXTRAS_NAO_AUTORIZADAS",
                "label": "Horas extras não autorizadas",
                "cor": "#d97706",
                "quantidadeRegistros": cat_regs["EXTRAS_NAO_AUTORIZADAS"][0],
                "totalMinutos": cat_regs["EXTRAS_NAO_AUTORIZADAS"][1],
                "participacaoPct": _pct(cat_regs["EXTRAS_NAO_AUTORIZADAS"][1]),
                "saldoObservacao": "Aguardando autorização" if cat_regs["EXTRAS_NAO_AUTORIZADAS"][1] > 0 else "Sem pendências",
                "aguardandoAutorizacao": cat_regs["EXTRAS_NAO_AUTORIZADAS"][1] > 0,
            },
            {
                "codigo": "JORNADA_REGULAR",
                "label": "Jornada regular",
                "cor": "#1d4ed8",
                "quantidadeRegistros": cat_regs["JORNADA_REGULAR"][0],
                "totalMinutos": cat_regs["JORNADA_REGULAR"][1],
                "participacaoPct": _pct(cat_regs["JORNADA_REGULAR"][1]),
                "saldoObservacao": "Tempo trabalhado contabilizado",
            },
            {
                "codigo": "VIAGENS",
                "label": "Viagens",
                "cor": "#7c3aed",
                "quantidadeRegistros": cat_regs["VIAGENS"][0],
                "totalMinutos": cat_regs["VIAGENS"][1],
                "participacaoPct": _pct(cat_regs["VIAGENS"][1]),
                "saldoObservacao": "Viagens a serviço",
            },
        ],
        key=lambda x: x["label"],
    )

    return {
        "competencia": f"{mes:02d}/{ano}",
        "competenciaLabel": f"{mes:02d}/{ano}",
        "statusCompetencia": status_competencia,
        "statusCompetenciaLabel": status_competencia_label,
        "ultimaSincronizacaoSarh": "Integrado secp_prod_real",
        "ultimoRecalculo": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "totalPrevistoMinutos": total_prev,
        "totalTrabalhadoMinutos": total_trab,
        "totalCreditoMinutos": total_cred,
        "totalDebitoMinutos": total_deb,
        "totalExcedenteAutorizadoMinutos": total_exc_aut,
        "totalExcedentePendenteMinutos": total_exc_pend,
        "bancoComputavelMinutos": total_cred - total_deb,
        "faltasOuInconsistencias": inconsistencias,
        "diasComJornada": dias_com_jornada,
        "unidadeLabel": unidade_label,
        "chefiaNome": chefia_nome,
        "dias": dias,
        "totaisPorTipo": totais_por_tipo,
        "ocorrencias": ocorrencias,
        "historicoAjustes": sol_list,
    }


def _map_resultado_ui(resultado: str, cred: int, deb: int, exc_pend: int = 0) -> tuple[str, str]:
    r = resultado.upper()
    if r in ("FERIAS", "AFASTAMENTO", "FERIADO", "RECESSO_FORENSE", "PONTO_FACULTATIVO", "ABONADA"):
        return ("ABONADA_FERIAS_RECESSO", r.replace("_", " ").title())
    if r in ("INCOMPLETA", "FALTA"):
        return ("INCOMPLETA", "Incompleta / Sem saída" if r == "INCOMPLETA" else "Falta")
    if cred > 0 or r == "CREDITO":
        return ("CREDITO", f"Crédito (+{cred // 60:02d}:{cred % 60:02d})")
    if deb > 0 or r == "DEBITO":
        return ("DEBITO", f"Débito (-{deb // 60:02d}:{deb % 60:02d})")
    if exc_pend > 0:
        return ("REGULAR", "Regular (excedente pendente)")
    return ("REGULAR", "Regular")
