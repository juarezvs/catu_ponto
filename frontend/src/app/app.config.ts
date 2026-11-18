import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { secpContextInterceptor } from './core/interceptors/secp-context.interceptor';
import { provideHexagonalArchitecture } from './infrastructure/di/hexagonal.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([secpContextInterceptor])),
    ...provideHexagonalArchitecture(),
  ],
};
