// Фикс экспорта в GCS / Foundry-VTT. v1.0.2
/* Переопределяет окно «Скачать» на листе и генерит корректный GCS v5 JSON прямо в браузере.
   
   Основано на оригинальном экспортере v0.1 от Siv (Discord: siv_honor). Многое было переписано, многое 
   было добавлено. 

   Что чинит и добавляет:
     1. Урон оружия привязан к ST ({st, base, type}) — Foundry считает урон от силы корректно.
     2. Hit-locations / DR по зонам в Foundry = как в GCS: статичный DR (вшит в body_type) или опциональный 
	    динамический (даётся бонусом, снимается toggle'ом equipped, требует макрос).
     3. Заклинания: college / difficulty / prereqs, очки в контейнерах, уровень атаки заклинания в Foundry.
     4. Поиск по мастер-библиотеке GCS на GitHub при указанной Книге (первое скачивание чуть дольше, так как 
	    грузит в кэш браузера).
     5. Опция «Имена на русском»: рус. имена черт/умений/заклинаний (как в Менторе) вместо англ. из библиотеки GCS.
*/
(function () {
  'use strict';
  var ID = 'gcs-and-foundry-exporter-fixed', DEF = true, RECALC = false;
  var LABEL = 'Фикс экспорта GCS / Foundry-VTT';
  var HINT = 'Кнопки «Foundry-VTT» и «Файл для GCS» в окне «Скачать» генерят корректный GCS v5 вместо сломанных штатных экспортёров.';
  function flag(id, def) { var v = localStorage.getItem('gc-fix:' + id); return v == null ? !!def : v === '1'; }
  function setFlag(id, on) { localStorage.setItem('gc-fix:' + id, on ? '1' : '0'); }
  var RUS_ID = 'gcs-rusnames';
  var RUS_LABEL = 'Имена на русском в экспорте';
  var RUS_HINT = 'Имена преимуществ/умений/заклинаний в экспорте GCS/VTT: при вкл. применяет русские (как в Менторе), при выкл. применяет английские (из библиотеки GCS).';
  function rusNames() { return flag(RUS_ID, false); }
  var DR_ID = 'gcs-dynamic-dr';
  var DR_LABEL = 'Использовать динамический DR';
  var DR_HINT = 'Динамический DR брони: даётся активным бонусом и снимается toggle\'ом галки equipped у предмета. ТРЕБУЕТ МАКРОС! Файл с макросом лежит в Discord канале, переход через клик по подсказке. Выключено (по умолчанию): DR статичный, фиксированно вшит в зоны body_type и макрос не нужен.';
  function dynamicDR() { return flag(DR_ID, false); }
  var nameMap = null;
  function buildNameMap() {
    if (nameMap) return nameMap;
    nameMap = {};
    globalChar.find("advantage, skill, spell, technique").each(function () {
      var $x = $(this);
      var en = ($x.children("name").text() || "").trim();
      var ru = ($x.children("name-loc").text() || "").trim();
      if (en && ru && en !== ru) nameMap[en.toLowerCase()] = ru;
    });
    return nameMap;
  }
  function rusifyPrereqs(pr) {
    if (!pr || !pr.prereqs) return;
    var map = buildNameMap();
    pr.prereqs.forEach(function (p) {
      if (p.type === "prereq_list") { rusifyPrereqs(p); return; }
      if (p.name && p.name.qualifier) {
        var ru = map[String(p.name.qualifier).toLowerCase()];
        if (ru) p.name.qualifier = ru;
      }
      if (p.type === "spell_prereq" && p.sub_type === "name" && p.qualifier && p.qualifier.qualifier) {
        var ru2 = map[String(p.qualifier.qualifier).toLowerCase()];
        if (ru2) p.qualifier.qualifier = ru2;
      }
    });
  }
  function rusifyAll(items) {
    (items || []).forEach(function (it) {
      if (it.prereqs) rusifyPrereqs(it.prereqs);
      if (it.children) rusifyAll(it.children);
    });
  }

  var LIB_BASE = "https://raw.githubusercontent.com/richardwilkes/gcs_master_library/master/Library/";
  var LIB = window.__gcsLib = window.__gcsLib || { idx: {}, loaded: {}, allLoaded: {}, files: null };
  LIB.idx = LIB.idx || {};
  ['trait', 'skill', 'spell', 'equipment'].forEach(function (k) { LIB.idx[k] = LIB.idx[k] || {}; });
  var EXT = { trait: ".adq", skill: ".skl", spell: ".spl", equipment: ".eqp" };
  var BASIC = { trait: "Basic Set/Basic Set Traits.adq", skill: "Basic Set/Basic Set Skills.skl", equipment: "Basic Set/Basic Set Equipment.eqp" };

  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open("gcsLibCache", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("books"); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbGet(key) {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var t = db.transaction("books").objectStore("books").get(key);
        t.onsuccess = function () { res(t.result); }; t.onerror = function () { res(null); };
      });
    }).catch(function () { return null; });
  }
  function idbPut(key, val) {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var t = db.transaction("books", "readwrite").objectStore("books").put(val, key);
        t.onsuccess = function () { res(); }; t.onerror = function () { res(); };
      });
    }).catch(function () {});
  }

  function bookRank(path) {
    if (path.indexOf("Basic Set") === 0) return 0;
    if (path === "Magic/Magic Spells.spl") return 1;
    if (path.indexOf("Magic/") === 0) return 2;
    if (/Discworld|Lite|Dungeon Fantasy/i.test(path)) return 4;
    return 3;
  }
  function indexBook(kind, txt, rank) {
    function walk(rows) {
      (rows || []).forEach(function (r) {
        if (!r) return;
        if (r.children) { walk(r.children); return; }
        var nm = r.name || r.description;
        if (nm) {
          var k = nm.toLowerCase(), ex = LIB.idx[kind][k];
          if (!ex || rank < (ex.__rank == null ? 9 : ex.__rank)) { r.__rank = rank; LIB.idx[kind][k] = r; }
        }
      });
    }
    try { walk(JSON.parse(txt).rows); } catch (e) {}
  }

  function loadBook(path, kind) {
    if (LIB.loaded[path]) return Promise.resolve();
    LIB.loaded[path] = true;
    var rank = bookRank(path);
    var url = LIB_BASE + path.split("/").map(encodeURIComponent).join("/");
    return idbGet(url).then(function (cached) {
      if (cached) { indexBook(kind, cached, rank); return; }
      return fetch(url).then(function (r) { return r.ok ? r.text() : ""; }).then(function (txt) {
        if (txt) { indexBook(kind, txt, rank); idbPut(url, txt); }
      }).catch(function () {});
    });
  }

  function libFiles() {
    if (LIB.files) return Promise.resolve(LIB.files);
    return fetch("https://api.github.com/repos/richardwilkes/gcs_master_library/git/trees/master?recursive=1")
      .then(function (r) { return r.json(); })
      .then(function (t) { LIB.files = (t.tree || []).map(function (n) { return n.path; }).filter(function (p) { return p.indexOf("Library/") === 0; }); return LIB.files; })
      .catch(function () { LIB.files = []; return LIB.files; });
  }

  function ensureAllLoaded(kind) {
    if (LIB.allLoaded[kind]) return Promise.resolve();
    return libFiles().then(function (files) {
      var ext = EXT[kind];
      var jobs = files.filter(function (p) { return p.slice(-ext.length) === ext; })
        .map(function (p) { return loadBook(p.slice("Library/".length), kind); });
      return Promise.all(jobs);
    }).then(function () { LIB.allLoaded[kind] = true; });
  }

  function findLib(kind, name) {
    if (!name) return Promise.resolve(null);
    var key = name.toLowerCase();
    if (LIB.idx[kind][key]) return Promise.resolve(LIB.idx[kind][key]);
    var basic = BASIC[kind] ? loadBook(BASIC[kind], kind) : Promise.resolve();
    return basic.then(function () {
      if (LIB.idx[kind][key]) return LIB.idx[kind][key];
      return ensureAllLoaded(kind).then(function () { return LIB.idx[kind][key] || null; });
    });
  }

  function findLibSync(kind, name) { return name ? (LIB.idx[kind][name.toLowerCase()] || null) : null; }

  function preloadLib() {
    var names = { trait: [], skill: [], spell: [], equipment: [] };
    globalAdvantagesList.each(function () { var n = $(this).children("name").text(); if (n) names.trait.push(n); });
    globalSkillsList.each(function () { var n = $(this).children("name").text(); if (n) names.skill.push(n); });
    if (window.globalSpellsList) globalSpellsList.each(function () { var n = $(this).children("name").text(); if (n) names.spell.push(n); });
    if (window.globalEquipmentList) globalEquipmentList.each(function () {
      var dl = $(this).children("description-loc").text();
      var n = (dl ? dl.split('\n')[0] : $(this).children("description").text()).trim();
      if (n) names.equipment.push(n);
    });
    var chain = Promise.resolve();
    ['trait', 'skill', 'spell', 'equipment'].forEach(function (kind) {
      names[kind].forEach(function (nm) { chain = chain.then(function () { return findLib(kind, nm); }); });
    });
    return chain;
  }

  function fromLib(libEl, kind, $v) {
    var el = JSON.parse(JSON.stringify(libEl));
    delete el.__rank;
    el.id = tid(kind === 'trait' ? 't' : kind === 'skill' ? 's' : 'p');
    if (el.weapons) el.weapons.forEach(function (w) { w.id = tid(w.id && w.id[0] === 'W' ? 'W' : 'w'); });
    if (el.children) delete el.children; 
    var loc = $v.children("name-loc").text();
    el.name = cleanName(rusNames() && loc ? loc : libEl.name);
    var cost = num($v.children("gc-cost").text());
    el.calc = el.calc || {}; el.calc.points = cost;
    var lv = $v.children("levels").text();
    if (kind === 'trait') {
      var mbp = $v.children("base_points").text(), mppl = $v.children("points_per_level").text();
      var leveled = mppl !== "" && num(mppl);
      if (leveled) { el.points_per_level = num(mppl); el.can_level = true; }
      var fmods = buildModifiers($v);
      if (mbp !== "") el.base_points = num(mbp);
      else if (leveled) delete el.base_points;
      else if (fmods.length) { if (libEl.base_points == null) el.base_points = 0; }
      else el.base_points = cost;
      if (leveled || libEl.points_per_level != null || libEl.can_level) el.levels = num(lv);
      else if (lv && num(lv)) el.levels = num(lv);
      var cr = $v.children("cr").text();
      if (cr && num(cr)) el.cr = num(cr);
      if (fmods.length) el.modifiers = fmods;
    }
    var mnotes = $v.children("notes").text().trim();
    if (mnotes) el.local_notes = mnotes;
    if (kind !== 'trait') {
      el.points = num($v.children("points").text());
      el.calc.level = num($v.children("gc-level").text());
      el.calc.rsl = $v.children("gc-stat").text();
      var mspec = $v.children("specialization").text();
      var ph = (el.specialization || "").match(/@([^@]+)@/);
      if (ph && mspec) { el.replacements = el.replacements || {}; el.replacements[ph[1]] = mspec; }
    }
    return el;
  }

  function fromLibEquip(libEl, $v, ruDesc) {
    var el = JSON.parse(JSON.stringify(libEl));
    delete el.__rank; delete el.children;
    el.id = tid('e');
    el.description = cleanName((rusNames() && ruDesc) ? ruDesc : libEl.description);
    if (el.weapons) {
      el.weapons.forEach(function (w) { w.id = tid(w.id && w.id[0] === 'W' ? 'W' : 'w'); });
      var mLvls = $v.children("melee_weapon").map(function () { return num($(this).children("gc-level").text()); }).get();
      var rLvls = $v.children("ranged_weapon").map(function () { return num($(this).children("gc-level").text()); }).get();
      var mi = 0, ri = 0;
      el.weapons.forEach(function (w) {
        var lvl = (w.id && w.id[0] === 'W') ? rLvls[ri++] : mLvls[mi++];
        if (lvl) { w.calc = w.calc || {}; w.calc.level = lvl; }
        if (w.strength != null && num(w.strength) <= 0) delete w.strength;
      });
    }
    el.base_value = String(num($v.children("value").text()));
    var wt = $v.children("weight").text();
    if (wt) el.base_weight = /[a-zA-Zа-яА-Я]/.test(wt) ? wt : wt + " lb";
    el.quantity = num($v.children("quantity").text()) || 1;
    var st = ($v.attr("state") || "").replace(/\s+/g, "_").toLowerCase();
    if (st !== "other" && st !== "not_carried") el.equipped = true;

    var nt = $v.children("notes").text().trim(); if (nt) el.local_notes = nt;
    el.calc = { value: num(el.base_value), extended_value: num(el.base_value) * el.quantity, weight: el.base_weight, extended_weight: el.base_weight };
    var lebn = featuresToBonuses(el.features, dynamicDR()); if (lebn) el.bonuses = lebn;
    if (el.equipped) (el.features || []).forEach(function (f) { if (f.type === "dr_bonus" && f.amount) addEquipDR(f.location, f.specialization, f.amount); });
    return el;
  }

  function buildEquipFeatures($v) {
    var LM = { feet: "foot", hands: "hand", arms: "arm", legs: "leg", eyes: "eye" };
    var CMP = { "starts with": "starts_with", "is": "is", "contains": "contains", "is anything": "is_anything", "ends with": "ends_with" };
    var feats = [];
    Array.from($v.children("dr_bonus")).forEach(function (i) {
      var $i = $(i), loc = ($i.children("location").text() || "").toLowerCase(), amt = $i.children("amount").text();
      if (!loc || !amt) return;
      var f = { type: "dr_bonus", location: LM[loc] || loc, amount: num(amt) };
      var dt = $i.children("damage-type").text(); if (dt) f.specialization = dt;
      feats.push(f);
    });
    Array.from($v.children("attribute_bonus")).forEach(function (i) {
      var $i = $(i), attr = $i.children("attribute").text(), amt = $i.children("amount").text();
      if (!attr || !amt) return;
      var f = { type: "attribute_bonus", attribute: attr, amount: num(amt) };
      var lim = $i.children("limitation").text(); if (lim) f.limitation = lim;
      feats.push(f);
    });
    Array.from($v.children("skill_bonus")).forEach(function (i) {
      var $i = $(i), $nm = $i.children("name"), qual = $nm.text(), amt = $i.children("amount").text();
      if (!qual || !amt) return;
      var f = { type: "skill_bonus", selection_type: "skills_with_name",
                name: { compare: CMP[$nm.attr("compare")] || "is", qualifier: qual }, amount: num(amt) };
      var $sp = $i.children("specialization"), spc = $sp.attr("compare");
      if (spc && spc !== "is anything" && $sp.text())
        f.specialization = { compare: CMP[spc] || "is", qualifier: $sp.text() };
      feats.push(f);
    });
    return feats;
  }
  var equipDR = {};
  function addEquipDR(loc, dmgType, amount) {
    if (!loc || !amount) return;
    var z = equipDR[loc] || (equipDR[loc] = {});
    var t = dmgType || "all";
    z[t] = (z[t] || 0) + amount;
  }

  function featuresToBonuses(features, includeDR) {
    var lines = [];
    (features || []).forEach(function (f) {
      if (f.amount == null) return;
      var s = f.amount >= 0 ? "+" : "";
      if (f.type === "dr_bonus" && includeDR && !f.specialization) lines.push("DR " + s + f.amount + (f.location ? " *" + f.location : ""));
    });
    return lines.join("\n");
  }

  var staticDefBonus = 0;
  function computeStaticDefBonus() {
    var b = 0;
    var adv = globalChar.find("advantage_list");
    if (adv.length && /combat reflexes/i.test(adv.text())) b += 1;
    globalChar.find("equipment").each(function () {
      var $e = $(this), st = ($e.attr("state") || "").replace(/\s+/g, "_").toLowerCase();
      if (st === "other" || st === "not_carried") return;
      var desc = $e.children("description").text();
      var dl1 = ($e.children("description-loc").text() || "").split('\n')[0].trim();
      var libEq = findLibSync("equipment", desc) || (dl1 ? findLibSync("equipment", dl1) : null);
      var feats = libEq ? libEq.features : buildEquipFeatures($e);
      var itemDB = 0;
      (feats || []).forEach(function (f) {
        if (f.type === "attribute_bonus" && /^(dodge|parry|block)$/i.test(f.attribute || "") && f.amount > itemDB) itemDB = f.amount;
      });
      b += itemDB;
    });
    return b;
  }

  var DIRECTED = {
    "status": { pos: "High Status", neg: "Low Status" },
    "reputation": { pos: "Good Reputation", neg: "Bad Reputation" }
  };

  function parseDamage(raw) {
    raw = String(raw == null ? '' : raw).trim();
    if (!raw || raw === '-') return undefined;
    var armorDiv;
    var ad = raw.match(/\((\d+(?:\.\d+)?)\)/);
    if (ad) { armorDiv = ad[1]; raw = (raw.slice(0, ad.index) + raw.slice(ad.index + ad[0].length)).trim(); }
    var parts = raw.split(/\s+/);
    var dpart = parts[0] || '';
    var type = parts.slice(1).join(' ').trim();
    var m = dpart.match(/^(sw|thr):?([+-]\d+)?$/i);
    var dmg = {};
    if (type) dmg.type = type;
    if (m) {
      dmg.st = m[1].toLowerCase();
      if (m[2]) dmg.base = m[2];
    } else {
      dmg.base = dpart;
    }
    if (armorDiv) dmg.armor_divisor = num(armorDiv);
    return dmg;
  }

  function tid(kind) {
    var b = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(b);
    var s = btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return kind + s;
  }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; }
  
  function cleanName(s) { return (typeof s === "string" ? s.trim() : "") || "-"; }
  
  function mapCompare(c) {
    c = (c || "").toLowerCase().trim();
    var m = { "is": "is", "is not": "is_not", "contains": "contains", "does not contain": "does_not_contain",
              "starts with": "starts_with", "ends with": "ends_with", "is anything": "any",
              "at least": "at_least", "at most": "at_most", "equals": "equals" };
    return m[c] || c.replace(/\s+/g, "_");
  }
  
  function critText($el) {
    if (!$el.length) return null;
    var cmp = $el.attr("compare");
    if (!cmp || cmp === "is anything") return null;
    return { compare: mapCompare(cmp), qualifier: $el.text() };
  }
  
  function critNum($el) {
    if (!$el.length) return null;
    var cmp = $el.attr("compare");
    if (!cmp || cmp === "is anything") return null;
    return { compare: mapCompare(cmp), qualifier: num($el.text()) };
  }
  
  function buildPrereqFromXml($pl) {
    var out = { type: "prereq_list", all: $pl.attr("all") === "yes", prereqs: [] };
    var wt = critNum($pl.children("when_tl")); if (wt) out.when_tl = wt;
    $pl.children().each(function () {
      var $p = $(this), tag = this.tagName.toLowerCase(), has = $p.attr("has") !== "no";
      if (tag === "when_tl") return;
      if (tag === "prereq_list") { out.prereqs.push(buildPrereqFromXml($p)); return; }
      if (tag === "advantage_prereq") {
        var tp = { type: "trait_prereq", has: has };
        var $names = $p.children("name");
        var nm = critText($names.eq(0)); if (nm) tp.name = nm;
        var nt = critText($names.eq(1)) || critText($p.children("notes"));
        if (nt) tp.notes = nt;
        var lv = critNum($p.children("level")); if (lv) tp.level = lv;
        out.prereqs.push(tp);
      } else if (tag === "skill_prereq") {
        var sk = { type: "skill_prereq", has: has };
        var skn = critText($p.children("name")); if (skn) sk.name = skn;
        var sks = critText($p.children("specialization")); if (sks) sk.specialization = sks;
        var skl = critNum($p.children("level")); if (skl) sk.level = skl;
        out.prereqs.push(sk);
      } else if (tag === "attribute_prereq") {
        out.prereqs.push({ type: "attribute_prereq", has: has, which: ($p.attr("which") || "").toLowerCase(),
                           qualifier: { compare: mapCompare($p.attr("compare")), qualifier: num($p.text()) } });
      } else if (tag === "contained_weight_prereq") {
        out.prereqs.push({ type: "contained_weight_prereq", has: has,
                           qualifier: { compare: mapCompare($p.attr("compare")), qualifier: $p.text().trim() } });
      } else if (tag === "spell_prereq") {
        var sp = { type: "spell_prereq", has: has };
        var $nm = $p.children("name"), $col = $p.children("college"), $cc = $p.children("college_count"), $qty = $p.children("quantity");
        if ($nm.length) { sp.sub_type = "name"; sp.qualifier = { compare: mapCompare($nm.attr("compare")), qualifier: $nm.text() }; }
        else if ($cc.length) { sp.sub_type = "college_count"; sp.quantity = { compare: mapCompare($cc.attr("compare")), qualifier: num($cc.text()) }; }
        else if ($col.length) { sp.sub_type = "college"; sp.qualifier = { compare: mapCompare($col.attr("compare")), qualifier: $col.text() }; }
        if ($qty.length && !sp.quantity) sp.quantity = { compare: mapCompare($qty.attr("compare")), qualifier: num($qty.text()) };
        out.prereqs.push(sp);
      } else if (tag === "obj_prereq") {
        var eq = { type: "equipped_equipment" };
        var en = critText($p.children("name").eq(0)); if (en) eq.name = en;
        var et = critText($p.children("name").eq(1)) || critText($p.children("notes")); if (et) eq.tags = et;
        out.prereqs.push(eq);
      }
    });
    return out;
  }

  function buildModifiers($v, forContainer) {
    var mods = [];
    $v.children("modifier").each(function () {
      var $m = $(this), mn = $m.children("name").text();
      if (!mn) return;
      var $c = $m.children("cost"), mc = ($c.text() || "").trim();
      var ctype = $c.attr("type");
      var cadj;
      if (ctype === "multiplier") cadj = "x" + mc;
      else if (ctype === "points") cadj = mc;
      else if (forContainer) cadj = mc.replace(/%$/, "");
      else cadj = /%/.test(mc) ? mc : (mc + "%");
      var mo = { id: tid("m"), name: mn, cost_adj: cadj };
      var ref = $m.children("reference").text(); if (ref) mo.reference = ref;
      var aff = $m.children("affects").text(); if (aff) mo.affects = aff;
      var mnt = $m.children("notes").text().trim(); if (mnt) mo.local_notes = mnt;
      if ($m.attr("enabled") === "no") mo.disabled = true;
      mods.push(mo);
    });
    return mods;
  }

  function normDiff(raw) {
    raw = String(raw == null ? '' : raw).toLowerCase().trim();
    var m = raw.match(/^([a-z_]+)\s*\/\s*(\w+)$/);
    if (!m) return raw;
    var diff = m[2];
    if (['e', 'a', 'h', 'vh', 'w'].indexOf(diff) === -1) diff = 'vh';
    return m[1] + '/' + diff;
  }

  function convUnit(s, kind) {
    s = String(s == null ? '' : s).trim();
    if (!s) return s;
    if (kind === 'weight') {
      s = s.replace(/кг/gi, 'kg').replace(/фунт(?:ов|а)?|фнт/gi, 'lb').replace(/ф(?=[\s.)]|$)/gi, 'lb').replace(/г/gi, 'g');
    } else {
      s = s.replace(/см/gi, 'cm').replace(/мм/gi, 'mm').replace(/км/gi, 'km').replace(/м/gi, 'm');
      if (/['"]/.test(s)) return s;
    }
    s = s.replace(/\.+\s*$/, '').trim();
    var m = s.match(/^([+-]?[\d.,]+)\s*(\S*)$/);
    if (!m) return s;
    var unit = m[2].toLowerCase();
    var KNOWN = kind === 'weight' ? { kg: 1, g: 1, lb: 1, oz: 1 } : { cm: 1, mm: 1, m: 1, km: 1, ft: 1, in: 1 };
    return (unit in KNOWN) ? m[1] + ' ' + unit : m[1] + ' ' + (kind === 'weight' ? 'kg' : 'cm');
  }

  function buildGcsExport(kind) {
    equipDR = {};
    staticDefBonus = (kind === "vtt") ? computeStaticDefBonus() : 0;
    nameMap = null;
    var charIQ = num(globalChar.find("iq").first().text()) || 10;
    function spellRsl($v) {
      var rel = num($v.children("gc-level").text()) - charIQ;
      return "IQ" + (rel === 0 ? "" : (rel > 0 ? "+" : "") + rel);
    }
    function zoneDr(locIdx) {
        return num(globalChar.find("locations-list>location").eq(locIdx).children("dr").first().text());
    }
    function naturalBodyDR() {
        var n = 0;
        globalChar.find("dr_bonus").each(function () {
            var $d = $(this);
            if (($d.children("location").text() || "").toLowerCase() !== "full body") return;
            if ($d.closest("equipment, equipment_container").length) return;
            var $am = $d.children("amount"), $mod = $am.filter(".gc-modified-value");
            n += num(($mod.length ? $mod : $am).last().text());
        });
        return n;
    }

    const created_date = globalChar.find("created_date").text();
    const modified_date = globalChar.find("modified_date").text();

    function convertDateIntoISO(raw) {
        var parts = String(raw || "").split(" ");
        var dmy = (parts[0] || "").split(".");
        var time = parts[1] || "00:00";
        function p2(s) { s = String(s || "0"); return s.length < 2 ? "0" + s : s; }
        return dmy[2] + "-" + p2(dmy[1]) + "-" + p2(dmy[0]) + "T" + time + ":00Z";
    }

    const characterExportFile = {
        version: 5,
        id: tid('A'),
        profile: {
            name: globalChar.find("profile>name").text(),
            age: globalChar.find("profile>age").text(),
            birthday: globalChar.find("profile>birthday").text(),
            gender: globalChar.find("profile>gender").text(),
            height: convUnit(globalChar.find("profile>height").text(), 'length'),
            weight: convUnit(globalChar.find("profile>weight").text(), 'weight'),
            hair: globalChar.find("profile>hair").text(),
            eyes: globalChar.find("profile>eyes").text(),
            skin: globalChar.find("profile>skin").text(),
            handedness: globalChar.find("profile>handedness").text(),
            player_name: globalChar.find("profile>player_name").text(),
            title: globalChar.find("profile>title").text(),
            religion: globalChar.find("profile>religion").text(),
            tech_level: globalChar.find("profile>tech_level").text(),
            portrait: globalChar.find("profile>portrait").text(),
            SM: num(globalChar.find("sm_result").text())
        },
        settings: {
            page: {
                "paper_size": "letter",
                "orientation": "portrait",
                "top_margin": "0.25 in",
                "left_margin": "0.25 in",
                "bottom_margin": "0.25 in",
                "right_margin": "0.25 in"
            },
            block_layout: ["reactions conditional_modifiers", "melee", "ranged", "traits skills", "spells", "equipment", "other_equipment", "notes"],
            attributes: [{
                "id": "st",
                "type": "integer",
                "name": "ST",
                "full_name": "Strength",
                "base": "10",
                "cost_per_point": 10,
                "cost_adj_percent_per_sm": 10
            }, {
                "id": "dx",
                "type": "integer",
                "name": "DX",
                "full_name": "Dexterity",
                "base": "10",
                "cost_per_point": 20
            }, {
                "id": "iq",
                "type": "integer",
                "name": "IQ",
                "full_name": "Intelligence",
                "base": "10",
                "cost_per_point": 20
            }, {
                "id": "ht",
                "type": "integer",
                "name": "HT",
                "full_name": "Health",
                "base": "10",
                "cost_per_point": 10
            }, {
                "id": "will", "type": "integer", "name": "Will", "base": "$iq", "cost_per_point": 5
            }, {
                "id": "fright_check",
                "type": "integer",
                "name": "Fright Check",
                "base": "$will",
                "cost_per_point": 2
            }, {
                "id": "per",
                "type": "integer",
                "name": "Per",
                "full_name": "Perception",
                "base": "$iq",
                "cost_per_point": 5
            }, {
                "id": "vision", "type": "integer", "name": "Vision", "base": "$per", "cost_per_point": 2
            }, {
                "id": "hearing", "type": "integer", "name": "Hearing", "base": "$per", "cost_per_point": 2
            }, {
                "id": "taste_smell",
                "type": "integer",
                "name": "Taste \u0026 Smell",
                "base": "$per",
                "cost_per_point": 2
            }, {
                "id": "touch", "type": "integer", "name": "Touch", "base": "$per", "cost_per_point": 2
            }, {
                "id": "basic_speed",
                "type": "decimal",
                "name": "Basic Speed",
                "base": "($dx+$ht)/4",
                "cost_per_point": 20
            }, {
                "id": "basic_move",
                "type": "integer",
                "name": "Basic Move",
                "base": "Math.floor($basic_speed)",
                "cost_per_point": 5
            }, {
                "id": "fp",
                "type": "pool",
                "name": "FP",
                "full_name": "Fatigue Points",
                "base": "$ht",
                "cost_per_point": 3,
                "thresholds": [{
                    "state": "Unconscious", "expression": "-$fp", "ops": ["halve_move", "halve_dodge", "halve_st"]
                }, {
                    "state": "Collapse",
                    "expression": "0",
                    "explanation": "Roll vs. Will to do anything besides talk or rest; failure causes unconsciousness\nEach FP you lose below 0 also causes 1 HP of injury\nMove, Dodge and ST are halved (B426)",
                    "ops": ["halve_move", "halve_dodge", "halve_st"]
                }, {
                    "state": "Tired",
                    "expression": "ceil($fp/3)-1",
                    "explanation": "Move, Dodge and ST are halved (B426)",
                    "ops": ["halve_move", "halve_dodge", "halve_st"]
                }, {
                    "state": "Tiring", "expression": "$fp-1"
                }, {
                    "state": "Rested", "expression": "$fp"
                }]
            }, {
                "id": "hp",
                "type": "pool",
                "name": "HP",
                "full_name": "Hit Points",
                "base": "$st",
                "cost_per_point": 2,
                "cost_adj_percent_per_sm": 10,
                "thresholds": [{
                    "state": "Dead", "expression": "round(-$hp*5)", "ops": ["halve_move", "halve_dodge"]
                }, {
                    "state": "Dying #4",
                    "expression": "round(-$hp*4)",
                    "explanation": "Roll vs. HT to avoid death\nRoll vs. HT-4 every second to avoid falling unconscious\nMove and Dodge are halved (B419)",
                    "ops": ["halve_move", "halve_dodge"]
                }, {
                    "state": "Dying #3",
                    "expression": "round(-$hp*3)",
                    "explanation": "Roll vs. HT to avoid death\nRoll vs. HT-3 every second to avoid falling unconscious\nMove and Dodge are halved (B419)",
                    "ops": ["halve_move", "halve_dodge"]
                }, {
                    "state": "Dying #2",
                    "expression": "round(-$hp*2)",
                    "explanation": "Roll vs. HT to avoid death\nRoll vs. HT-2 every second to avoid falling unconscious\nMove and Dodge are halved (B419)",
                    "ops": ["halve_move", "halve_dodge"]
                }, {
                    "state": "Dying #1",
                    "expression": "-$hp",
                    "explanation": "Roll vs. HT to avoid death\nRoll vs. HT-1 every second to avoid falling unconscious\nMove and Dodge are halved (B419)",
                    "ops": ["halve_move", "halve_dodge"]
                }, {
                    "state": "Collapse",
                    "expression": "0",
                    "explanation": "Roll vs. HT every second to avoid falling unconscious\nMove and Dodge are halved (B419)",
                    "ops": ["halve_move", "halve_dodge"]
                }, {
                    "state": "Reeling",
                    "expression": "ceil($hp/3)-1",
                    "explanation": "Move and Dodge are halved (B419)",
                    "ops": ["halve_move", "halve_dodge"]
                }, {
                    "state": "Wounded", "expression": "$hp-1"
                }, {
                    "state": "Healthy", "expression": "$hp"
                }]
            }],
            body_type: {
                name: "Humanoid", roll: "3d", locations: [{
                    id: "eye",
                    choice_name: "Eyes",
                    table_name: "Eyes",
                    hit_penalty: -9,
                    description: "An attack that misses by 1 hits the torso instead. Only\nimpaling (imp), piercing (pi-, pi, pi+, pi++), and\ntight-beam burning (burn) attacks can target the eye – and\nonly from the front or sides. Injury over HP÷10 blinds the\neye. Otherwise, treat as skull, but without the extra DR!",
                    calc: {
                        roll_range: "-", dr: {
                            all: zoneDr(2)
                        }
                    }
                }, {
                    id: "skull",
                    choice_name: "Skull",
                    table_name: "Skull",
                    slots: 2,
                    hit_penalty: -7,
                    dr_bonus: 2,
                    description: "An attack that misses by 1 hits the torso instead. Wounding\nmodifier is x4. Knockdown rolls are at -10. Critical hits\nuse the Critical Head Blow Table (B556). Exception: These\nspecial effects do not apply to toxic (tox) damage.",
                    calc: {
                        roll_range: "3-4", dr: {
                            all: zoneDr(0)
                        }
                    }
                }, {
                    "id": "face",
                    "choice_name": "Face",
                    "table_name": "Face",
                    "slots": 1,
                    "hit_penalty": -5,
                    "description": "An attack that misses by 1 hits the torso instead. Jaw,\ncheeks, nose, ears, etc. If the target has an open-faced\nhelmet, ignore its DR. Knockdown rolls are at -5. Critical\nhits use the Critical Head Blow Table (B556). Corrosion\n(cor) damage gets a x1½ wounding modifier, and if it\ninflicts a major wound, it also blinds one eye (both eyes on\ndamage over full HP). Random attacks from behind hit the\nskull instead.",
                    "calc": {
                        "roll_range": "5", "dr": {
                            all: zoneDr(1)
                        }
                    }
                }, {
                    "id": "leg",
                    "choice_name": "Leg",
                    "table_name": "Right Leg",
                    "slots": 2,
                    "hit_penalty": -2,
                    "description": "Reduce the wounding multiplier of large piercing (pi+), huge\npiercing (pi++), and impaling (imp) damage to x1. Any major\nwound (loss of over ½ HP from one blow) cripples the limb.\nDamage beyond that threshold is lost.",
                    "calc": {
                        "roll_range": "6-7", "dr": {
                            all: zoneDr(8)
                        }
                    }
                }, {
                    "id": "arm",
                    "choice_name": "Arm",
                    "table_name": "Right Arm",
                    "slots": 1,
                    "hit_penalty": -2,
                    "description": "Reduce the wounding multiplier of large piercing (pi+), huge\npiercing (pi++), and impaling (imp) damage to x1. Any major\nwound (loss of over ½ HP from one blow) cripples the limb.\nDamage beyond that threshold is lost. If holding a shield,\ndouble the penalty to hit: -4 for shield arm instead of -2.",
                    "calc": {
                        "roll_range": "8", "dr": {
                            all: zoneDr(6)
                        }
                    }
                }, {
                    "id": "torso", "choice_name": "Torso", "table_name": "Torso", "slots": 2, "calc": {
                        "roll_range": "9-10", "dr": {
                            all: zoneDr(4)
                        }
                    }
                }, {
                    "id": "groin",
                    "choice_name": "Groin",
                    "table_name": "Groin",
                    "slots": 1,
                    "hit_penalty": -3,
                    "description": "An attack that misses by 1 hits the torso instead. Human\nmales and the males of similar species suffer double shock\nfrom crushing (cr) damage, and get -5 to knockdown rolls.\nOtherwise, treat as a torso hit.",
                    "calc": {
                        "roll_range": "11", "dr": {
                            all: zoneDr(5)
                        }
                    }
                }, {
                    "id": "arm",
                    "choice_name": "Arm",
                    "table_name": "Left Arm",
                    "slots": 1,
                    "hit_penalty": -2,
                    "description": "Reduce the wounding multiplier of large piercing (pi+), huge\npiercing (pi++), and impaling (imp) damage to x1. Any major\nwound (loss of over ½ HP from one blow) cripples the limb.\nDamage beyond that threshold is lost. If holding a shield,\ndouble the penalty to hit: -4 for shield arm instead of -2.",
                    "calc": {
                        "roll_range": "12", "dr": {
                            all: zoneDr(6)
                        }
                    }
                }, {
                    "id": "leg",
                    "choice_name": "Leg",
                    "table_name": "Left Leg",
                    "slots": 2,
                    "hit_penalty": -2,
                    "description": "Reduce the wounding multiplier of large piercing (pi+), huge\npiercing (pi++), and impaling (imp) damage to x1. Any major\nwound (loss of over ½ HP from one blow) cripples the limb.\nDamage beyond that threshold is lost.",
                    "calc": {
                        "roll_range": "13-14", "dr": {
                            all: zoneDr(8)
                        }
                    }
                }, {
                    "id": "hand",
                    "choice_name": "Hand",
                    "table_name": "Hand",
                    "slots": 1,
                    "hit_penalty": -4,
                    "description": "If holding a shield, double the penalty to hit: -8 for\nshield hand instead of -4. Reduce the wounding multiplier of\nlarge piercing (pi+), huge piercing (pi++), and impaling\n(imp) damage to x1. Any major wound (loss of over ⅓ HP\nfrom one blow) cripples the extremity. Damage beyond that\nthreshold is lost.",
                    "calc": {
                        "roll_range": "15", "dr": {
                            all: zoneDr(7)
                        }
                    }
                }, {
                    "id": "foot",
                    "choice_name": "Foot",
                    "table_name": "Foot",
                    "slots": 1,
                    "hit_penalty": -4,
                    "description": "Reduce the wounding multiplier of large piercing (pi+), huge\npiercing (pi++), and impaling (imp) damage to x1. Any major\nwound (loss of over ⅓ HP from one blow) cripples the\nextremity. Damage beyond that threshold is lost.",
                    "calc": {
                        "roll_range": "16", "dr": {
                            all: zoneDr(9)
                        }
                    }
                }, {
                    "id": "neck",
                    "choice_name": "Neck",
                    "table_name": "Neck",
                    "slots": 2,
                    "hit_penalty": -5,
                    "description": "An attack that misses by 1 hits the torso instead. Neck and\nthroat. Increase the wounding multiplier of crushing (cr)\nand corrosion (cor) attacks to x1½, and that of cutting\n(cut) damage to x2. At the GM’s option, anyone killed by a\ncutting (cut) blow to the neck is decapitated!",
                    "calc": {
                        "roll_range": "17-18", "dr": {
                            all: zoneDr(3)
                        }
                    }
                }, {
                    "id": "vitals",
                    "choice_name": "Vitals",
                    "table_name": "Vitals",
                    "hit_penalty": -3,
                    "description": "An attack that misses by 1 hits the torso instead. Heart,\nlungs, kidneys, etc. Increase the wounding modifier for an\nimpaling (imp) or any piercing (pi-, pi, pi+, pi++) attack\nto x3. Increase the wounding modifier for a tight-beam\nburning (burn) attack to x2. Other attacks cannot target the\nvitals.",
                    "calc": {
                        "roll_range": "-", "dr": {
                            "all": naturalBodyDR()
                        }
                    }
                }]
            },
            damage_progression: "basic_set",
            use_modifying_dice_plus_adds: true,
            default_length_units: "cm",
            default_weight_units: "kg",
            user_description_display: "tooltip",
            modifiers_display: "inline",
            notes_display: "inline",
            skill_level_adj_display: "tooltip",
            show_spell_adj: true
        },
        total_points: +globalChar.find("total_points").text(),
        points_record: [{
            when: convertDateIntoISO(modified_date), points: +globalChar.find("total_points").text(), reason: "Initial points"
        }],
        created_date: convertDateIntoISO(created_date), modified_date: convertDateIntoISO(modified_date),
        calc: {
            swing: globalChar.find("damages>damage-sw").text(),
            thrust: globalChar.find("damages>damage-thr").text(),
            basic_lift: getBasicLift(1 * getAttr('ST') + globalChar.find("ST_lift_bonus").int()) + " lb",
            move: (function () { var m = num(globalChar.find("move_result").text()); return [m, Math.floor(m * 0.8), Math.floor(m * 0.6), Math.floor(m * 0.4), Math.floor(m * 0.2)]; })(),
            dodge: (function () {
                var base = Math.floor(num(globalChar.find("speed_result").text())) + 3 + staticDefBonus;
                return [base, base - 1, base - 2, base - 3, base - 4];
            })()
        },
        attributes: (function () {
            var f = function (q) { return num(globalChar.find(q).text()); };
            var ST = f("st_result"), DX = f("dx_result"), IQ = f("iq_result"), HT = f("ht_result");
            var WILL = f("will_result"), PER = f("perception_result");
            var FCB = f("fright_check_bonus");
            var SPEED = f("speed_result"), MOVE = f("move_result"), FP = f("fp_result"), HP = f("hp_result");
            var bST = f("st"), bDX = f("dx"), bIQ = f("iq"), bHT = f("ht");
            var bWILL = f("will"), bPER = f("perception"), bSPEED = f("speed"), bMOVE = f("move"), bFP = f("fp"), bHP = f("hp");
            function A(id, adj, value, cost, extra) {
                var a = { attr_id: id, adj: adj, calc: { value: value, points: Math.round(adj * cost) } };
                if (extra) for (var k in extra) a.calc[k] = extra[k];
                return a;
            }
            return [
                A("st", bST - 10, ST, 10),
                A("dx", bDX - 10, DX, 20),
                A("iq", bIQ - 10, IQ, 20),
                A("ht", bHT - 10, HT, 10),
                A("will", bWILL, WILL, 5),
                A("fright_check", 0, WILL + FCB, 0),
                A("per", bPER, PER, 5),
                A("vision", 0, PER, 2),
                A("hearing", 0, PER, 2),
                A("taste_smell", 0, PER, 2),
                A("touch", 0, PER, 2),
                A("basic_speed", bSPEED, SPEED, 20),
                A("basic_move", bMOVE, MOVE, 5),
                A("fp", bFP, FP, 3, { current: FP }),
                A("hp", bHP, HP, 2, { current: HP })
            ];
        })(),
    }

    function buildDefaults($w) {
        var out = [];
        $w.children("default").each(function () {
            var $d = $(this);
            var type = ($d.children("type").text() || "").toLowerCase();
            if (!type) return;
            var d = { type: type };
            var name = $d.children("name").text(); if (name) d.name = name;
            var spec = $d.children("specialization").text(); if (spec) d.specialization = spec;
            var mod = $d.children("modifier").text(); if (mod && num(mod) !== 0) d.modifier = num(mod);
            out.push(d);
        });
        return out;
    }

    function weaponCalc($w) {
        var c = {};
        var lvl = $w.children("gc-level").text(); if (lvl) c.level = num(lvl);
        var dres = $w.children("damage-result").text();
        if (dres) c.damage = dres.replace(/\s+/g, " ").trim();
        else {
            var draw = $w.children("damage").last().text().replace(/\s+/g, " ").trim();
            if (draw && !/\b(sw|thr)\b/i.test(draw)) c.damage = draw;
        }
        if (lvl) {
            var lv = num(lvl);
            var pStr = $w.children("parry").text();
            if (pStr && pStr !== "No" && pStr !== "-") {
                var pm = parseInt(pStr, 10);
                if (!isNaN(pm)) c.parry = String(Math.floor(lv / 2) + 3 + pm + staticDefBonus) + pStr.replace(/[+-]?\d+/, "").trim();
            }
            var bStr = $w.children("block").text();
            if (bStr && bStr !== "No" && bStr !== "-") {
                var bm = parseInt(bStr, 10);
                if (!isNaN(bm)) c.block = String(Math.floor(lv / 2) + 3 + bm + staticDefBonus);
            }
        }
        return Object.keys(c).length ? c : null;
    }

    function buildWeapons($container) {
        var ws = [];
        $container.children("melee_weapon").each(function () {
            var $w = $(this);
            var w = { id: tid("w"), sv: 1 };
            var dmg = parseDamage($w.children("damage").last().text()); if (dmg) w.damage = dmg;
            var usage = $w.children("usage").text(); if (usage) w.usage = usage;
            var strength = $w.children("strength").text(); if (strength && strength !== "-" && num(strength) > 0) w.strength = strength;
            var reach = $w.children("reach").text(); if (reach && reach !== "-") w.reach = reach;
            var parry = $w.children("parry").text(); if (parry && parry !== "-") w.parry = parry;
            var block = $w.children("block").text(); if (block && block !== "-") w.block = block;
            var defs = buildDefaults($w); if (defs.length) w.defaults = defs;
            var c = weaponCalc($w); if (c) w.calc = c;
            ws.push(w);
        });
        $container.children("ranged_weapon").each(function () {
            var $w = $(this);
            var w = { id: tid("W"), sv: 1 };
            var dmg = parseDamage($w.children("damage").last().text()); if (dmg) w.damage = dmg;
            var usage = $w.children("usage").text(); if (usage) w.usage = usage;
            var strength = $w.children("strength").text(); if (strength && strength !== "-" && num(strength) > 0) w.strength = strength;
            var accuracy = $w.children("accuracy").text(); if (accuracy) w.accuracy = accuracy;
            var range = $w.children("range").text(); if (range) w.range = range;
            var rof = $w.children("rate_of_fire").text(); if (rof) w.rate_of_fire = rof;
            var shots = $w.children("shots").text(); if (shots) w.shots = shots;
            var bulk = $w.children("bulk").text(); if (bulk) w.bulk = bulk;
            var recoil = $w.children("recoil").text(); if (recoil) w.recoil = recoil;
            var defs = buildDefaults($w); if (defs.length) w.defaults = defs;
            var c = weaponCalc($w); if (c) w.calc = c;
            ws.push(w);
        });
        return ws;
    }
	
    function buildSkill($v) {
        var engName = $v.children("name").text();
        var lib = engName ? findLibSync("skill", engName) : null;
        if (lib) return fromLib(lib, "skill", $v);
        var specialization = $v.children("specialization").text();
        var name = cleanName(rusNames() ? ($v.children("name-loc").text() || engName) : engName);
        var sk = {
            id: tid("s"),
            name: name,
            difficulty: normDiff($v.children("difficulty").text()),
            points: num($v.children("points").text()),
            calc: { level: num($v.children("gc-level").text()), rsl: $v.children("gc-stat").text() }
        };
        if (specialization && name.indexOf(specialization) === -1) sk.specialization = specialization;
        var notes = $v.children("notes").text(); if (notes) sk.notes = notes;
        return sk;
    }
    function walkSkills($c) {
        var out = [];
        $c.children().each(function () {
            var $v = $(this), tag = this.tagName.toLowerCase();
            if ($v.hasClass("empty-container")) return;
            if (tag === "skill_container") {
                var en = $v.children("name").text(), ru = $v.children("name-loc").text();
                out.push({ id: tid("S"), name: cleanName(rusNames() ? (ru || en) : (en || ru)), children: walkSkills($v) });
            } else if (tag === "skill") {
                out.push(buildSkill($v));
            }
        });
        return out;
    }
    var $skRoot = globalChar.find("skill_list").first();
    characterExportFile.skills = $skRoot.length
        ? walkSkills($skRoot)
        : globalSkillsList.map(function (k, v) { return buildSkill($(v)); }).get();

    globalTechniqueList.each(function (k, v) {
        var $v = $(v);
        var tq = {
            id: tid("q"),
            name: cleanName(rusNames() ? ($v.find(">name-loc").text() || $v.find(">name").text()) : $v.find(">name").text()),
            difficulty: normDiff($v.find(">difficulty").text()),
            points: num($v.find(">points").text()),
            calc: { level: num($v.find(">gc-level").text()), rsl: $v.find(">points").text() }
        };
        var dt = ($v.find(">default>type").text() || "").toLowerCase();
        if (dt) {
            tq.default = { type: dt };
            var dn = $v.find(">default>name").text(); if (dn) tq.default.name = dn;
            var dm = $v.find(">default>modifier").text(); if (dm && num(dm) !== 0) tq.default.modifier = num(dm);
        }
        characterExportFile.skills.push(tq);
    });


    function buildSpell($v) {
        var engName = $v.children("name").text();
        var lib = engName ? findLibSync("spell", engName) : null;
        if (lib) {
            var libSp = fromLib(lib, "spell", $v);
            var col = $v.children("college").text(); if (col) libSp.college = [col];
            if (libSp.difficulty && libSp.difficulty.indexOf("/") === -1) libSp.difficulty = "iq/" + libSp.difficulty;
            if (libSp.calc) libSp.calc.rsl = spellRsl($v);
            if (!libSp.prereqs) { var $pl = $v.children("prereq_list"); if ($pl.length) libSp.prereqs = buildPrereqFromXml($pl); }
            if (kind === "vtt" && libSp.weapons) {
                var spLvl = num($v.children("gc-level").text());
                libSp.weapons.forEach(function (w) { w.calc = w.calc || {}; if (w.calc.level == null) w.calc.level = spLvl; });
            }
            return libSp;
        }
        var sp = {
            id: tid("p"),
            name: cleanName(rusNames() ? ($v.children("name-loc").text() || engName) : engName),
            difficulty: normDiff($v.children("difficulty").text()),
            points: num($v.children("points").text()),
            calc: { level: num($v.children("gc-level").text()), rsl: spellRsl($v) }
        };
        var college = $v.children("college").text(); if (college) sp.college = [college];
        var cls = $v.children("spell_class").text(); if (cls) sp.spell_class = cls;
        var cc = $v.children("casting_cost").text(); if (cc) sp.casting_cost = cc;
        var ct = $v.children("casting_time").text(); if (ct) sp.casting_time = ct;
        var mc = $v.children("maintenance_cost").text(); if (mc) sp.maintenance_cost = mc;
        var dur = $v.children("duration").text(); if (dur) sp.duration = dur;
        var $fpl = $v.children("prereq_list"); if ($fpl.length) sp.prereqs = buildPrereqFromXml($fpl);
        return sp;
    }
    function walkSpells($c) {
        var out = [];
        $c.children().each(function () {
            var $v = $(this), tag = this.tagName.toLowerCase();
            if ($v.hasClass("empty-container")) return;
            if (tag === "spell_container") {
                var en = $v.children("name").text(), ru = $v.children("name-loc").text();
                out.push({ id: tid("P"), name: cleanName(rusNames() ? (ru || en) : (en || ru)), children: walkSpells($v) });
            } else if (tag === "spell") {
                out.push(buildSpell($v));
            }
        });
        return out;
    }
    var $spRoot = globalChar.find("spell_list").first();
    characterExportFile.spells = $spRoot.length
        ? walkSpells($spRoot)
        : globalSpellsList.map(function (k, v) { return buildSpell($(v)); }).get();
    if (kind === "vtt") {
        /* ───────────────────────────────────────────────────────────────
                              ВРЕМЕННЫЙ ОБХОД БАГА GGA
                             После исправления уберу */
        (function sumContainerPoints(arr) {
            var total = 0;
            arr.forEach(function (s) {
                if (s.children) s.points = sumContainerPoints(s.children);
                total += s.points || 0;
            });
            return total;
        })(characterExportFile.spells);
        // ─────────────────────────────────────────────────────────────── 
    }

    function buildTraitDRFeatures($v) {
        var LM = { feet: "foot", hands: "hand", arms: "arm", legs: "leg", eyes: "eye" };
        var out = [];
        $v.children("dr_bonus").each(function () {
            var loc = ($(this).children("location").text() || "").toLowerCase();
            var amt = num($(this).children("amount").first().text());
            if (!amt) return;
            if (loc === "full body") {
                out.push({ type: "dr_bonus", locations: ["all"], amount: amt, per_level: true });
            } else if (loc.indexOf("except") >= 0 && loc.indexOf("eye") >= 0) {
                out.push({ type: "dr_bonus", locations: ["all"], amount: amt, per_level: true });
                out.push({ type: "dr_bonus", locations: ["eye"], amount: -amt, per_level: true });
            } else {
                out.push({ type: "dr_bonus", locations: [LM[loc] || loc], amount: amt, per_level: true });
            }
        });
        return out;
    }
    function buildTrait($v) {
        var engName = $v.children("name").text();
        if (!engName) return null;
        var lc = engName.toLowerCase(), skipLib = false;
        if (lc === "wealth") {
            if (!num($v.children("gc-cost").text())) return null;
            skipLib = true;
        }
        if (lc.indexOf("language:") === 0) {
            var libLang = findLibSync("trait", "language: @language@");
            if (libLang) {
                var rl = fromLib(libLang, "trait", $v);
                delete rl.base_points;
                var lmods = buildModifiers($v);
                if (lmods.length) rl.modifiers = lmods;
                var langEn = engName.replace(/^language:\s*/i, "").trim();
                var langRu = $v.children("name-loc").text().replace(/^язык\s*/i, "").trim();
                rl.replacements = { Language: (rusNames() && langRu) ? langRu : langEn };
                delete rl.prereqs;
                return rl;
            }
        }
        var searchName = engName, dir = DIRECTED[lc];
        if (dir) {
            searchName = num($v.children("gc-cost").text()) < 0 ? dir.neg : dir.pos;
        }
        var lib = (!skipLib && searchName) ? findLibSync("trait", searchName) : null;
        if (lib) {
            var libTr = fromLib(lib, "trait", $v);
            var drf = buildTraitDRFeatures($v);
            if (drf.length) libTr.features = (libTr.features || []).filter(function (f) { return f.type !== "dr_bonus"; }).concat(drf);
            return libTr;
        }
        var nm = $v.children("name-loc").text() || engName;
        var cost = num($v.children("gc-cost").text());
        var tr = { id: tid("t"), name: cleanName(rusNames() ? nm : engName), calc: { points: cost } };
        var mbp = $v.children("base_points").text(), mppl = $v.children("points_per_level").text();
        var leveled = mppl !== "" && num(mppl);
        if (leveled) { tr.points_per_level = num(mppl); tr.can_level = true; }
        var fbmods = buildModifiers($v);
        if (mbp !== "") tr.base_points = num(mbp);
        else if (!leveled) tr.base_points = fbmods.length ? 0 : cost;
        var mlv = $v.children("levels").text();
        if (leveled || (mlv && num(mlv))) tr.levels = num(mlv);
        if (fbmods.length) tr.modifiers = fbmods;
        var nt = $v.children("notes").text().trim();
        if (nt) tr.notes = nt;
        if (kind === "gcs") {
            var desc = $v.children("description-loc").text().replace(/\s+/g, " ").trim();
            if (desc) tr.userdesc = desc;
        }
        return tr;
    }
    function walkTraits($c) {
        var out = [];
        $c.children().each(function () {
            var $v = $(this), tag = this.tagName.toLowerCase();
            if ($v.hasClass("empty-container")) return;
            if (tag === "advantage_container") {
                var en = $v.children("name").text(), ru = $v.children("name-loc").text();
                var ct = { id: tid("T"), name: cleanName(rusNames() ? (ru || en) : (en || ru)), children: walkTraits($v) };
                var cnotes = $v.children("notes").text().trim();
                if (cnotes) ct.local_notes = cnotes;
                var cmods = buildModifiers($v, true);
                if (cmods.length) ct.modifiers = cmods;
                out.push(ct);
            } else if (tag === "advantage") {
                var tr = buildTrait($v);
                if (tr) out.push(tr);
            }
        });
        return out;
    }
    var $advRoot = globalChar.find("advantage_list").first();
    characterExportFile.traits = $advRoot.length
        ? walkTraits($advRoot)
        : globalAdvantagesList.map(function (k, v) { return buildTrait($(v)); }).get().filter(Boolean);
    if (kind === "vtt") {
        var leavesOf = function (n) {
            var out = [];
            (n.children || []).forEach(function (ch) { ch.children ? out.push.apply(out, leavesOf(ch)) : out.push(ch); });
            return out;
        };
        var d1 = function (nodes) {
            var res = [];
            (nodes || []).forEach(function (n) {
                if (!n.children) { res.push(n); return; }
                if (!n.children.some(function (c) { return !c.children; })) { res.push.apply(res, d1(n.children)); return; }
                var lv = leavesOf(n);
                if ((n.name || "").trim()) { n.children = lv; res.push(n); }
                else res.push.apply(res, lv);
            });
            return res;
        };
        var modConts = [];
        var stripMods = function (nodes) {
            return (nodes || []).filter(function (n) {
                if (n.children && n.modifiers && n.modifiers.length) { modConts.push(n); return false; }
                if (n.children) n.children = stripMods(n.children);
                return true;
            });
        };
        characterExportFile.traits = d1(stripMods(characterExportFile.traits)).concat(modConts);
    }

    (function stripSm(list) {
        (list || []).forEach(function (t) {
            if (t.features) {
                t.features = t.features.filter(function (f) { return !(f.type === "attribute_bonus" && String(f.attribute).toLowerCase() === "sm"); });
                if (!t.features.length) delete t.features;
            }
            if (t.children) stripSm(t.children);
        });
    })(characterExportFile.traits);
    function weaponBondFeature($v, hasWeapons) {
        if (!hasWeapons) return null;
        var n = 0;
        $v.find("skill_level").each(function () { if ($(this).attr("type") === "add") n += num($(this).text()); });
        return n ? { type: "skill_bonus", selection_type: "this_weapon", amount: n } : null;
    }
    function buildEquipItem($v, kind) {
        kind = kind || "e";
        var desc = $v.children("description").text();
        var dl1 = ($v.children("description-loc").text() || "").split('\n')[0].trim();
        var libEq = findLibSync("equipment", desc) || (dl1 ? findLibSync("equipment", dl1) : null);
        if (libEq) {
            var le = fromLibEquip(libEq, $v, desc);
            if (kind === "E") le.id = tid("E");
            var lw = buildWeapons($v);
            if (lw.length) le.weapons = lw;
            var lwb = weaponBondFeature($v, lw.length);
            if (lwb) le.features = (le.features || []).concat(lwb);
            return le;
        }
        var weightTxt = ($v.children("weight").text() || "").split('/')[0].trim();
        var eq = {
            id: tid(kind),
            description: cleanName(desc),
            base_value: String(num($v.children("value").text())),
            base_weight: weightTxt ? (/[a-zA-Zа-яА-Я]/.test(weightTxt) ? weightTxt : weightTxt + " lb") : "0 lb",
            quantity: num($v.children("quantity").text()) || 1
        };
        var ref = $v.children("reference").text(); if (ref) eq.reference = ref;
        var tl = $v.children("tech_level").text(); if (tl) eq.tech_level = tl;
        var lc = $v.children("legality_class").text(); if (lc) eq.legality_class = lc;
        var cats = $v.children("categories").children("category").map(function () { return $(this).text(); }).get();
        if (cats.length) eq.tags = cats;
        var enotes = $v.children("notes").text().trim(); if (enotes) eq.local_notes = enotes;
        var feats = buildEquipFeatures($v);
        if (feats.length) eq.features = feats;
        var ebn = featuresToBonuses(feats, dynamicDR()); if (ebn) eq.bonuses = ebn;
        var st = ($v.attr("state") || "").replace(/\s+/g, "_").toLowerCase();
        if (st !== "other" && st !== "not_carried") eq.equipped = true;
        if (eq.equipped) feats.forEach(function (f) { if (f.type === "dr_bonus" && f.amount) addEquipDR(f.location, f.specialization, f.amount); });
        eq.calc = {
            value: num(eq.base_value),
            extended_value: num(eq.base_value) * eq.quantity,
            weight: eq.base_weight,
            extended_weight: eq.base_weight
        };
        var weapons = buildWeapons($v);
        if (weapons.length) eq.weapons = weapons;
        var ewb = weaponBondFeature($v, weapons.length);
        if (ewb) eq.features = (eq.features || []).concat(ewb);
        return eq;
    }
	
    function walkEquip($c) {
        var out = [];
        $c.children().each(function () {
            var $v = $(this), tag = this.tagName.toLowerCase();
            if ($v.hasClass("empty-container")) return;
            if (tag === "equipment_container") {
                var ct = buildEquipItem($v, "E");
                ct.children = walkEquip($v);
                out.push(ct);
            } else if (tag === "equipment") {
                out.push(buildEquipItem($v));
            }
        });
        return out;
    }
    var $eqRoot = globalChar.find("equipment_list").first();
    function eqIsOther($v) { var s = ($v.attr("state") || "").replace(/\s+/g, "_").toLowerCase(); return s === "not_carried" || s === "other"; }
    var eqCarried = [], eqOther = [];
    if ($eqRoot.length) {
        $eqRoot.children("equipment, equipment_container").each(function () {
            var $v = $(this), tag = this.tagName.toLowerCase();
            if ($v.hasClass("empty-container")) return;
            var item;
            if (tag === "equipment_container") { item = buildEquipItem($v, "E"); item.children = walkEquip($v); }
            else { item = buildEquipItem($v); }
            (eqIsOther($v) ? eqOther : eqCarried).push(item);
        });
    } else {
        eqCarried = globalEquipmentList.map(function (k, v) { return buildEquipItem($(v)); }).get();
    }
    characterExportFile.equipment = eqCarried;
    if (eqOther.length) characterExportFile.other_equipment = eqOther;
		
    (function suffixDupWeapons(rows, seen) {
        (rows || []).forEach(function (r) {
            if (r.weapons && r.weapons.length) {
                var base = r.description || "";
                var c = seen[base] || 0;
                if (c > 0) r.description = base + " (" + c + ")";
                seen[base] = c + 1;
            }
            if (r.children) suffixDupWeapons(r.children, seen);
        });
    })((characterExportFile.equipment || []).concat(characterExportFile.other_equipment || []), {});

    if (kind === "vtt") {
        (function fixExt(nodes) {
            var tw = 0, tv = 0;
            (nodes || []).forEach(function (n) {
                var bw = parseFloat(n.base_weight) || 0, bv = num(n.base_value) || 0, q = n.quantity || 1;
                var child = n.children ? fixExt(n.children) : [0, 0];
                var ew = bw * q + child[0], ev = bv * q + child[1];
                if (n.calc) { n.calc.extended_weight = ew + " lb"; n.calc.extended_value = ev; }
                tw += ew; tv += ev;
            });
            return [tw, tv];
        })((characterExportFile.equipment || []).concat(characterExportFile.other_equipment || []));

        var bt = characterExportFile.settings && characterExportFile.settings.body_type;
        if (bt && bt.locations) bt.locations.forEach(function (loc) {
            var dz = equipDR[loc.id];
            if (!dz || !loc.calc || !loc.calc.dr || typeof loc.calc.dr.all !== "number") return;
            var dr = loc.calc.dr;
            if (dynamicDR()) {
                var total = Object.keys(dz).reduce(function (s, t) { return s + dz[t]; }, 0);
                dr.all = Math.max(0, dr.all - total);
                Object.keys(dz).forEach(function (t) {
                    if (t !== "all") dr[t] = (dz.all || 0) + dz[t];
                });
            } else Object.keys(dz).forEach(function (t) {
                if (t !== "all") { dr.all -= dz[t]; dr[t] = (dr[t] || 0) + dz[t]; }
            });
        });
    }

    var bioParts = [];
    globalChar.find("profile>notes, character>notes").each(function () { var t = $(this).text().trim(); if (t) bioParts.push(t); });
    var charBio = bioParts.join("\n\n");
    if (charBio) characterExportFile.notes = [{ id: tid("n"), type: "note", text: charBio }];

    if (rusNames()) {
      rusifyAll(characterExportFile.traits);
      rusifyAll(characterExportFile.skills);
      rusifyAll(characterExportFile.spells);
    }
    return characterExportFile;
  }

  function exportGcs(kind) {
    return preloadLib().then(function () {
      var data = buildGcsExport(kind);
      var name = globalChar.find("profile>name").text();
      if (!name) name = "[Имя не задано]";
      name += (kind === 'gcs' ? ".gcs" : "-vtt.gcs");
      var json = JSON.stringify(data, null, 2);
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url; link.download = name; link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }
  window.gcsExportFixed = exportGcs;

  function ourDialog() {
    var html = '' +
      '<style>modalpopup message button {min-width:250px;} modalpopup .note {margin:5px 20px 20px;}</style>' +
      '<button onClick="saveCharToFile(); modalPopupClose();"><i class="fa fa-download"></i> Файл ментора </button>' +
      '<div class="note">.xml - нужен для восстановления документа в менторе и для оффлайн версии</div>' +
      '<button class="pale" onClick="window.open(mentorServiceUrl+\'pdf/v\'+reverseString(currentChar), \'_blank\'); modalPopupClose();"><i class="fa fa-download"></i> Документ PDF </button>' +
      '<div class="note">.pdf - эксперементальный режим</div>';
    if (typeof classicRenderMode !== 'undefined' && classicRenderMode && !(typeof boardMode !== 'undefined' && boardMode)) {
      html += '' +
        '<button class="pale" onClick="location.href=\'roll20-download.php?c=\'+currentChar; modalPopupClose();"><i class="fa fa-download"></i> Файл для Roll20</button>' +
        '<div class="note">.json - огромное спасибо est0y за этот экспортер</div>' +
        '<button class="pale" onClick="gcsExportFixed(\'gcs\'); modalPopupClose();"><i class="fa fa-download"></i> Файл для GCS</button>' +
        '<div class="note">.gcs - исправленный экспорт</div>' +
        '<button class="pale" onClick="gcsExportFixed(\'vtt\'); modalPopupClose();"><i class="fa fa-download"></i> Файл для Foundry-VTT</button>' +
        '<div class="note">-vtt.gcs - исправленный экспорт<br>В настройках foundry-vtt обязательно выбрать Import file encoding: UTF-8<br>Оригинальный экспортер сделал Siv, его Дискорд: siv_honor<br><small>-vtt.gcs файл не совместим с GCS программой<br><br>Нашли неточность в экспортере GCS/VTT? Обращайтесь в Дискорд исправляющего: _gorch</small></div>';
    }
    modalPopup(html, null, "Закрыть");
  }

  var _orig = null;
  function apply() {
    if (window.__gcsExpInjected) return false;
    if (typeof window.saveCharToFileDialog !== 'function') return false;
    _orig = window.saveCharToFileDialog;
    window.saveCharToFileDialog = ourDialog;
    window.__gcsExpInjected = true;
    return true;
  }
  function revert() {
    if (!window.__gcsExpInjected) return false;
    if (_orig && window.saveCharToFileDialog === ourDialog) window.saveCharToFileDialog = _orig;
    window.__gcsExpInjected = false;
    return true;
  }

  (window.gcFixes = window.gcFixes || []).push({
    id: ID, default: DEF, recalc: RECALC, label: LABEL, hint: HINT, apply: apply, revert: revert,
    subs: [{
      id: RUS_ID, default: false, recalc: false, label: RUS_LABEL, hint: RUS_HINT,
      apply: function () { return true; }, revert: function () { return true; }
    }, {
      id: DR_ID, default: false, recalc: false, label: DR_LABEL, hint: DR_HINT, link: 'https://discord.gg/JsAxE79pU9',
      apply: function () { return true; }, revert: function () { return true; }
    }]
  });

  var tries = 0;
  function run() {
    if (typeof window.saveCharToFileDialog !== 'function') return false;
    if (!flag(ID, DEF)) { revert(); return true; }
    if (window.__gcsExpInjected) return true;
    return apply();
  }
  if (!run()) { var iv = setInterval(function () { if (run() || ++tries > 60) clearInterval(iv); }, 500); }

  function hintHtml(h, link) {
    var t = "class='note' title='" + h.replace(/'/g, '&#39;') + "'";
    return link
      ? " <a " + t + " href='" + link + "' target='_blank' rel='noopener'><i class='fa fa-question-circle'></i></a>"
      : " <span " + t + "><i class='fa fa-question-circle'></i></span>";
  }
  function subRow(id, label, hint, onChange, link) {
    var $r = $("<line id='gc-fixrow-" + id + "' style='margin-left:20px'><label><input type='checkbox' " + (flag(id, false) ? 'checked' : '') + " /> " + label + "</label>" + hintHtml(hint, link) + "</line>");
    $r.find('input').on('change', function () { setFlag(id, this.checked); if (onChange) onChange(); });
    return $r;
  }
  function injectSolo() {
    if (window.gcSnippetsHub) return;
    var $anchor = $('.gc-char-settings #attr-as-disadv').closest('line');
    if (!$anchor.length) return;
    if (!document.getElementById('gc-fixrow-' + ID)) {
      var $prev = $('.gc-char-settings [id^="gc-fixrow-"]').last();
      var $row = $("<line id='gc-fixrow-" + ID + "'><label><input type='checkbox' " + (flag(ID, DEF) ? 'checked' : '') + " /> " + LABEL + "</label>" + hintHtml(HINT) + "</line>");
      $row.find('input').on('change', function () { setFlag(ID, this.checked); this.checked ? apply() : revert(); });
      ($prev.length ? $prev : $anchor).after($row);
    }
    if (!document.getElementById('gc-fixrow-' + RUS_ID)) {
      $('#gc-fixrow-' + ID).after(subRow(RUS_ID, RUS_LABEL, RUS_HINT, null));
    }
    if (!document.getElementById('gc-fixrow-' + DR_ID)) {
      $('#gc-fixrow-' + RUS_ID).after(subRow(DR_ID, DR_LABEL, DR_HINT, null, 'https://discord.gg/JsAxE79pU9'));
    }
  }
  injectSolo();
  if (!window.__gcsExpObs) {
    window.__gcsExpObs = true;
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () { t = null; injectSolo(); }, 200);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
