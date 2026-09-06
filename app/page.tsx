'use client';
import { useEffect, useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import { BookOpen, Layers, Volume2, Bookmark, ArrowLeft, ArrowRight, RotateCcw, Check, Sparkles, ChevronRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { words } from '@/lib/words';
type RecordMap = Record<string, 'review' | 'known'>;
const KEY = 'cijian-cet4-v1';
export default function Home() {
 const [unit,setUnit]=useState(0),[filter,setFilter]=useState('all'),[index,setIndex]=useState(0),[flipped,setFlipped]=useState(false);
 const [marks,setMarks]=useState<RecordMap>({}),[stars,setStars]=useState<string[]>([]),[ready,setReady]=useState(false),[notice,setNotice]=useState(''),[saved,setSaved]=useState(true);
 useEffect(()=>{try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d){if(d.marks && typeof d.marks==='object')setMarks(Object.fromEntries(Object.entries(d.marks).filter(([k,v])=>words.some(w=>w.word===k)&&(v==='known'||v==='review'))) as RecordMap);if(Array.isArray(d.stars))setStars(d.stars.filter((w:unknown)=>typeof w==='string'&&words.some(x=>x.word===w)));if(Number.isInteger(d.unit)&&d.unit>=0&&d.unit<16)setUnit(d.unit);}}catch{setNotice('无法读取旧进度，本次仍可正常学习。');}setReady(true);},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem(KEY,JSON.stringify({marks,stars,unit}));setSaved(true);}catch{setSaved(false);}},[marks,stars,unit,ready]);
 const list=words.filter((w,i)=>filter==='all'?Math.floor(i/20)===unit:filter==='star'?stars.includes(w.word):marks[w.word]===filter);
 const safeIndex=Math.min(index,Math.max(0,list.length-1)),word=list[safeIndex];
 const known=Object.values(marks).filter(v=>v==='known').length,review=Object.values(marks).filter(v=>v==='review').length;
 const studied=Object.keys(marks).length,progress=Math.round(known/words.length*100);
 function move(delta:number){if(!list.length)return;setIndex((safeIndex+delta+list.length)%list.length);setFlipped(false);setNotice('');}
 function mark(status:'known'|'review'){if(!word)return;setMarks(m=>({...m,[word.word]:status}));if(filter==='all'||filter==='star'||filter===status)setIndex((safeIndex+1)%list.length);else setIndex(Math.min(safeIndex,Math.max(0,list.length-2)));setFlipped(false);setNotice(status==='known'?'已标记掌握，继续下一个词。':'已加入待巩固，稍后再复习。');}
 function star(){if(word)setStars(s=>s.includes(word.word)?s.filter(w=>w!==word.word):[...s,word.word]);}
 function speak(){if(!word)return;if(!('speechSynthesis' in window)){setNotice('当前浏览器不支持发音，请换用支持语音朗读的浏览器。');return;}window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(word.word);u.lang='en-US';u.rate=.8;u.onerror=()=>setNotice('发音暂不可用，请检查设备语音或稍后重试。');window.speechSynthesis.speak(u);}
 useEffect(()=>{
  function keyboard(e:KeyboardEvent){
   const t=e.target;
   if(e.defaultPrevented||e.isComposing||e.keyCode===229||e.altKey||e.ctrlKey||e.metaKey)return;
   if(t instanceof HTMLElement&&(t.isContentEditable||t.closest('input,select,textarea,[role="textbox"],[role="combobox"]')))return;
   // Handle pronunciation before the button guard so clicking a card never disables M.
   if(e.key.toLowerCase()==='m'){
    if(e.repeat)return;
    e.preventDefault();
    speak();
    return;
   }
   if(t instanceof HTMLElement&&t.closest('button,[role="tab"]'))return;
   if(e.code==='Space'){e.preventDefault();setFlipped(f=>!f);}
   if(e.key==='ArrowRight')move(1);
   if(e.key==='ArrowLeft')move(-1);
   if(e.key==='1')mark('review');
   if(e.key==='2')mark('known');
  }
  window.addEventListener('keydown',keyboard);
  return()=>window.removeEventListener('keydown',keyboard);
 });
 const modelState=useRef({word,flipped,marks,known,review,studied,mark});
 modelState.current={word,flipped,marks,known,review,studied,mark};
 useEffect(()=>{
  type Tool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown};
  const context=(document as Document & {modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  const register=(tool:Tool)=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'get_current_study_card',description:'Read the current CET-4 card and device-local learning totals. Does not reveal a hidden definition.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>{const s=modelState.current;return {word:s.word?.word??null,meaning:s.flipped?s.word?.meaning:null,flipped:s.flipped,known:s.known,review:s.review,studied:s.studied,total:words.length};}});
  register({name:'rate_current_study_card',description:'Mark the currently displayed word as known or needing review, save locally, and advance using the same action as the card buttons. Requires the displayed word to prevent rating a stale card.',inputSchema:{type:'object',properties:{word:{type:'string'},rating:{type:'string',enum:['known','review']}},required:['word','rating'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input)=>{if(!input||typeof input!=='object')throw new Error('Expected word and rating.');const d=input as {word:unknown;rating:unknown};if(Object.keys(d).some(k=>k!=='word'&&k!=='rating')||typeof d.word!=='string'||(d.rating!=='known'&&d.rating!=='review'))throw new Error('Invalid word or rating.');if(modelState.current.word?.word!==d.word)throw new Error('The displayed card has changed. Read it again first.');const rating=d.rating;flushSync(()=>modelState.current.mark(rating));return {ratedWord:d.word,rating,nextWord:modelState.current.word?.word??null,known:modelState.current.known,review:modelState.current.review};}});
  return()=>lifecycle.abort();
 },[]);
 return <div className="app-shell">
 <header className="topbar"><a href="/" className="brand"><span className="brand-icon"><BookOpen size={21}/></span>词间<span className="brand-en">WORDSPACE</span></a><div className="top-label">英语四级 · CET-4</div><div className="save-state"><span className={saved?'status-dot':'status-dot warning'}/>{!ready?'正在读取进度':saved?'进度已保存在本机':'进度暂未保存'}</div></header>
 <main className="workspace"><div className="page-heading"><div><div className="eyebrow">A LITTLE EVERY DAY</div><h1>四级高频词<span>320</span></h1><p>从真题常考词开始，一张卡片，一次积累。</p></div><span className="edition"><Layers size={17}/>16 组 · 每组 20 词</span></div>
 <div className="study-layout"><section className="study-main" aria-label="单词卡片学习">
 <Tabs value={filter} onValueChange={v=>{setFilter(String(v));setIndex(0);setFlipped(false);setNotice('');}}><TabsList className="study-tabs"><TabsTrigger value="all">全部单词 <span>{words.length}</span></TabsTrigger><TabsTrigger value="review">待巩固 <span>{review}</span></TabsTrigger><TabsTrigger value="known">已掌握 <span>{known}</span></TabsTrigger><TabsTrigger value="star">收藏 <span>{stars.length}</span></TabsTrigger></TabsList><TabsContent value={filter}>
 <div className="deck-heading"><span>{filter==='all'?`UNIT ${String(unit+1).padStart(2,'0')} · 高频词组`:filter==='review'?'再遇见，就是进步':filter==='known'?'已掌握词汇':'我的收藏词'}</span><span><b>{list.length?safeIndex+1:0}</b> / {list.length}</span></div>
 {word?<><div className={'flashcard '+(flipped?'is-flipped':'')}><div className="card-top"><span className="word-tag"><span/>四级常考词</span><button className={'icon-button bookmark '+(stars.includes(word.word)?'selected':'')} onClick={star} aria-label={stars.includes(word.word)?'取消收藏':'收藏单词'} aria-pressed={stars.includes(word.word)}><Bookmark size={21}/></button></div><button className="card-content" onClick={()=>setFlipped(v=>!v)} aria-label={`${word.word}，${flipped?'隐藏':'显示'}释义`} aria-expanded={flipped}><span className="word" lang="en">{word.word}</span>{flipped?<div className="answer"><span className="part-of-speech">{word.pos}</span><h2>{word.meaning}</h2><div className="phrase"><span>常用搭配</span><p lang="en">{word.phrase}</p></div></div>:<div className="recall"><span className="recall-line"/><p>想一想，它的意思是什么？</p></div>}</button><div className="card-bottom"><button className="pronounce" onClick={speak} aria-keyshortcuts="m" title="美式发音（M）" aria-label={`朗读 ${word.word}`}><Volume2 size={18}/>美式发音 <kbd aria-hidden="true">M</kbd></button><button className="flip-hint" onClick={()=>setFlipped(v=>!v)}><RotateCcw size={15}/>{flipped?'点击返回正面':'点击卡片查看释义'}</button><span className="card-no">{String(words.indexOf(word)+1).padStart(3,'0')} / 320</span></div></div>
 <div className="card-controls"><button className="nav-arrow" onClick={()=>move(-1)} aria-label="上一个单词"><ArrowLeft size={20}/></button><button className="review-action" onClick={()=>mark('review')}><RotateCcw size={17}/>还需巩固<kbd>1</kbd></button><button className="known-action" onClick={()=>mark('known')}><Check size={19}/>已掌握<kbd>2</kbd></button><button className="nav-arrow" onClick={()=>move(1)} aria-label="下一个单词"><ArrowRight size={20}/></button></div></>:<div className="empty-state"><BookOpen size={38}/><h2>{filter==='review'?'暂时没有待巩固单词':filter==='known'?'你的积累，从第一张开始':'收藏值得再看一遍的词'}</h2><p>{filter==='star'?'点击卡片右上角的书签，即可加入收藏。':'学习时标记单词，就会在这里看到它们。'}</p><button className="known-action" onClick={()=>{setFilter('all');setIndex(0);}}>开始学习 <ArrowRight size={16}/></button></div>}
 <div className="feedback" role="status">{notice||<span>先回忆，再翻卡，让记忆多停留一会儿。</span>}</div><div className="keyboard-help"><kbd>Space</kbd>翻转卡片<i/> <kbd>←</kbd><kbd>→</kbd>切换单词<i/><kbd>M</kbd>朗读单词</div></TabsContent></Tabs>
 </section><aside className="study-aside"><section className="progress-panel"><div className="panel-title"><span>我的学习进度</span><Sparkles size={17}/></div><div className="progress-number">{progress}<span>%</span></div><p>已掌握 {known} / {words.length} 个词</p><Progress value={progress} aria-label="总掌握进度"/><div className="stats"><div><span className="mini-dot blue"/>已学习<strong>{studied}</strong></div><div><span className="mini-dot orange"/>待巩固<strong>{review}</strong></div><div><span className="mini-dot gray"/>未学习<strong>{words.length-studied}</strong></div></div><div className="encouragement">{known===320?'320 个词都已掌握，记得定期回顾。':'不必一次记住所有，坚持比速度更重要。'}</div></section><section className="tip-panel"><div className="tip-kicker">STUDY NOTE / 01</div><h3>把“认识”变成“记住”</h3><p>先尝试说出词义，再翻面核对。犹豫的词，放进待巩固，下一次重点复习。</p><span>每次 20 词，慢慢来。<ChevronRight size={15}/></span></section></aside></div>
 <section className="units-section"><div className="section-title"><h2>学习分组</h2><span>按参考真题句频降序编排</span></div><div className="units-grid">{Array.from({length:16},(_,u)=>{const group=words.slice(u*20,u*20+20),done=group.filter(w=>marks[w.word]==='known').length;return <button key={u} className={'unit '+(u===unit&&filter==='all'?'active':'')} aria-pressed={u===unit&&filter==='all'} onClick={()=>{setUnit(u);setFilter('all');setIndex(0);setFlipped(false);setNotice('');}}><div><span>UNIT {String(u+1).padStart(2,'0')}</span>{done===20?<Check size={16}/>:<ArrowRight size={15}/>}</div><strong>{group[0]?.word} <span>—</span></strong><div className="unit-progress"><span style={{width:`${done/20*100}%`}}/></div><small>{done} / 20 已掌握</small></button>})}</div></section>
 <footer><span>词间 <span className="footer-dot">·</span> 让每一次积累都有回响</span><details><summary>词库来源与说明</summary><p>选词与排序参考<a href="https://english-exam.lazynote.cn/cet4/words/stats/syllabus/" target="_blank" rel="noreferrer">懒笔记「英语四级考纲高频词」</a>公开词表前 320 词（核对日期：2026-09-06）。参考站按所收录真题的句频排序，并非官方全量历届考试统计；本站不承诺命中率。中文释义与搭配为学习用途独立编写，搭配不冒充真题原句。学习记录只保存在当前浏览器，清除浏览器数据会移除进度。发音由设备的语音服务提供。</p></details></footer>
 </main></div>;
}
