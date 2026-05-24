<p align="center">
  <img src="./logo.svg" alt="GMentor Snippet Installer" width="140" />
</p>

<h1 align="center">GMentor Snippet Installer</h1>

<p align="center">
  <strong>Установка набора расширений на ваши кастомные листы <a href="https://gmentor.ru">gmentor.ru</a> в один клик.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License: MIT" /></a>
  <a href="#установка"><img src="https://img.shields.io/badge/version-1.0.0-brightgreen.svg?style=flat-square" alt="Version 1.0.0" /></a>
  <a href="#установка"><img src="https://img.shields.io/badge/platforms-Windows%20%7C%20Linux-lightgrey.svg?style=flat-square" alt="Platforms" /></a>
  <a href="./releases/Bundle/gmentor-bundle.js"><img src="https://img.shields.io/badge/bundle-v1.0.0-orange.svg?style=flat-square" alt="Bundle v1.0.0" /></a>
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/releases/Plugin/distributor.user.js"><img src="https://img.shields.io/badge/Browser%20Plugin-FF6347?logo=tampermonkey&logoColor=white&style=flat-square" alt="Tampermonkey" /></a>
  <a href="./releases/Windows/GMentor-Snippet-Installer-portable.exe"><img src="https://img.shields.io/badge/Windows%20Portable-0078D6?logo=windows&logoColor=white&style=flat-square" alt="Windows portable" /></a>
  <a href="./releases/Windows/GMentor-Snippet-Installer-setup.exe"><img src="https://img.shields.io/badge/Windows%20Installer-2563EB?logo=windows&logoColor=white&style=flat-square" alt="Windows Installer" /></a><br>
  <a href="./snippets/"><img src="https://img.shields.io/badge/Manual%20snippets-8B5CF6?logo=javascript&logoColor=white&style=flat-square" alt="Manual snippets" /></a>
  <a href="./releases/Linux/GMentor-Snippet-Installer.AppImage"><img src="https://img.shields.io/badge/Linux%20AppImage-FCC624?logo=linux&logoColor=black&style=flat-square" alt="Linux AppImage" /></a>
  <a href="./releases/Linux/gmentor-snippet-installer_1.0.0_amd64.deb"><img src="https://img.shields.io/badge/Linux%20.deb-A81D33?logo=debian&logoColor=white&style=flat-square" alt="Linux .deb" /></a>
</p>

<p align="center">
  <a href="#-что-включено">Что делает</a> · <a href="#-установка">Установка</a> · <a href="#%EF%B8%8F-откат-установки">Откат</a> · <a href="#-поддержка">Поддержка</a>
</p>

---

**У вас много кастомных листов в Менторе, и каждый раз обновлять скрипты и стили вручную на каждом — это долгие минуты множества кликов?**

GMentor Snippet Installer — утилита, которая читает список ваших кастомных листов и одной кнопкой раздаёт свежий bundle (JS + LESS) на выбранные. Сохраняет ваш собственный код в `<gc-script>` через анкорные маркеры `GMENTOR-BUNDLE-{START,END}`. Доступна в виде Tampermonkey-плагина, standalone-приложения для Windows/Linux и набора отдельных сниппетов для ручного ввода.

---

## ✨ Что включено

<table>
  <tr align="center">
    <td width="50%" valign="top">
      <h3>⚔ Зоны попадания</h3>
      <p>Кастомные зоны с иерархией parent/subzone, custom DR, 3d6-таблица, тултипы. UI-редактор «Зоны» прямо на листе!</p>
    </td>
    <td width="50%" valign="top">
      <h3>🛡 DR-наследование</h3>
      <p>DR cascade от parent-зоны в подзоны, поддержка <code>noInheritDR</code>. Настоятельная рекомендация при иерархии зон!</p>
    </td>
  </tr>
  <tr align="center">
    <td width="50%" valign="top">
      <h3>🎲 1d6 подлокации</h3>
      <p>Допбросок 1d6 на подлокация при попадании в Arm/Leg/Skull/Face через модалку → выбирается подзона. Discord-friendly формат!</p>
    </td>
    <td width="50%" valign="top">
      <h3>📁 Ace-fold-all</h3>
      <p>QoL сниппет, делающий авто-сворачивание всего bundle в Ace-редакторе <code>CSS/LESS</code> и <code>SCRIPT</code>. Меньше лишнего кода перед глазами — производительнее работа!</p>
    </td>
  </tr>
  <tr align="center">
    <td width="50%" valign="top">
      <h3>🎚 Toggler UI</h3>
      <p>Кнопка «Сниппеты» для вкл/выкл групп сниппетов без редактирования кода. Cascade-зависимости автоматом!</p>
    </td>
      <td width="50%" valign="top">
      <h3>🛠️ И ещё много чего впереди</h3>
        <p>Следите за обновлениями!</p>
    </td>
  </tr>
