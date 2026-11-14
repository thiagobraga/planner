import type { PrivacyPolicyContent } from '../../types/legal';

export const privacyEnglish: PrivacyPolicyContent = {
  title: 'Privacy Policy',
  subtitle: 'How BulletPlanner collects, processes, and protects your data under GDPR and LGPD',
  lastUpdated: 'Last updated: August 7, 2026',
  onThisPage: 'On This Page',
  backToPlanner: 'Back to BulletPlanner',
  introSection: {
    id: 'overview',
    title: 'Overview',
    paragraphs: [
      'BulletPlanner is a Bullet Journal-inspired task and habit manager. We believe your personal tasks, notes, and habits belong to you. This Privacy Policy explains what personal data we collect, why we process it, the legal basis under the European Union General Data Protection Regulation (GDPR) and the Brazilian General Data Protection Law (LGPD - Lei No. 13.709/2018), and how you can exercise your data rights.',
    ],
  },
  dataCollectionSection: {
    id: 'data-collection',
    title: 'Data We Collect & Legal Basis',
    intro: 'We collect only the minimum data necessary to operate your account and provide BulletPlanner features:',
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
    intro: 'BulletPlanner uses only strictly necessary cookies required to keep you signed in and protect your account against Cross-Site Request Forgery (CSRF):',
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
      'No cookie consent banner is required because all cookies set by BulletPlanner are strictly necessary for authentication and security. We do not use analytics, marketing, or third-party tracking cookies.',
    googleCookieNote:
      'When the Google Identity Services (GIS) library is loaded for Google sign-in, Google may set its own cookies governed by Google Privacy Policy as strictly necessary for the OAuth flow.',
  },
  userRightsSection: {
    id: 'user-rights',
    title: 'Your Rights (GDPR Chapter III / LGPD Chapter III)',
    intro: 'Under GDPR and LGPD, you have the following rights over your personal data:',
    headers: {
      right: 'Right',
      implementation: 'How to Exercise in BulletPlanner',
    },
    rows: [
      {
        right: 'Access (GDPR Art. 15 / LGPD Art. 18(II))',
        implementation: 'Data export in Settings > General > Data & Privacy',
      },
      {
        right: 'Rectification (GDPR Art. 16 / LGPD Art. 18(III))',
        implementation: 'Edit your tasks, collections, and preferences directly in BulletPlanner',
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
