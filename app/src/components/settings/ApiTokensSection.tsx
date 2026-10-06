import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Radio } from '../ui/Radio';
import { Select } from '../ui/Select';
import { ConfirmModal } from '../ConfirmModal';
import { apiCreateApiToken, apiRevokeApiToken, fetchApiTokens } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import type { ApiToken, ApiTokenExpiryDays, CreateApiTokenInput, CreatedApiToken } from '../../types/apiToken';

const API_TOKENS_KEY = ['api-tokens'] as const;

const EXPIRY_OPTIONS: Array<{ value: string; days: ApiTokenExpiryDays }> = [
  { value: '30', days: 30 },
  { value: '90', days: 90 },
  { value: '365', days: 365 },
  { value: 'never', days: null },
];

const labelClass = 'text-[10px] leading-6 tracking-[0.12em] uppercase text-ink-light font-medium';

function NewTokenForm({ onCreated, onCancel }: { onCreated: (created: CreatedApiToken) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [expiry, setExpiry] = useState('90');

  const create = useMutation({
    mutationFn: (input: CreateApiTokenInput) => apiCreateApiToken(input),
    onSuccess: onCreated,
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const option = EXPIRY_OPTIONS.find((candidate) => candidate.value === expiry);
    create.mutate({
      name: name.trim(),
      scopes: canWrite ? ['read', 'write'] : ['read'],
      expiresInDays: option ? option.days : 90,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={t('settings.apiTokens.new')}
      className="space-y-6 rounded-[8px] border border-border p-6"
    >
      <label className="block">
        <span className={labelClass}>{t('settings.apiTokens.name')}</span>
        <Input
          autoFocus
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('settings.apiTokens.namePlaceholder')}
        />
      </label>

      <fieldset>
        <legend className={labelClass}>{t('settings.apiTokens.access')}</legend>
        <div className="flex flex-wrap gap-6">
          <Radio name="api-token-access" checked={!canWrite} onChange={() => setCanWrite(false)} label={t('settings.apiTokens.readOnly')} />
          <Radio name="api-token-access" checked={canWrite} onChange={() => setCanWrite(true)} label={t('settings.apiTokens.readWrite')} />
        </div>
      </fieldset>

      <label className="block">
        <span className={labelClass}>{t('settings.apiTokens.expires')}</span>
        <Select value={expiry} onChange={(event) => setExpiry(event.target.value)}>
          {EXPIRY_OPTIONS.map(({ value, days }) => (
            <option key={value} value={value}>
              {days === null
                ? t('settings.apiTokens.never')
                : days === 365
                  ? t('settings.apiTokens.oneYear')
                  : t('settings.apiTokens.days', { count: days })}
            </option>
          ))}
        </Select>
      </label>

      {create.isError && (
        <p role="alert" className="m-0 text-[13px] leading-6 text-accent">
          {create.error instanceof Error ? create.error.message : t('settings.apiTokens.createError')}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" size="md" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" size="md" type="submit" disabled={!name.trim() || create.isPending}>
          {t('settings.apiTokens.create')}
        </Button>
      </div>
    </form>
  );
}

function RevealToken({ rawToken, onDone }: { rawToken: string; onDone: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawToken);
    setCopied(true);
  };

  return (
    <div role="status" className="space-y-3 rounded-[8px] border border-ink-light p-6">
      <p className="m-0 text-[13px] leading-6 text-ink">{t('settings.apiTokens.copyNow')}</p>
      <div className="flex gap-3">
        <Input
          readOnly
          value={rawToken}
          aria-label={t('settings.apiTokens.title')}
          className="flex-1"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          variant="secondary"
          size="lg"
          onClick={handleCopy}
          leftIcon={copied ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
        >
          {copied ? t('settings.apiTokens.copied') : t('settings.apiTokens.copy')}
        </Button>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" size="md" onClick={onDone}>
          {t('settings.apiTokens.done')}
        </Button>
      </div>
    </div>
  );
}

function TokenRow({ token, onRevoke }: { token: ApiToken; onRevoke: (token: ApiToken) => void }) {
  const { t, formatDate } = useI18n();
  const date = (iso: string) => formatDate(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric' });

  const meta = [
    `${token.tokenPrefix}…`,
    token.scopes.includes('write') ? t('settings.apiTokens.readWrite') : t('settings.apiTokens.readOnly'),
    t('settings.apiTokens.createdOn', { date: date(token.createdAt) }),
    token.lastUsedAt
      ? t('settings.apiTokens.lastUsed', { date: date(token.lastUsedAt) })
      : t('settings.apiTokens.neverUsed'),
    token.expiresAt
      ? t('settings.apiTokens.expiresOn', { date: date(token.expiresAt) })
      : t('settings.apiTokens.noExpiry'),
  ];

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="m-0 flex items-center gap-2 text-sm leading-6 font-medium text-ink">
          <KeyRound size={14} strokeWidth={1.5} className="shrink-0 text-ink-light" />
          <span className="truncate">{token.name}</span>
        </p>
        <p className="m-0 text-[12px] leading-6 text-ink-light">{meta.join(' · ')}</p>
      </div>
      <Button variant="destructive" size="sm" onClick={() => onRevoke(token)}>
        {t('settings.apiTokens.revoke')}
      </Button>
    </li>
  );
}

export function ApiTokensSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<ApiToken | null>(null);

  const { data: tokens = [], isLoading } = useQuery({ queryKey: API_TOKENS_KEY, queryFn: fetchApiTokens });

  const revoke = useMutation({
    mutationFn: (id: string) => apiRevokeApiToken(id),
    onSettled: () => qc.invalidateQueries({ queryKey: API_TOKENS_KEY }),
  });

  const handleCreated = (created: CreatedApiToken) => {
    setIsCreating(false);
    setRevealed(created.rawToken);
    void qc.invalidateQueries({ queryKey: API_TOKENS_KEY });
  };

  return (
    <section className="space-y-6" aria-labelledby="api-tokens-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="api-tokens-heading" className={labelClass}>
            {t('settings.apiTokens.title')}
          </h3>
          <p className="m-0 text-[13px] leading-6 text-ink-light">{t('settings.apiTokens.description')}</p>
        </div>
        {!isCreating && !revealed && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsCreating(true)}
            leftIcon={<Plus size={16} strokeWidth={1.5} />}
          >
            {t('settings.apiTokens.new')}
          </Button>
        )}
      </div>

      {isCreating && <NewTokenForm onCreated={handleCreated} onCancel={() => setIsCreating(false)} />}
      {revealed && <RevealToken rawToken={revealed} onDone={() => setRevealed(null)} />}

      {isLoading ? (
        <p className="m-0 text-[13px] leading-6 text-ink-light">{t('common.loading')}</p>
      ) : tokens.length === 0 ? (
        <p className="m-0 text-[13px] leading-6 text-ink-light">{t('settings.apiTokens.empty')}</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-[var(--planner-settings-separator)] p-0" aria-label={t('settings.apiTokens.title')}>
          {tokens.map((token) => (
            <TokenRow key={token.id} token={token} onRevoke={setPendingRevoke} />
          ))}
        </ul>
      )}

      <ConfirmModal
        isOpen={pendingRevoke !== null}
        title={t('settings.apiTokens.revokeTitle')}
        message={t('settings.apiTokens.revokeMessage', { name: pendingRevoke?.name ?? '' })}
        confirmLabel={t('settings.apiTokens.revoke')}
        onConfirm={() => {
          if (pendingRevoke) revoke.mutate(pendingRevoke.id);
          setPendingRevoke(null);
        }}
        onCancel={() => setPendingRevoke(null)}
      />
    </section>
  );
}
