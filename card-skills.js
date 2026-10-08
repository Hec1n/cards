globalThis.CardSkills = (()=>{
 const initial=id=>[{name:'Уклонение',level:2,description:'Пассивный навык. Мастер учитывает уровень при попадании противника.'},...(id==='human'?[{name:'Жестокость',level:2,description:'Эффект определяет мастер.'},{name:'Медитация',level:2,description:'Позволяет развивать навыки; успех и повышение определяет мастер.'}]:[])];
 function add(skills,name,level,description){
  name=typeof name==='string'?name.trim():'';description=typeof description==='string'?description.trim():'';
  if(!name||name.length>80||!Number.isSafeInteger(level)||level<1||level>999||description.length>1000||skills.length>=100)throw new Error('Укажи название до 80 символов, уровень 1–999 и описание до 1000 символов. Максимум 100 навыков.');
  if(skills.some(s=>s.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))throw new Error('Навык с таким названием уже есть в карточке.');
  return [...skills,{name,level,description}];
 }
 return {initial,add};
})();
