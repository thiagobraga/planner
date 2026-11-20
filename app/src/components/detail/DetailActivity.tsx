import { useId, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiCreateComment, fetchTaskComments } from '../../api/client';
import { commentsQueryKey } from '../../utils/commentSync';
import { useI18n } from '../../i18n/I18nContext';

const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

/** Plain text with http(s) URLs as links; everything else stays text, so nothing is parsed as markup. */
function CommentBody({ body }: { body: string }) {
  return (
    <p>
      {body.split(URL_PATTERN).map((part, index) =>
        index % 2 === 1 ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part,
      )}
    </p>
  );
}

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
              <div className="detail-comment-meta">
                <time dateTime={comment.createdAt}>
                  {new Date(comment.createdAt).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </time>
                {comment.actorLabel && <span className="detail-comment-actor">{comment.actorLabel}</span>}
              </div>
              <CommentBody body={comment.body} />
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
