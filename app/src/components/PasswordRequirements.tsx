import { useI18n } from '../i18n/I18nContext';

const MIN_LENGTH = 15;
const MAX_LENGTH = 128;

const BLOCKLIST = [
  'admin', 'admin123', 'admin1234', 'administrator', 'root',
  'password', 'passw0rd', 'password123', 'senha', 'senha123', 'senha1234', 'pass',
  '123456', '12345678', '123456789', 'qwerty123', 'abc123', 'letmein', 'welcome',
  'monkey', 'dragon',  'master', 'planner', 'bulletjournal', 'bujo',
  'teste', 'test', 'testing', 'test123', 'test1234', 'test12345',
] as const;

function isCommonPassword(password: string): boolean {
  const normalized = password.toLowerCase().normalize('NFC');
  return BLOCKLIST.some((word) => normalized.includes(word) || word.includes(normalized));
}

export function passwordRequirementStatus(password: string) {
  const normalized = password.normalize('NFC');

  return {
    validLength: normalized.length >= MIN_LENGTH && normalized.length <= MAX_LENGTH,
    hasUpperAndLowercase: /\p{Ll}/u.test(normalized) && /\p{Lu}/u.test(normalized),
    hasNumber: /\p{N}/u.test(normalized),
    hasSymbol: /[^\p{L}\p{N}\s]/u.test(normalized),
    uncommon: normalized.length > 0 && !isCommonPassword(normalized),
  };
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  const { t } = useI18n();

  return (
    <li
      className="flex items-center text-[12px] leading-6"
      aria-label={`${label}: ${t(met ? 'auth.requirementMet' : 'auth.requirementNotMet')}`}
      data-met={met}
    >
      <span
        aria-hidden="true"
        style={met ? {
          fontSize: 'var(--icon-check-size, 26px)',
          transform: 'translateY(var(--icon-check-offset, 0px))',
        } : {
          fontSize: 'var(--icon-dot-size, 10px)',
          transform: 'translateY(var(--icon-dot-offset, 0px))',
        }}
        className={`w-6 shrink-0 overflow-hidden text-center leading-6 text-ink ${met ? 'font-bold' : 'font-normal'}`}
      >
        {met ? '×' : '•'}
      </span>
      <span className={met ? 'line-through text-ink-light' : 'text-ink-light'}>
        {label}
      </span>
    </li>
  );
}

export function PasswordRequirements({ password }: { password: string }) {
  const { t } = useI18n();
  const status = passwordRequirementStatus(password);

  return (
    <div className="password-requirements" aria-live="polite">
      <ul aria-label={t('auth.passwordRequirements')}>
        <Requirement met={status.validLength} label={t('auth.passwordLengthRequirement')} />
        <Requirement met={status.hasUpperAndLowercase} label={t('auth.passwordLetterRequirement')} />
        <Requirement met={status.hasNumber} label={t('auth.passwordNumberRequirement')} />
        <Requirement met={status.hasSymbol} label={t('auth.passwordSymbolRequirement')} />
        <Requirement met={status.uncommon} label={t('auth.passwordCommonRequirement')} />
      </ul>
    </div>
  );
}
