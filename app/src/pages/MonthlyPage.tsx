import { useMemo, useState } from 'react';
import { MonthlyRows } from '../components/monthly/MonthlyRows';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { Toolbar } from '../components/ui/Toolbar';
import { getPhrase } from '../utils/phrases';
import { useI18n } from '../i18n/I18nContext';

export function MonthlyPage() {
  const { locale, t } = useI18n();
  const phrase = useMemo(() => getPhrase('monthly', locale), [locale]);
  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  return (
    <div className="monthly-page relative w-full">
      <PageHeader
        title={t('page.monthly')}
        subtitle={phrase}
        toolbar={
          <Toolbar className="monthly-page-header-controls">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setSelected({ year: today.getFullYear(), month: today.getMonth() })}
            >
              {t('page.today')}
            </Button>
          </Toolbar>
        }
      />

      <div className="max-w-[832px]">
        <div className="h-6" />

        <MonthlyRows
          year={selected.year}
          month={selected.month}
          onMonthChange={(year, month) => setSelected({ year, month })}
        />
      </div>
    </div>
  );
}
