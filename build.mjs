import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const write=(name,value)=>fs.writeFileSync(path.join(root,name),value);
const attributes=['Сила','Выносливость','Ловкость','Восприятие','Интеллект','Мудрость','Инициатива','Удача','Вера','Харизма'];
// Только сведения для игроков; данные мастерского сайта сюда не импортируются.
const people=[
 {id:'neko',title:'Неко',subtitle:'Длинный лук',sex:'Женский',move:10,vision:10,stats:[1,1,2,1,2,1,1,1,0,1],weapon:'Длинный лук из дуба',damage:'2–3',range:'16 клеток',category:'Луки',specific:'Длинный лук',note:'Железная стрела: 1–2 урона. Лук добавляет 1.',abilities:[['Точный выстрел','Урон ×1,5','Дробный урон округляется вверх.'],['Дальний выстрел','Дальность ×2','16 → 32 клетки. Можно совместить с точным выстрелом.']]},
 {id:'human',title:'Человек',subtitle:'Глефа',sex:'Мужской',move:5,vision:1,stats:[1,1,1,1,1,1,1,1,2,1],weapon:'Глефа из железа',damage:'1–3',range:'Ближний бой',category:'Древковое оружие',specific:'Глефа',note:'Урон при силе 1. При попадании результат определяет мастер.',abilities:[['Критический удар','Урон ×1,5','Дробный урон округляется вверх.'],['Оглушающий удар','Оглушение · 2 раунда','Полностью лишает цель действий при успешном оглушении. Сопротивление цели учитывает мастер.']]}
];
const icon="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='5' y='3' width='22' height='26' rx='3' fill='%231c2829' stroke='%23d3ac69' stroke-width='2'/%3E%3Cpath d='M10 11h12M10 16h12M10 21h8' stroke='%23d3ac69' stroke-width='2'/%3E%3C/svg%3E";
const shell=(title,content,cls='')=>`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#10181c"><meta name="description" content="Карточка игрока: характеристики, здоровье, снаряжение и изученные способности."><title>${title} · Карточки</title><link rel="icon" href="${icon}"><link rel="stylesheet" href="styles.css"></head><body class="${cls}"><a class="skip" href="#main">К карточке</a><div class="frame"><header class="topbar"><a href="index.html">ВЕЛИКАЯ ИМПЕРИЯ</a><span>КАРТОЧКИ ИГРОКОВ</span></header><main id="main">${content}</main><footer>Стартовые карточки · данные обновляет мастер</footer></div></body></html>`;
for(const p of people){
const h=`<a class="back" href="index.html">← Все карточки</a><header class="hero"><p class="eyebrow">ПЕРСОНАЖ · ИМЕНИ ПОКА НЕТ</p><h1>${p.title}</h1><p class="subtitle">${p.subtitle} <span>·</span> Пол: ${p.sex.toLowerCase()}</p></header>
<div class="overview"><section class="health"><span class="label">ХИТ-ПОИНТЫ</span><strong>5 <small>/ 5</small></strong><meter min="0" max="5" value="5" aria-label="Стартовые ХП: 5 из 5"></meter><span class="hint">3 базовых + 2 от выносливости</span></section><section class="armor"><span class="label">БРОНЯ</span><h2>Туника</h2><p>Обычная одежда.<br>Бонусов к ХП и защите нет.</p></section></div>
<div class="quick-stats"><div><strong>${p.move}</strong><span>клеток за ход</span></div><div><strong>${p.vision} м</strong><span>ночное зрение</span></div><div><strong>1</strong><span>инициатива</span></div><div><strong>1:3</strong><span>перестат</span></div></div>
<section class="section"><h2>Характеристики</h2><dl class="attributes">${attributes.map((a,i)=>`<div><dt>${a}</dt><dd>${p.stats[i]}</dd></div>`).join('')}</dl><p class="hint">Бонусов от предметов нет. Удача 1 не даёт бонуса к броскам.</p></section>
<section class="section"><h2>Оружие</h2><article class="weapon"><div><p class="eyebrow">МАТЕРИАЛ · РАНГ 1</p><h3>${p.weapon}</h3><p>${p.range}</p></div><div class="damage"><strong>${p.damage}</strong><span>урона</span></div></article><p class="hint">${p.note}</p><div class="mastery"><p><span>${p.category}</span><strong>1 уровень</strong></p><p><span>${p.specific}</span><strong>1 уровень</strong></p></div></section>
<section class="section"><h2>Способности</h2><p class="hint">Боевые способности пока не изучены. Владения категорией и конкретным оружием указаны выше.</p></section>
${p.id==='human'?'<section class="section"><h2>Покровитель</h2><p><strong>Бешаба</strong> — богиня неудачи. Вера: 2.</p><p class="hint">Сейчас бонусов за поклонение нет.</p></section>':''}
<section class="section reminder"><h2>Памятка на ход</h2><ul><li>Если пройдёшь меньше ${p.move} клеток, можешь затем атаковать или достать предмет. После этого ход заканчивается.</li><li>Обычно доступна одна атака за ход.</li><li>При 0 ХП теряешь сознание. На спасение есть 5 раундов.</li></ul></section>`;
write(p.id+'.html',shell(p.title,h,p.id));
}
write('index.html',shell('Персонажи',`<header class="hero"><p class="eyebrow">НАЧАЛО ПРИКЛЮЧЕНИЯ</p><h1>Твой персонаж</h1><p class="subtitle">Характеристики, снаряжение и способности.</p></header><div class="selection">${people.map(p=>`<a href="${p.id}.html" class="select-card ${p.id}"><span class="eyebrow">${p.subtitle}</span><h2>${p.title}</h2><p>5 ХП · ${p.move} клеток за ход</p><span class="open">Открыть карточку →</span></a>`).join('')}</div>`));
console.log('Built 2 player cards and index.');
