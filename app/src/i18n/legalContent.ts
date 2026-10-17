import type { Locale } from './I18nContext';
import type { PrivacyPolicyContent, TermsOfServiceContent } from '../types/legal';

const privacyEnglish: PrivacyPolicyContent = {
  title: 'Privacy Policy',
  subtitle: 'How Planner collects, processes, and protects your data under GDPR and LGPD',
  lastUpdated: 'Last updated: August 7, 2026',
  onThisPage: 'On This Page',
  backToPlanner: 'Back to Planner',
  introSection: {
    id: 'overview',
    title: 'Overview',
    paragraphs: [
      'Planner is a Bullet Journal-inspired task and habit manager. We believe your personal tasks, notes, and habits belong to you. This Privacy Policy explains what personal data we collect, why we process it, the legal basis under the European Union General Data Protection Regulation (GDPR) and the Brazilian General Data Protection Law (LGPD - Lei No. 13.709/2018), and how you can exercise your data rights.',
    ],
  },
  dataCollectionSection: {
    id: 'data-collection',
    title: 'Data We Collect & Legal Basis',
    intro: 'We collect only the minimum data necessary to operate your account and provide Planner features:',
    headers: {
      category: 'Data Category',
      source: 'Source',
      purpose: 'Purpose',
      gdprBasis: 'Legal Basis (GDPR)',
      lgpdBasis: 'Legal Basis (LGPD)',
    },
    rows: [
      {
        category: 'Email address',
        source: 'Registration / Google OAuth',
        purpose: 'Account identification, login',
        gdprBasis: 'Art. 6(1)(b) - contractual necessity',
        lgpdBasis: 'Art. 7(V) - contract execution',
      },
      {
        category: 'Display name',
        source: 'Registration / Google OAuth',
        purpose: 'Personalization',
        gdprBasis: 'Art. 6(1)(b) - contractual necessity',
        lgpdBasis: 'Art. 7(V) - contract execution',
      },
      {
        category: 'Password hash',
        source: 'Registration',
        purpose: 'Authentication',
        gdprBasis: 'Art. 6(1)(b) - contractual necessity',
        lgpdBasis: 'Art. 7(V) - contract execution',
      },
      {
        category: 'Google user ID',
        source: 'Google OAuth',
        purpose: 'Account linking',
        gdprBasis: 'Art. 6(1)(b) - contractual necessity',
        lgpdBasis: 'Art. 7(V) - contract execution',
      },
      {
        category: 'Tasks, notes, events',
        source: 'User input',
        purpose: 'Core service functionality',
        gdprBasis: 'Art. 6(1)(b) - contractual necessity',
        lgpdBasis: 'Art. 7(V) - contract execution',
      },
      {
        category: 'Collections, labels',
        source: 'User input',
        purpose: 'Organization features',
        gdprBasis: 'Art. 6(1)(b) - contractual necessity',
        lgpdBasis: 'Art. 7(V) - contract execution',
      },
      {
        category: 'Habits, completions',
        source: 'User input',
        purpose: 'Habit tracking feature',
        gdprBasis: 'Art. 6(1)(b) - contractual necessity',
        lgpdBasis: 'Art. 7(V) - contract execution',
      },
      {
        category: 'Session data',
        source: 'Automatic',
        purpose: 'Authentication, security',
        gdprBasis: 'Art. 6(1)(f) - legitimate interest',
        lgpdBasis: 'Art. 7(IX) - legitimate interest',
      },
      {
        category: 'IP address (rate limiting)',
        source: 'Automatic (Redis, not persisted)',
        purpose: 'Abuse prevention',
        gdprBasis: 'Art. 6(1)(f) - legitimate interest',
        lgpdBasis: 'Art. 7(IX) - legitimate interest',
      },
      {
        category: 'User preferences',
        source: 'User input',
        purpose: 'Personalization',
        gdprBasis: 'Art. 6(1)(b) - contractual necessity',
        lgpdBasis: 'Art. 7(V) - contract execution',
      },
      {
        category: 'Google Calendar tokens',
        source: 'Google OAuth (calendar scope)',
        purpose: 'Calendar sync feature',
        gdprBasis: 'Art. 6(1)(a) - explicit consent',
        lgpdBasis: 'Art. 7(I) - consent',
      },
    ],
    consentNote:
      'Calendar sync uses explicit consent (not contractual necessity) because it is an optional feature you explicitly opt into. You can withdraw consent at any time by disconnecting your calendar in Settings.',
  },
  dataNotCollectedSection: {
    id: 'data-not-collected',
    title: 'Data Not Collected',
    items: [
      'No analytics or tracking cookies',
      'No advertising identifiers or behavioral profiling',
      'No browsing history',
      'No profile pictures (Google profile photo is not stored)',
      'No Google access or refresh tokens for sign-in (the Google ID token is verified server-side and immediately discarded)',
    ],
  },
  thirdPartySection: {
    id: 'third-party-processors',
    title: 'Third-Party Data Processors',
    intro: 'We do not sell or rent your personal data. Data is shared only with third-party processors when you use optional authentication or integration features:',
    headers: {
      thirdParty: 'Third Party',
      dataReceived: 'What They Receive',
      purpose: 'Purpose',
    },
    rows: [
      {
        thirdParty: 'Google (OAuth)',
        dataReceived: 'Email, name (from Google to us)',
        purpose: 'Authentication',
      },
      {
        thirdParty: 'Google (Calendar API)',
        dataReceived: 'Event titles, dates, times (from us to Google)',
        purpose: 'Calendar sync (opt-in)',
      },
    ],
  },
  cookiePolicySection: {
    id: 'cookie-policy',
    title: 'Cookie Policy',
    intro: 'Planner uses only strictly necessary cookies required to keep you signed in and protect your account against Cross-Site Request Forgery (CSRF):',
    headers: {
      name: 'Cookie',
      type: 'Type',
      purpose: 'Purpose',
      duration: 'Duration',
      consentRequired: 'Consent Required?',
    },
    rows: [
      {
        name: 'planner_session / __Host-planner_session',
        type: 'Strictly necessary',
        purpose: 'Authentication session',
        duration: 'Sliding 30-day idle / 90-day absolute',
        consentRequired: 'No - strictly necessary',
      },
      {
        name: 'planner_csrf / __Host-planner_csrf',
        type: 'Strictly necessary',
        purpose: 'CSRF protection',
        duration: 'Session',
        consentRequired: 'No - strictly necessary',
      },
    ],
    noBannerNotice:
      'No cookie consent banner is required because all cookies set by Planner are strictly necessary for authentication and security. We do not use analytics, marketing, or third-party tracking cookies.',
    googleCookieNote:
      'When the Google Identity Services (GIS) library is loaded for Google sign-in, Google may set its own cookies governed by Google Privacy Policy as strictly necessary for the OAuth flow.',
  },
  userRightsSection: {
    id: 'user-rights',
    title: 'Your Rights (GDPR Chapter III / LGPD Chapter III)',
    intro: 'Under GDPR and LGPD, you have the following rights over your personal data:',
    headers: {
      right: 'Right',
      implementation: 'How to Exercise in Planner',
    },
    rows: [
      {
        right: 'Access (GDPR Art. 15 / LGPD Art. 18(II))',
        implementation: 'Data export in Settings > General > Data & Privacy',
      },
      {
        right: 'Rectification (GDPR Art. 16 / LGPD Art. 18(III))',
        implementation: 'Edit your tasks, collections, and preferences directly in Planner',
      },
      {
        right: 'Erasure (GDPR Art. 17 / LGPD Art. 18(VI))',
        implementation: 'Delete account in Settings > General > Data & Privacy - cascading deletion of all data',
      },
      {
        right: 'Data portability (GDPR Art. 20 / LGPD Art. 18(V))',
        implementation: 'JSON export of all user data in Settings > General > Data & Privacy',
      },
      {
        right: 'Restriction of processing (GDPR Art. 18)',
        implementation: 'Account deactivation or contact our Data Protection Officer',
      },
      {
        right: 'Object to processing (GDPR Art. 21 / LGPD Art. 18(IV))',
        implementation: 'Contact our Data Protection Officer',
      },
      {
        right: 'Withdraw consent (GDPR Art. 7(3) / LGPD Art. 8(5))',
        implementation: 'Disconnect Google Calendar or connected apps in Settings > Integrations',
      },
    ],
  },
  retentionSection: {
    id: 'data-retention',
    title: 'Data Retention',
    items: [
      'Account data: retained while your account remains active',
      'Session data: automatically expires after 30 days of inactivity or 90 days absolute lifetime',
      'Rate limiting data: stored in Redis memory only and automatically expires after 15 minutes',
      'Deleted account: all database records are permanently removed immediately upon account deletion, and any residual backups expire within 30 days',
      'Google Calendar and OAuth tokens: deleted immediately when disconnected or when your account is deleted',
    ],
  },
  securitySection: {
    id: 'data-security',
    title: 'Data Security',
    items: [
      'Passwords hashed with Argon2id',
      'Sessions and API tokens use 256-bit random opaque tokens stored as SHA-256 hashes in the database',
      'Google Calendar tokens encrypted at rest using AES-256-GCM',
      'All network traffic encrypted over HTTPS (TLS 1.2+)',
      'Session cookies protected with HttpOnly, Secure, and SameSite=Lax attributes plus double-submit CSRF tokens',
    ],
  },
  contactSection: {
    id: 'contact',
    title: 'Contact & Data Protection Officer (Encarregado)',
    paragraphs: [
      'For privacy inquiries, data subject requests, or to contact our Data Protection Officer (Encarregado pelo Tratamento de Dados Pessoais under LGPD Art. 41):',
      'Email: privacy@thiagobraga.dev',
    ],
  },
};

