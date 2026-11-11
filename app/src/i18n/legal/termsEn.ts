import type { TermsOfServiceContent } from '../../types/legal';

export const termsEnglish: TermsOfServiceContent = {
  title: 'Terms of Service',
  subtitle: 'Terms and conditions for using Bullet Planner',
  lastUpdated: 'Last updated: August 7, 2026',
  onThisPage: 'On This Page',
  backToPlanner: 'Back to Bullet Planner',
  sections: [
    {
      id: 'service-description',
      title: '1. Service Description',
      paragraphs: [
        'Bullet Planner is a digital task, note, collection, and habit management application inspired by the paper Bullet Journal method. Bullet Planner provides web access, real-time synchronization across devices, and optional API and Model Context Protocol (MCP) integrations.',
      ],
    },
    {
      id: 'user-responsibilities',
      title: '2. User Responsibilities',
      paragraphs: [
        'To use Bullet Planner, you must register an account with a valid email address and keep your login credentials and personal API tokens confidential.',
      ],
      items: [
        'Provide accurate account information and maintain the security of your password and API tokens',
        'Do not use Bullet Planner for unlawful activities, spam, or unauthorized automated scraping',
        'Do not attempt to disrupt, overload, or bypass security controls or rate limits of the service',
      ],
    },
    {
      id: 'account-termination',
      title: '3. Account Termination',
      paragraphs: [
        'You may stop using Bullet Planner at any time. You can export a full JSON copy of your data and permanently delete your account from Settings > General > Data & Privacy. Account deletion immediately removes your user record and cascades across all tasks, collections, habits, labels, comments, reminders, and credentials.',
        'We reserve the right to suspend or terminate accounts that violate these Terms or abuse the service infrastructure.',
      ],
    },
    {
      id: 'intellectual-property',
      title: '4. Intellectual Property & Your Data',
      paragraphs: [
        'You retain full ownership of all tasks, notes, collections, habits, and other content you create in Bullet Planner. By using the service, you grant us only the limited right to store, process, and transmit your content solely to provide Bullet Planner to you.',
        'The Bullet Planner application source code, design system, and visual assets are owned by the project authors and licensed under the repository license.',
      ],
    },
    {
      id: 'limitation-of-liability',
      title: '5. Limitation of Liability',
      paragraphs: [
        'Bullet Planner is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, or non-infringement.',
        'To the maximum extent permitted by applicable law, Bullet Planner and its maintainers shall not be liable for any indirect, incidental, consequential, or special damages, or for any loss of data or profits arising from your use of the service. We recommend periodically exporting your data using the built-in export tool.',
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
