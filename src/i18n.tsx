import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Role } from "./domain/types"
import type { ModuleId } from "./nav"
import { api, ApiError } from "./api"

export type Lang = "az" | "en" | "ru"

const THEME_KEY = "afez.theme"
const LANG_KEY = "afez.lang"
const NAV_KEY = "afez.nav"
const TOKEN_KEY = "afez.token"
const USER_KEY = "afez.user"
const MODULE_KEY = "afez.module"
const NOTICE_KEY = "afez.notice"

export const DEMO_ACCOUNT = {
  email: "admin@afez.az",
  password: "Afez2026!",
}

export type NoticeKey = "doc" | "task" | "trip" | "service" | "stock" | "invoice" | "transit" | "report"
export type Notices = Record<NoticeKey, boolean>

const NOTICE_KEYS: NoticeKey[] = ["doc", "task", "trip", "service", "stock", "invoice", "transit", "report"]

export type SessionUser = {
  userId: string
  email: string
  name: string
  role: Role
  title: string
  initials: string
}

type Theme = "light" | "dark"

const copy = {
  "mod.hesab": ["Şirkət", "Company", "Компания"],
  "mod.hesab.hint": ["Kabinet, kataloq, hesab və sifariş", "Cabinet, catalog, calculation, and orders", "Кабинет, каталог, расчёт и заказы"],
  "mod.insaat": ["İnşaat", "Construction", "Строительство"],
  "mod.insaat.hint": ["Tikinti prosesi", "Site operations", "Строительный процесс"],
  "mod.crm": ["CRM", "CRM", "CRM"],
  "mod.crm.hint": ["Sifarişçi, tapşırıq və sənəd", "Clients, tasks, and files", "Заказчики, задачи и документы"],
  "mod.maliyye": ["Maliyyə", "Finance", "Финансы"],
  "mod.maliyye.hint": ["Hesab, qaimə və borc", "Accounts, invoices, debt", "Счета, накладные и долг"],
  "mod.hrm": ["HRM", "HRM", "HRM"],
  "mod.hrm.hint": ["İşçi, davamiyyət və məzuniyyət", "People, attendance, and leave", "Сотрудники, явка и отпуск"],
  "mod.tender": ["Tender", "Tender", "Тендер"],
  "mod.tender.hint": ["Elan, BOQ və təminat", "Notice, BOQ, and bond", "Объявление, BOQ и обеспечение"],
  "mod.techizat": ["Təchizat", "Supply", "Снабжение"],
  "mod.techizat.hint": ["Bazar, anbar və istehsal", "Market, stock, and production", "Рынок, склад и производство"],
  "mod.kadr": ["Kadr", "People", "Кадры"],
  "mod.kadr.hint": ["İşçi, davamiyyət və ödəniş", "People, attendance, and pay", "Сотрудники, явка и оплата"],
  "mod.klub": ["Klub", "Club", "Клуб"],
  "mod.klub.hint": ["Əməkdaşlıq və abunə", "Partnerships and plans", "Сотрудничество и подписка"],
  "nav.cabinet": ["Kabinet", "Cabinet", "Кабинет"],
  "nav.company": ["Şirkət", "Company", "Компания"],
  "nav.drawings": ["Fayl", "Files", "Файлы"],
  "nav.catalog": ["Kataloq", "Catalog", "Каталог"],
  "nav.calc": ["Hesablama", "Calculation", "Расчёт"],
  "nav.haul": ["Daşınma", "Haulage", "Перевозка"],
  "nav.offer": ["Təklif", "Offer", "Предложение"],
  "nav.flow": ["Sifariş", "Order", "Заказ"],
  "nav.tariff": ["Tarif", "Tariff", "Тариф"],
  "nav.platform": ["Platforma", "Platform", "Платформа"],
  "nav.procure": ["Təchizat platforması", "Procurement platform", "Платформа снабжения"],
  "nav.schedule": ["Qrafik", "Schedule", "График"],
  "nav.weather": ["Hava", "Weather", "Погода"],
  "nav.spec": ["Spesifikasiya", "Specification", "Спецификация"],
  "nav.tender": ["Tender", "Tender", "Тендер"],
  "nav.boq": ["BOQ", "BOQ", "BOQ"],
  "nav.guarantee": ["Qarantiya", "Guarantee", "Гарантия"],
  "nav.market": ["Bazar", "Market", "Рынок"],
  "nav.cashflow": ["Pul axını", "Cash flow", "Денежный поток"],
  "nav.club": ["Klub", "Club", "Клуб"],
  "nav.coop": ["Əməkdaşlıq", "Cooperation", "Сотрудничество"],
  "nav.subscription": ["Abunə", "Subscription", "Подписка"],
  "nav.passport": ["Pasport", "Passport", "Паспорт"],
  "nav.checks": ["Yoxlama", "Checks", "Проверки"],
  "nav.registry": ["Tərəfdaşlar", "Partners", "Партнёры"],
  "nav.cover": ["Sığorta", "Insurance", "Страхование"],
  "nav.templates": ["Şablonlar", "Templates", "Шаблоны"],
  "nav.admin": ["İdarə", "Admin", "Админ"],
  "nav.ops": ["Əməliyyat", "Operations", "Операции"],
  "nav.resources": ["Resurslar", "Resources", "Ресурсы"],
  "nav.team": ["Komanda", "Team", "Команда"],
  "nav.hr": ["Kadrlar", "People", "Кадры"],
  "nav.sales": ["Satış", "Sales", "Продажи"],
  "nav.pipeline": ["Satış borusu", "Pipeline", "Воронка"],
  "nav.desk": ["İş masası", "Desk", "Стол"],
  "nav.homes": ["Mənzil", "Homes", "Квартиры"],
  "nav.leads": ["Potensiallar", "Leads", "Лиды"],
  "nav.deals": ["Sövdələr", "Deals", "Сделки"],
  "nav.activity": ["Fəaliyyət", "Activity", "Активность"],
  "nav.tasks": ["Tapşırıqlar", "Tasks", "Задачи"],
  "nav.files": ["Sənədlər", "Documents", "Документы"],
  "nav.calendar": ["Təqvim", "Calendar", "Календарь"],
  "nav.complexes": ["Komplekslər", "Complexes", "Комплексы"],
  "nav.places": ["Obyektlər", "Places", "Объекты"],
  "nav.money": ["Pul", "Cash", "Деньги"],
  "nav.overview": ["İcmal", "Overview", "Обзор"],
  "nav.projects": ["Layihələr", "Projects", "Проекты"],
  "nav.site": ["Sahə", "Site", "Площадка"],
  "nav.daily": ["Gündəlik", "Daily logs", "Дневники"],
  "nav.clients": ["Sifarişçilər", "Clients", "Заказчики"],
  "nav.forma2": ["Forma-2", "Form-2", "Форма-2"],
  "nav.forma3": ["Forma-3", "Form-3", "Форма-3"],
  "nav.warehouse": ["Anbar", "Warehouse", "Склад"],
  "nav.assets": ["Aktivlər", "Assets", "Активы"],
  "nav.plant": ["Zavod", "Plant", "Завод"],
  "nav.recipes": ["Reseptlər", "Recipes", "Рецепты"],
  "nav.shops": ["Sex", "Shop", "Цех"],
  "nav.people": ["İşçilər", "Employees", "Сотрудники"],
  "nav.staff": ["İşçilər", "Employees", "Сотрудники"],
  "nav.jobs": ["Məşğulluq", "Employment", "Занятость"],
  "nav.attendance": ["Davamiyyət", "Attendance", "Явка"],
  "nav.terminals": ["Terminallar", "Terminals", "Терминалы"],
  "nav.leave": ["Məzuniyyət", "Leave", "Отпуск"],
  "nav.hrpay": ["Ödənişlər", "Payments", "Выплаты"],
  "nav.departments": ["Şöbələr", "Departments", "Отделы"],
  "nav.offices": ["Ofislər", "Offices", "Офисы"],
  "nav.moves": ["Köçürmələr", "Transfers", "Переводы"],
  "nav.audit": ["Tarixçə", "Audit", "История"],
  "nav.companies": ["Alt şirkətlər", "Companies", "Компании"],
  "nav.units": ["Mənzillər", "Units", "Квартиры"],
  "nav.buyers": ["Alıcılar", "Buyers", "Покупатели"],
  "nav.contracts": ["Müqavilələr", "Contracts", "Договоры"],
  "nav.finance": ["İcmal", "Overview", "Обзор"],
  "nav.panel": ["İdarə paneli", "Dashboard", "Панель"],
  "nav.tx": ["Əməliyyatlar", "Transactions", "Операции"],
  "nav.accounts": ["Hesablar", "Accounts", "Счета"],
  "nav.invoices": ["Qaimələr", "Invoices", "Накладные"],
  "nav.payroll": ["Əmək haqqı", "Payroll", "Зарплата"],
  "nav.fixed": ["Əsas vəsaitlər", "Fixed assets", "Основные средства"],
  "nav.bank": ["Bank", "Bank", "Банк"],
  "nav.partners": ["Debitor/Kreditor", "Receivables", "Дебиторы"],
  "nav.categories": ["Kateqoriyalar", "Categories", "Категории"],
  "nav.periods": ["Dövrlər", "Periods", "Периоды"],
  "nav.reports": ["Hesabatlar", "Reports", "Отчёты"],
  "shell.module": ["Modul", "Module", "Модуль"],
  "shell.search": ["Layihə, müştəri, material axtar", "Search projects, clients, materials", "Поиск проектов, клиентов, материалов"],
  "shell.searchLabel": ["Axtarış", "Search", "Поиск"],
  "shell.clear": ["Təmizlə", "Clear", "Очистить"],
  "shell.menu": ["Menyu", "Menu", "Меню"],
  "shell.closeMenu": ["Menyunu bağla", "Close menu", "Закрыть меню"],
  "shell.alerts": ["Bildirişlər", "Notifications", "Уведомления"],
  "shell.alertsTitle": ["Diqqət tələb edir", "Needs attention", "Требует внимания"],
  "shell.alertsEmpty": ["Açıq xəbərdarlıq yoxdur.", "No open alerts.", "Нет открытых предупреждений."],
  "shell.navEmpty": ["Bu modul bu rol üçün bağlıdır.", "This module is closed for your role.", "Этот модуль закрыт для вашей роли."],
  "shell.themeLight": ["İşıqlı rejim", "Light mode", "Светлая тема"],
  "shell.themeDark": ["Qaranlıq rejim", "Dark mode", "Тёмная тема"],
  "shell.language": ["Dil", "Language", "Язык"],
  "shell.profile": ["Profil", "Profile", "Профиль"],
  "shell.settings": ["Ayarlar", "Settings", "Настройки"],
  "shell.logout": ["Çıxış", "Log out", "Выйти"],
  "shell.lang.az": ["Azərbaycan", "Azerbaijani", "Азербайджанский"],
  "shell.lang.en": ["English", "English", "Английский"],
  "shell.lang.ru": ["Русский", "Russian", "Русский"],
  "alert.low": ["{name} minimumdan aşağıdır", "{name} is below minimum", "{name} ниже минимума"],
  "alert.lowMeta": ["{qty} {unit} qalıb", "{qty} {unit} left", "Осталось {qty} {unit}"],
  "alert.late": ["{id} ödənişi gecikir", "{id} payment is late", "Просрочен платёж {id}"],
  "alert.service": ["{name} servisdədir", "{name} is in service", "{name} на сервисе"],
  "alert.serviceDue": ["{name} servis vaxtıdır", "{name} is due for service", "{name}: подошёл сервис"],
  "alert.doc": ["{name} sənədinin vaxtı çatır", "{name} document is due", "Истекает документ: {name}"],
  "alert.task": ["{name} tapşırığı gecikir", "{name} task is overdue", "Просрочена задача: {name}"],
  "alert.trip": ["{name} yoldadır", "{name} is on the road", "{name} в пути"],
  "alert.transit": ["{id} yoldadır", "{id} is in transit", "{id} в пути"],
  "alert.report": ["{id} təsdiq gözləyir", "{id} is waiting for approval", "{id} ждёт утверждения"],
  "role.director": ["Direktor", "Director", "Директор"],
  "role.pm": ["Layihə rəhbəri", "Project manager", "Руководитель проекта"],
  "role.site": ["Sahə mühəndisi", "Site engineer", "Инженер площадки"],
  "role.warehouse": ["Anbar", "Warehouse", "Склад"],
  "role.procurement": ["Təchizat", "Procurement", "Снабжение"],
  "role.accountant": ["Mühasib", "Accountant", "Бухгалтер"],
  "role.sales": ["Satış", "Sales", "Продажи"],
  "title.director": ["Əməliyyat direktoru", "Operations director", "Операционный директор"],
  "title.pm": ["Layihə rəhbəri", "Project manager", "Руководитель проекта"],
  "title.site": ["Sahə mühəndisi", "Site engineer", "Инженер площадки"],
  "title.warehouse": ["Anbar müdiri", "Warehouse lead", "Начальник склада"],
  "title.procurement": ["Təchizatçı", "Buyer", "Снабженец"],
  "title.accountant": ["Mühasib", "Accountant", "Бухгалтер"],
  "title.sales": ["Satış rəhbəri", "Sales lead", "Руководитель продаж"],
  "auth.title": ["Daxil ol", "Sign in", "Войти"],
  "auth.text": ["Sessiya bağlıdır. Giriş rollar üzrə icazə ilə açılacaq.", "You are signed out. Sign-in will use role-based access.", "Сессия закрыта. Вход будет с ролевым доступом."],
  "auth.enter": ["Daxil ol", "Sign in", "Войти"],
  "settings.kicker": ["Hesab", "Account", "Аккаунт"],
  "settings.title": ["Ayarlar", "Settings", "Настройки"],
  "settings.text": ["Profil, görünüş, bildiriş və başlanğıc modul.", "Profile, appearance, notifications, and the start module.", "Профиль, оформление, уведомления и стартовый модуль."],
  "settings.account": ["Profil", "Profile", "Профиль"],
  "settings.role": ["Rol", "Role", "Роль"],
  "settings.roleNote": ["Hesab dəyişmə siyahısı çıxarılıb. İcazələr girişdəki roldan gələcək.", "The account switcher is gone. Permissions will come from the signed-in role.", "Переключатель аккаунта убран. Права будут зависеть от роли при входе."],
  "settings.appearance": ["Görünüş", "Appearance", "Оформление"],
  "settings.light": ["İşıqlı", "Light", "Светлая"],
  "settings.dark": ["Qaranlıq", "Dark", "Тёмная"],
  "settings.notices": ["Bildirişlər", "Notifications", "Уведомления"],
  "settings.noticesText": ["Bağlanan növ zəngdə görünmür.", "A closed kind stays out of the bell.", "Закрытый вид не попадает в колокольчик."],
  "settings.notice.doc": ["Sənəd vaxtı", "Document expiry", "Срок документа"],
  "settings.notice.task": ["Gecikən tapşırıq", "Overdue task", "Просроченная задача"],
  "settings.notice.trip": ["Reys", "Trip", "Рейс"],
  "settings.notice.service": ["Servis", "Service", "Сервис"],
  "settings.notice.stock": ["Kritik ehtiyat", "Low stock", "Низкий остаток"],
  "settings.notice.invoice": ["Gecikən ödəniş", "Late payment", "Просроченный платёж"],
  "settings.notice.transit": ["Yoldakı sifariş", "Order in transit", "Заказ в пути"],
  "settings.notice.report": ["Gündəlik təsdiqi", "Daily approval", "Утверждение дневника"],
  "settings.workspace": ["İş mühiti", "Workspace", "Рабочая среда"],
  "settings.sidebar": ["Yan menyu", "Sidebar", "Боковое меню"],
  "settings.navOpen": ["Açıq", "Open", "Открыто"],
  "settings.navClosed": ["Yığcam", "Compact", "Сжато"],
  "settings.start": ["Başlanğıc modul", "Start module", "Стартовый модуль"],
  "settings.startText": ["Girişdən sonra bu modul açılır.", "This module opens after sign-in.", "Этот модуль открывается после входа."],
  "settings.access": ["Bu rolun modulları", "Modules for this role", "Модули этой роли"],
  "settings.allowed": ["Açıq", "Open", "Открыт"],
  "settings.blocked": ["Bağlı", "Closed", "Закрыт"],
  "settings.company": ["Şirkət", "Company", "Компания"],
  "settings.session": ["Sessiya", "Session", "Сессия"],
  "dash.live": ["Davam edən", "In progress", "В работе"],
  "dash.graph": ["Qrafik", "Chart", "График"],
  "dash.table": ["Cədvəl", "Table", "Таблица"],
  "dash.avg": ["Orta irəliləyiş {count}%", "Average progress {count}%", "Средний ход {count}%"],
  "dash.openLines": ["Açıq həcm", "Open volume", "Открытый объём"],
  "dash.openLinesMeta": ["{count} smeta sətri", "{count} estimate lines", "{count} строк сметы"],
  "dash.waiting": ["Gündəlik", "Daily logs", "Дневники"],
  "dash.waitingMeta": ["{count} təsdiq gözləyir", "{count} waiting for approval", "{count} ждут утверждения"],
  "dash.projectsChart": ["Layihə irəliləyişi", "Project progress", "Ход проектов"],
  "dash.statusChart": ["Layihə statusu", "Project status", "Статус проектов"],
  "dash.reportChart": ["Gündəlik statusu", "Daily log status", "Статус дневников"],
  "dash.requestChart": ["Tələbnamə", "Requests", "Требования"],
  "dash.assetChart": ["Texnika vəziyyəti", "Equipment status", "Состояние техники"],
  "dash.utilChart": ["Yüklənmə", "Utilization", "Загрузка"],
  "dash.sheet.project": ["Layihə", "Project", "Проект"],
  "dash.sheet.volume": ["Həcm", "Volume", "Объём"],
  "dash.sheet.report": ["Gündəlik", "Daily log", "Дневник"],
  "dash.sheet.request": ["Tələbnamə", "Request", "Требование"],
  "dash.sheet.stock": ["Ehtiyat", "Stock", "Запас"],
  "dash.sheet.asset": ["Texnika", "Equipment", "Техника"],
  "dash.sheet.journal": ["Jurnal", "Journal", "Журнал"],
  "gate.title": ["Bu bölmə bağlıdır", "This section is closed", "Раздел закрыт"],
  "gate.text": ["Bu səhifə sizin rolunuz üçün açıq deyil.", "This page is not open for your role.", "Эта страница недоступна для вашей роли."],
  "missing.kicker": ["404", "404", "404"],
  "missing.title": ["Səhifə tapılmadı", "Page not found", "Страница не найдена"],
  "missing.text": ["Soldakı menyudan bölmə seçin.", "Choose a section from the menu.", "Выберите раздел в меню."],
  "choose": ["Seçin", "Select", "Выберите"],
  "none": ["Yoxdur", "None", "Нет"],
  "close": ["Bağla", "Close", "Закрыть"],
  "status.aktiv": ["Aktiv", "Active", "Активен"],
  "status.gecikir": ["Gecikir", "Late", "Просрочен"],
  "status.plan": ["Planlaşdırılır", "Planned", "Планируется"],
  "status.tehvil": ["Təhvilə yaxın", "Near handover", "Близко к сдаче"],
  "status.odenilib": ["Ödənilib", "Paid", "Оплачен"],
  "status.gonderilib": ["Göndərilib", "Sent", "Отправлен"],
  "status.qaralama": ["Qaralama", "Draft", "Черновик"],
  "status.sahede": ["Sahədə", "On site", "На площадке"],
  "status.servis": ["Servisdə", "In service", "На сервисе"],
  "status.bos": ["Boş", "Idle", "Свободен"],
  "status.icarede": ["İcarədə", "Hired out", "В аренде"],
  "status.gedir": ["Gedir", "In progress", "В работе"],
  "status.novbede": ["Növbədə", "Queued", "В очереди"],
  "status.hazir": ["Hazır", "Ready", "Готово"],
  "status.gonderildi": ["Sahədə", "On site", "На площадке"],
  "status.legv": ["Ləğv", "Cancelled", "Отменён"],
  "status.yoldadir": ["Yoldadır", "In transit", "В пути"],
  "status.tesdiq": ["Təsdiqlənib", "Approved", "Утверждён"],
  "status.elcatan": ["Əlçatan", "Available", "Доступен"],
  "status.axtarir": ["Axtarır", "Looking", "В поиске"],
  "status.layihede": ["Layihədə", "On a project", "На проекте"],
  "status.elcatmaz": ["Əlçatmaz", "Unavailable", "Недоступен"],
  "status.qebul": ["Qəbul edilib", "Received", "Принят"],
  "status.isti": ["İsti", "Hot", "Горячий"],
  "status.ilik": ["İlıq", "Warm", "Тёплый"],
  "status.soyuq": ["Soyuq", "Cold", "Холодный"],
  "status.ofisde": ["Ofisdə", "In office", "В офисе"],
  "status.istehsalda": ["İstehsalatda", "In production", "На производстве"],
  "status.ezamiyyetde": ["Ezamiyyətdə", "On a trip", "В командировке"],
  "status.mezuniyyet": ["Məzuniyyətdə", "On leave", "В отпуске"],
  "status.telim": ["Təlimdə", "In training", "На обучении"],
  "status.cixis": ["İşdən çıxıb", "Left", "Уволен"],
  "place.sahe": ["Sahə", "Site", "Площадка"],
  "place.ofis": ["Ofis", "Office", "Офис"],
  "place.istehsal": ["İstehsal", "Production", "Производство"],
  "status.geldi": ["Gəldi", "Present", "Явка"],
  "status.gec": ["Gecikdi", "Late", "Опоздал"],
  "status.gelmedi": ["Gəlmədi", "Absent", "Неявка"],
  "status.ezamiyyet": ["Ezamiyyət", "Trip", "Командировка"],
  "status.illik": ["İllik", "Annual", "Ежегодный"],
  "status.xestelik": ["Xəstəlik", "Sick", "Больничный"],
  "status.odenissiz": ["Ödənişsiz", "Unpaid", "Без оплаты"],
  "status.maas": ["Maaş", "Salary", "Оклад"],
  "status.avans": ["Avans", "Advance", "Аванс"],
  "status.mukafat": ["Mükafat", "Bonus", "Премия"],
  "status.cerime": ["Cərimə", "Penalty", "Штраф"],
  "status.online": ["Onlayn", "Online", "Онлайн"],
  "status.offline": ["Oflayn", "Offline", "Офлайн"],
  "status.medaxil": ["Mədaxil", "Receipt", "Приход"],
  "status.mexaric": ["Məxaric", "Issue", "Расход"],
  "status.transfer": ["Köçürmə", "Transfer", "Перемещение"],
  "status.faktura": ["Fakturalanıb", "Invoiced", "Выставлен счёт"],
  "status.duzelis": ["Düzəliş", "Correction", "Корректировка"],
  "status.gozleyir": ["Gözləyir", "Waiting", "Ожидает"],
  "status.sifaris": ["Sifarişdə", "On order", "В заказе"],
  "status.razilasma": ["Razılaşma", "Agreed", "Согласовано"],
  "status.anbar": ["Anbardan", "From stock", "Со склада"],
  "status.teklif": ["Təklif", "Quote", "Предложение"],
  "status.secildi": ["Seçildi", "Selected", "Выбран"],
  "status.redd": ["Rədd", "Rejected", "Отклонён"],
  "status.acik": ["Açıq", "Open", "Открыт"],
  "status.bitdi": ["Bitdi", "Done", "Готово"],
  "status.asagi": ["Aşağı", "Low", "Низкий"],
  "status.orta": ["Orta", "Medium", "Средний"],
  "status.yuksek": ["Yüksək", "High", "Высокий"],
  "status.tecili": ["Təcili", "Urgent", "Срочно"],
  "status.zeng": ["Zəng", "Call", "Звонок"],
  "status.gorus": ["Görüş", "Meeting", "Встреча"],
  "status.takip": ["İzləmə", "Follow-up", "Контроль"],
  "status.sened": ["Sənəd", "Document", "Документ"],
  "status.arxiv": ["Arxiv", "Archive", "Архив"],
  "status.cizgi": ["Çizgi", "Drawing", "Чертёж"],
  "status.mektub": ["Məktub", "Letter", "Письмо"],
  "status.sexsiyyet": ["Şəxsiyyət", "Identity", "Удостоверение"],
  "status.akt": ["Akt", "Act", "Акт"],
  "status.email": ["E-poçt", "Email", "Почта"],
  "status.qeyd": ["Qeyd", "Note", "Заметка"],
  "status.ziyaret": ["Ziyarət", "Visit", "Визит"],
  "status.bina": ["Bina", "Building", "Здание"],
  "status.villa": ["Villa", "Villa", "Вилла"],
  "status.heyet": ["Həyət evi", "Courtyard house", "Двор-дом"],
  "status.plaza": ["Biznes plaza", "Business plaza", "Бизнес-плаза"],
  "status.bagli": ["Bağlı", "Closed", "Закрыт"],
  "status.bron": ["Bron", "Reserved", "Бронь"],
  "status.muqavile": ["Müqavilə", "Contract", "Договор"],
  "status.satilib": ["Satılıb", "Sold", "Продан"],
  "status.acar": ["Açar təhvili", "Keys handed", "Ключи выданы"],
  "status.araliq": ["Aralıq", "Interim", "Промежуточный"],
  "status.yekun": ["Yekun", "Final", "Итоговый"],
  "status.nagd": ["Nağd", "Cash", "Наличные"],
  "status.daxili": ["Daxili kredit", "In-house credit", "Внутренний кредит"],
  "status.ipoteka": ["İpoteka", "Mortgage", "Ипотека"],
  "status.menzil": ["Mənzil", "Apartment", "Квартира"],
  "status.ofis": ["Ofis", "Office", "Офис"],
  "status.zavod": ["Zavod", "Plant", "Завод"],
  "status.tikinti": ["Tikinti şöbəsi", "Construction dept.", "Строительный отдел"],
  "status.parking": ["Parking", "Parking", "Паркинг"],
  "weather.gunesli": ["Günəşli", "Sunny", "Солнечно"],
  "weather.buludlu": ["Buludlu", "Cloudy", "Облачно"],
  "weather.yagis": ["Yağış", "Rain", "Дождь"],
  "weather.kulek": ["Külək", "Wind", "Ветер"],
  "stock.general": ["Anbar / ümumi", "Warehouse / general", "Склад / общее"],
  "page.finance.kicker": ["Maliyyə", "Finance", "Финансы"],
  "page.finance.title": ["İdarə paneli", "Dashboard", "Панель"],
  "page.finance.text": ["Pul, debitor, kreditor və anbar dəyəri. Qaimə satışdan, borc təchizatdan, ehtiyat anbardan, vəsait parkdan gəlir.", "Cash, receivables, payables, and stock value. Invoices come from sales, debt from procurement, stock from the warehouse, assets from the fleet.", "Деньги, дебиторка, кредиторка и стоимость склада. Накладные из продаж, долг из снабжения, запас со склада, средства из парка."],
  "page.moves.kicker": ["Maliyyə · Əməliyyat", "Finance · Transactions", "Финансы · Операции"],
  "page.moves.title": ["Pul hərəkəti", "Cash movements", "Движение денег"],
  "page.moves.text": ["Bank və kassaya düşən sənədlər. Açıq qaimə və ödənməmiş təchizat burada yoxdur, onlar borcdur.", "Documents that hit the bank or the cash box. Open invoices and unpaid supply stay off this list — they are debt.", "Документы, которые прошли по банку или кассе. Открытые накладные и неоплаченное снабжение сюда не входят — это долг."],
  "page.accounts.kicker": ["Maliyyə · Hesab", "Finance · Accounts", "Финансы · Счета"],
  "page.accounts.title": ["Hesablar", "Accounts", "Счета"],
  "page.accounts.text": ["Pul hesabının qalığı hərəkətdən yığılır. Balans sətirləri anbarın, parkın və borcun maliyyə görüntüsüdür.", "Cash balances come from movements. Balance lines are the finance view of stock, the fleet, and debt.", "Остаток денежного счёта собирается из движений. Строки баланса — финансовый вид склада, парка и долга."],
  "page.invoices.kicker": ["Maliyyə · Qaimə", "Finance · Invoices", "Финансы · Накладные"],
  "page.invoices.title": ["Qaimələr", "Invoices", "Накладные"],
  "page.invoices.text": ["Satış sifarişçiyə, alış təchizatçıya. Qəbul edilməmiş sifariş hələ qaimə deyil.", "Sales go to the client, purchases to the supplier. An order that is not received is not an invoice yet.", "Продажа — заказчику, закупка — поставщику. Непринятый заказ ещё не накладная."],
  "page.payroll.kicker": ["Maliyyə · Əmək haqqı", "Finance · Payroll", "Финансы · Зарплата"],
  "page.payroll.title": ["Əmək haqqı", "Payroll", "Зарплата"],
  "page.payroll.text": ["Ştatın aylıq norması HRM maaşından gəlir. Sahədən düşmüş əmək haqqı xərci ayrıdır. Açıq cədvəl ödəniləndə pula düşür.", "The monthly staff norm comes from HRM salaries. Site labor cost stays apart. An open run hits cash when it is paid.", "Месячная норма штата берётся из окладов HRM. Сдельная оплата площадки отдельно. Открытая ведомость попадает в деньги после оплаты."],
  "page.fixed.kicker": ["Maliyyə · Əsas vəsait", "Finance · Fixed assets", "Финансы · Основные средства"],
  "page.fixed.title": ["Əsas vəsaitlər", "Fixed assets", "Основные средства"],
  "page.fixed.text": ["Qalıq dəyər {value}. İcarədəki {hired} texnika kapitallaşmır — parkda qalır, balansda yox.", "Net book value is {value}. {hired} hired machine is not capitalized — it stays on the fleet, not on the balance sheet.", "Остаточная стоимость {value}. Арендованная техника ({hired}) не капитализируется — она в парке, не в балансе."],
  "page.bank.kicker": ["Maliyyə · Bank", "Finance · Bank", "Финансы · Банк"],
  "page.bank.title": ["Bank", "Bank", "Банк"],
  "page.bank.text": ["Kapital Bank satış və xərcin əsas hesabıdır. ABB açılış qalığı ilə durur. Nağd yanacaq kassadadır.", "Kapital Bank carries sales and most costs. ABB stands at its opening balance. Fuel cash sits in the cash box.", "Kapital Bank несёт продажи и основные расходы. ABB стоит на начальном остатке. Топливо — в кассе."],
  "page.partners.kicker": ["Maliyyə · Tərəf", "Finance · Counterparties", "Финансы · Контрагенты"],
  "page.partners.title": ["Debitor və kreditor", "Receivables and payables", "Дебиторы и кредиторы"],
  "page.partners.text": ["Debitor göndərilmiş satış qaiməsidir. Kreditor qəbul edilmiş, ödənməmiş təchizatdır.", "A receivable is a sent sales invoice. A payable is received supply that is still unpaid.", "Дебиторка — отправленная накладная. Кредиторка — принятое и ещё не оплаченное снабжение."],
  "page.categories.kicker": ["Maliyyə · Kateqoriya", "Finance · Categories", "Финансы · Категории"],
  "page.categories.title": ["Kateqoriyalar", "Categories", "Категории"],
  "page.categories.text": ["Pul hərəkətinin növü: material, əmək haqqı, texnika, yanacaq, subpodrat və satış.", "How cash moved: materials, payroll, equipment, fuel, subcontract, and sales.", "Как шли деньги: материалы, зарплата, техника, топливо, субподряд и продажи."],
  "page.periods.kicker": ["Maliyyə · Dövr", "Finance · Periods", "Финансы · Периоды"],
  "page.periods.title": ["Dövrlər", "Periods", "Периоды"],
  "page.periods.text": ["Ay bağlanır, cari ay açıq qalır. Məbləğ həmin aya düşən bank və kassa hərəkətidir.", "A month closes, and the current month stays open. The figures are the bank and cash movements of that month.", "Месяц закрывается, текущий остаётся открытым. Суммы — движения банка и кассы за этот месяц."],
  "page.crm.kicker": ["CRM · Sifarişçi", "CRM · Clients", "CRM · Заказчики"],
  "page.crm.title": ["Sifarişçilər və sövdələr", "Clients and deals", "Заказчики и сделки"],
  "page.crm.text": ["Sifarişçi, portfel və podrat müqaviləsi buradadır. Ad dəyişəndə layihə, tapşırıq və sənədə keçir. Layihəsi olan sifarişçi silinmir.", "Clients, the portfolio, and the construction contract live here. A renamed client follows onto projects, tasks, and files. A client with a project stays.", "Заказчики, портфель и подрядный договор здесь. Новое имя переходит в проекты, задачи и документы. Заказчик с проектом остаётся."],
  "page.board.kicker": ["CRM", "CRM", "CRM"],
  "page.board.title": ["İcmal", "Overview", "Обзор"],
  "page.board.text": ["Sövdə borusu, açıq tapşırıq, gözləyən sənəd və son fəaliyyət. Mənzil satışı ayrıca durur.", "The deal pipeline, open tasks, waiting documents, and the latest activity. Home sales sit apart.", "Воронка сделок, открытые задачи, ожидающие документы и последняя активность. Продажа квартир отдельно."],
  "page.leads.kicker": ["CRM · Potensial", "CRM · Leads", "CRM · Лиды"],
  "page.leads.title": ["Potensiallar", "Leads", "Лиды"],
  "page.leads.text": ["Fürsət temperaturu və növbəti əlaqə ilə durur. Sövdəyə keçəndə tapşırıq və sənəd onun ardınca gedir.", "A lead keeps its temperature and the next contact. When it becomes a deal, its tasks and files follow.", "Лид хранит температуру и следующий контакт. Когда он становится сделкой, задачи и документы идут следом."],
  "page.deals.kicker": ["CRM · Sövdə", "CRM · Deals", "CRM · Сделки"],
  "page.deals.title": ["Sövdələr", "Deals", "Сделки"],
  "page.deals.text": ["İlkin əlaqədən müqaviləyə qədər sütunla gedir. Müqavilə mərhələsindən layihə açılır.", "A deal moves by column from first contact to contract. A project opens from the contract stage.", "Сделка идёт по столбцам от первого контакта до договора. Проект открывается со стадии договора."],
  "page.tasks.kicker": ["CRM · Tapşırıq", "CRM · Tasks", "CRM · Задачи"],
  "page.tasks.title": ["Tapşırıqlar", "Tasks", "Задачи"],
  "page.tasks.text": ["Zəng, görüş, təklif və sənəd işi dörd sütunda durur. Bitən iş son sütunda qalır.", "Calls, meetings, proposals, and document work sit in four columns. Finished work stays in the last column.", "Звонки, встречи, предложения и документы стоят в четырёх столбцах. Готовая работа остаётся в последнем."],
  "page.files.kicker": ["CRM · Sənəd", "CRM · Documents", "CRM · Документы"],
  "page.files.title": ["Sənədlər", "Documents", "Документы"],
  "page.files.text": ["Təklif, müqavilə, cizgi və məktub qaralamadan təsdiqə, sonra arxivə keçir. Qaralama silinir. Obyektin icazə və cizgisi layihənin özündə qalır.", "Proposals, contracts, drawings, and letters move from draft to approval, then to the archive. A draft can be deleted. A site permit stays on the project.", "Предложения, договоры, чертежи и письма идут от черновика к утверждению, затем в архив. Черновик удаляется. Разрешение объекта остаётся в проекте."],
  "page.activity.kicker": ["CRM · Fəaliyyət", "CRM · Activity", "CRM · Активность"],
  "page.activity.title": ["Fəaliyyət", "Activity", "Активность"],
  "page.activity.text": ["Zəng, görüş, e-poçt və qeyd sifarişçi, potensial və sövdə ilə bağlanır.", "Calls, meetings, email, and notes attach to a client, a lead, and a deal.", "Звонки, встречи, почта и заметки привязаны к заказчику, лиду и сделке."],
  "page.calendar.kicker": ["CRM · Təqvim", "CRM · Calendar", "CRM · Календарь"],
  "page.calendar.title": ["Təqvim", "Calendar", "Календарь"],
  "page.calendar.text": ["Tapşırıq, fəaliyyət, potensialın növbəti əlaqəsi və sənədin son tarixi bir ayda durur.", "Tasks, activity, the next lead contact, and a document due date sit on one month.", "Задачи, активность, следующий контакт лида и срок документа стоят на одном месяце."],
  "page.complexes.kicker": ["CRM · Kompleks", "CRM · Complex", "CRM · Комплекс"],
  "page.complexes.title": ["Komplekslər", "Complexes", "Комплексы"],
  "page.complexes.text": ["Bir şirkətin bir neçə kompleksi olur. Kompleksin içində bina, villa, həyət evi və biznes plaza durur.", "One company can hold several complexes. A complex holds buildings, villas, courtyard houses, and business plazas.", "У одной компании несколько комплексов. В комплексе стоят здания, виллы, двор-дома и бизнес-плаза."],
  "page.places.kicker": ["CRM · Obyekt", "CRM · Places", "CRM · Объекты"],
  "page.places.title": ["Obyektlər", "Places", "Объекты"],
  "page.places.text": ["Bina, villa, həyət evi və biznes plaza ayrı növdür. Mənzil və ofis bu obyektin içində satılır.", "A building, a villa, a courtyard house, and a business plaza are separate kinds. Apartments and offices sell inside them.", "Здание, вилла, двор-дом и бизнес-плаза — разные виды. Квартиры и офисы продаются внутри них."],
  "page.sales.kicker": ["CRM", "CRM", "CRM"],
  "page.sales.text": ["Şirkət, kompleks və obyekt. Mənzil, ofis və parking həmin obyektin içində satılır.", "Company, complex, and place. Apartments, offices, and parking sell inside that place.", "Компания, комплекс и объект. Квартиры, офисы и паркинг продаются внутри объекта."],
  "page.sales.icmal": ["Satış icmalı", "Sales overview", "Обзор продаж"],
  "page.sales.sirket": ["Alt şirkətlər", "Companies", "Компании"],
  "page.sales.menzil": ["Mənzillər", "Units", "Квартиры"],
  "page.sales.alici": ["Alıcılar", "Buyers", "Покупатели"],
  "page.sales.muqavile": ["Müqavilələr", "Contracts", "Договоры"],
  "page.reportsFinance.kicker": ["Maliyyə · Hesabat", "Finance · Reports", "Финансы · Отчёты"],
  "page.reportsFinance.title": ["ƏDV, mənfəət və pul", "VAT, profit, and cash", "НДС, прибыль и деньги"],
  "page.reportsFinance.text": ["Forma-2-nin ƏDV-si, layihə mənfəəti, debitor köhnəlməsi və pul axını.", "VAT from Form-2, project profit, receivable aging, and cash flow.", "НДС формы-2, прибыль проекта, старение дебиторки и денежный поток."],
  "page.forma3.kicker": ["İnşaat · Forma-3", "Construction · Form-3", "Строительство · Форма-3"],
  "page.forma3.title": ["İcra və qiymətləndirmə aktı", "Progress and valuation act", "Акт выполнения и оценки"],
  "page.forma3.text": ["İcmallar, aralıq, yekun və ödəniş ayrı tablardadır. Qaralama silinir və təsdiqlənmiş Forma-2-lərdən yenilənir. Təsdiq qaralamaya qayıdır.", "Summaries, interim, final, and payment each have a tab. A draft can be deleted and rebuilt from approved Form-2s. An approval returns to draft.", "Сводки, промежуточный, итоговый и оплата — в отдельных вкладках. Черновик удаляется и собирается заново из утверждённых форм-2. Утверждение возвращается в черновик."],
  "page.forma2.kicker": ["İnşaat · Forma-2", "Construction · Form-2", "Строительство · Форма-2"],
  "page.forma2.title": ["Təhvil-qəbul aktı", "Acceptance act", "Акт приёмки"],
  "page.forma2.text": ["Akt, həcm, smeta, hesablaşma və faktura ayrı tablardadır. Qaralama redaktə olunur və silinir. Təsdiq qaralamaya qayıdır. Faktura silinmir.", "Acts, volume, the estimate, settlement, and invoices each have a tab. A draft can be edited and deleted. An approval returns to draft. An invoiced act stays.", "Акты, объём, смета, расчёт и счета — в отдельных вкладках. Черновик правится и удаляется. Утверждение возвращается в черновик. Счёт остаётся."],
  "page.site.kicker": ["İnşaat · Sahə", "Construction · Site", "Строительство · Площадка"],
  "page.site.title": ["Sahə", "Site", "Площадка"],
  "page.site.text": ["İcmal, hesabat, həcm, briqada, texnika, material və qeyd seçilmiş obyektin ətrafında durur. Briqadaya işçi yazılır. Texnika aktivlər parkından cəlb olunur.", "Overview, the report, volume, the crew, equipment, materials, and notes sit around the selected site. Crew can be added. Equipment is pulled from the fleet.", "Обзор, отчёт, объём, бригада, техника, материалы и заметки собраны вокруг выбранного объекта. В бригаду добавляют людей. Технику привлекают из парка."],
  "page.assets.kicker": ["Təchizat · Aktivlər", "Supply · Assets", "Снабжение · Активы"],
  "page.assets.title": ["Aktivlər", "Assets", "Активы"],
  "page.assets.text": ["Aktivlərin orta istifadəsi {util}%-dir. Reys, yanacaq, sənəd və servis buradan idarə olunur.", "Average asset use is {util}%. Trips, fuel, documents, and service are managed here.", "Средняя загрузка активов {util}%. Рейсы, топливо, документы и сервис ведутся здесь."],
  "page.daily.kicker": ["Sahə", "Site", "Площадка"],
  "page.daily.title": ["Gündəliklər", "Daily logs", "Дневники"],
  "page.daily.text": ["Gündəlik, həcm, tabel, texnika və qeyd ayrı tablardadır. Qaralama və düzəliş yazılır və silinir. Göndərilmiş sənəd düzəlişə qayıdır. Təsdiq smetaya yazılır və silinmir.", "The log, volume, timesheet, equipment, and notes each have a tab. A draft or correction can be edited and deleted. A sent log returns for correction. An approval posts to the estimate and stays.", "Дневник, объём, табель, техника и заметки — в отдельных вкладках. Черновик и исправление правятся и удаляются. Отправленный документ возвращается на исправление. Утверждение пишется в смету и остаётся."],
  "page.people.kicker": ["HRM", "HRM", "HRM"],
  "page.people.title": ["İşçilər", "Employees", "Сотрудники"],
  "page.people.text": ["Yer sahə, ofis və istehsal üzrə ayrılır. Layihə və ofis siyahısı uzana bilər. Status məzuniyyət, ezamiyyət, xəstəlik, təlim və dayanma ilə genişlənir.", "Place splits into site, office, and production. Project and office lists can grow. Status covers leave, trips, sick time, training, and suspension.", "Место делится на площадку, офис и производство. Списки проектов и офисов растут. Статус покрывает отпуск, командировку, больничный, обучение и отстранение."],
  "page.attendance.kicker": ["HRM", "HRM", "HRM"],
  "page.attendance.title": ["Davamiyyət", "Attendance", "Явка"],
  "page.attendance.text": ["Giriş və çıxış terminaldan düşür. Eyni işçiyə eyni gün ikinci sətir yazılmır.", "In and out come from a terminal. The same person does not get a second row on the same day.", "Вход и выход приходят с терминала. На тот же день вторую строку тому же человеку не пишут."],
  "page.terminals.kicker": ["HRM", "HRM", "HRM"],
  "page.terminals.title": ["Terminallar", "Terminals", "Терминалы"],
  "page.terminals.text": ["Keçid nöqtəsi obyektə bağlıdır. Davamiyyəti olan terminal silinmir.", "A gate belongs to a site. A terminal with attendance stays.", "Точка прохода привязана к объекту. Терминал с явкой не удаляется."],
  "page.leave.kicker": ["HRM", "HRM", "HRM"],
  "page.leave.title": ["Məzuniyyət", "Leave", "Отпуск"],
  "page.leave.text": ["İllik, xəstəlik, ödənişsiz və ezamiyyət təsdiq gözləyir. Bu günə düşən təsdiq işçini məzuniyyətə keçirir.", "Annual, sick, unpaid, and trip requests wait for approval. Approval that covers today puts the person on leave.", "Ежегодный, больничный, неоплачиваемый и командировка ждут утверждения. Утверждение на сегодня переводит человека в отпуск."],
  "page.hrpay.kicker": ["HRM", "HRM", "HRM"],
  "page.hrpay.title": ["Ödənişlər", "Payments", "Выплаты"],
  "page.hrpay.text": ["Avans, mükafat, cərimə və maaş. Ödənilən sətir maliyyədə əmək haqqı xərci kimi durur. Bağlı dövrə düşmür.", "Advance, bonus, penalty, and salary. A paid row stands in finance as a payroll expense. A closed period stays shut.", "Аванс, премия, штраф и оклад. Оплаченная строка стоит в финансах как расход на зарплату. В закрытый период не падает."],
  "page.departments.kicker": ["HRM", "HRM", "HRM"],
  "page.departments.title": ["Şöbələr", "Departments", "Отделы"],
  "page.departments.text": ["Hər şöbənin rəhbəri və yeri var. İçində işçi olan şöbə silinmir.", "Each department has a lead and a place. A department with people stays.", "У отдела есть руководитель и место. Отдел с людьми не удаляется."],
  "page.offices.kicker": ["HRM", "HRM", "HRM"],
  "page.offices.title": ["Ofislər", "Offices", "Офисы"],
  "page.offices.text": ["Ofis ayrı kateqoriyadır. İşçisi, şöbəsi və ya terminalı olan ofis silinmir. Ad dəyişəndə yer də dəyişir.", "An office is its own category. An office with people, a department, or a terminal stays. Renaming it moves the place too.", "Офис — отдельная категория. Офис с людьми, отделом или терминалом не удаляется. Смена имени переносит место."],
  "page.hrmmove.kicker": ["HRM", "HRM", "HRM"],
  "page.hrmmove.title": ["Köçürmələr", "Transfers", "Переводы"],
  "page.hrmmove.text": ["İşçi başqa zavoda, tikinti şöbəsinə və ya ofisə köçürülür. Köçürmə yazılır və silinir. Son köçürmə silinəndə işçi əvvəlki yerinə qayıdır.", "A person moves to another plant, construction department, or office. A transfer can be edited and deleted. Deleting the latest one sends the person back.", "Сотрудника переводят на другой завод, в строительный отдел или офис. Перевод правится и удаляется. Удаление последнего возвращает человека назад."],
  "page.supply.kicker": ["Təchizat", "Procurement", "Снабжение"],
  "page.supply.title": ["Təchizat", "Procurement", "Снабжение"],
  "page.supply.text": ["Tələb, təklif, sifariş, borc, təchizatçı, reyestr və yoxlama ayrı tablardadır. Yoxlama göndərmə, açılma, təsdiq, bitmə və qaytarma ilə gedir.", "Requests, quotes, orders, payables, suppliers, the register, and inspection each have a tab. Inspection moves through send, open, confirm, finish, and return.", "Требования, предложения, заказы, долги, поставщики, реестр и проверка — отдельные вкладки. Проверка идёт через отправку, открытие, подтверждение, завершение и возврат."],
  "status.istifade": ["İstifadədə", "In use", "В работе"],
  "status.anbarda": ["Anbarda", "In store", "На складе"],
  "status.yoxlamada": ["Yoxlamada", "In inspection", "На проверке"],
  "status.deyisme": ["Dəyişilir", "Being replaced", "На замене"],
  "status.kohnelmis": ["Köhnəlmiş", "Obsolete", "Изношен"],
  "status.itki": ["İtki", "Lost", "Потеря"],
  "status.yolda": ["Yolda", "On the road", "В пути"],
  "status.catdi": ["Çatdı", "Arrived", "Прибыл"],
  "status.dayandirilib": ["Dayandırılıb", "Suspended", "Отстранён"],
  "status.sigorta": ["Sığorta", "Insurance", "Страховка"],
  "status.baxis": ["Texniki baxış", "Inspection", "Техосмотр"],
  "status.qeydiyyat": ["Qeydiyyat", "Registration", "Регистрация"],
  "status.icaze": ["İcazə", "Permit", "Допуск"],
  "status.oz": ["Öz", "Owned", "Свой"],
  "status.icare": ["İcarə", "Hired", "Аренда"],
  "page.zavod.kicker": ["İstehsalat", "Production", "Производство"],
  "page.zavod.title": ["Zavod", "Plant", "Завод"],
  "page.zavod.text": ["Növbə vərəqəsi, iş əmri, tələbnamə, anbar, transfer, texnika və itki ayrı tablardadır.", "The shift sheet, work orders, requests, stock, transfers, machines, and waste each have a tab.", "Сменный лист, наряды, требования, склад, перемещения, техника и потери — в отдельных вкладках."],
  "page.shops.kicker": ["İstehsalat", "Production", "Производство"],
  "page.shops.title": ["Sex", "Shop", "Цех"],
  "page.shops.text": ["Hər sexin növbə vərəqəsi, iş əmri, tələbnamə, anbar, transfer, texnika və itkisi ayrı tablardadır.", "Each shop has its own tabs for the shift sheet, work orders, requests, stock, transfers, machines, and waste.", "У каждого цеха отдельные вкладки: смена, наряды, требования, склад, перемещения, техника и потери."],
  "page.recipes.kicker": ["İstehsalat", "Production", "Производство"],
  "page.recipes.title": ["Reseptlər", "Recipes", "Рецепты"],
  "page.recipes.text": ["Məhsullar cədvəldə durur. Xammal xanasına basanda bütün norma açılır. Ad, vahid və norma yalnız orada yazılır.", "Products stay in the table. The material cell opens the full norm. The name, unit, and norm are written only there.", "Продукция стоит в таблице. Ячейка сырья открывает всю норму. Название, единица и норма пишутся только там."],
  "page.warehouse.kicker": ["Anbar", "Warehouse", "Склад"],
  "page.warehouse.title": ["Material ehtiyatı", "Material stock", "Запас материалов"],
  "page.warehouse.text": ["Ümumi dəyər {value}. Qalıq, kritik, transfer, hərəkət və anbarlar ayrı tablardadır. Hərəkətin mahiyyəti sətirdə qısa, açanda tam görünür.", "Total value {value}. Stock, shortages, transfers, movements, and warehouses each have a tab. The reason stays short in the row and opens in full.", "Общая стоимость {value}. Остаток, дефицит, перемещение, движение и склады — в отдельных вкладках. Суть движения в строке кратко, полностью открывается рядом."],
  "page.audit.kicker": ["Nəzarət", "Control", "Контроль"],
  "page.audit.title": ["Əməliyyat tarixçəsi", "Audit trail", "История операций"],
  "page.audit.text": ["Hər smeta, anbar, akt və sənəd dəyişikliyi kim tərəfindən edildiyi ilə qalır.", "Every estimate, stock, act, and document change keeps who made it.", "Каждое изменение сметы, склада, акта и документа хранит автора."],
  "page.projects.kicker": ["Layihə idarəetməsi", "Project management", "Управление проектами"],
  "page.projects.title": ["Sahələr", "Sites", "Площадки"],
  "page.projects.text": ["Kart, reyestr, həcm, sənəd və jurnal. Pasport, qeyd və sənəd buradan yazılır.", "Cards, register, volume, documents, and the journal. The passport, notes, and documents are written here.", "Карточки, реестр, объёмы, документы и журнал. Паспорт, заметки и документы пишутся здесь."],
  "dash.hello": ["Sabahınız xeyir, {name}.", "Good morning, {name}.", "Доброе утро, {name}."],
  "dash.place": ["23 sentyabr 2026 · Bakı", "23 September 2026 · Baku", "23 сентября 2026 · Баку"],
  "dash.month": ["Bu ay", "This month", "Этот месяц"],
  "dash.quarter": ["Bu rüb", "This quarter", "Этот квартал"],
  "dash.year": ["Bu il", "This year", "Этот год"],
  "dash.period": ["Dövr", "Period", "Период"],
  "dash.ongoing": ["{count} layihə davam edir", "{count} projects are active", "В работе {count} проектов"],
  "dash.low": ["{count} material minimumdan aşağıdır", "{count} materials are below minimum", "{count} материалов ниже минимума"],
  "dash.late": ["{count} gündəlik təsdiq gözləyir", "{count} daily logs await approval", "Дневников ждут утверждения: {count}"],
  "dash.service": ["{count} texnika servisdədir", "{count} machines are in service", "На сервисе техники: {count}"],
  "dash.turnover": ["Dövriyyə", "Turnover", "Оборот"],
  "dash.vsMonth": ["keçən aya", "vs last month", "к прошлому месяцу"],
  "dash.vsQuarter": ["keçən rübə", "vs last quarter", "к прошлому кварталу"],
  "dash.vsYear": ["keçən ilə", "vs last year", "к прошлому году"],
  "dash.fromDocs": ["Faktura və aktlardan", "From invoices and acts", "По счетам и актам"],
  "dash.stock": ["Anbar dəyəri", "Stock value", "Стоимость склада"],
  "dash.critical": ["{count} kritik material", "{count} critical materials", "{count} критичных материалов"],
  "dash.ar": ["Açıq debitor", "Open receivables", "Открытая дебиторка"],
  "dash.lateInv": ["{count} gecikən faktura", "{count} late invoices", "{count} просроченных счетов"],
  "dash.util": ["Texnika istifadəsi", "Equipment use", "Загрузка техники"],
  "dash.working": ["{count} işlək vahid", "{count} working units", "{count} рабочих единиц"],
  "forma.interim": ["Aralıq icmal", "Interim summary", "Промежуточная сводка"],
  "forma.final": ["Yekun akt", "Final act", "Итоговый акт"],
} as const

