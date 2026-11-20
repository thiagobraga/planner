import { useId, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiCreateComment, fetchTaskComments } from '../../api/client';
import { commentsQueryKey } from '../../utils/commentSync';
import { useI18n } from '../../i18n/I18nContext';

export function DetailActivity({ taskId }: { taskId: string }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const headingId = useId();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const { data: comments = [] } = useQuery({ queryKey: commentsQueryKey(taskId), queryFn: () => fetchTaskComments(taskId) });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setFailed(false);
    try {
      await apiCreateComment(taskId, text);
      setBody('');
      await qc.invalidateQueries({ queryKey: commentsQueryKey(taskId) });
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="detail-section detail-section--ruled" aria-labelledby={headingId}>
      <h3 id={headingId} className="detail-section-label">{t('detail.activity')}</h3>
      {comments.length === 0 ? (
        <p className="detail-muted detail-empty">{t('detail.commentsEmpty')}</p>
      ) : (
        <ol className="detail-comments">
          {comments.map((comment) => (
            <li key={comment.id}>
              <time dateTime={comment.createdAt}>
                {new Date(comment.createdAt).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </time>
              <p>{comment.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form className="detail-comment-form" onSubmit={submit}>
        <textarea
          aria-label={t('detail.commentLabel')}
          placeholder={t('detail.commentPlaceholder')}
          rows={2}
          value={body}
          maxLength={5000}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit(event);
          }}
        />
        <div className="detail-comment-actions">
          {failed && <span role="alert" className="detail-error-text">{t('detail.commentFailed')}</span>}
          <button type="submit" className="detail-button" disabled={sending || body.trim() === ''}>{t('detail.commentSend')}</button>
        </div>
      </form>
    </section>
  );
}
