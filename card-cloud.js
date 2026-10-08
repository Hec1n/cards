globalThis.CardCloud = (() => {
  const config = globalThis.CARD_CLOUD_CONFIG;
  const enabled = Boolean(config?.url && config?.key);
  async function start({id, onState, onStatus, onAccess, onSkills = () => {}}) {
    if (!enabled) return null;
    if (!globalThis.supabase) throw new Error('Не удалось загрузить модуль общего сохранения. Обнови страницу.');
    const client = supabase.createClient(config.url, config.key);
    let revision = null, busy = false, editable = false, stopped = false, loaded = false, skillManager = false;
    const get = name => document.getElementById(name);
    const lock = () => onAccess(editable && loaded && !busy, skillManager);
    async function refresh(force = false) {
      if (busy || stopped) return;
      if (!force && (!get('armor-form').hidden || !get('weapon-form').hidden || (get('skill-form') && !get('skill-form').hidden))) return;
      busy = true; lock();
      try {
        const {data, error} = await client.from('cards').select('state, revision, skills').eq('id', id).single();
        if (error) throw error;
        loaded = true;
        if (revision !== data.revision) { revision = data.revision; onState(CardState.normalize(data.state,id)); onSkills(data.skills || []); }
        onStatus('Общая карточка загружена. Изменения проверяются каждые 5 секунд.');
      } catch { loaded=false; onStatus('Нет связи с общей карточкой. Показаны последние загруженные данные.'); }
      finally { busy = false; lock(); }
    }
    async function identity() {
      const {data:{session}} = await client.auth.getSession();
      editable = false; skillManager = false;
      if (session) {
        const {data,error} = await client.from('card_editors').select('card_id, can_manage_skills').eq('card_id',id);
        editable = !error && data.length > 0;
        skillManager = editable && data.some(row=>row.can_manage_skills===true);
      }
      get('auth-form').hidden = Boolean(session);
      get('sign-out').hidden = !session;
      get('auth-status').textContent = session
        ? (editable ? 'Вход выполнен. Ты можешь редактировать эту карточку.' : 'Вход выполнен. На эту карточку пока есть только право просмотра — обратись к мастеру.')
        : 'Войди, чтобы редактировать. Просмотр общей карточки доступен без входа.';
      lock();
      await refresh(true);
    }
    get('cloud-panel').hidden = false;
    get('auth-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.submitter;
      if (!button) return;
      const inputs = [...get('auth-form').querySelectorAll('button')];
      inputs.forEach(b=>b.disabled=true);
      get('auth-status').textContent='Выполняется вход…';
      try {
        const credentials={email:get('auth-email').value.trim(),password:get('auth-password').value};
        const result=await client.auth.signInWithPassword(credentials);
        get('auth-password').value='';
        if(result.error) throw result.error;
        await identity();
      } catch(error) { get('auth-status').textContent='Не удалось войти: '+error.message; }
      finally {inputs.forEach(b=>b.disabled=false);}
    });
    get('sign-out').addEventListener('click',async()=>{
      const {error}=await client.auth.signOut();
      if(error){get('auth-status').textContent='Не удалось выйти. Проверь соединение.';return;}
      editable=false;lock();await identity();
    });
    client.auth.onAuthStateChange(()=>{setTimeout(()=>{if(!stopped) identity().catch(()=>onStatus('Не удалось проверить вход.'));},0);});
    await identity();
    const timer=setInterval(()=>{if(!document.hidden)refresh();},5000);
    window.addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);});
    async function save(next, skillsOnly = false) {
        if(!editable||!loaded||busy||revision===null) throw new Error('Дождись загрузки и войди в аккаунт с правом редактирования.');
        if(skillsOnly&&!skillManager) throw new Error('Добавлять навыки может только мастер.');
        busy=true;lock();onStatus('Сохраняем на сервере…');
        try {
          const {data,error}=await client.rpc(skillsOnly?'save_card_skills':'save_card',skillsOnly?{p_id:id,p_revision:revision,p_skills:next}:{p_id:id,p_revision:revision,p_state:next});
          if(error) throw error;
          const row=data[0];
          revision=row.revision;
          onState(CardState.normalize(row.state,id)); onSkills(row.skills || []);
          onStatus('Сохранено для всех устройств.');
        } catch(error) {
          // Не повторяем запрос автоматически: сервер мог сохранить его до разрыва связи.
          busy=false;
          await refresh(true);
          throw new Error(error.code==='PT409'
            ? 'Карточку уже изменили в другой вкладке или на другом устройстве. Загружена актуальная версия; проверь её и повтори правку.'
            : 'Сохранение не подтверждено. Проверь значения после восстановления связи, прежде чем повторять правку.');
        } finally {busy=false;lock();}
      }
    return {save:next=>save(next),saveSkills:next=>save(next,true)};
  }
  return {enabled,start};
})();
