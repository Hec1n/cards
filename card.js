(() => {
  const id = document.body.dataset.character;
  if (!['neko', 'human'].includes(id)) return;
  const model = globalThis.CardState;
  const localKey = 'imperial-player-card:v1:' + id;
  const cloudEnabled = globalThis.CardCloud?.enabled;
  const key = cloudEnabled ? 'imperial-player-card:cloud-cache:' + id : localKey;
  let cloud = null, canEdit = !cloudEnabled, canManageSkills = false;
  let editingSkill = null;
  let editingSlot = null;
  const statLabels = ["Сила","Выносливость","Ловкость","Восприятие","Интеллект","Мудрость","Инициатива","Удача","Вера","Харизма"];
  let skills = CardSkills.initial(id);
  const get = name => document.getElementById(name);
  let state = model.initial(id);
  let storageAvailable = true;
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed=JSON.parse(saved);
        if(!parsed.revision) localStorage.setItem(key+':before-session-1',saved);
        state = model.migrate(parsed,id);
        localStorage.setItem(key,JSON.stringify(state));
      }
      catch { get('save-status').textContent = 'Сохранённые данные повреждены. Проверь значения и внеси их заново.'; }
    }
  } catch { storageAvailable = false; }
  function storageMessage() {
    if(cloudEnabled) return;
    get('save-status').textContent = storageAvailable
      ? 'Сохранено в этом браузере. Другие устройства не синхронизируются.'
      : 'Браузер не разрешил сохранение. Изменения действуют до закрытия или обновления страницы.';
  }
  function applyAccess() {
    document.querySelectorAll('main button,main input,main textarea').forEach(el=>{
      if(el.closest('#cloud-panel')) return;
      if(!canEdit) el.disabled=true;
    });
  }
  function access(allowed, manageSkills = false) {
    canEdit=allowed; canManageSkills=manageSkills;
    get('add-skill').hidden=!canManageSkills;
    if(!canManageSkills) get('skill-form').hidden=true;
    document.querySelectorAll('main button,main input,main textarea').forEach(el=>{
      if(!el.closest('#cloud-panel')) el.disabled=false;
    });
    render();
  }
  function render() {
    get('notes-text').textContent=state.notes||'Нет записей.';
    get('eira-value').textContent=state.eira;get('eira-meter').value=state.eira;get('eira-meter').setAttribute('aria-label','Эйра: '+state.eira+' из 100');
    const energyAmount=Number(get('eira-amount').value),energyValid=Number.isInteger(energyAmount)&&energyAmount>0&&energyAmount<=100;
    get('eira-minus').disabled=!energyValid||state.eira<energyAmount;get('eira-plus').disabled=!energyValid||state.eira+energyAmount>100;
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
    get('stats-note').textContent='Показаны характеристики с бонусами оружия и надетых украшений. Удача: '+stats[7]+'.';
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
    get('carry-limit').textContent=model.carryLimit(state);
    const slots=get('slot-list'),earrings=get('earring-slot-list'),utility=get('utility-slot-list');slots.replaceChildren();earrings.replaceChildren();utility.replaceChildren();
    get('earrings-count').textContent='· надето '+state.gear.slots.slice(12,16).filter(slot=>slot.name&&slot.equipped).length;
    state.gear.slots.forEach((slot,i)=>{
      const row=document.createElement('article'), title=document.createElement('h3'), note=document.createElement('p'),button=document.createElement('button');
      title.textContent=model.slotNames[i]+': '+(slot.name||'Пусто');
      const bonuses=slot.bonuses.map((v,j)=>v?statLabels[j]+' '+(v>0?'+':'')+v:'').filter(Boolean).join(', ');
      note.textContent=(slot.name?(slot.equipped?'Надето':'Снято'):'Не занято')+(bonuses?' · '+bonuses:'')+(i===16&&slot.name?' · Петельки: оружие'+(slot.potions?', зелья':''):'');
      button.type='button';button.textContent='Изменить';button.setAttribute('aria-label','Изменить: '+model.slotNames[i]);button.addEventListener('click',()=>openSlot(i));
      row.append(title,note,button);(i>=16?utility:i>=12?earrings:slots).append(row);
    });
    const skillList=get('skills-list'); skillList.replaceChildren();
    skills.forEach((skill,index)=>{
      const article=document.createElement('article'),row=document.createElement('p'),name=document.createElement('span'),level=document.createElement('strong');
      name.textContent=skill.name;level.textContent=skill.level+' уровень';row.append(name,level);article.append(row);
      if(canManageSkills){const edit=document.createElement('button');edit.type='button';edit.textContent='Изменить';edit.setAttribute('aria-label','Изменить навык '+skill.name);edit.addEventListener('click',()=>{if(!canEdit)return;editingSkill=index;get('skill-name').value=skill.name;get('skill-level').value=skill.level;get('skill-form').hidden=false;get('skill-name').focus();});article.append(edit);}
      skillList.append(article);
    });
    applyAccess();
  }
  async function update(next, message = '') {
    if(cloudEnabled) {
      if(!cloud || !canEdit) {get('action-status').textContent='Войди и дождись загрузки общей карточки.';return;}
      try { await cloud.save(next); get('action-status').textContent=message; return true; }
      catch(error) {get('action-status').textContent=error.message;return false;}
      return;
    }
    state = next;
    try { localStorage.setItem(key, JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; }
    render();
    storageMessage();
    get('action-status').textContent = message;
    return true;
  }
  function openSlot(i){
    if(!canEdit)return;editingSlot=i;const slot=state.gear.slots[i];get('slot-form').hidden=false;get('slot-title').textContent=model.slotNames[i];get('slot-name').value=slot.name;get('slot-equipped').checked=slot.equipped;get('slot-potions').checked=slot.potions;get('slot-potions-label').hidden=i!==16;get('slot-bonuses').hidden=i>=16;slot.bonuses.forEach((v,j)=>get('slot-bonus-'+j).value=v);get('slot-name').focus();
  }
  get('slot-cancel').addEventListener('click',()=>{get('slot-form').hidden=true;editingSlot=null;});
  get('slot-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!canEdit||editingSlot===null)return;
    const slots=state.gear.slots.map(slot=>({...slot,bonuses:[...slot.bonuses]}));
    slots[editingSlot]={name:get('slot-name').value,equipped:get('slot-equipped').checked,potions:get('slot-potions').checked,bonuses:Array.from({length:10},(_,j)=>Number(get('slot-bonus-'+j).value))};
    const ok=await update(model.equip(state,{slots}),'Снаряжение сохранено. Характеристики, ХП и переносимый вес пересчитаны.');
    if(ok){get('slot-form').hidden=true;editingSlot=null;}
  });
  get('edit-notes').addEventListener('click',()=>{if(!canEdit)return;get('notes-input').value=state.notes;get('notes-form').hidden=false;get('notes-input').focus();});
  get('cancel-notes').addEventListener('click',()=>{get('notes-form').hidden=true;});
  get('notes-form').addEventListener('submit',async event=>{event.preventDefault();if(!canEdit)return;const ok=await update({...state,notes:get('notes-input').value.slice(0,8000)},'Памятка сохранена.');if(ok)get('notes-form').hidden=true;});
  get('eira-amount').addEventListener('input',render);
  get('eira-minus').addEventListener('click',()=>{const n=Number(get('eira-amount').value);if(Number.isInteger(n)&&n>0&&n<=state.eira)update(model.eira(state,-n),'Запас Эйры сохранён.');});
  get('eira-plus').addEventListener('click',()=>{const n=Number(get('eira-amount').value);if(Number.isInteger(n)&&n>0&&state.eira+n<=100)update(model.eira(state,n),'Запас Эйры сохранён.');});
  get('add-skill').addEventListener('click',()=>{
    if(!canManageSkills||!canEdit)return;
    editingSkill=null;get('skill-form').reset();get('skill-form').hidden=false;get('add-skill').setAttribute('aria-expanded','true');get('skill-name').focus();
  });
  get('cancel-skill').addEventListener('click',()=>{get('skill-form').hidden=true;get('add-skill').setAttribute('aria-expanded','false');get('add-skill').focus();});
  get('skill-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!cloud||!canManageSkills||!canEdit)return;
    try{
      const next=editingSkill===null?CardSkills.add(skills,get('skill-name').value,Number(get('skill-level').value),''):CardSkills.update(skills,editingSkill,get('skill-name').value,Number(get('skill-level').value));
      await cloud.saveSkills(next);
      get('skill-form').reset();get('skill-form').hidden=true;get('add-skill').setAttribute('aria-expanded','false');
      editingSkill=null;get('skill-status').textContent='Навык сохранён.';get('add-skill').focus();
    }catch(error){get('skill-status').textContent=error.message;}
  });
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
    if (cloudEnabled || event.key !== key) return;
    try { state = model.migrate(event.newValue ? JSON.parse(event.newValue) : null, id); render(); }
    catch { /* Сохраняем текущие значения при повреждённых данных другой вкладки. */ }
  });
  render();
  if (!storageAvailable) storageMessage();
  if(cloudEnabled) {
    get('save-status').textContent='Загружаем общую карточку…';
    CardCloud.start({id,onState(next){
      state=next;
      try {localStorage.setItem(key,JSON.stringify(state));}catch{}
      render();
    },onSkills(next){skills=next;render();},onStatus(message){get('save-status').textContent=message;},onAccess:access})
    .then(connection=>{cloud=connection;})
    .catch(error=>{access(false);get('save-status').textContent=error.message;});
  }
})();
