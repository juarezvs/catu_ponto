import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-menu-item-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg [ngClass]="sizeClass" class="shrink-0" viewBox="0 0 16 16" fill="none">
      @switch (itemId) {
        @case ('registrar-ponto') {
          <path d="M2.5 5V3.5C2.5 2.9 2.9 2.5 3.5 2.5H5M11 2.5H12.5C13.1 2.5 13.5 2.9 13.5 3.5V5M13.5 11V12.5C13.5 13.1 13.1 13.5 12.5 13.5H11M5 13.5H3.5C2.9 13.5 2.5 13.1 2.5 12.5V11" stroke="#0078D4" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="8" cy="6.8" r="2" fill="#50E6FF" stroke="#0078D4" stroke-width="1"/>
          <path d="M5 11.8C5.4 10.3 6.6 9.5 8 9.5C9.4 9.5 10.6 10.3 11 11.8" stroke="#00A4EF" stroke-width="1.3" stroke-linecap="round"/>
        }
        @case ('ponto-de-hoje') {
          <circle cx="8" cy="8" r="6" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M8 4.5V8L10.5 9.8" stroke="#0078D4" stroke-width="1.4" stroke-linecap="round"/>
          <circle cx="8" cy="8" r="1" fill="#00BCF2"/>
        }
        @case ('historico-marcacoes') {
          <path d="M3 4H13M3 8H10M3 12H8" stroke="#0078D4" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="12.5" cy="11.5" r="2.5" fill="#50E6FF" stroke="#0078D4" stroke-width="1"/>
        }
        @case ('meu-espelho-ponto') {
          <rect x="2" y="2.5" width="12" height="11" rx="1.5" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M2 5.8H14M6 5.8V13.5M10 5.8V13.5" stroke="#00A4EF" stroke-width="1.1"/>
        }
        @case ('solicitacoes-ajuste') {
          <rect x="2.5" y="2" width="8.5" height="12" rx="1.2" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M9.5 11.5L13.5 7.5L14.5 8.5L10.5 12.5L9 13L9.5 11.5Z" fill="#FFB900" stroke="#F7630C" stroke-width="0.8"/>
        }
        @case ('solicitacoes-banco-horas') {
          <path d="M4 2.5H12M4 13.5H12M5 2.5C5 5.5 8 7 8 8C8 9 5 10.5 5 13.5M11 2.5C11 5.5 8 7 8 8C8 9 11 10.5 11 13.5" stroke="#0078D4" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M6 12.5H10L8 10L6 12.5Z" fill="#FFB900"/>
        }
        @case ('meu-contracheque') {
          <rect x="2" y="3.5" width="12" height="9" rx="1.5" fill="#E9F7DF" stroke="#5E9C31" stroke-width="1.2"/>
          <circle cx="8" cy="8" r="2.2" fill="#7FBA00"/>
        }
        @case ('meus-afastamentos') {
          <rect x="2.5" y="3" width="11" height="10.5" rx="1.5" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M8 5.5V10.5M5.5 8H10.5" stroke="#E81123" stroke-width="1.5" stroke-linecap="round"/>
        }
        @case ('minhas-ferias') {
          <circle cx="8" cy="8" r="3.2" fill="#FFB900" stroke="#F7630C" stroke-width="1"/>
          <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.5 4.5M11.5 11.5L12.6 12.6M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6" stroke="#FFB900" stroke-width="1.3" stroke-linecap="round"/>
        }
        @case ('meu-banco-horas') {
          <rect x="2.5" y="9" width="2.5" height="4.5" rx="0.5" fill="#00A4EF"/>
          <rect x="6.8" y="6" width="2.5" height="7.5" rx="0.5" fill="#0078D4"/>
          <rect x="11" y="3" width="2.5" height="10.5" rx="0.5" fill="#7FBA00"/>
        }
        @case ('minhas-horas-extras') {
          <path d="M8.8 2L4.8 8.4H8L7 14L11.5 7.4H8.3L8.8 2Z" fill="#FFB900" stroke="#F7630C" stroke-width="0.7" stroke-linejoin="round"/>
        }
        @case ('recesso-forense') {
          <path d="M8 2V14M2.8 5L13.2 11M13.2 5L2.8 11" stroke="#00A4EF" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="8" cy="8" r="1.5" fill="#0078D4"/>
        }
        @case ('meus-relatorios') {
          <path d="M3 2.5H10.5L13 5V13.5H3V2.5Z" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M5.5 11V8.5M8 11V7M10.5 11V9.5" stroke="#5E9C31" stroke-width="1.4" stroke-linecap="round"/>
        }
        @case ('minhas-substituicoes') {
          <path d="M3 5.5H12.5M10 3L12.5 5.5L10 8" stroke="#0078D4" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M13 10.5H3.5M6 8L3.5 10.5L6 13" stroke="#7FBA00" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        }
        @case ('cad-orgaos') {
          <path d="M2 13.5H14M3.5 6.5V12M6.5 6.5V12M9.5 6.5V12M12.5 6.5V12" stroke="#0078D4" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M8 2L14 5.5H2L8 2Z" fill="#50E6FF" stroke="#0078D4" stroke-width="1.1" stroke-linejoin="round"/>
        }
        @case ('cad-unidades') {
          <rect x="6" y="2" width="4" height="3" rx="0.6" fill="#0078D4"/>
          <rect x="2" y="10.5" width="4" height="3" rx="0.6" fill="#50E6FF" stroke="#0078D4" stroke-width="0.8"/>
          <rect x="10" y="10.5" width="4" height="3" rx="0.6" fill="#50E6FF" stroke="#0078D4" stroke-width="0.8"/>
          <path d="M8 5V7.8M4 10.5V7.8H12V10.5" stroke="#0078D4" stroke-width="1.1"/>
        }
        @case ('cad-cargos') {
          <rect x="2" y="5" width="12" height="8.5" rx="1.4" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M5.5 5V3.5C5.5 2.9 6 2.5 6.5 2.5H9.5C10 2.5 10.5 2.9 10.5 3.5V5" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M2 8.5H14" stroke="#00A4EF" stroke-width="1.1"/>
        }
        @case ('cad-funcoes') {
          <path d="M8 2L9.8 5.8L14 6.4L11 9.3L11.7 13.5L8 11.5L4.3 13.5L5 9.3L2 6.4L6.2 5.8L8 2Z" fill="#FFB900" stroke="#F7630C" stroke-width="0.9" stroke-linejoin="round"/>
        }
        @case ('cad-categorias') {
          <path d="M2.5 3.5H8L13.5 9L9 13.5L3.5 8V3.5Z" fill="#E6F4FF" stroke="#00A4EF" stroke-width="1.2" stroke-linejoin="round"/>
          <circle cx="5.8" cy="6" r="1" fill="#0078D4"/>
        }
        @case ('cad-servidores') {
          <rect x="2" y="3" width="12" height="10" rx="1.4" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.2"/>
          <circle cx="6" cy="7.2" r="1.6" fill="#00A4EF"/>
          <path d="M3.8 11C4.2 9.8 5 9.3 6 9.3C7 9.3 7.8 9.8 8.2 11" stroke="#0078D4" stroke-width="1.1" stroke-linecap="round"/>
          <path d="M9.5 6.8H12.2M9.5 9.5H12.2" stroke="#0078D4" stroke-width="1.1" stroke-linecap="round"/>
        }
        @case ('cad-lotacoes') {
          <path d="M8 14C8 14 12.5 9.8 12.5 6.5C12.5 4 10.5 2 8 2C5.5 2 3.5 4 3.5 6.5C3.5 9.8 8 14 8 14Z" fill="#7FBA00" stroke="#5E9C31" stroke-width="1"/>
          <circle cx="8" cy="6.5" r="1.8" fill="#FFFFFF"/>
        }
        @case ('cad-gestores') {
          <path d="M2.5 12L3.5 5L6.5 8L8 4L9.5 8L12.5 5L13.5 12H2.5Z" fill="#FFB900" stroke="#F7630C" stroke-width="1" stroke-linejoin="round"/>
        }
        @case ('cad-identificadores') {
          <path d="M8 2.5C5 2.5 3 4.8 3 7.8M13 7.8C13 4.8 11 2.5 8 2.5M8 5C6.3 5 5.2 6.2 5.2 8V12.5M10.8 11V8C10.8 6.2 9.7 5 8 5M8 7.5V13.5" stroke="#0078D4" stroke-width="1.2" stroke-linecap="round"/>
        }
        @case ('cad-dispensas') {
          <circle cx="8" cy="8" r="5.8" fill="#E9F7DF" stroke="#5E9C31" stroke-width="1.2"/>
          <path d="M5.5 8.2L7.2 10L10.8 6.2" stroke="#5E9C31" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        }
        @case ('cad-jornadas') {
          <circle cx="8" cy="8" r="5.8" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M8 4.5V8H11" stroke="#00A4EF" stroke-width="1.4" stroke-linecap="round"/>
        }
        @case ('cad-escalas') {
          <path d="M12.5 5.5A5 5 0 0 0 3.5 6.5M3.5 10.5A5 5 0 0 0 12.5 9.5" stroke="#0078D4" stroke-width="1.3" stroke-linecap="round"/>
          <path d="M11 5.5H13V3.5M5 10.5H3V12.5" stroke="#00A4EF" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        }
        @case ('cad-fusos') {
          <circle cx="8" cy="8" r="5.8" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.2"/>
          <ellipse cx="8" cy="8" rx="2.6" ry="5.8" stroke="#00A4EF" stroke-width="1"/>
          <path d="M2.5 8H13.5" stroke="#00A4EF" stroke-width="1"/>
        }
        @case ('cad-calendario') {
          <rect x="2.2" y="3.2" width="11.6" height="10.5" rx="1.4" fill="#FFFFFF" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M2.2 6.2H13.8" stroke="#0078D4" stroke-width="1.2"/>
          <rect x="4.5" y="8" width="2.2" height="2" rx="0.4" fill="#E81123"/>
          <rect x="8.5" y="8" width="2.2" height="2" rx="0.4" fill="#00A4EF"/>
        }
        @case ('cad-tipos-feriado') {
          <path d="M4 2.5V14" stroke="#767676" stroke-width="1.3" stroke-linecap="round"/>
          <path d="M4 3H12.5L10.8 5.5L12.5 8H4V3Z" fill="#E81123"/>
        }
        @case ('cad-tipos-afast') {
          <rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="#FFF0F0" stroke="#E81123" stroke-width="1.1"/>
          <path d="M8 5V11M5 8H11" stroke="#E81123" stroke-width="1.5" stroke-linecap="round"/>
        }
        @case ('cad-recessos') {
          <path d="M8 2V14M3 5L13 11M13 5L3 11" stroke="#00A4EF" stroke-width="1.3" stroke-linecap="round"/>
        }
        @case ('cad-regulamentacoes') {
          <path d="M3 2.5H10.5L13 5V13.5H3V2.5Z" fill="#FFF8E6" stroke="#F7630C" stroke-width="1.2"/>
          <path d="M5.2 6.8H10.8M5.2 9.4H10.8" stroke="#F7630C" stroke-width="1.1" stroke-linecap="round"/>
        }
        @case ('cad-equipamentos') {
          <rect x="2" y="2.5" width="12" height="8.5" rx="1.2" fill="#50E6FF" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M6 11V13.5M10 11V13.5M4.5 13.5H11.5" stroke="#767676" stroke-width="1.2" stroke-linecap="round"/>
        }
        @case ('cad-estados') {
          <path d="M2.5 4L6 2.5L10 4L13.5 2.5V12L10 13.5L6 12L2.5 13.5V4Z" fill="#E9F7DF" stroke="#5E9C31" stroke-width="1.2" stroke-linejoin="round"/>
        }
        @case ('cad-cidades') {
          <rect x="2.5" y="6" width="4.5" height="7.5" fill="#50E6FF" stroke="#0078D4" stroke-width="1"/>
          <rect x="7" y="3" width="6.5" height="10.5" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.1"/>
          <path d="M9 5.5H11.5M9 8H11.5" stroke="#0078D4" stroke-width="1"/>
        }
        @case ('cad-usuarios') {
          <circle cx="8" cy="5.2" r="2.5" fill="#50E6FF" stroke="#0078D4" stroke-width="1.1"/>
          <path d="M3 13.5C3.4 10.8 5.4 9.2 8 9.2C10.6 9.2 12.6 10.8 13 13.5" fill="#0078D4"/>
        }
        @case ('cad-perfis') {
          <path d="M8 1.8L13.2 4V8C13.2 11.2 11 13.6 8 14.5C5 13.6 2.8 11.2 2.8 8V4L8 1.8Z" fill="#0078D4"/>
          <path d="M8 1.8V14.5C5 13.6 2.8 11.2 2.8 8V4L8 1.8Z" fill="#50E6FF"/>
        }
        @case ('cad-permissoes') {
          <circle cx="5.5" cy="8" r="2.8" fill="#FFB900" stroke="#F7630C" stroke-width="1"/>
          <path d="M8.3 8H14M11.5 8V10.5M13.5 8V10" stroke="#F7630C" stroke-width="1.3" stroke-linecap="round"/>
        }
        @case ('cad-integracoes') {
          <path d="M6 4.5V2.5M10 4.5V2.5M4.5 4.5H11.5V8C11.5 9.9 9.9 11.5 8 11.5C6.1 11.5 4.5 9.9 4.5 8V4.5Z" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M8 11.5V14" stroke="#00A4EF" stroke-width="1.4" stroke-linecap="round"/>
        }
        @case ('cad-config') {
          <path d="M2.5 5H13.5M2.5 11H13.5" stroke="#0078D4" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="5.5" cy="5" r="1.8" fill="#50E6FF" stroke="#0078D4" stroke-width="1"/>
          <circle cx="10.5" cy="11" r="1.8" fill="#7FBA00" stroke="#5E9C31" stroke-width="1"/>
        }
        @case ('homologacao-equipe') {
          <circle cx="8" cy="8" r="5.8" fill="#6BB700"/>
          <path d="M5.5 8.2L7.2 10L10.8 6.2" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        }
        @case ('boletim-frequencia') {
          <rect x="3" y="2.5" width="10" height="11.5" rx="1.2" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M5.5 6H10.5M5.5 8.8H10.5M5.5 11.5H8.5" stroke="#00A4EF" stroke-width="1.2" stroke-linecap="round"/>
        }
        @case ('perfis-rbac') {
          <path d="M8 1.8L13.2 4V8C13.2 11.2 11 13.6 8 14.5C5 13.6 2.8 11.2 2.8 8V4L8 1.8Z" fill="#0078D4"/>
          <circle cx="8" cy="8" r="2" fill="#50E6FF"/>
        }
        @default {
          <path d="M3.5 2.5H10.5L13 5V13.5H3.5V2.5Z" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.2"/>
          <path d="M5.5 7.5H10.5M5.5 10.2H9" stroke="#00A4EF" stroke-width="1.2" stroke-linecap="round"/>
        }
      }
    </svg>
  `,
})
export class MenuItemIconComponent {
  @Input() itemId = '';
  @Input() sizeClass = 'w-4 h-4';
}