const privacyPortugueseBrazil: PrivacyPolicyContent = {
  title: 'Política de Privacidade',
  subtitle: 'Como o Planner coleta, processa e protege seus dados sob a LGPD e o GDPR',
  lastUpdated: 'Última atualização: 7 de agosto de 2026',
  onThisPage: 'Nesta Página',
  backToPlanner: 'Voltar ao Planner',
  introSection: {
    id: 'overview',
    title: 'Visão Geral',
    paragraphs: [
      'O Planner é um gerenciador de tarefas e hábitos inspirado no método Bullet Journal. Acreditamos que suas tarefas, notas e hábitos pertencem exclusivamente a você. Esta Política de Privacidade explica quais dados pessoais coletamos, por que os tratamos, a base legal segundo a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018) e o Regulamento Geral sobre a Proteção de Dados da União Europeia (GDPR), e como você pode exercer seus direitos.',
    ],
  },
  dataCollectionSection: {
    id: 'data-collection',
    title: 'Dados Coletados e Base Legal',
    intro: 'Coletamos apenas o mínimo de dados necessário para operar sua conta e fornecer os recursos do Planner:',
    headers: {
      category: 'Categoria de Dados',
      source: 'Origem',
      purpose: 'Finalidade',
      gdprBasis: 'Base Legal (GDPR)',
      lgpdBasis: 'Base Legal (LGPD)',
    },
    rows: [
      {
        category: 'Endereço de e-mail',
        source: 'Cadastro / Google OAuth',
        purpose: 'Identificação da conta, login',
        gdprBasis: 'Art. 6(1)(b) - execução de contrato',
        lgpdBasis: 'Art. 7(V) - execução de contrato',
      },
      {
        category: 'Nome de exibição',
        source: 'Cadastro / Google OAuth',
        purpose: 'Personalização',
        gdprBasis: 'Art. 6(1)(b) - execução de contrato',
        lgpdBasis: 'Art. 7(V) - execução de contrato',
      },
      {
        category: 'Hash de senha',
        source: 'Cadastro',
        purpose: 'Autenticação',
        gdprBasis: 'Art. 6(1)(b) - execução de contrato',
        lgpdBasis: 'Art. 7(V) - execução de contrato',
      },
      {
        category: 'ID de usuário Google',
        source: 'Google OAuth',
        purpose: 'Vinculação de conta',
        gdprBasis: 'Art. 6(1)(b) - execução de contrato',
        lgpdBasis: 'Art. 7(V) - execução de contrato',
      },
      {
        category: 'Tarefas, notas, eventos',
        source: 'Entrada do usuário',
        purpose: 'Funcionalidade principal do serviço',
        gdprBasis: 'Art. 6(1)(b) - execução de contrato',
        lgpdBasis: 'Art. 7(V) - execução de contrato',
      },
      {
        category: 'Coleções, etiquetas',
        source: 'Entrada do usuário',
        purpose: 'Recursos de organização',
        gdprBasis: 'Art. 6(1)(b) - execução de contrato',
        lgpdBasis: 'Art. 7(V) - execução de contrato',
      },
      {
        category: 'Hábitos, conclusões',
        source: 'Entrada do usuário',
        purpose: 'Rastreamento de hábitos',
        gdprBasis: 'Art. 6(1)(b) - execução de contrato',
        lgpdBasis: 'Art. 7(V) - execução de contrato',
      },
      {
        category: 'Dados de sessão',
        source: 'Automático',
        purpose: 'Autenticação e segurança',
        gdprBasis: 'Art. 6(1)(f) - legítimo interesse',
        lgpdBasis: 'Art. 7(IX) - legítimo interesse',
      },
      {
        category: 'Endereço IP (limite de requisições)',
        source: 'Automático (Redis, não persistido)',
        purpose: 'Prevenção de abuso',
        gdprBasis: 'Art. 6(1)(f) - legítimo interesse',
        lgpdBasis: 'Art. 7(IX) - legítimo interesse',
      },
      {
        category: 'Preferências do usuário',
        source: 'Entrada do usuário',
        purpose: 'Personalização',
        gdprBasis: 'Art. 6(1)(b) - execução de contrato',
        lgpdBasis: 'Art. 7(V) - execução de contrato',
      },
      {
        category: 'Tokens do Google Calendar',
        source: 'Google OAuth (escopo de calendário)',
        purpose: 'Sincronização de calendário',
        gdprBasis: 'Art. 6(1)(a) - consentimento explícito',
        lgpdBasis: 'Art. 7(I) - consentimento',
      },
    ],
    consentNote:
      'A sincronização com o Google Calendar utiliza consentimento explícito (e não execução de contrato) por ser um recurso opcional. Você pode revogar seu consentimento a qualquer momento desconectando seu calendário nas Configurações.',
  },
  dataNotCollectedSection: {
    id: 'data-not-collected',
    title: 'Dados Não Coletados',
    items: [
      'Sem cookies de análise (analytics) ou rastreamento',
      'Sem identificadores publicitários ou criação de perfil comportamental',
      'Sem histórico de navegação',
      'Sem fotos de perfil (a foto do perfil do Google não é armazenada)',
      'Sem armazenamento de tokens de acesso ou atualização do Google no login (o ID token é verificado no servidor e descartado imediatamente)',
    ],
  },
  thirdPartySection: {
    id: 'third-party-processors',
    title: 'Operadores de Dados Terceiros',
    intro: 'Não vendemos nem alugamos seus dados pessoais. Os dados são compartilhados apenas com operadores terceiros quando você utiliza recursos opcionais de autenticação ou integração:',
    headers: {
      thirdParty: 'Terceiro',
      dataReceived: 'Dados Recebidos',
      purpose: 'Finalidade',
    },
    rows: [
      {
        thirdParty: 'Google (OAuth)',
        dataReceived: 'E-mail, nome (do Google para o Planner)',
        purpose: 'Autenticação',
      },
      {
        thirdParty: 'Google (Calendar API)',
        dataReceived: 'Títulos, datas e horários de eventos (do Planner para o Google)',
        purpose: 'Sincronização de calendário (opcional)',
      },
    ],
  },
  cookiePolicySection: {
    id: 'cookie-policy',
    title: 'Política de Cookies',
    intro: 'O Planner utiliza apenas cookies estritamente necessários para manter sua sessão autenticada e proteger sua conta contra ataques CSRF (Cross-Site Request Forgery):',
    headers: {
      name: 'Cookie',
      type: 'Tipo',
      purpose: 'Finalidade',
      duration: 'Duração',
      consentRequired: 'Requer Consentimento?',
    },
    rows: [
      {
        name: 'planner_session / __Host-planner_session',
        type: 'Estritamente necessário',
        purpose: 'Sessão de autenticação',
        duration: '30 dias de inatividade / 90 dias absolutos',
        consentRequired: 'Não - estritamente necessário',
      },
      {
        name: 'planner_csrf / __Host-planner_csrf',
        type: 'Estritamente necessário',
        purpose: 'Proteção CSRF',
        duration: 'Sessão',
        consentRequired: 'Não - estritamente necessário',
      },
    ],
    noBannerNotice:
      'Nenhum banner de consentimento de cookies é necessário porque todos os cookies definidos pelo Planner são estritamente necessários para autenticação e segurança. Não utilizamos cookies de análise, marketing ou rastreamento.',
    googleCookieNote:
      'Quando a biblioteca Google Identity Services (GIS) é carregada para login com o Google, o Google pode definir seus próprios cookies regidos pela Política de Privacidade do Google como estritamente necessários para o fluxo OAuth.',
  },
  userRightsSection: {
    id: 'user-rights',
    title: 'Seus Direitos (LGPD Capítulo III / GDPR Capítulo III)',
    intro: 'Nos termos da LGPD (Art. 18) e do GDPR, você possui os seguintes direitos sobre seus dados pessoais:',
    headers: {
      right: 'Direito',
      implementation: 'Como Exercer no Planner',
    },
    rows: [
      {
        right: 'Acesso (GDPR Art. 15 / LGPD Art. 18(II))',
        implementation: 'Exportação de dados em Configurações > Geral > Dados e Privacidade',
      },
      {
        right: 'Correção (GDPR Art. 16 / LGPD Art. 18(III))',
        implementation: 'Edite suas tarefas, coleções e preferências diretamente no Planner',
      },
      {
        right: 'Eliminação (GDPR Art. 17 / LGPD Art. 18(VI))',
        implementation: 'Excluir conta em Configurações > Geral > Dados e Privacidade - exclusão em cascata de todos os dados',
      },
      {
        right: 'Portabilidade (GDPR Art. 20 / LGPD Art. 18(V))',
        implementation: 'Exportação em JSON de todos os dados em Configurações > Geral > Dados e Privacidade',
      },
      {
        right: 'Limitação do tratamento (GDPR Art. 18)',
        implementation: 'Desativação da conta ou contato com o Encarregado (DPO)',
      },
      {
        right: 'Oposição ao tratamento (GDPR Art. 21 / LGPD Art. 18(IV))',
        implementation: 'Contato com o Encarregado (DPO)',
      },
      {
        right: 'Revogação do consentimento (GDPR Art. 7(3) / LGPD Art. 8(§5))',
        implementation: 'Desconectar Google Calendar ou aplicativos conectados em Configurações > Integrações',
      },
    ],
  },
  retentionSection: {
    id: 'data-retention',
    title: 'Retenção de Dados',
    items: [
      'Dados da conta: mantidos enquanto sua conta permanecer ativa',
      'Dados de sessão: expiram automaticamente após 30 dias de inatividade ou 90 dias de duração máxima',
      'Dados de limite de requisições (rate limit): armazenados apenas em memória no Redis e expiram em 15 minutos',
      'Conta excluída: todos os registros no banco de dados são removidos imediatamente no momento da exclusão, e eventuais backups expiram em até 30 dias',
      'Tokens do Google Calendar e OAuth: excluídos imediatamente ao desconectar ou excluir a conta',
    ],
  },
  securitySection: {
    id: 'data-security',
    title: 'Segurança dos Dados',
    items: [
      'Senhas protegidas com hash Argon2id',
      'Sessões e tokens de API utilizam segredos opacos aleatórios de 256 bits armazenados como hash SHA-256 no banco de dados',
      'Tokens do Google Calendar criptografados em repouso com AES-256-GCM',
      'Todo o tráfego de rede criptografado via HTTPS (TLS 1.2+)',
      'Cookies de sessão protegidos com atributos HttpOnly, Secure e SameSite=Lax, além de proteção CSRF double-submit',
    ],
  },
  contactSection: {
    id: 'contact',
    title: 'Contato e Encarregado pelo Tratamento de Dados (DPO)',
    paragraphs: [
      'Para dúvidas sobre privacidade, solicitações de titulares de dados ou contato com o Encarregado pelo Tratamento de Dados Pessoais (LGPD Art. 41 / GDPR DPO):',
      'E-mail: privacy@thiagobraga.dev',
    ],
  },
};