</table>

## 📥 Установка

### Tampermonkey / Violentmonkey

#### 1. Установите userscript-менеджер

Подойдёт любой из двух — оба умеют запускать `.user.js`-плагины и автообновлять их:

- [**Tampermonkey**](https://github.com/Tampermonkey/tampermonkey) — самый популярный.
- [**Violentmonkey**](https://github.com/violentmonkey/violentmonkey) — open-source альтернатива.

#### 2. Установите распространитель

**В один клик:** перейдите на [distributor.user.js](https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/releases/Plugin/distributor.user.js). Менеджер автоматически предложит установить скрипт.

После установки менеджер проверяет обновления и подтягивает их сам.

#### 3. Откройте gmentor.ru

Залогиньтесь как обычно. В правом верхнем углу, рядом с кнопками `⚙` и `📚`, появится новая кнопка `📦`. Это и есть GMentor Snippet Installer.

#### 4. Поставьте сниппеты на нужные листы

Кликните по `📦` → откроется popup со списком **ваших кастомных листов**. Никакого ручного ввода URL'ов — список подтягивается из вашего профиля автоматически.

- Отметьте чекбоксами листы, на которые хотите установить bundle.
- Следом нажать **«Установить на N»**.
- Прогресс показывается inline на каждой строке.

### Windows — Portable

1. Скачайте [`GMentor-Snippet-Installer-portable.exe`](./releases/Windows/GMentor-Snippet-Installer-portable.exe).
2. Запустить из любого места.

Windows Defender SmartScreen при первом запуске ругнётся (бинарь не подписан) — «Подробнее» → «Выполнить в любом случае». Требует WebView2 runtime (на Windows 10 1803+, на Windows 11 стоит из коробки).

### Windows — Installer (NSIS)

1. Скачайте [`GMentor-Snippet-Installer-setup.exe`](./releases/Windows/GMentor-Snippet-Installer-setup.exe).
2. Запустите. Откроется мастер установки.
3. Запуск из меню «Пуск» или через ярлык на рабочем столе.

### Linux — AppImage (любой дистрибутив)

1. Скачайте [`GMentor-Snippet-Installer.AppImage`](./releases/Linux/GMentor-Snippet-Installer.AppImage).
2. `chmod +x GMentor-Snippet-Installer.AppImage`
3. `./GMentor-Snippet-Installer.AppImage`

Если ошибка про libfuse на Ubuntu 22.04+ — `sudo apt install libfuse2`.

### Linux — .deb (Debian/Ubuntu/Mint)

```bash
sudo apt install ./releases/Linux/gmentor-snippet-installer_1.0.0_amd64.deb
```

Зависимости (`libwebkit2gtk-4.1-0`, `libgtk-3-0` и т.п.) подтянутся автоматически. Запуск через Activities или `gmentor-snippet-installer` в терминале.

### Источник bundle для standalone-приложений

По умолчанию приложение тянет bundle с GitHub raw — последняя стабильная версия из этого репозитория:

```
https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/releases/Bundle/gmentor-bundle.js
https://raw.githubusercontent.com/Syntiset/GMentor-Snippet-Installer/main/releases/Bundle/gmentor-bundle.less
```

URL'ы можно переопределить через Settings (шестерёнка вверху) → **URL bundle (.js)** / **URL bundle (.less)** — например, чтобы указать на форк, собственный CDN или локальный HTTP-сервер при разработке.

### Ручной копипаст сниппетов

Если нужны не все функции, или хочется поставить только на один лист без приложения/плагина — копируйте отдельные сниппеты прямо в `CSS/LESS` и `SCRIPT` листа. Все исходники, порядок подключения, минимальный набор и инструкция по установке/откату — в [**`./snippets/README.md`**](./snippets/README.md).

## 📊 Проверка статуса

Напротив каждого листа после инициации появится бейдж. Вот обозначения:

- 🟢 `v1.0.0` — bundle актуальной версии, обновлять не нужно.
- 🟡 `v1.0.0 → v1.0.1` — установлена старая версия bundle, доступно обновление.
- ⚪ `нет` — bundle не установлен.
- 🔒 `view-only` — нет прав редактирования (общие листы), установка невозможна.

Кнопка **«Проверить версии»** в подзаголовке списка проходит по всем листам и узнаёт их актуальный статус. Если листов много - может занять достаточно времени.

## ↩️ Откат установки

Открыть проблемный лист → `</>` в правом верхнем углу → вручную удалить блок между `{ // === GMENTOR-BUNDLE-START ===` и `} // === GMENTOR-BUNDLE-END ===`. Сохранить. F5.

Или: «Сниппеты» → снять все группы → Применить. Таким образом сниппеты остаются в коде, но не активируются.

## 🤝 Co-existence с вашим кодом

Если кастомный лист уже использует код в `SCRIPT` — Installer **не сотрёт ваш код**:

- При push'е installer ищет блок между `{ // === GMENTOR-BUNDLE-START ===` и `} // === GMENTOR-BUNDLE-END ===`. Если блока нет (первый push на лист) — bundle **добавляется** в конец, ваш код сохраняется выше.
- При повторном push'е installer находит маркеры и **заменяет только добавленный блок**, не трогая ваш код.
- При удалении bundle через ручное редактирование достаточно удалить блок между маркерами.

То же самое верно для `CSS/LESS` (маркеры `/* === GMENTOR-LESS-BUNDLE-START === */`...`/* === GMENTOR-LESS-BUNDLE-END === */`).

**Возможные конфликты:** bundle оборачивает GMentor функции `charCalcDR`, `damageRoll`, `getRandomLocation`, `toolLocationsTexts` и `modifyField`. Если ваш код тоже их трогает — могут быть пересечения. Решение: через «Сниппеты» отключить группу, которая мешает (например `hit-locations` или `dr-inheritance`), затем делать точечные правки.

## 🛠 Редактирование XML-шаблона

На каждом custom-char листе Ментор показывает всего две кнопки в правой панели, раскрываемой через `</>`:
- `CSS/LESS` → редактор `<gc-style-less>` (стили)
- `SCRIPT` → редактор `<gc-script>` (JS-логика, наш bundle)

Эти кнопки и редакторы — встроенный функционал Ментора, доступны вне зависимости от установщика. Snippet Installer работает только с ними.

Но есть и малоизвестная, третья кнопка на Менторе - редактор XML-шаблона. Она доступна, к примеру, на [листе для транспорта](https://gmentor.ru/v3cd6bbb8a6a6b4abb9aa1930bb3cd39c). Очень хрупкая сама по себе функция, но даёт гибкость листа с нуля. При знании как работать - мастхэв, но нужно понимать, зачем оно вам вообще нужно. Для тех, кому обычного `CSS/LESS` и `SCRIPT` мало.
- `BASE XML` → редактор `<gc-basic-xml>` (структура листа: какие поля, какие списки)

## ❓ Поддержка

Если что-то сломалось:

1. В установщике: нажать `⚙` → «Очистить кеш».
2. В Tampermonkey dashboard: снять галку с скрипта → проверить что иконка пропала с сайта → вернуть обратно.
3. Если bundle сломал лист — вручную очистить всё в `</>` (см. «Откат установки»).
4. Не помогло? Добро пожаловать в [Issues](https://github.com/Syntiset/GMentor-Snippet-Installer/issues).

---
<p align="center">
  Лицензия MIT &copy; <a href="https://github.com/Syntiset">Syntiset</a>
</p>