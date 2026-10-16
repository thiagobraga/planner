{
  function pad(n) { return String(n).padStart(2, '0'); }

  function getToday() {
    const now = options.now || new Date();
    return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  }

  function addDays(base, n) {
    const d = options.now ? new Date(options.now) : new Date();
    if (base) {
      const parts = base.split('-');
      d.setFullYear(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function addMonths(n) {
    const d = options.now ? new Date(options.now) : new Date();
    d.setMonth(d.getMonth() + n);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function nextWeekday(dayNum) {
    const d = options.now ? new Date(options.now) : new Date();
    const current = d.getDay();
    let diff = dayNum - current;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function monthNum(name) {
    const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
    return months[name.toLowerCase().slice(0,3)];
  }

  // The coming Saturday, or today when it already is Saturday.
  function weekend() {
    const d = options.now ? new Date(options.now) : new Date();
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function dayFirst() { return options.locale === 'pt-BR'; }

  function yearOf(y) {
    return y ? y : String((options.now || new Date()).getFullYear());
  }

  function weekdayNum(name) {
    const days = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
    return days[name.toLowerCase().slice(0,3)];
  }
}

Start
  = _ expr:Expression _ { return expr; }

Expression
  = RecurrenceWithTime
  / DateWithTime

RecurrenceWithTime
  = rec:Recurrence time:(__ TimeComponent)? {
      const result = { date: rec.date, recurrence: rec.recurrence };
      if (time && time[1]) {
        result.time = time[1];
      }
      return result;
    }

DateWithTime
  = date:DateComponent time:(__ TimeComponent)? {
      const result = { date: date };
      if (time && time[1]) {
        result.time = time[1];
      }
      return result;
    }
  / time:TimeComponent date:(__ DateComponent)? {
      const d = date && date[1] ? date[1] : getToday();
      const result = { date: d, time: time };
      return result;
    }

DateComponent
  = AbsoluteDate
  / RelativeDate
  / WeekdayExpression

AbsoluteDate
  = ISODate
  / SlashDayFirstDate
  / USDate
  / PtDayOfMonthDate
  / DayMonthYearDate
  / MonthDayYearDate
  / MonthDayDate
  / DayMonthDate

// YYYY-MM-DD
ISODate
  = year:Year "-" month:TwoDigit "-" day:TwoDigit {
      return `${year}-${month}-${day}`;
    }

// MM/DD/YYYY
USDate
  = month:TwoDigit "/" day:TwoDigit "/" year:Year {
      return `${year}-${month}-${day}`;
    }

// DD/MM[/YYYY] (pt-BR)
SlashDayFirstDate
  = &{ return dayFirst(); } day:DayNum "/" month:DayNum year:("/" @Year)? {
      return `${yearOf(year)}-${pad(month)}-${pad(day)}`;
    }

// "17 de outubro [de 2026]"
PtDayOfMonthDate
  = day:DayNum __ "de"i __ month:PtMonthName year:(__ "de"i __ @Year)? {
      return `${yearOf(year)}-${pad(month)}-${pad(day)}`;
    }

// DD MMM YYYY
DayMonthYearDate
  = day:DayNum __ month:MonthName __ year:Year {
      return `${year}-${pad(monthNum(month))}-${pad(day)}`;
    }

// MMM DD YYYY
MonthDayYearDate
  = month:MonthName __ day:DayNum __ year:Year {
      return `${year}-${pad(monthNum(month))}-${pad(day)}`;
    }

// MMM DD (assume current year)
MonthDayDate
  = month:MonthName __ day:DayNum {
      const now = options.now || new Date();
      return `${now.getFullYear()}-${pad(monthNum(month))}-${pad(day)}`;
    }

// DD MMM (assume current year)
DayMonthDate
  = day:DayNum __ month:MonthName {
      const now = options.now || new Date();
      return `${now.getFullYear()}-${pad(monthNum(month))}-${pad(day)}`;
    }

RelativeDate
  = TodayExpr
  / DayAfterTomorrowExpr
  / TomorrowExpr
  / YesterdayExpr
  / WeekendExpr
  / NextWeekdayExpr
  / InNDaysExpr
  / InNWeeksExpr
  / InNMonthsExpr

TodayExpr
  = ("today"i / "hoje"i) { return getToday(); }

DayAfterTomorrowExpr
  = "depois"i __ "de"i __ "amanha"i { return addDays(null, 2); }

TomorrowExpr
  = ("tomorrow"i / "amanha"i) { return addDays(null, 1); }

YesterdayExpr
  = ("yesterday"i / "ontem"i) { return addDays(null, -1); }

WeekendExpr
  = (("this"i / "este"i / "neste"i) __)? ("weekend"i / "fim"i __ "de"i __ "semana"i) { return weekend(); }

NextWeekdayExpr
  = ("next"i / "proxima"i / "proximo"i) __ day:Weekday {
      const dayNum = weekdayNum(day);
      const d = options.now ? new Date(options.now) : new Date();
      const current = d.getDay();
      let diff = dayNum - current;
      if (diff <= 0) diff += 7;
      // "next" always skips current week
      if (diff < 7) diff += 7;
      d.setDate(d.getDate() + diff);
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    }

InNDaysExpr
  = "in"i __ n:Integer __ "day"i "s"i? { return addDays(null, n); }
  / "em"i __ n:Integer __ "dia"i "s"i? { return addDays(null, n); }

InNWeeksExpr
  = "in"i __ n:Integer __ "week"i "s"i? { return addDays(null, n * 7); }
  / "em"i __ n:Integer __ "semana"i "s"i? { return addDays(null, n * 7); }

InNMonthsExpr
  = "in"i __ n:Integer __ "month"i "s"i? { return addMonths(n); }
  / "em"i __ n:Integer __ ("meses"i / "mes"i) { return addMonths(n); }

WeekdayExpression
  = day:Weekday {
      return nextWeekday(weekdayNum(day));
    }

Recurrence
  = EveryDay
  / EveryNDays
  / EveryNWeeks
  / EveryWeekday
  / EveryMonthOnThe
  / EveryMonth
  / EveryYear
  / PtEveryDay
  / PtEveryN
  / PtEveryWeekday
  / PtEveryWeek
  / PtEveryMonth
  / PtEveryYear

PtEvery
  = ("todos"i / "todas"i / "todo"i / "toda"i) __ (("os"i / "as"i) __)?

PtEveryDay
  = (PtEvery ("dias"i / "dia"i) / "diariamente"i) {
      return { date: getToday(), recurrence: { type: 'daily', interval: 1 } };
    }

PtEveryN
  = "a"i __ "cada"i __ n:Integer __ unit:PtUnit {
      return { date: getToday(), recurrence: { type: unit, interval: n } };
    }

PtUnit
  = ("dias"i / "dia"i) { return 'daily'; }
  / ("semanas"i / "semana"i) { return 'weekly'; }
  / ("meses"i / "mes"i) { return 'monthly'; }
  / ("anos"i / "ano"i) { return 'yearly'; }

PtEveryWeekday
  = PtEvery day:Weekday {
      const dayNum = weekdayNum(day);
      return { date: nextWeekday(dayNum), recurrence: { type: 'weekly', interval: 1, weekdays: [dayNum] } };
    }

PtEveryWeek
  = PtEvery ("semanas"i / "semana"i) {
      return { date: getToday(), recurrence: { type: 'weekly', interval: 1 } };
    }

PtEveryMonth
  = PtEvery ("meses"i / "mes"i) {
      return { date: getToday(), recurrence: { type: 'monthly', interval: 1 } };
    }

PtEveryYear
  = PtEvery ("anos"i / "ano"i) {
      return { date: getToday(), recurrence: { type: 'yearly', interval: 1 } };
    }

EveryDay
  = "every"i __ "day"i {
      return { date: getToday(), recurrence: { type: 'daily', interval: 1 } };
    }

EveryNDays
  = "every"i __ n:Integer __ "day"i "s"i? {
      return { date: getToday(), recurrence: { type: 'daily', interval: n } };
    }

EveryNWeeks
  = "every"i __ n:Integer __ "week"i "s"i? {
      return { date: getToday(), recurrence: { type: 'weekly', interval: n } };
    }

EveryWeekday
  = "every"i __ day:Weekday {
      const dayNum = weekdayNum(day);
      return { date: nextWeekday(dayNum), recurrence: { type: 'weekly', interval: 1, weekdays: [dayNum] } };
    }

EveryMonthOnThe
  = "every"i __ "month"i __ "on"i __ "the"i __ n:Integer ordSuffix {
      return { date: getToday(), recurrence: { type: 'monthly', interval: 1, dayOfMonth: n } };
    }

EveryMonth
  = "every"i __ "month"i {
      return { date: getToday(), recurrence: { type: 'monthly', interval: 1 } };
    }

EveryYear
  = "every"i __ "year"i {
      return { date: getToday(), recurrence: { type: 'yearly', interval: 1 } };
    }

// Time components
TimeComponent
  = (("at"i / "as"i) __)? time:(HourMinuteAmPm / HourAmPm / Time24 / HourH) { return time; }

// 15h, 9h, 18h30
HourH
  = hour:HourNum "h"i min:TwoDigit? {
      return `${pad(parseInt(hour, 10))}:${min || '00'}`;
    }

// H:MM am/pm or HH:MM am/pm
HourMinuteAmPm
  = hour:HourNum ":" min:TwoDigit _ period:AmPm {
      let h = parseInt(hour, 10);
      if (period === 'pm' && h !== 12) h += 12;
      if (period === 'am' && h === 12) h = 0;
      return `${pad(h)}:${min}`;
    }

// Ham/pm or H am/pm
HourAmPm
  = hour:HourNum _ period:AmPm {
      let h = parseInt(hour, 10);
      if (period === 'pm' && h !== 12) h += 12;
      if (period === 'am' && h === 12) h = 0;
      return `${pad(h)}:00`;
    }

// HH:MM or H:MM (24h)
Time24
  = hour:HourNum ":" min:TwoDigit !(_ AmPm) {
      return `${pad(parseInt(hour, 10))}:${min}`;
    }

AmPm
  = "am"i { return 'am'; }
  / "pm"i { return 'pm'; }

// Helpers
Weekday
  = "sunday"i { return "sun"; }
  / "monday"i { return "mon"; }
  / "tuesday"i { return "tue"; }
  / "wednesday"i { return "wed"; }
  / "thursday"i { return "thu"; }
  / "friday"i { return "fri"; }
  / "saturday"i { return "sat"; }
  / PtWeekday

PtWeekday
  = ("domingo"i / "dom"i) !Letter { return "sun"; }
  / ("segunda"i / "seg"i) Feira? !Letter { return "mon"; }
  / ("terca"i / "ter"i) Feira? !Letter { return "tue"; }
  / ("quarta"i / "qua"i) Feira? !Letter { return "wed"; }
  / ("quinta"i / "qui"i) Feira? !Letter { return "thu"; }
  / ("sexta"i / "sex"i) Feira? !Letter { return "fri"; }
  / ("sabado"i / "sab"i) !Letter { return "sat"; }

Feira
  = [ -] "feira"i

Letter
  = [a-z]i

// Returns the month number.
PtMonthName
  = name:$("janeiro"i / "fevereiro"i / "marco"i / "abril"i / "maio"i / "junho"i / "julho"i
         / "agosto"i / "setembro"i / "outubro"i / "novembro"i / "dezembro"i
         / "jan"i / "fev"i / "mar"i / "abr"i / "mai"i / "jun"i / "jul"i
         / "ago"i / "set"i / "out"i / "nov"i / "dez"i) !Letter {
      const months = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12 };
      return months[name.toLowerCase().slice(0,3)];
    }

MonthName
  = "january"i { return "jan"; }
  / "february"i { return "feb"; }
  / "march"i { return "mar"; }
  / "april"i { return "apr"; }
  / "may"i { return "may"; }
  / "june"i { return "jun"; }
  / "july"i { return "jul"; }
  / "august"i { return "aug"; }
  / "september"i { return "sep"; }
  / "october"i { return "oct"; }
  / "november"i { return "nov"; }
  / "december"i { return "dec"; }
  / "jan"i { return "jan"; }
  / "feb"i { return "feb"; }
  / "mar"i { return "mar"; }
  / "apr"i { return "apr"; }
  / "jun"i { return "jun"; }
  / "jul"i { return "jul"; }
  / "aug"i { return "aug"; }
  / "sep"i { return "sep"; }
  / "oct"i { return "oct"; }
  / "nov"i { return "nov"; }
  / "dec"i { return "dec"; }

ordSuffix
  = "st"i / "nd"i / "rd"i / "th"i

Year
  = digits:$([0-9][0-9][0-9][0-9]) { return digits; }

TwoDigit
  = digits:$([0-9][0-9]) { return digits; }

DayNum
  = digits:$([0-9][0-9]?) { return parseInt(digits, 10); }

HourNum
  = digits:$([0-9][0-9]?) { return digits; }

Integer
  = digits:$([0-9]+) { return parseInt(digits, 10); }

_ "optional whitespace"
  = [ \t]*

__ "whitespace"
  = [ \t]+