type Key = keyof typeof copy

const index: Record<Lang, 0 | 1 | 2> = { az: 0, en: 1, ru: 2 }

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === "az" || saved === "en" || saved === "ru") return saved
  } catch {
    /* saxlama bağlıdır */
  }
  return "az"
}

function readNav(): boolean {
  try {
    const saved = localStorage.getItem(NAV_KEY)
    if (saved === "closed") return false
    if (saved === "open") return true
  } catch {
    /* saxlama bağlıdır */
  }
  return !window.matchMedia("(max-width: 960px)").matches
}

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ""
  } catch {
    return ""
  }
}

function readUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const user = JSON.parse(raw) as SessionUser
    if (!user.userId || !user.role) return null
    return user
  } catch {
    return null
  }
}

function readHome(): ModuleId {
  try {
    const saved = localStorage.getItem(MODULE_KEY)
    if (saved === "hesab" || saved === "insaat" || saved === "tender" || saved === "techizat" || saved === "maliyye" || saved === "kadr" || saved === "klub") return saved
    if (saved === "crm") return "tender"
    if (saved === "hrm") return "kadr"
  } catch {
    /* saxlama bağlıdır */
  }
  return "hesab"
}

function readNotices(): Notices {
  const base = Object.fromEntries(NOTICE_KEYS.map((key) => [key, true])) as Notices
  try {
    const saved = JSON.parse(localStorage.getItem(NOTICE_KEY) || "{}") as Partial<Notices>
    for (const key of NOTICE_KEYS) if (saved[key] === false) base[key] = false
  } catch {
    /* saxlama bağlıdır */
  }
  return base
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* saxlama bağlıdır */
  }
}

