// Dream Valley — farm actions: plot, trees, ground forage, house/pump/jar/shrine/mailbox, day cycle
(() => {
'use strict';
const DV = window.DV, T = DV.T, WORLD = window.DV_WORLD;
const S = () => DV.S;
DV.CROPS = {
  chili: { name: 'พริก', row: 0, regrow: 2 }, basil: { name: 'กะเพรา', row: 1, regrow: 2 },
  corn: { name: 'ข้าวโพดหวาน', row: 2, regrow: -1 }, morning_glory: { name: 'ผักบุ้ง', row: 3, regrow: 2 },
};
const CROP_KEYS = Object.keys(DV.CROPS);
const COST = { clear: 2, pick: 1, hoe: 2, plant: 1, water: 1, harvest: 1, refill: 1, fruit: 3, pods: 2, chop: 6, stump: 8, gather: 1, weeds: 3 };
const TOOL = { hoe: 0, can: 1, sickle: 2, hand: 3, bucket: 4, axe: 5, saw: 6, rake: 7 };
DV.TOOL = TOOL;
const ic = n => ['icons', DV.icon(n)];

// ---------- object kinds ----------
const DECO = { pebble: 1, branch: 1, stump: 1, boulder: 1, weeds: 1 };
DV.tapOf = o => o.tap || null;
const treeInfo = o => {
  const img = o.label || '';
  const tam = img.startsWith('tree_tamarind');
  const fruit = img.includes('fruit_full') ? 5 : img.includes('fruit_mid') ? 3 : img.includes('fruit_few') ? 2 : img.includes('pods') ? 4 : 0;
  return { kind: tam ? 'tamarind' : 'mango', name: tam ? 'ต้นมะขาม' : 'ต้นมะม่วง', fruit, bare: tam ? 'tree_tamarind' : 'tree_mango' };
};
const treeState = o => S().trees[o.id] || (S().trees[o.id] = { fruitDay: -99, cutDay: 0 });
const hasFruit = o => { const ti = treeInfo(o); return ti.fruit > 0 && S().day - treeState(o).fruitDay >= 3; };
DV.objSprite = o => (o.tap === 'coop' && DV.S.coopFixed) ? WORLD.atlas.alt.coop_fixed : (o.tap === 'tree' && DV.S.map === 'farm' && treeInfo(o).fruit && !hasFruit(o)) ? WORLD.atlas.alt[treeInfo(o).bare] : o.s;

DV.costLabel = (e, n = 1) => e ? `แรง −${e * n}` : 'ไม่ใช้แรง';
const cellOf = o => o.block.length ? o.block[0] : [Math.floor(o.x / T), Math.floor((o.y - 2) / T)];

function openTree(o) {
  const ti = treeInfo(o), st = treeState(o), opts = [], tc = [cellOf(o)], lvl = DV.forageLevel();
  if (ti.fruit && DV.S.map === 'farm') {
    if (hasFruit(o)) {
      const isM = ti.kind === 'mango', n = ti.fruit + (lvl >= 3 ? 1 : 0), key = isM ? 'mango' : 'tamarind';
      opts.push({ label: isM ? `สอยมะม่วง (~${n} ลูก)` : `เก็บฝักมะขาม (~${n} กำ)`, icon: ic(DV.item(key).icon), cost: isM ? COST.fruit : COST.pods,
        run: () => DV.doAction({ energy: isM ? COST.fruit : COST.pods, tool: TOOL.rake, fx: 'leaf', targets: tc,
          apply: () => { st.fruitDay = S().day; DV.addItem(key, n); DV.stat('fruit', n); DV.gainForage(1); },
          after: () => { DV.floatText(o.x, o.y - 70, `+${n} ${DV.item(key).name}`, '#fff4b0'); DV.toast(`ได้${DV.item(key).name} ${n} — กินเพิ่มแรงหรือขายก็ได้`); } }) });
    } else opts.push({ info: true, label: `ผลยังไม่ออก อีก ${3 - (S().day - st.fruitDay)} วัน` });
  }
  if (DV.S.map === 'farm') opts.push({ label: 'ตัดกิ่งแห้งทำฟืน', icon: ['tools', TOOL.axe], cost: COST.chop, disabled: st.cutDay === S().day && 'วันนี้ตัดแล้ว',
    run: () => DV.doAction({ energy: COST.chop, tool: TOOL.axe, fx: 'wood', targets: tc, apply: () => {
      st.cutDay = S().day; const w = 2 + (lvl >= 2 ? 1 : 0); DV.addItem('wood', w); DV.stat('wood', w); DV.gainForage(1);
      const extra = [];
      if (ti.kind === 'mango' && Math.random() < 0.22) { DV.addItem('ant_egg'); extra.push('ไข่มดแดง 1 ห่อ (รังบนกิ่ง!)'); }
      if (Math.random() < 0.06) { DV.addItem('honey'); extra.push('น้ำผึ้งป่า 1 ขวด'); }
      DV.floatText(o.x, o.y - 70, `+${w} ไม้ฟืน`, '#fff4b0');
      setTimeout(() => DV.toast(`ได้ไม้ฟืน ${w} มัด` + (extra.length ? ' · โชคดี! ' + extra.join(', ') : '')), 50);
    } }) });
  opts.push({ label: 'นั่งพักใต้ร่มไม้', icon: ic('food_water'), extra: 'แรงฟื้นช้า ๆ ตามเวลา', run: () => { DV.closeSheet(); DV.sitDown('ใต้ร่ม' + ti.name.replace('ต้น', '')); } });
  DV.openSheet(ti.name, ti.kind === 'mango' ? 'ต้นที่ยายปลูกไว้ตั้งแต่แม่ยังเด็ก' : 'ต้นมะขามแก่ ร่มใหญ่ ลมเย็น', null, opts, { spr: DV.objSprite(o) });
}
function openDeco(o, kind) {
  const done = (until, text) => () => { S().gone[o.id] = until; DV.rebuildBlocked(); DV.toast(text); DV.maybeRandomCard(0.06); };
  const spr = { spr: o.s };
  if (kind === 'pebble') return DV.openSheet('ก้อนหินเล็ก', 'เก็บไว้ทำทางเดินได้', null, [
    { label: 'เก็บหิน', icon: ic('misc_stone'), cost: COST.gather, run: () => DV.doAction({ energy: COST.gather, tool: TOOL.hand, fx: 'dirt',
      targets: [cellOf(o)], apply: () => { DV.addItem('stone'); DV.gainForage(1); }, after: done(S().day + 1, 'ได้ก้อนหิน 1') }) }], spr);
  if (kind === 'branch') return DV.openSheet('กิ่งไม้หล่น', 'กิ่งแห้งจากลมเมื่อคืน', null, [
    { label: 'เก็บกิ่งไม้', icon: ic('misc_wood'), cost: COST.gather, run: () => DV.doAction({ energy: COST.gather, tool: TOOL.hand, fx: 'grass',
      targets: [cellOf(o)], apply: () => { DV.addItem('wood'); DV.stat('wood'); DV.gainForage(1); }, after: done(S().day + 1, 'ได้ไม้ฟืน 1 มัด') }) }], spr);
  if (kind === 'stump') return DV.openSheet('ตอไม้เก่า', 'ผุแล้ว ผ่าทำฟืนได้ อาจมีเห็ดขึ้นข้าง ๆ', null, [
    { label: 'ผ่าตอไม้', icon: ['tools', TOOL.axe], cost: COST.stump, run: () => { let mush = false; DV.doAction({ energy: COST.stump, tool: TOOL.axe, fx: 'wood',
      targets: [cellOf(o)], apply: () => { DV.addItem('wood', 3); DV.stat('wood', 3); DV.gainForage(2); if (Math.random() < 0.4) { DV.addItem('mushroom', 2); mush = true; } },
      after: () => done(99999, mush ? 'ได้ไม้ฟืน 3 มัด + เห็ดโคนไม้ 2 ดอก!' : 'ได้ไม้ฟืน 3 มัด')() }); } }], spr);
  if (kind === 'weeds') return DV.openSheet('กอหญ้ารก', 'หญ้าขึ้นรกตั้งแต่ยายไม่สบาย ถางออกแล้วที่ตรงนี้จะโล่ง', null, [
    { label: 'ถางหญ้า', icon: ['tools', TOOL.sickle], cost: COST.weeds, run: () => DV.doAction({ energy: COST.weeds, tool: TOOL.sickle, fx: 'grass',
      targets: [cellOf(o)], apply: () => { DV.stat('cleared'); if (Math.random() < .25) DV.addItem('worm'); }, after: done(99999, 'ถางแล้ว ที่ตรงนี้โล่งขึ้น') }) },
    ...(() => { const n = DV.M.objects.filter(q => q.tap === 'weeds' && !(S().gone[q.id] > S().day)).length; return n > 1 ? [{ label: `ถางกอหญ้าทั้งหมด (${n} กอ)`, icon: ['tools', TOOL.sickle], cost: COST.weeds, n,
      run: () => { const L = DV.M.objects.filter(q => q.tap === 'weeds' && !(S().gone[q.id] > S().day));
        DV.doAction({ energy: COST.weeds * L.length, tool: TOOL.sickle, fx: 'grass', targets: L.map(cellOf), apply: () => DV.stat('cleared'),
          after: () => { L.forEach(q => { S().gone[q.id] = 99999; }); DV.rebuildBlocked(); DV.toast(`ถางหญ้ารก ${L.length} กอ ฟาร์มโล่งขึ้นเยอะ`); } }); } }] : []; })()], spr);
  if (kind === 'boulder') return DV.openSheet('หินก้อนใหญ่', 'ต้องใช้ค้อนปอนด์ (ยังไม่มีขาย)', null, [{ info: true, label: 'มือเปล่ายกไม่ไหว' }], spr);
}
DV.openObject = o => {
  const t = o.tap, s = S();
  if (t === 'tree') return openTree(o);
  if (DECO[t]) return openDeco(o, t);
  if (t === 'house') return DV.openSheet('บ้านยาย', 'บ้านไม้ใต้ถุนสูง กลับมาเงียบกว่าที่จำได้', null, [
    { label: 'เข้าบ้าน', icon: ['ui', 'door'], extra: 'ปลอดภัยจากผี · นอน ไหว้ยาย ทำกับข้าว', run: () => { DV.closeSheet(); DV.travel('house', 'in'); } },
    { label: 'นอน (จบวัน)', icon: ic('item_alarm_clock'), extra: 'ตื่นมาแรงเต็ม', run: () => { DV.closeSheet(); DV.sleep(); } },
    { label: 'งีบหลับ 1 ชั่วโมง', icon: ic('item_alarm_clock'), extra: 'ข้ามเวลา 1 ชม. · แรง +20', disabled: s.napCount >= 2 && 'วันนี้งีบพอแล้ว',
      run: () => { DV.closeSheet(); DV.fade(() => { s.napCount++; DV.addEnergy(20); DV.addMins(60); DV.hud(); DV.save(); DV.toast('งีบไปชั่วโมงหนึ่ง สดชื่นขึ้น'); }); } },
    { label: 'นั่งพักบนชานบ้าน', icon: ic('food_water'), extra: 'แรงฟื้นช้า ๆ ตามเวลา', run: () => { DV.closeSheet(); DV.sitDown('บนชานบ้าน'); } },
    { label: 'ไหว้รูปยายบนหิ้งพระ', icon: ic('item_amulet_charoensap'), disabled: s.flags['bowGrandma' + s.day] && 'วันนี้ไหว้แล้ว',
      run: () => { s.flags['bowGrandma' + s.day] = 1; DV.closeSheet(); DV.toast(DV.pick(['รูปยายยิ้มเหมือนเดิม… คิดถึงนะยาย', 'กลิ่นธูปลอยไปทั่วบ้าน รู้สึกเหมือนยายนั่งอยู่ตรงนี้', 'ขอให้ยายสบายนะ วันนี้หลานจะทำให้ดีที่สุด'])); DV.addEnergy(3); } },
  ], { spr: o.s });
  // ---- inside grandma's house ----
  if (t === 'bed') return DV.openSheet('ที่นอนของยาย', 'เสื่อกก หมอนใบเดิม มุ้งพับไว้เรียบร้อย', null, [
    { label: 'นอน (จบวัน)', icon: ['ui', 'bed'], extra: 'ตื่นมาแรงเต็ม', run: () => { DV.closeSheet(); DV.sleep(); } },
    { label: 'งีบหลับ 1 ชั่วโมง', icon: ['ui', 'clock'], extra: 'ข้ามเวลา 1 ชม. · แรง +25', disabled: s.napCount >= 2 && 'วันนี้งีบพอแล้ว',
      run: () => { DV.closeSheet(); DV.fade(() => { s.napCount++; DV.addEnergy(25); DV.addMins(60); DV.hud(); DV.save(); DV.toast('งีบในมุ้งยาย หลับสนิทกว่าที่คิด'); }); } }]);
  if (t === 'altar') return DV.openSheet('หิ้งพระกับรูปยาย', 'ยายในรูปยิ้มเหมือนรู้ว่าวันนี้หลานจะทำอะไร', null, [
    { label: 'จุดธูปไหว้ยาย', icon: ['ui', 'pray'], extra: 'แรง +5 · ใจสงบ', disabled: s.flags['bowGrandma' + s.day] && 'วันนี้ไหว้แล้ว',
      run: () => { s.flags['bowGrandma' + s.day] = 1; s.prayedDay = s.day; DV.closeSheet(); DV.addEnergy(5); DV.sfx('spark');
        DV.toast(DV.pick(['รูปยายยิ้มเหมือนเดิม… คิดถึงนะยาย', 'กลิ่นธูปลอยไปทั่วบ้าน รู้สึกเหมือนยายนั่งอยู่ตรงนี้', 'ขอให้ยายสบายนะ วันนี้หลานจะทำให้ดีที่สุด', 'ควันธูปลอยตรงไปที่รูป ยายคงได้ยินแล้ว'])); DV.save(); } }]);
  if (t === 'stove') { const egg = DV.has('egg_chicken') || DV.has('egg_duck'), rice = DV.has('rice_white') || DV.has('rice');
    return DV.openSheet('เตาถ่านของยาย', 'ถ่านเหลือนิดหน่อย หม้อดำเพราะใช้มาสามสิบปี', null, [
      { label: 'ทำอาหาร (มินิเกม)', icon: ['ui', 'cook'], hl: true, extra: 'ผัก ไข่ ปลา → อาหารให้แรง/ขายได้', run: () => DV.openCook() },
      { label: egg ? 'ทอดไข่เจียวกินกับข้าว' : 'ทอดไข่เจียว (ต้องมีไข่)', icon: ['ui', 'cook'], extra: 'แรง +35', disabled: !egg && 'ไม่มีไข่ในกระเป๋า',
        run: () => DV.doAction({ energy: 0, fx: 'spark', apply: () => { DV.addItem(DV.has('egg_chicken') ? 'egg_chicken' : 'egg_duck', -1); }, after: () => { DV.addEnergy(35); DV.toast('ไข่เจียวฟูกรอบขอบ ใส่น้ำปลาแบบยาย อร่อยจนน้ำตาซึม'); DV.hud(); } }) },
      { label: 'ต้มน้ำชงชาร้อน', icon: ['ui', 'cook'], extra: 'แรง +8 · วันละครั้ง', disabled: s.flags['tea' + s.day] && 'วันนี้ชงแล้ว',
        run: () => DV.doAction({ energy: 0, fx: 'water', apply: () => { s.flags['tea' + s.day] = 1; }, after: () => { DV.addEnergy(8); DV.toast('ชาร้อนในแก้วสังกะสีลายดอกของยาย'); DV.hud(); } }) }]); }
  if (t === 'jar_in') return DV.openSheet('โอ่งน้ำในครัว', 'น้ำฝนที่ยายรองไว้ ยังใสอยู่', null, [
    { label: 'ตักน้ำดื่ม', icon: ['ui', 'water'], extra: 'แรง +6', disabled: s.drinkCount >= 3 && 'อิ่มน้ำแล้ว',
      run: () => { s.drinkCount++; DV.addEnergy(6); DV.sfx('water'); DV.toast('น้ำเย็นชื่นใจ'); DV.hud(); DV.save(); } }]);
  if (t === 'table' && DV.isVisiting && DV.isVisiting()) return DV.stealMenu(o);
  if (t === 'table') return DV.openSheet('โต๊ะเตี้ยของยาย', 'ปิ่นโตใบเดิมกับตะเกียงเจ้าพายุ', null, [
    { label: 'เปิดสมุดของยาย', icon: ['ui', 'diary'], extra: 'อ่านหน้าที่เจอแล้ว', run: () => { DV.closeSheet(); DV.openPhone('diary'); } },
    { label: 'นั่งพักที่โต๊ะ', icon: ['ui', 'home'], extra: 'แรงฟื้นช้า ๆ', run: () => { DV.closeSheet(); DV.sitDown('ที่โต๊ะยาย'); } },
    { label: 'ดูทักษะของฉัน', icon: ['ui', 'star'], run: () => DV.openSkills() },
    { label: 'ราคาพืชผลวันนี้', icon: ic('crop_chili'), extra: 'ขึ้นลงทุกวัน', run: () => DV.openPrices() }]);
  if (t === 'bundle') return DV.openSheet('ห่อผ้าเก่า', 'ผ้าขาวม้าคลุมของบางอย่างไว้', null, [
    { label: 'เปิดดู', icon: ['ui', 'use'], disabled: s.flags.bundleOpened && 'เปิดแล้ว',
      run: () => { s.flags.bundleOpened = 1; DV.closeSheet(); DV.addItem('marble'); DV.addItem('lottery_ticket'); DV.toast('ข้างในมีลูกแก้วของเล่นตอนเด็ก กับสลากเก่าหนึ่งใบ… ยายเก็บไว้ทำไมนะ'); DV.save(); } }]);
  if (t === 'coop') {
    if (s.coopFixed) return DV.openCoop(o);
    const wood = (s.items && s.items.wood) || 0, cost = 300, need = 5;
    return DV.openSheet('เล้าไก่พัง', 'หลังคาสังกะสีรั่ว ไม้ผุ ตาข่ายขาด · ต้องซ่อมก่อนถึงจะเลี้ยงไก่ได้', null, [
      { label: 'ซ่อมเล้าไก่', icon: ['tools', TOOL.saw], cost: 30, extra: `ไม้ฟืน ${need} มัด + ฿${cost} ค่าสังกะสี/ตาข่าย`,
        disabled: (wood < need && `ไม้ไม่พอ (มี ${wood}/${need} · เก็บกิ่งไม้ ผ่าตอไม้)`) || (s.money < cost && `เงินไม่พอ (ต้องมี ฿${cost})`),
        run: () => DV.doAction({ energy: 30, tool: TOOL.saw, fx: 'wood', targets: [cellOf(o)], apply: () => { s.items.wood -= need; s.money -= cost; s.coopFixed = s.day; },
          after: () => { DV.toast('ซ่อมเล้าไก่เสร็จแล้ว! หลังคาใหม่ ตาข่ายใหม่'); DV.sfx('spark'); DV.hud(); } }) }], { spr: o.s });
  }
  if (t === 'bench') return DV.openSheet('ม้านั่งไม้', 'ที่ยายชอบนั่งดูแปลงผักตอนเย็น', null, [
    { label: 'นั่งพัก', icon: ic('food_water'), extra: 'แรงฟื้นเร็วกว่ายืน', run: () => { DV.closeSheet(); DV.sitDown('บนม้านั่ง', [o.x, o.y + 1], 11); } }], { spr: o.s });
  if (t === 'pump') return DV.openSheet('ปั๊มน้ำโยก', `บัวรดน้ำ ${s.water}/${DV.CAN_MAX}`, null, [
    { label: 'เติมน้ำบัวรดน้ำ', icon: ['tools', TOOL.can], cost: COST.refill, disabled: s.water >= DV.CAN_MAX && 'เต็มแล้ว',
      run: () => DV.doAction({ energy: COST.refill, tool: TOOL.bucket, fx: 'water', targets: [cellOf(o)], apply: () => { s.water = DV.CAN_MAX; }, after: () => DV.toast('เติมน้ำเต็มแล้ว (12 ครั้ง)') }) }], { spr: o.s });
  if (t === 'jar') return DV.openSheet('โอ่งน้ำฝน', 'น้ำฝนเย็นชื่นใจ', null, [
    { label: 'ตักน้ำดื่ม', icon: ic('food_water'), extra: 'แรง +6', disabled: s.drinkCount >= 3 && 'อิ่มน้ำแล้ว',
      run: () => DV.doAction({ energy: -6, fx: 'water', targets: [cellOf(o)], apply: () => { s.drinkCount++; }, after: () => {} }) }], { spr: o.s });
  if (t === 'spirit') return DV.openSheet('ศาลพระภูมิ', s.prayedDay === s.day ? 'วันนี้ไหว้แล้ว' : 'ยายไหว้ทุกเช้า', null, [
    { label: 'จุดธูปไหว้', icon: ic('item_amulet_charoensap'), extra: 'คืนนี้ใจกล้าขึ้น', disabled: s.prayedDay === s.day && 'ไหว้แล้ว',
      run: () => DV.doAction({ energy: 0, fx: 'spark', targets: [cellOf(o)], apply: () => { s.prayedDay = s.day; }, after: () => DV.toast('ควันธูปลอยขึ้นช้า ๆ รู้สึกอุ่นใจ') }) }], { spr: o.s });
  if (t === 'mailbox') return DV.openSheet('ตู้จดหมาย', s.mailDay === s.day ? 'วันนี้เปิดดูแล้ว' : 'มีอะไรมาไหมนะ', null, [
    { label: 'เปิดดู', icon: ic('item_money_envelope'), disabled: s.mailDay === s.day && 'เปิดแล้ว',
      run: () => DV.doAction({ energy: 0, fx: 'tick', apply: () => { s.mailDay = s.day; }, after: () => {
        if (s.day === 1) return DV.toast('ตู้ว่าง มีแต่ใบไม้แห้ง');
        const pool = window.DV_CARDS.filter(c => c.place === 'mailbox'); DV.showCard(pool[(s.day * 7) % pool.length]); } }) }], { spr: o.s });
};

// ---------- plot ----------
const warn = (e, n = 1) => e && S().energy - e * n <= 0;
DV.warnCost = warn;
DV.openPlot = (x, y) => {
  const s = S(), c = DV.cell(x, y), opts = [];
  const nW = Math.min(s.water, DV.plotCells(q => q.crop && !q.wet && q.crop.st < 4).length);
  let title = 'แปลงผักยาย', sub = '', icon = null;
  const clear = (a, b) => { DV.cell(a, b).debris = null; DV.stat('cleared'); };
  const hoe = (a, b) => { DV.cell(a, b).soil = true; };
  if (c.debris) {
    const stone = c.debris === 'debris_00' || c.debris === 'debris_04';
    title = stone ? (c.debris === 'debris_00' ? 'ก้อนหิน' : 'กิ่งไม้') : 'หญ้ารก'; sub = 'ต้องเก็บกวาดก่อนพรวนดิน';
    const cc = stone ? COST.pick : COST.clear;
    opts.push({ label: stone ? 'เก็บออก' : 'ถอนหญ้า', icon: ['tools', stone ? TOOL.hand : TOOL.sickle], cost: cc,
      run: () => DV.doAction({ energy: cc, tool: stone ? TOOL.hand : TOOL.sickle, fx: 'grass', targets: [[x, y]], apply: clear }) });
    const all = DV.plotCells(q => q.debris);
    if (all.length > 1) opts.push({ label: `เก็บกวาดทั้งแปลง (${all.length} ช่อง)`, icon: ['tools', TOOL.sickle], cost: COST.clear, n: all.length,
      run: () => DV.doAction({ energy: COST.clear * all.length, tool: TOOL.sickle, fx: 'grass', targets: all, apply: clear }) });
  } else if (!c.soil) {
    title = 'ดินหญ้า'; sub = 'พรวนแล้วถึงจะปลูกได้';
    opts.push({ label: 'พรวนดิน', icon: ['tools', TOOL.hoe], cost: COST.hoe, run: () => DV.doAction({ energy: COST.hoe, tool: TOOL.hoe, fx: 'hoe', targets: [[x, y]], apply: hoe }) });
    const all = DV.plotCells(q => !q.debris && !q.soil);
    if (all.length > 1) opts.push({ label: `พรวนทั้งแปลง (${all.length} ช่อง)`, icon: ['tools', TOOL.hoe], cost: COST.hoe, n: all.length,
      run: () => DV.doAction({ energy: COST.hoe * all.length, tool: TOOL.hoe, fx: 'hoe', targets: all, apply: hoe }) });
  } else if (!c.crop) {
    title = 'ดินพรวนแล้ว'; sub = c.wet ? 'ดินชุ่มน้ำ' : 'ดินแห้ง · เลือกเมล็ดที่จะปลูก';
    const empty = DV.plotCells(q => q.soil && !q.crop);
    CROP_KEYS.forEach(k => {
      const has = s.seeds[k] || 0;
      const plant = (a, b) => { if ((s.seeds[k] || 0) <= 0) return; DV.cell(a, b).crop = { k, st: 0 }; s.seeds[k]--; DV.stat('planted'); DV.xp && DV.xp('farm', .2); };
      opts.push({ label: `ปลูก${DV.CROPS[k].name}`, icon: ic(DV.SEEDS[k].icon), cost: COST.plant, extra: `เหลือ ${has}`, disabled: !has && 'ไม่มีเมล็ด (ซื้อที่ร้านป้าแต๋ว)',
        run: () => DV.doAction({ energy: COST.plant, tool: TOOL.hand, fx: 'seed', targets: [[x, y]], apply: plant }) });
      const n = Math.min(has, empty.length);
      if (n > 1) opts.push({ label: `ปลูก${DV.CROPS[k].name}ทุกช่องว่าง (${n} ช่อง)`, icon: ic(DV.SEEDS[k].icon), cost: COST.plant, n,
        run: () => DV.doAction({ energy: COST.plant * n, tool: TOOL.hand, fx: 'seed', targets: empty.slice(0, n), apply: plant }) });
    });
  } else {
    const cr = DV.CROPS[c.crop.k]; icon = ic(DV.item(c.crop.k).icon);
    title = cr.name; sub = c.crop.st >= 4 ? 'โตเต็มที่ เก็บได้แล้ว!' : `ระยะ ${c.crop.st + 1}/5 · ${c.wet ? 'รดน้ำแล้ว รอพรุ่งนี้โต' : 'ดินแห้ง ต้องรดน้ำ'}`;
    if (c.crop.st >= 4) {
      opts.push({ label: 'เก็บเกี่ยว', icon: ['tools', TOOL.sickle], cost: COST.harvest, run: () => harvest([[x, y]]) });
      const all = DV.plotCells(q => q.crop && q.crop.st >= 4);
      if (all.length > 1) opts.push({ label: `เก็บทั้งแปลง (${all.length} ต้น)`, icon: ['tools', TOOL.sickle], cost: COST.harvest, n: all.length, run: () => harvest(all) });
    } else if (!c.wet) opts.push({ label: 'รดน้ำ', icon: ['tools', TOOL.can], cost: COST.water, extra: `น้ำ ${s.water}/${DV.CAN_MAX}`, disabled: !s.water && 'บัวรดน้ำหมด ไปเติมที่ปั๊ม', run: () => water([[x, y]]) });
    if (nW > 1) { const all = DV.plotCells(q => q.crop && !q.wet && q.crop.st < 4).slice(0, s.water);
      opts.push({ label: `รดน้ำทั้งแปลง (${all.length} ต้น)`, icon: ['tools', TOOL.can], cost: COST.water, n: all.length, run: () => water(all) }); }
    if (c.crop.st < 4 && c.wet && nW <= 1) opts.push({ info: true, label: 'วันนี้ไม่ต้องทำอะไรแล้ว รอพรุ่งนี้' });
  }
  DV.openSheet(title, sub, icon || ['tools', TOOL.hoe], opts);
};
function water(list) {
  DV.doAction({ energy: COST.water * list.length, tool: TOOL.can, fx: 'water', targets: list,
    apply: (a, b) => { const c = DV.cell(a, b); if (S().water > 0 && !c.wet) { c.wet = true; S().water--; } } });
}
function harvest(list) {
  const got = {};
  DV.doAction({ energy: COST.harvest * list.length, tool: TOOL.sickle, fx: 'spark', targets: list,
    apply: (a, b) => { const c = DV.cell(a, b); if (!c.crop) return; const k = c.crop.k; const extra = Math.random() < (DV.skLv ? (DV.skLv('farm') - 1) * .04 : 0) ? 1 : 0; DV.addItem(k, 1 + extra); got[k] = (got[k] || 0) + 1 + extra; DV.stat('harvest'); DV.xp && DV.xp('farm', 1);
      DV.floatText(a * T + 16, b * T - 10, `+${1 + extra} ${DV.CROPS[k].name}`, '#fff4b0');
      if (DV.CROPS[k].regrow >= 0) c.crop.st = DV.CROPS[k].regrow; else c.crop = null; },
    after: () => { DV.toast('ได้ ' + Object.entries(got).map(([k, n]) => `${DV.CROPS[k].name} ${n}`).join(', ') + ' — ขายได้ที่ร้านป้าแต๋ว ตลาด หรือลานเสี่ยเฮง'); DV.maybeRandomCard(0.1); } });
}
DV.sellCrop = ({ crop, mult }) => { const n = DV.S.items[crop] || 0, g = Math.round(n * DV.item(crop).sell * mult); DV.S.money += g; delete DV.S.items[crop]; DV.sfx('coin'); return `ขายได้ ฿${g}`; };

// ---------- day cycle ----------
DV.sleep = () => { DV.standUp(); DV.fade(() => DV.newDay(false)); };
DV.faint = msg => {
  DV.setBusy(false); DV.player.path = []; DV.standUp();
  DV.showCard({ type: 'story', art: 'night', title: 'เป็นลม', text: msg + '\nตื่นมาอีกทีที่ รพ.สต. หมอแอนบ่นเบา ๆ ว่าให้ดูแลตัวเองบ้าง',
    choices: [{ label: 'กลับบ้าน', hint: `แรงพรุ่งนี้ 50% · ค่ารักษา ฿${Math.min(500, Math.floor(DV.S.money * 0.1))}`, effect: { faintDay: true } }] });
};
DV.newDay = fainted => {
  const s = S();
  if (s.cells) for (const k in s.cells) { const c = s.cells[k]; if (c.crop && c.wet) c.crop.st = Math.min(4, c.crop.st + 1); c.wet = false; }
  s.day++; s.min = 0; s.energy = fainted ? DV.MAX_E / 2 : DV.MAX_E; s.napCount = 0; s.drinkCount = 0; s.cardsToday = 0;
  if (fainted) { const fee = Math.min(500, Math.floor(s.money * 0.1)); s.money -= fee; s.flags.faintedYesterday = 1; s.flags.faintedDay = s.day; DV.setFlag('fainted_once'); }
  s.rain = Math.random() < 0.22;
  if (s.rain) DV.waterAll();
  DV.bindState(s);
  DV.enterMap('farm', 'home', true);
  DV.player.dir = 0;
  DV.dirtySoil(); DV.hud(); DV.save(true);
  DV.toast(s.rain ? `วันที่ ${s.day} — ฝนตกตอนเช้ามืด แปลงชุ่มน้ำแล้ว` : `วันที่ ${s.day} — อรุณสวัสดิ์`);
  DV.onMorning && DV.onMorning();
};
})();
