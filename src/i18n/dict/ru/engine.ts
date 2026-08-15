// Тексты движка: автоматические статьи ДДС, контрольные суммы, ошибки формул
// и разбора сумм. Эти строки рождаются вне компонентов, поэтому t() зовётся там
// с явной локалью — см. правило в src/store/uiSlice.ts.

export const engine = {
  // Автоматический отчёт ДДС. Эти статьи не сохраняются в снимок: они
  // синтезируются при каждой сборке отчёта, поэтому переводятся вживую.
  'autocf.section.in': 'Поступления',
  'autocf.section.out': 'Списания',
  'autocf.section.balances': 'Остатки по счетам',
  'autocf.noCategory': 'Без категории',
  'autocf.total.in': 'ИТОГО поступления',
  'autocf.total.out': 'ИТОГО списания',
  'autocf.total.balance': 'ИТОГО остаток',
  'autocf.net': 'Чистый поток (поступления − списания)',

  // Контрольные суммы: заголовок проверки и подписи расхождений.
  'checks.rates.title': 'Курсы валют заданы на даты операций',
  'checks.rates.issue': '{date}: нет курса {currency}',
  'checks.rates.issueWithDesc': '{date}: нет курса {currency} · {desc}',
  'checks.balance.title': 'Остаток на начало + приход − расход = остаток на конец',
  'checks.balance.issue': '{period}: расхождение остатка',
  'checks.transfer.title': 'Переброска: сумма проводок = 0',
  'checks.transfer.issue': '{date} · {desc}',
  'checks.typeCategory.title': 'Переброски вне прихода/расхода (тип ↔ категория)',
  'checks.typeCategory.issue': '{date} · {desc}: тип «{type}» ≠ направление категории «{dir}»',
  'checks.emptyZero.title': 'Операции без проводок или с нулевой суммой',
  'checks.emptyZero.noLines': '{date} · {desc}: нет проводок',
  'checks.emptyZero.zero': '{date} · {desc}: нулевая сумма',
  'checks.dateRange.title': 'Даты в пределах периодов проекта',
  'checks.dateRange.issue': '{date} · {desc}: вне диапазона проекта',
  'checks.plRevenue.title': 'Выручка неотрицательна',
  'checks.plRevenue.issue': '{period}: выручка отрицательна',
  'checks.plNet.title': 'Нет убытка по периодам',
  'checks.plNet.issue': '{period}: убыток',

  // Дашборд: срез «прочее» в донате расходов (строится в селекторе, не в JSX).
  'dashboard.other': 'Прочее',

  // --- Сообщения слоя данных ---
  // Это литералы ФРОНТА, выбранные по res.status: поле detail из ответа сервера
  // приложение никогда не читает (grep '.detail' по src/ пуст). Поэтому
  // локализация здесь даёт всю видимую пользу, не трогая сервер.
  'net.error.load': 'Сервер вернул {status} при загрузке',
  'net.error.save': 'Сервер вернул {status} при сохранении',
  'net.error.clear': 'Сервер вернул {status} при очистке',
  'net.error.reportList': 'Сервер вернул {status} при загрузке списка отчётов',
  'net.error.reportCreate': 'Сервер вернул {status} при создании отчёта',
  'net.error.reportRename': 'Сервер вернул {status} при переименовании',
  'net.error.reportDelete': 'Сервер вернул {status} при удалении',
  'net.error.status': 'Сервер вернул {status}',
  'net.error.noSession': 'Нет активной сессии',
  'net.error.notOurFile': 'Не похоже на файл финансовых отчётов',

  // --- Выгрузка в Excel ---
  // ВИДИМЫЕ имена листов и заголовки — обычный текст, переводится.
  // Имя скрытого листа-снимка «Данные» НЕ переводится: это контракт формата
  // (см. data/xlsx.ts и тест data/xlsx.contract.test.ts).
  'xlsx.sheet.report': 'Отчёт',
  'xlsx.sheet.dashboard': 'Дашборд',
  'xlsx.sheet.journal': 'Журнал',
  'xlsx.dash.title': 'Дашборд ДДС',
  'xlsx.dash.kpis': 'Ключевые показатели',
  'xlsx.dash.totalIn': 'Итого поступления',
  'xlsx.dash.totalOut': 'Итого списания',
  'xlsx.dash.result': 'Чистый результат',
  'xlsx.dash.ending': 'Остаток на конец',
  'xlsx.dash.monthly': 'Помесячно',
  'xlsx.dash.in': 'Приход',
  'xlsx.dash.out': 'Расход',
  'xlsx.dash.res': 'Результат',
  'xlsx.dash.balance': 'Остаток',
  'xlsx.dash.byCategory': 'Расходы по категориям',
  'xlsx.dash.amount': 'Сумма',
  'xlsx.dash.share': 'Доля',
  'xlsx.error.noSheet': 'Файл без листа «{sheet}» — экспортируйте его из этого приложения',
  'xlsx.error.emptySheet': 'Лист «{sheet}» пуст или повреждён',

  // Разбор сумм и периодов.
  'error.money.amount': 'Некорректная сумма: {value}',
  'error.money.input': 'Некорректная сумма: «{value}»',
  'error.period.date': 'Некорректная дата операции: «{date}»',
  'error.period.range': 'Некорректный диапазон периодов: {start}..{end}',

  // Формулы шаблона отчёта. Видны пользователю в редакторе шаблона.
  'error.formula.needMoney': 'Ожидалась денежная величина, получен дробный скаляр',
  'error.formula.unknownRef': 'Неизвестная ссылка на статью «{code}»',
  'error.formula.childrenOutsideSum': '«children» допустимо только как аргумент SUM',
  'error.formula.addMoneyScalar': 'Нельзя складывать деньги и скаляр',
  'error.formula.mulMoneyMoney': 'Нельзя перемножать две денежные величины',
  'error.formula.divZero': 'Деление на ноль',
  'error.formula.divScalarByMoney': 'Некорректное деление скаляра на деньги',
  'error.formula.noFormula': 'У calc-статьи «{code}» нет формулы',
  'error.formula.inItem': 'Ошибка в формуле статьи «{code}»: {message}',
  'error.formula.unexpectedChar': 'Неожиданный символ «{char}»',
  'error.formula.expected': 'Ожидался «{expected}», получено «{got}»',
  'error.formula.trailingInput': 'Лишний ввод после выражения: «{value}»',
  'error.formula.unknownFunction': 'Неизвестная функция «{name}»',
  'error.formula.unexpectedToken': 'Неожиданный токен «{value}»',
  'error.formula.arity': 'Функция {name} ожидает {want} аргумент(ов), получено {got}',
  'error.formula.cycle': 'Циклическая зависимость статей: {cycle}',
} as const
