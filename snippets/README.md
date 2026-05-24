# Сниппеты — ручная установка

Отдельные `.js` / `.less` фрагменты для прямой вставки в `SCRIPT` и `CSS / LESS` кастомного листа. Не особо мною рекомендумая альтернатива плагину или standalone-приложению. Использовать когда нужен полный контроль или нужно поставить только часть функционала на пару-тройку листов.

> [!NOTE]
> Общий обзор проекта, остальные способы установки (Браузерный плагин, Windows/Linux .exe/.AppImage/.deb) и описание самих расширений — в [главном README](../README.md).

## Содержимое папки

### JavaScript-сниппеты:

| # | Файл | Что предоставляет, вкратце | Зависит от |
|---|---|---|---|
| 1 | [`gc-toggler.js`](./gc-toggler.js) | Базовый toggle-механизм (`window.GC_DISABLED_SNIPPETS`). **Обязателен первым.** | — |
| 2 | [`gc-utils.js`](./gc-utils.js) | Общие хелперы (`window.gcUtils`, `window.gcInternal`). **Обязателен вторым.** | gc-toggler |
| 3 | [`gc-toggler-ui.js`](./gc-toggler-ui.js) | Кнопка «Сниппеты» рядом со `SCRIPT` внутри `</>` для вкл/выкл групп сниппетов. | gc-toggler |
| 4 | [`fix-multiply-zero.js`](./fix-multiply-zero.js) | Фикс бага движка: `modifyField(N, 0, "multiply…")` → `"N*0"`. Независим. | — |
| 5 | [`hit-locations.js`](./hit-locations.js) | Кастомные зоны попаданий, UI редактора «⚔ Зоны», 3d6-таблица, parent/subzone. | fix-multiply-zero |
| 6 | [`dr-inheritance.js`](./dr-inheritance.js) | DR cascade от parent-зоны в подзоны, поддержка `noInheritDR`. **Настоятельно рекомендую** при иерархии зон. | hit-locations |
| 7 | [`sub-location.js`](./sub-location.js) | Допбросок 1d6 на подлокация при попадании в Arm/Leg/Skull/Face через модалку → выбирается подзона. Хорошо работает в связке с двумя сниппетами выше. | dr-inheritance |
| 8 | [`strong-back.js`](./strong-back.js) | Фикс перка «Крепкий хребет» из Unofficial Fallout Revised — 6/10/20/30×ST. Сам перк присутствует в [этой коллекции](https://gmentor.ru/v40543b39c53c5671a90620893740e83e). Если играете с KYOS и собираетесь использовать этот перк — дайте знать, сделаю фикс. | — |
| 9 | [`ace-fold-all.js`](./ace-fold-all.js) | QoL сниппет, делающий авто-сворачивание всего bundle в Ace-редакторе. | — |

### LESS-стили:

| Файл | Когда нужен |
|---|---|
| [`gc-utils.less`](./gc-utils.less) | Всегда — скрывает base64-теги. |
| [`gc-toggler.less`](./gc-toggler.less) | Если используется toggler-UI. |
| [`hit-locations.less`](./hit-locations.less) | Если используется hit-locations. |
| [`sub-location.less`](./sub-location.less) | Если используется sub-location. |

## Порядок подключения

**Важно!** Зависимости по цепочке. Системные первыми (`gc-toggler` → `gc-utils`), потом идут независимые, следом цепочка `hit-locations` → `dr-inheritance` → `sub-location`.

## Как ставить

1. На кастомном листе справа кликнуть `</>` → открыть `CSS/LESS` или `SCRIPT` редактор.
2. **Если в редакторе уже есть код** — добавлять новые сниппеты в конец, каждый — внутри собственной IIFE `(function(){ ... })();`.
3. Скопировать содержимое нужных `.js` файлов (целиком, включая `(function(){ ... })();`) и вставить в редактор.
4. Клик по ``СОХРАНИТЬ``.
5. Для стилей — `CSS/LESS` → аналогично вставить нужные `.less` файлы.

## Пример: Минимальный набор для зон попаданий

5 файлов `.js` + 3 файла `.less`:

- `gc-toggler.js` + `gc-toggler.less`
- `gc-utils.js` + `gc-utils.less`
- `fix-multiply-zero.js`
- `hit-locations.js` + `hit-locations.less`
- `dr-inheritance.js`

Опционально: `gc-toggler-ui.js` и `sub-location.js` + `sub-location.less`.

## Обновление

Открыть редактор, найти старую копию сниппета (по комментарию-заголовку `// === <filename> ===` или по namespace вроде `window.gcInternal.patched.hitLocations`), заменить блок на новое содержимое из этой папки. Все сниппеты идемпотентны (guard на повторный eval).

## Откат установки

Открыть редактор, удалить IIFE сниппета целиком → сохранить → reload. Или через UI «Сниппеты» снять чекбокс группы (сниппет остаётся в коде, но не активируется).