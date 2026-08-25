import { useMemo, useState } from 'react';
import { MonthlyRows } from '../components/monthly/MonthlyRows';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { Toolbar } from '../components/ui/Toolbar';
import { useI18n } from '../i18n/I18nContext';
import { getPhrase } from '../utils/phrases';

export function MonthlyPage() {
  const { t, locale } = useI18n();
  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  return (
    <div className="monthly-page relative w-full">
      <PageHeader
        title={t('page.monthly')}
        subtitle={getPhrase('monthly', locale)}
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