const termsEnglish: TermsOfServiceContent = {
  title: 'Terms of Service',
  subtitle: 'Terms and conditions for using Planner',
  lastUpdated: 'Last updated: August 7, 2026',
  onThisPage: 'On This Page',
  backToPlanner: 'Back to Planner',
  sections: [
    {
      id: 'service-description',
      title: '1. Service Description',
      paragraphs: [
        'Planner is a digital task, note, collection, and habit management application inspired by the paper Bullet Journal method. Planner provides web access, real-time synchronization across devices, and optional API and Model Context Protocol (MCP) integrations.',
      ],
    },
    {
      id: 'user-responsibilities',
      title: '2. User Responsibilities',
      paragraphs: [
        'To use Planner, you must register an account with a valid email address and keep your login credentials and personal API tokens confidential.',
      ],
      items: [
        'Provide accurate account information and maintain the security of your password and API tokens',
        'Do not use Planner for unlawful activities, spam, or unauthorized automated scraping',
        'Do not attempt to disrupt, overload, or bypass security controls or rate limits of the service',
      ],
    },
    {
      id: 'account-termination',
      title: '3. Account Termination',
      paragraphs: [
        'You may stop using Planner at any time. You can export a full JSON copy of your data and permanently delete your account from Settings > General > Data & Privacy. Account deletion immediately removes your user record and cascades across all tasks, collections, habits, labels, comments, reminders, and credentials.',
        'We reserve the right to suspend or terminate accounts that violate these Terms or abuse the service infrastructure.',
      ],
    },
    {
      id: 'intellectual-property',
      title: '4. Intellectual Property & Your Data',
      paragraphs: [
        'You retain full ownership of all tasks, notes, collections, habits, and other content you create in Planner. By using the service, you grant us only the limited right to store, process, and transmit your content solely to provide Planner to you.',
        'The Planner application source code, design system, and visual assets are owned by the project authors and licensed under the repository license.',
      ],
    },
    {
      id: 'limitation-of-liability',
      title: '5. Limitation of Liability',
      paragraphs: [
        'Planner is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, or non-infringement.',
        'To the maximum extent permitted by applicable law, Planner and its maintainers shall not be liable for any indirect, incidental, consequential, or special damages, or for any loss of data or profits arising from your use of the service. We recommend periodically exporting your data using the built-in export tool.',
      ],
    },
    {
      id: 'governing-law',
      title: '6. Governing Law',
      paragraphs: [
        'These Terms are governed by the laws of the Federative Republic of Brazil, including the Brazilian General Data Protection Law (LGPD - Lei No. 13.709/2018), without prejudice to mandatory consumer and data protection rights applicable in your jurisdiction (including the EU GDPR).',
      ],
    },
    {
      id: 'changes-to-terms',
      title: '7. Changes to Terms',
      paragraphs: [
        'We may update these Terms from time to time to reflect new features or legal requirements. When material changes are made, we will update the "Last updated" date at the top of this page and notify users via email or an in-app notice.',
      ],
    },
  ],
};

