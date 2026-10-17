import type { ReactNode } from 'react';

export interface DataCollectionRow {
  category: string;
  source: string;
  purpose: string;
  gdprBasis: string;
  lgpdBasis: string;
}

export interface ThirdPartyProcessorRow {
  thirdParty: string;
  dataReceived: string;
  purpose: string;
}

export interface CookiePolicyRow {
  name: string;
  type: string;
  purpose: string;
  duration: string;
  consentRequired: string;
}

export interface UserRightRow {
  right: string;
  implementation: string;
}

export interface LegalTextSection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface PrivacyPolicyContent {
  title: string;
  subtitle: string;
  lastUpdated: string;
  onThisPage: string;
  backToPlanner: string;
  introSection: LegalTextSection;
  dataCollectionSection: {
    id: string;
    title: string;
    intro: string;
    headers: {
      category: string;
      source: string;
      purpose: string;
      gdprBasis: string;
      lgpdBasis: string;
    };
    rows: DataCollectionRow[];
    consentNote: string;
  };
  dataNotCollectedSection: LegalTextSection;
  thirdPartySection: {
    id: string;
    title: string;
    intro: string;
    headers: {
      thirdParty: string;
      dataReceived: string;
      purpose: string;
    };
    rows: ThirdPartyProcessorRow[];
  };
  cookiePolicySection: {
    id: string;
    title: string;
    intro: string;
    headers: {
      name: string;
      type: string;
      purpose: string;
      duration: string;
      consentRequired: string;
    };
    rows: CookiePolicyRow[];
    noBannerNotice: string;
    googleCookieNote: string;
  };
  userRightsSection: {
    id: string;
    title: string;
    intro: string;
    headers: {
      right: string;
      implementation: string;
    };
    rows: UserRightRow[];
  };
  retentionSection: LegalTextSection;
  securitySection: LegalTextSection;
  contactSection: LegalTextSection;
}

export interface TermsOfServiceContent {
  title: string;
  subtitle: string;
  lastUpdated: string;
  onThisPage: string;
  backToPlanner: string;
  sections: LegalTextSection[];
}

export interface LegalLayoutSectionItem {
  id: string;
  title: string;
}

export interface LegalLayoutProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  onThisPage: string;
  backToPlanner: string;
  toc: LegalLayoutSectionItem[];
  children: ReactNode;
}
