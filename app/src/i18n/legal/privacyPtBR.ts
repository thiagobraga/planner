import type { PrivacyPolicyContent } from '../../types/legal';

export const privacyPortugueseBrazil: PrivacyPolicyContent = {
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