const termsPortugueseBrazil: TermsOfServiceContent = {
  title: 'Termos de Serviço',
  subtitle: 'Termos e condições para uso do Planner',
  lastUpdated: 'Última atualização: 7 de agosto de 2026',
  onThisPage: 'Nesta Página',
  backToPlanner: 'Voltar ao Planner',
  sections: [
    {
      id: 'service-description',
      title: '1. Descrição do Serviço',
      paragraphs: [
        'O Planner é uma aplicação digital de gerenciamento de tarefas, notas, coleções e hábitos inspirada no método Bullet Journal em papel. O Planner oferece acesso via web, sincronização em tempo real entre dispositivos e integrações opcionais via API e Model Context Protocol (MCP).',
      ],
    },
    {
      id: 'user-responsibilities',
      title: '2. Responsabilidades do Usuário',
      paragraphs: [
        'Para utilizar o Planner, você deve criar uma conta com um endereço de e-mail válido e manter suas credenciais de acesso e tokens de API confidenciais.',
      ],
      items: [
        'Fornecer informações cadastrais verdadeiras e manter a segurança da sua senha e tokens de API',
        'Não utilizar o Planner para atividades ilícitas, envio de spam ou coleta automatizada não autorizada',
        'Não tentar interromper, sobrecarregar ou contornar controles de segurança ou limites de requisições do serviço',
      ],
    },
    {
      id: 'account-termination',
      title: '3. Encerramento de Conta',
      paragraphs: [
        'Você pode deixar de usar o Planner a qualquer momento. Você pode exportar uma cópia completa em JSON dos seus dados e excluir permanentemente sua conta em Configurações > Geral > Dados e Privacidade. A exclusão da conta remove imediatamente seu registro de usuário e exclui em cascata todas as tarefas, coleções, hábitos, etiquetas, comentários, lembretes e credenciais.',
        'Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos ou abusem da infraestrutura do serviço.',
      ],
    },
    {
      id: 'intellectual-property',
      title: '4. Propriedade Intelectual e Seus Dados',
      paragraphs: [
        'Você mantém total propriedade sobre todas as tarefas, notas, coleções, hábitos e demais conteúdos que criar no Planner. Ao usar o serviço, você nos concede apenas o direito limitado de armazenar, processar e transmitir seu conteúdo exclusivamente para fornecer o Planner a você.',
        'O código-fonte da aplicação Planner, o sistema de design e os elementos visuais pertencem aos autores do projeto e são licenciados conforme a licença do repositório.',
      ],
    },
    {
      id: 'limitation-of-liability',
      title: '5. Limitação de Responsabilidade',
      paragraphs: [
        'O Planner é fornecido "no estado em que se encontra" e "conforme disponível", sem garantias de qualquer natureza, expressas ou implícitas.',
        'Na extensão máxima permitida pela legislação aplicável, o Planner e seus mantenedores não serão responsáveis por quaisquer danos indiretos, incidentais, especiais ou consequenciais, ou por perda de dados decorrente do uso do serviço. Recomendamos exportar periodicamente seus dados utilizando a ferramenta integrada de exportação.',
      ],
    },
    {
      id: 'governing-law',
      title: '6. Legislação Aplicável',
      paragraphs: [
        'Estes Termos são regidos pelas leis da República Federativa do Brasil, incluindo a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018) e o Marco Civil da Internet (Lei nº 12.965/2014), sem prejuízo dos direitos obrigatórios de proteção ao consumidor e de dados aplicáveis na sua jurisdição (incluindo o GDPR da União Europeia).',
      ],
    },
    {
      id: 'changes-to-terms',
      title: '7. Alterações nos Termos',
      paragraphs: [
        'Podemos atualizar estes Termos periodicamente para refletir novos recursos ou exigências legais. Quando houver alterações relevantes, atualizaremos a data de "Última atualização" no topo desta página e notificaremos os usuários por e-mail ou aviso no aplicativo.',
      ],
    },
  ],
};

export const privacyContent: Record<Locale, PrivacyPolicyContent> = {
  en: privacyEnglish,
  'pt-BR': privacyPortugueseBrazil,
};

export const termsContent: Record<Locale, TermsOfServiceContent> = {
  en: termsEnglish,
  'pt-BR': termsPortugueseBrazil,
};
