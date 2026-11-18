import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import {
  BiometriaFacialStatus,
  FacialRecognitionService,
  FrameFaceAnalysis,
  ProvaVidaTipo,
  RegistrarPontoFacialResponse,
} from '../../core/services/facial-recognition.service';

@Component({
  selector: 'app-biometria-facial-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-facial-title"
    >
      <div class="bg-white rounded-2xl border border-slate-200 max-w-lg w-full overflow-hidden shadow-2xl">
        <!-- Cabeçalho -->
        <div class="bg-[#002f6c] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h3 id="modal-facial-title" class="text-sm font-bold">
              {{
                modoAtual() === 'cadastro'
                  ? 'Cadastro de Biometria Facial'
                  : 'Validação Biométrica Facial (Marcação de Ponto)'
              }}
            </h3>
            <p class="text-[11px] text-blue-100 mt-0.5">
              {{ servidorNome }} · Matrícula {{ matricula }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="alternarVoz()"
              class="inline-flex items-center gap-1 rounded-lg bg-white/15 hover:bg-white/25 px-2.5 py-1 text-[11px] font-semibold text-white transition"
              [title]="vozAtiva() ? 'Silenciar guia por voz' : 'Ativar guia por voz'"
              [attr.aria-label]="vozAtiva() ? 'Silenciar guia por voz' : 'Ativar guia por voz'"
            >
              @if (vozAtiva()) {
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <span>Voz</span>
              } @else {
                <svg class="h-3.5 w-3.5 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
                <span class="text-blue-200">Mudo</span>
              }
            </button>
            <button
              type="button"
              (click)="fecharModal()"
              class="text-white/80 hover:text-white text-lg leading-none px-1"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="p-5 flex flex-col gap-4">
          @if (avisoSemCadastro()) {
            <div class="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              Você ainda não possui biometria facial cadastrada. Faça o cadastro rápido abaixo (leva ~5 segundos) para liberar o registro de ponto facial.
            </div>
          }

          <!-- Visor da Webcam -->
          <div class="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-200">
            <video
              #videoEl
              autoplay
              muted
              playsinline
              class="w-full h-full object-cover -scale-x-100"
            ></video>

            <!-- Moldura Oval de Alinhamento -->
            <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                class="w-44 h-56 rounded-full border-2 transition-colors duration-200 shadow-[0_0_0_9999px_rgba(2,6,23,0.38)]"
                [ngClass]="
                  etapa() === 'concluido'
                    ? 'border-emerald-400'
                    : rostoDetectado()
                      ? 'border-sky-400'
                      : 'border-white/60 border-dashed'
                "
              ></div>
            </div>

            <!-- Badge de Status no Topo -->
            <div class="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md"
                [ngClass]="
                  rostoDetectado()
                    ? 'bg-emerald-500/90 text-white'
                    : 'bg-slate-900/75 text-slate-100'
                "
              >
                <span
                  class="h-2 w-2 rounded-full"
                  [ngClass]="rostoDetectado() ? 'bg-white animate-pulse' : 'bg-amber-400'"
                ></span>
                {{ rostoDetectado() ? 'Rosto alinhado' : 'Aguardando rosto...' }}
              </span>

              <span class="rounded-full bg-slate-900/75 text-slate-100 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md">
                Confiabilidade mínima: {{ confiabilidadeMinima() }}%
              </span>
            </div>

            @if (carregandoCamera()) {
              <div class="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center text-white text-xs gap-2">
                <div class="h-7 w-7 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                <span>Iniciando câmera e modelos biométricos...</span>
              </div>
            }
          </div>

          <!-- Painel de Instrução & Prova de Vida -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-[#002f6c]">
                {{ instrucaoAtual().titulo }}
              </span>
              <span class="text-[11px] font-semibold text-slate-500">
                {{ progressoPct() }}%
              </span>
            </div>
            <p class="text-[11px] text-slate-600">
              {{ instrucaoAtual().detalhe }}
            </p>
            <div class="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                class="h-full transition-all duration-300 rounded-full"
                [ngClass]="etapa() === 'concluido' ? 'bg-emerald-600' : 'bg-[#002f6c]'"
                [style.width.%]="progressoPct()"
              ></div>
            </div>
          </div>

          <!-- Mensagens de Erro ou Sucesso -->
          @if (erroMsg()) {
            <div class="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 flex items-center justify-between gap-2">
              <span>{{ erroMsg() }}</span>
              <button
                type="button"
                (click)="reiniciarCaptura()"
                class="shrink-0 px-2.5 py-1 rounded-lg bg-rose-700 text-white font-semibold hover:bg-rose-800 transition"
              >
                Tentar novamente
              </button>
            </div>
          }

          @if (sucessoMsg()) {
            <div class="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
              ✓ {{ sucessoMsg() }}
            </div>
          }

          <!-- Ações -->
          <div class="flex items-center justify-between gap-2 pt-1">
            @if (statusBiometria()?.cadastrado && modoAtual() === 'marcacao') {
              <button
                type="button"
                (click)="alternarParaRecadastro()"
                [disabled]="processando()"
                class="text-[11px] font-semibold text-[#002f6c] hover:underline disabled:opacity-50"
              >
                Atualizar meu cadastro facial
              </button>
            } @else {
              <span></span>
            }

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="fecharModal()"
                class="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                {{ etapa() === 'concluido' ? 'Fechar' : 'Cancelar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class BiometriaFacialModalComponent implements OnInit, OnDestroy {
  private readonly facialService = inject(FacialRecognitionService);

  @ViewChild('videoEl', { static: false }) videoRef?: ElementRef<HTMLVideoElement>;

  @Input() mode: 'cadastro' | 'marcacao' = 'marcacao';
  @Input() matricula = '';
  @Input() servidorNome = '';

  @Output() closed = new EventEmitter<void>();
  @Output() cadastrado = new EventEmitter<BiometriaFacialStatus>();
  @Output() marcacaoRegistrada = new EventEmitter<RegistrarPontoFacialResponse>();

  readonly modoAtual = signal<'cadastro' | 'marcacao'>('marcacao');
  readonly statusBiometria = signal<BiometriaFacialStatus | null>(null);
  readonly avisoSemCadastro = signal<boolean>(false);
  readonly carregandoCamera = signal<boolean>(true);
  readonly rostoDetectado = signal<boolean>(false);
  readonly etapa = signal<'alinhamento' | 'prova_vida' | 'enviando' | 'concluido' | 'erro'>('alinhamento');
  readonly progressoPct = signal<number>(10);
  readonly erroMsg = signal<string | null>(null);
  readonly sucessoMsg = signal<string | null>(null);
  readonly processando = signal<boolean>(false);
  readonly confiabilidadeMinima = signal<number>(85);
  readonly vozAtiva = signal<boolean>(true);

  private desafioAtual: ProvaVidaTipo = 'PISCAR';
  private ultimaFala = '';
  private mediaStream: MediaStream | null = null;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private isAnalyzing = false;

  private framesAnalisados = 0;
  private baselineFrames: FrameFaceAnalysis[] = [];
  private baselineEar = 0.3;
  private baselineYaw = 0;
  private baselineMouthRatio = 0.5;
  private blinkSawClose = false;
  private minEarSeen = 1.0;
  private capturedEmbeddings: number[][] = [];
  private prevNose: { x: number; y: number } | null = null;
  private microMotionAccum = 0;

  async ngOnInit(): Promise<void> {
    this.modoAtual.set(this.mode);
    try {
      const status = await this.facialService.getStatus(this.matricula);
      this.statusBiometria.set(status);
      this.confiabilidadeMinima.set(status.confiabilidadeMinimaPct || 85);
      if (this.mode === 'marcacao' && !status.cadastrado) {
        this.avisoSemCadastro.set(true);
        this.modoAtual.set('cadastro');
      }
    } catch {
      if (this.mode === 'marcacao') {
        this.confiabilidadeMinima.set(85);
      }
    }

    await this.iniciarCameraEModelos();
  }

  ngOnDestroy(): void {
    this.pararCameraELoop();
  }

  instrucaoAtual(): { titulo: string; detalhe: string } {
    const e = this.etapa();
    if (e === 'alinhamento') {
      return {
        titulo: '1. Posicione seu rosto na moldura',
        detalhe: 'Olhe diretamente para a câmera em local iluminado.',
      };
    }
    if (e === 'prova_vida') {
      const inst = this.facialService.getChallengeInstruction(this.desafioAtual);
      return {
        titulo: `2. Prova de vida: ${inst.titulo}`,
        detalhe: inst.detalhe,
      };
    }
    if (e === 'enviando') {
      return {
        titulo: '3. Validando biometria...',
        detalhe: 'Comparando vetor facial e prova de vida com segurança.',
      };
    }
    if (e === 'concluido') {
      return {
        titulo: 'Concluído com sucesso!',
        detalhe: 'Identidade confirmada.',
      };
    }
    return {
      titulo: 'Não foi possível validar',
      detalhe: this.erroMsg() || 'Tente novamente.',
    };
  }

  private async iniciarCameraEModelos(): Promise<void> {
    this.carregandoCamera.set(true);
    this.erroMsg.set(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Navegador sem suporte à câmera (getUserMedia indisponível).');
      }

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      const video = this.videoRef?.nativeElement;
      if (video) {
        video.srcObject = this.mediaStream;
        await video.play();
      }

      await this.facialService.ensureModelsLoaded();
      this.carregandoCamera.set(false);
      this.reiniciarCaptura();
    } catch (err: any) {
      this.carregandoCamera.set(false);
      this.etapa.set('erro');
      this.erroMsg.set(
        err?.message || 'Não foi possível acessar a câmera. Verifique as permissões do navegador.'
      );
      this.falar('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
    }
  }

  reiniciarCaptura(): void {
    if (!this.mediaStream) {
      void this.iniciarCameraEModelos();
      return;
    }
    this.erroMsg.set(null);
    this.sucessoMsg.set(null);
    this.etapa.set('alinhamento');
    this.progressoPct.set(15);
    this.desafioAtual = this.facialService.pickRandomChallenge();
    this.framesAnalisados = 0;
    this.baselineFrames = [];
    this.baselineEar = 0.3;
    this.baselineYaw = 0;
    this.baselineMouthRatio = 0.5;
    this.blinkSawClose = false;
    this.minEarSeen = 1.0;
    this.capturedEmbeddings = [];
    this.prevNose = null;
    this.microMotionAccum = 0;
    this.processando.set(false);
    this.ultimaFala = '';

    if (this.avisoSemCadastro()) {
      this.falar(
        'Você ainda não possui biometria facial cadastrada. Posicione seu rosto na moldura e olhe para a câmera.'
      );
    } else if (this.modoAtual() === 'cadastro') {
      this.falar('Cadastro facial. Posicione seu rosto na moldura e olhe para a câmera.');
    } else {
      this.falar('Validação facial. Posicione seu rosto na moldura e olhe para a câmera.');
    }

    if (this.loopTimer) {
      clearInterval(this.loopTimer);
    }
    this.loopTimer = setInterval(() => {
      void this.processarFrame();
    }, 65);
  }

  alternarParaRecadastro(): void {
    this.modoAtual.set('cadastro');
    this.avisoSemCadastro.set(false);
    this.reiniciarCaptura();
  }

  private async processarFrame(): Promise<void> {
    if (this.isAnalyzing || this.processando() || this.etapa() === 'concluido' || this.etapa() === 'erro') {
      return;
    }
    const video = this.videoRef?.nativeElement;
    if (!video) {
      return;
    }

    this.isAnalyzing = true;
    try {
      const emProvaVida = this.etapa() === 'prova_vida';
      const analysis = await this.facialService.analyzeVideoFrame(video, {
        skipDescriptor: emProvaVida,
        withExpressions: emProvaVida && this.desafioAtual === 'SORRIR',
      });
      if (!analysis || analysis.faceAreaRatio < 0.035) {
        this.rostoDetectado.set(false);
        return;
      }

      this.rostoDetectado.set(true);
      this.framesAnalisados += 1;

      if (this.prevNose) {
        this.microMotionAccum += Math.hypot(
          analysis.noseX - this.prevNose.x,
          analysis.noseY - this.prevNose.y
        );
      }
      this.prevNose = { x: analysis.noseX, y: analysis.noseY };

      if (this.etapa() === 'alinhamento') {
        this.baselineFrames.push(analysis);
        if (analysis.descriptor.length === 128) {
          this.capturedEmbeddings.push(analysis.descriptor);
        }
        const pct = Math.min(45, 15 + this.baselineFrames.length * 10);
        this.progressoPct.set(pct);

        if (this.baselineFrames.length >= 3) {
          this.baselineEar =
            this.baselineFrames.reduce((acc, f) => acc + f.ear, 0) / this.baselineFrames.length;
          this.baselineYaw =
            this.baselineFrames.reduce((acc, f) => acc + f.yawRatio, 0) / this.baselineFrames.length;
          this.baselineMouthRatio =
            this.baselineFrames.reduce((acc, f) => acc + f.mouthRatio, 0) / this.baselineFrames.length;
          this.etapa.set('prova_vida');
          this.progressoPct.set(55);
          const inst = this.facialService.getChallengeInstruction(this.desafioAtual);
          this.falar(`Rosto alinhado. Agora, ${inst.titulo}.`);
        }
        return;
      }

      if (this.etapa() === 'prova_vida') {
        let livenessOk = false;

        if (this.desafioAtual === 'PISCAR') {
          if (analysis.ear > this.baselineEar && !this.blinkSawClose) {
            this.baselineEar = this.baselineEar * 0.7 + analysis.ear * 0.3;
          }
          const closeThreshold = Math.max(0.24, this.baselineEar * 0.87);
          if (analysis.ear <= closeThreshold) {
            this.blinkSawClose = true;
            this.minEarSeen = Math.min(this.minEarSeen, analysis.ear);
            this.progressoPct.set(78);
          } else if (
            this.blinkSawClose &&
            (analysis.ear >= this.baselineEar * 0.91 || analysis.ear >= this.minEarSeen + 0.025)
          ) {
            livenessOk = true;
          }
        } else if (this.desafioAtual === 'SORRIR') {
          if (
            analysis.happyScore >= 0.35 ||
            (this.baselineMouthRatio > 0 && analysis.mouthRatio >= this.baselineMouthRatio * 1.07)
          ) {
            livenessOk = true;
          } else if (
            analysis.happyScore >= 0.18 ||
            (this.baselineMouthRatio > 0 && analysis.mouthRatio >= this.baselineMouthRatio * 1.035)
          ) {
            this.progressoPct.set(78);
          }
        } else if (this.desafioAtual === 'VIRAR_ROSTO') {
          const deltaYaw = Math.abs(analysis.yawRatio - this.baselineYaw);
          if (deltaYaw >= 0.065) {
            livenessOk = true;
          } else if (deltaYaw >= 0.03) {
            this.progressoPct.set(78);
          }
        }

        if (livenessOk) {
          let finalDescriptor = analysis.descriptor;
          if (!finalDescriptor || finalDescriptor.length !== 128) {
            const full = await this.facialService.analyzeVideoFrame(video);
            finalDescriptor = full?.descriptor?.length === 128 ? full.descriptor : (this.capturedEmbeddings[0] ?? []);
          }
          if (finalDescriptor.length === 128) {
            this.capturedEmbeddings.push(finalDescriptor);
          }
          await this.finalizarEnvio(video, finalDescriptor);
        }
      }
    } finally {
      this.isAnalyzing = false;
    }
  }

  private async finalizarEnvio(video: HTMLVideoElement, lastDescriptor: number[]): Promise<void> {
    this.processando.set(true);
    this.etapa.set('enviando');
    this.progressoPct.set(90);

    try {
      if (this.modoAtual() === 'cadastro') {
        const snapshot = this.facialService.captureSnapshotBase64(video);
        const amostras = this.capturedEmbeddings.slice(0, 4);
        const res = await this.facialService.cadastrarBiometria({
          matricula: this.matricula,
          embeddings: amostras,
          provaVidaTipo: this.desafioAtual,
          provaVidaAprovada: true,
          framesAnalisados: this.framesAnalisados,
          fotoReferenciaBase64: snapshot,
        });

        this.statusBiometria.set(res);
        this.etapa.set('concluido');
        this.progressoPct.set(100);
        this.sucessoMsg.set('Biometria facial cadastrada com sucesso!');
        this.falar('Biometria facial cadastrada com sucesso!');
        this.cadastrado.emit(res);

        if (this.mode === 'marcacao') {
          this.avisoSemCadastro.set(false);
          setTimeout(() => {
            this.modoAtual.set('marcacao');
            this.reiniciarCaptura();
          }, 1100);
        } else {
          this.pararCameraELoop();
        }
        return;
      }

      const resp = await this.facialService.registrarPontoFacial({
        matricula: this.matricula,
        embedding: this.capturedEmbeddings[0] ?? lastDescriptor,
        provaVidaTipo: this.desafioAtual,
        provaVidaAprovada: true,
        framesAnalisados: this.framesAnalisados,
      });

      this.etapa.set('concluido');
      this.progressoPct.set(100);
      this.sucessoMsg.set(
        `Ponto registrado com ${resp.verificacao.confiancaPct.toFixed(1)}% de confiabilidade!`
      );
      this.falar('Identidade confirmada. Ponto registrado com sucesso!');
      this.pararCameraELoop();
      this.marcacaoRegistrada.emit(resp);
    } catch (err: any) {
      this.etapa.set('erro');
      this.processando.set(false);
      const detalhe = err?.error?.detail || err?.message || 'Falha na validação biométrica facial.';
      this.erroMsg.set(detalhe);
      this.falar(detalhe);
    }
  }

  alternarVoz(): void {
    const novo = !this.vozAtiva();
    this.vozAtiva.set(novo);
    if (!novo) {
      this.pararVoz();
    } else {
      this.ultimaFala = '';
      const inst = this.instrucaoAtual();
      this.falar(`${inst.titulo}. ${inst.detalhe}`);
    }
  }

  private falar(texto: string): void {
    if (!this.vozAtiva() || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    if (texto === this.ultimaFala) {
      return;
    }
    this.ultimaFala = texto;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const ptBrVoice = voices.find((v) => v.lang.toLowerCase().startsWith('pt-br'));
      if (ptBrVoice) {
        utterance.voice = ptBrVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignora falhas de síntese em navegadores sem suporte
    }
  }

  private pararVoz(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignora
      }
    }
  }

  private pararCameraELoop(): void {
    this.pararVoz();
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  fecharModal(): void {
    this.pararCameraELoop();
    this.closed.emit();
  }
}
