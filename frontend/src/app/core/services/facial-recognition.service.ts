import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import * as faceapi from '@vladmandic/face-api';
import { firstValueFrom } from 'rxjs';

export type ProvaVidaTipo = 'PISCAR' | 'SORRIR' | 'VIRAR_ROSTO';

export interface BiometriaFacialStatus {
  cadastrado: boolean;
  confiabilidadeMinimaPct: number;
  amostrasColetadas: number;
  atualizadoEm: string | null;
  fotoReferenciaBase64: string | null;
}

export interface RegistrarPontoFacialResponse {
  marcacao: any;
  verificacao: {
    aprovado: boolean;
    confiancaPct: number;
    limiarPct: number;
    provaVidaTipo: string;
  };
}

export interface FrameFaceAnalysis {
  detected: boolean;
  boxScore: number;
  faceAreaRatio: number;
  ear: number;
  yawRatio: number;
  mouthRatio: number;
  happyScore: number;
  noseX: number;
  noseY: number;
  descriptor: number[];
}

@Injectable({ providedIn: 'root' })
export class FacialRecognitionService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = 'http://localhost:8000/api/v1/secp/ponto/real/biometria-facial';
  private modelsLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  async ensureModelsLoaded(): Promise<void> {
    if (this.modelsLoaded) {
      return;
    }
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    const modelUrl = '/assets/models/face-api';
    this.loadingPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
      faceapi.nets.faceExpressionNet.loadFromUri(modelUrl),
    ])
      .then(() => {
        this.modelsLoaded = true;
      })
      .finally(() => {
        this.loadingPromise = null;
      });

    return this.loadingPromise;
  }

  pickRandomChallenge(): ProvaVidaTipo {
    const options: ProvaVidaTipo[] = ['PISCAR', 'SORRIR', 'VIRAR_ROSTO'];
    return options[Math.floor(Math.random() * options.length)];
  }

  getChallengeInstruction(tipo: ProvaVidaTipo): { titulo: string; detalhe: string } {
    if (tipo === 'PISCAR') {
      return {
        titulo: 'Pisque os olhos uma vez',
        detalhe: 'Olhe para a câmera e pisque naturalmente.',
      };
    }
    if (tipo === 'SORRIR') {
      return {
        titulo: 'Dê um leve sorriso',
        detalhe: 'Mantenha o rosto na moldura e sorria brevemente.',
      };
    }
    return {
      titulo: 'Vire levemente o rosto para o lado',
      detalhe: 'Gire o rosto devagar para a esquerda ou direita.',
    };
  }

  async analyzeVideoFrame(
    video: HTMLVideoElement,
    options: { skipDescriptor?: boolean; withExpressions?: boolean } = {}
  ): Promise<FrameFaceAnalysis | null> {
    if (!this.modelsLoaded || video.readyState < 2 || video.videoWidth === 0) {
      return null;
    }

    const detectorOpts = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.5,
    });

    let detection: any = null;
    if (options.skipDescriptor && options.withExpressions) {
      detection = await faceapi
        .detectSingleFace(video, detectorOpts)
        .withFaceLandmarks(true)
        .withFaceExpressions();
    } else if (options.skipDescriptor) {
      detection = await faceapi
        .detectSingleFace(video, detectorOpts)
        .withFaceLandmarks(true);
    } else {
      detection = await faceapi
        .detectSingleFace(video, detectorOpts)
        .withFaceLandmarks(true)
        .withFaceExpressions()
        .withFaceDescriptor();
    }

    if (!detection) {
      return null;
    }

    const box = detection.detection.box;
    const videoArea = video.videoWidth * video.videoHeight;
    const faceAreaRatio = videoArea > 0 ? (box.width * box.height) / videoArea : 0;

    const landmarks = detection.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const ear = (this.eyeAspectRatio(leftEye) + this.eyeAspectRatio(rightEye)) / 2;

    const nose = landmarks.getNose();
    const noseTip = nose[3] ?? nose[0];
    const leftOuter = leftEye[0];
    const rightOuter = rightEye[3];
    const eyeMidX = (leftOuter.x + rightOuter.x) / 2;
    const interOcular = Math.max(1, Math.hypot(rightOuter.x - leftOuter.x, rightOuter.y - leftOuter.y));
    const yawRatio = (noseTip.x - eyeMidX) / interOcular;
    const mouth = landmarks.getMouth();
    const mouthWidth =
      mouth.length >= 7
        ? Math.hypot(mouth[6].x - mouth[0].x, mouth[6].y - mouth[0].y)
        : 0;
    const mouthRatio = mouthWidth / interOcular;

    return {
      detected: true,
      boxScore: detection.detection.score,
      faceAreaRatio,
      ear,
      yawRatio,
      mouthRatio,
      happyScore: detection.expressions?.happy ?? 0,
      noseX: noseTip.x / Math.max(1, video.videoWidth),
      noseY: noseTip.y / Math.max(1, video.videoHeight),
      descriptor: detection.descriptor ? Array.from(detection.descriptor) : [],
    };
  }

  private eyeAspectRatio(pts: faceapi.Point[]): number {
    if (pts.length < 6) {
      return 0.3;
    }
    const v1 = Math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y);
    const v2 = Math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y);
    const h = Math.max(1, Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y));
    return (v1 + v2) / (2 * h);
  }

  captureSnapshotBase64(video: HTMLVideoElement): string | null {
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }
    const canvas = document.createElement('canvas');
    const targetW = 240;
    const targetH = Math.round((video.videoHeight / video.videoWidth) * targetW);
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.drawImage(video, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  getStatus(matricula: string): Promise<BiometriaFacialStatus> {
    return firstValueFrom(
      this.http.get<BiometriaFacialStatus>(`${this.apiBase}/status`, {
        params: { matricula },
      })
    );
  }

  cadastrarBiometria(payload: {
    matricula: string;
    embeddings: number[][];
    provaVidaTipo: ProvaVidaTipo;
    provaVidaAprovada: boolean;
    framesAnalisados: number;
    fotoReferenciaBase64?: string | null;
  }): Promise<BiometriaFacialStatus> {
    return firstValueFrom(
      this.http.post<BiometriaFacialStatus>(`${this.apiBase}/cadastrar`, payload)
    );
  }

  registrarPontoFacial(payload: {
    matricula: string;
    embedding: number[];
    provaVidaTipo: ProvaVidaTipo;
    provaVidaAprovada: boolean;
    framesAnalisados: number;
    observacao?: string;
  }): Promise<RegistrarPontoFacialResponse> {
    return firstValueFrom(
      this.http.post<RegistrarPontoFacialResponse>(`${this.apiBase}/registrar-ponto`, payload)
    );
  }
}
