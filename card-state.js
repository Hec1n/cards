/* Общие операции над локальным состоянием карточки. */
globalThis.CardState = (() => {
  const maxHp = 5;
  const maxCoins = 999999999;
  const baseStats = {neko:[1,1,2,1,2,1,1,1,0,1],human:[1,1,1,1,1,1,1,1,2,1]};
  const gearDefaults = id => ({armorName:'Туника',armorHp:0,weaponName:id==='neko'?'Длинный лук из дуба':'Глефа из железа',damage:id==='neko'?'2–3':'1–3',range:id==='neko'?'16 клеток':'Ближний бой',bonuses:Array(10).fill(0)});
  const totalStats = state => baseStats[state.id].map((v,i)=>v+state.gear.bonuses[i]);
  const hpLimit = state => Math.max(3,3+2*totalStats(state)[1])+state.gear.armorHp;
  const whole = (value, fallback, min, max) => Number.isSafeInteger(value)
    ? Math.min(max, Math.max(min, value)) : fallback;
  function initial(id) {
    return { id, gear:gearDefaults(id), revision: 1, hp: 5, coins: id === 'neko' ? 296 : 386, items: [
      { name: id === 'neko' ? 'Длинный лук из дуба' : 'Глефа из железа', quantity: 1 },
      { name: 'Туника', quantity: 1 },
      { name: id === 'neko' ? 'Стрелы' : 'Кинжалы', quantity: id === 'neko' ? 9 : 3 }
    ] };
  }
  function normalize(value, id) {
    const fallback = initial(id);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
    const g=value.gear || {};
    const gear={...gearDefaults(id),armorName:typeof g.armorName==='string'&&g.armorName.trim()?g.armorName.trim().slice(0,120):'Туника',armorHp:whole(g.armorHp,0,0,999),weaponName:typeof g.weaponName==='string'&&g.weaponName.trim()?g.weaponName.trim().slice(0,120):gearDefaults(id).weaponName,damage:typeof g.damage==='string'&&g.damage.trim()?g.damage.trim().slice(0,50):gearDefaults(id).damage,bonuses:Array.from({length:10},(_,i)=>whole(g.bonuses?.[i],0,0,999))};
    gear.range=typeof g.range==='string'&&g.range.trim()?g.range.trim().slice(0,80):gearDefaults(id).range;
    return {
      id, gear, revision: whole(value.revision,0,0,999),
      hp: whole(value.hp, 5, 0, hpLimit({id,gear})),
      coins: whole(value.coins, 0, 0, maxCoins),
      items: Array.isArray(value.items) ? value.items.filter(item =>
        item && typeof item.name === 'string' && item.name.trim() &&
        Number.isSafeInteger(item.quantity) && item.quantity > 0
      ).map(item => ({ name: item.name.trim().slice(0, 120), quantity: Math.min(9999, item.quantity) })) : fallback.items
    };
  }
  function migrate(value, id) {
    const state=normalize(value,id);
    if(state.revision>=1) return state;
    const snapshot=initial(id);
    return {...state,revision:1,coins:snapshot.coins,items:snapshot.items};
  }
  function hp(state, delta) {
    return { ...state, hp: whole(state.hp + delta, state.hp, 0, hpLimit(state)) };
  }
  function coins(state, delta) {
    if (!Number.isSafeInteger(delta) || state.coins + delta < 0 || state.coins + delta > maxCoins) return state;
    return { ...state, coins: state.coins + delta };
  }
  function add(state, name, quantity) {
    name = typeof name === 'string' ? name.trim() : '';
    if (!name || name.length > 120 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999) return state;
    const match = state.items.findIndex(item => item.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'));
    if (match >= 0 && state.items[match].quantity + quantity > 9999) return state;
    const items = state.items.map(item => ({ ...item }));
    if (match >= 0) items[match].quantity += quantity;
    else items.push({ name, quantity });
    return { ...state, items };
  }
  function remove(state, index) {
    return { ...state, items: state.items.filter((_, i) => i !== index) };
  }
  function equip(state, changes) {
    const next=normalize({...state,gear:{...state.gear,...changes}},state.id);
    next.hp=state.hp===0?0:Math.max(0,Math.min(hpLimit(next),state.hp+hpLimit(next)-hpLimit(state)));
    return next;
  }
  return { maxHp, maxCoins, initial, normalize, migrate, hp, coins, add, remove, totalStats, hpLimit, equip };
})();