type Prefs = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  lang: Lang
  setLang: (lang: Lang) => void
  navOpen: boolean
  setNavOpen: (open: boolean) => void
  toggleNav: () => void
  signedIn: boolean
  session: SessionUser | null
  signIn: (email: string, password: string) => Promise<string | void>
  signUp: (name: string, email: string, password: string) => Promise<string | void>
  signOut: () => void | Promise<void>
  home: ModuleId
  setHome: (id: ModuleId) => void
  notices: Notices
  setNotice: (key: NoticeKey, on: boolean) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const PrefsContext = createContext<Prefs | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme)
  const [lang, setLangState] = useState<Lang>(readLang)
  const [navOpen, setNavOpenState] = useState(readNav)
  const [session, setSession] = useState<SessionUser | null>(readUser)
  const [signedIn, setSignedIn] = useState(() => Boolean(readToken() && readUser()))
  const [home, setHome] = useState<ModuleId>(readHome)
  const [notices, setNotices] = useState<Notices>(readNotices)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    persist(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = lang
    persist(LANG_KEY, lang)
  }, [lang])

  useEffect(() => {
    persist(NAV_KEY, navOpen ? "open" : "closed")
  }, [navOpen])

  useEffect(() => {
    persist(MODULE_KEY, home)
  }, [home])

  useEffect(() => {
    persist(NOTICE_KEY, JSON.stringify(notices))
  }, [notices])

  const value = useMemo<Prefs>(() => {
    function t(key: string, vars?: Record<string, string | number>) {
      const row = copy[key as Key]
      const text = row ? row[index[lang]] : key
      if (!vars) return text
      return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""))
    }
    return {
      theme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((current) => (current === "dark" ? "light" : "dark")),
      lang,
      setLang: setLangState,
      navOpen,
      setNavOpen: setNavOpenState,
      toggleNav: () => setNavOpenState((current) => !current),
      signedIn,
      session,
      signIn: async (email, password) => {
        try {
          const result = await api<{ user: SessionUser }>("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          })
          persist(TOKEN_KEY, "cookie")
          persist(USER_KEY, JSON.stringify(result.user))
          setSession(result.user)
          setSignedIn(true)
        } catch (error) {
          return error instanceof ApiError ? error.message : "Giriş alınmadı."
        }
      },
      signUp: async (name, email, password) => {
        try {
          const result = await api<{ user: SessionUser }>("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password }),
          })
          persist(TOKEN_KEY, "cookie")
          persist(USER_KEY, JSON.stringify(result.user))
          setSession(result.user)
          setSignedIn(true)
        } catch (error) {
          return error instanceof ApiError ? error.message : "Qeydiyyat alınmadı."
        }
      },
      signOut: () => {
        void api("/api/auth/logout", { method: "POST" }).catch(() => undefined)
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setSession(null)
        setSignedIn(false)
      },
      home,
      setHome,
      notices,
      setNotice: (key, on) => setNotices((current) => ({ ...current, [key]: on })),
      t,
    }
  }, [theme, lang, navOpen, signedIn, session, home, notices])

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs() {
  const value = useContext(PrefsContext)
  if (!value) throw new Error("PrefsProvider tapılmadı")
  return value
}
