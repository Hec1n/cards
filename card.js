(() => {
  const id = document.body.dataset.character;
  if (!['neko', 'human'].includes(id)) return;
  const model = globalThis.CardState;
  const key = 'imperial-player-card:v1:' + id;
  const get = name => document.getElementById(name);
  let state = model.initial(id);
  let storageAvailable = true;
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      try { state = model.normalize(JSON.parse(saved), id); }
      catch { get('save-status').textContent = 'Сохранённые данные повреждены. Проверь значения и внеси их заново.'; }
    }
  } catch { storageAvailable = false; }
  function storageMessage() {
    get('save-status').textContent = storageAvailable
      ? 'Сохранено в этом браузере. Другие устройства не синхронизируются.'
      : 'Браузер не разрешил сохранение. Изменения действуют до закрытия или обновления страницы.';
  }
  function render() {
    const limit=model.hpLimit(state);
    const stats=model.totalStats(state);
    get('hp-max').textContent=limit;
    get('hp-meter').max=limit;
    get('hp-formula').textContent='3 базовых + '+(2*stats[1])+' от выносливости + '+state.gear.armorHp+' от брони';
    get('armor-name').textContent=state.gear.armorName;
    get('armor-note').textContent='Бонус к максимуму ХП: +'+state.gear.armorHp+'. Снижение урона определяет мастер.';
    get('weapon-name').textContent=state.gear.weaponName;
    get('weapon-damage').textContent=state.gear.damage;
    get('weapon-range').textContent=state.gear.range;
    document.querySelectorAll('[data-stat]').forEach(el=>{el.textContent=stats[Number(el.dataset.stat)];});
    document.querySelectorAll('[data-movement]').forEach(el=>{el.textContent=Math.max(5,stats[2]*5);});
    get('initiative-value').textContent=stats[6];
    if(get('faith-value')) get('faith-value').textContent=stats[8];
    get('stats-note').textContent='Показаны характеристики с бонусами оружия. Удача: '+stats[7]+'.';
    get('hp-value').textContent = state.hp;
    get('hp-meter').value = state.hp;
    get('hp-meter').setAttribute('aria-label', 'ХП: ' + state.hp + ' из '+limit);
    get('hp-minus').disabled = state.hp === 0;
    get('hp-plus').disabled = state.hp === limit;
    get('hp-status').textContent = state.hp === 0 ? 'Без сознания. На спасение — 5 раундов.' : '';
    get('coins-value').textContent = state.coins.toLocaleString('ru-RU');
    const amount = Number(get('coin-amount').value);
    const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= model.maxCoins;
    get('coins-minus').disabled = !valid || state.coins < amount;
    get('coins-plus').disabled = !valid || state.coins + amount > model.maxCoins;
    const list = get('inventory-list');
    list.replaceChildren();
    get('inventory-empty').hidden = state.items.length > 0;
    state.items.forEach((item, index) => {
      const row = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = item.name + ' × ' + item.quantity;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-item';
      remove.textContent = 'Убрать';
      remove.setAttribute('aria-label', 'Убрать из инвентаря: ' + item.name);
      remove.addEventListener('click', () => {
        update(model.remove(state, index), 'Убрано: ' + item.name);
        const buttons = list.querySelectorAll('button');
        (buttons[Math.min(index, buttons.length - 1)] || get('item-name')).focus();
      });
      row.append(text, remove);
      list.append(row);
    });
  }
  function update(next, message = '') {
    state = next;
    try { localStorage.setItem(key, JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; }
    render();
    storageMessage();
    get('action-status').textContent = message;
  }
  get('hp-minus').addEventListener('click', () => update(model.hp(state, -1)));
  get('edit-armor').addEventListener('click',()=>{
    const form=get('armor-form');form.hidden=!form.hidden;
    get('edit-armor').setAttribute('aria-expanded',String(!form.hidden));
    if(!form.hidden){get('armor-input').value=state.gear.armorName;get('armor-hp').value=state.gear.armorHp;get('armor-input').focus();}
  });
  get('armor-form').addEventListener('submit',e=>{
    e.preventDefault();if(!get('armor-input').value.trim())return;
    update(model.equip(state,{armorName:get('armor-input').value,armorHp:Number(get('armor-hp').value)}),'Броня обновлена. ХП пересчитаны на разницу бонусов.');
    get('armor-form').hidden=true;get('edit-armor').setAttribute('aria-expanded','false');get('edit-armor').focus();
  });
  get('edit-weapon').addEventListener('click',()=>{
    const form=get('weapon-form');form.hidden=!form.hidden;
    get('edit-weapon').setAttribute('aria-expanded',String(!form.hidden));
    if(!form.hidden){get('weapon-input').value=state.gear.weaponName;get('damage-input').value=state.gear.damage;get('range-input').value=state.gear.range;state.gear.bonuses.forEach((v,i)=>{get('bonus-'+i).value=v;});get('weapon-input').focus();}
  });
  get('weapon-form').addEventListener('submit',e=>{
    e.preventDefault();if(!get('weapon-input').value.trim()||!get('damage-input').value.trim()||!get('range-input').value.trim())return;
    update(model.equip(state,{weaponName:get('weapon-input').value,damage:get('damage-input').value,range:get('range-input').value,bonuses:Array.from({length:10},(_,i)=>Number(get('bonus-'+i).value))}),'Оружие и бонусы обновлены.');
    get('weapon-form').hidden=true;get('edit-weapon').setAttribute('aria-expanded','false');get('edit-weapon').focus();
  });
  get('hp-plus').addEventListener('click', () => update(model.hp(state, 1)));
  get('coin-amount').addEventListener('input', render);
  get('coins-minus').addEventListener('click', () => update(model.coins(state, -Number(get('coin-amount').value))));
  get('coins-plus').addEventListener('click', () => update(model.coins(state, Number(get('coin-amount').value))));
  get('item-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = get('item-name').value.trim();
    const quantity = Number(get('item-quantity').value);
    const next = model.add(state, name, quantity);
    if (next === state) { get('action-status').textContent = 'Проверь название и количество: от 1 до 9 999.'; return; }
    update(next, 'Добавлено: ' + name + ' × ' + quantity);
    get('item-form').reset();
    get('item-name').focus();
  });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    try { state = model.normalize(event.newValue ? JSON.parse(event.newValue) : null, id); render(); }
    catch { /* Сохраняем текущие значения при повреждённых данных другой вкладки. */ }
  });
  render();
  if (!storageAvailable) storageMessage();
})();
