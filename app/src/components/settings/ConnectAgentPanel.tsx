import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '../ui/Button';
import { useI18n } from '../../i18n/I18nContext';
import { claudeCodeCommand, mcpJsonConfig, mcpUrl, TOKEN_PLACEHOLDER } from '../../utils/mcpSnippets';

const labelClass = 'text-[10px] leading-6 tracking-[0.12em] uppercase text-ink-light font-medium';

function Snippet({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className={labelClass}>{label}</span>
        <Button
          variant="tertiary"
          size="sm"
          onClick={handleCopy}
          aria-label={`${t('settings.apiTokens.copy')} ${label}`}
          leftIcon={copied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
        >
          {copied ? t('settings.apiTokens.copied') : t('settings.apiTokens.copy')}
        </Button>
      </div>
      <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-all rounded-[6px] border border-border bg-[var(--planner-control-bg)] px-3 py-3 font-[inherit] text-[13px] leading-6 text-ink">
        {value}
      </pre>
    </div>
  );
}

/** Copy-paste setup for MCP clients; fills in the real token while it is still on screen. */
export function ConnectAgentPanel({ token }: { token?: string }) {
  const { t } = useI18n();
  const url = mcpUrl(window.location.origin);
  const secret = token ?? TOKEN_PLACEHOLDER;

  return (
    <section className="space-y-6 border-t border-[var(--planner-settings-separator)] pt-6" aria-labelledby="connect-agent-heading">
      <div>
        <h3 id="connect-agent-heading" className={labelClass}>
          {t('settings.connectAgent.title')}
        </h3>
        <p className="m-0 text-[13px] leading-6 text-ink-light">
          {token ? t('settings.connectAgent.withToken') : t('settings.connectAgent.description')}
        </p>
      </div>
      <Snippet label={t('settings.connectAgent.url')} value={url} />
      <Snippet label="Claude Code" value={claudeCodeCommand(url, secret)} />
      <Snippet label={t('settings.connectAgent.json')} value={mcpJsonConfig(url, secret)} />
    </section>
  );
}
