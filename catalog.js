(async()=>{
'use strict';
const response=await fetch('./catalog-data.json',{credentials:'omit'});if(!response.ok)throw new Error('目录数据加载失败');const catalog=await response.json();
const plugins=catalog.plugins;
const chosen=new Set();
const pageSize=60;let currentPage=1;
const search=document.getElementById('search');
const cards=document.getElementById('cards');
const filters=document.getElementById('filters');
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
document.title=catalog.metadata.title;
document.getElementById('title').textContent=catalog.metadata.title;
document.getElementById('meta').textContent=`收录 ${plugins.length} 个 · 核对日期 ${catalog.metadata.verified_at} · ${catalog.metadata.index_complete?'索引已核对 · 图标与详情尚未齐全':(catalog.metadata.completeness==='page-verified'?'已按入口页面核对':'完整性尚未确认')}`;
document.getElementById('notice').textContent=catalog.metadata.notice;
const categories=[...new Set(plugins.flatMap(p=>p.categories))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
const all=node('button','chip','全部');all.type='button';all.dataset.category='';all.setAttribute('aria-pressed','true');all.addEventListener('click',()=>{chosen.clear();currentPage=1;render();});filters.append(all);
categories.forEach(category=>{const count=plugins.filter(p=>p.categories.includes(category)).length;const button=node('button','chip',`${category} ${count}`);button.type='button';button.dataset.category=category;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{chosen.has(category)?chosen.delete(category):chosen.add(category);currentPage=1;render();});filters.append(button);});
const embeddedIconCount=plugins.filter(p=>/^assets\/[a-f0-9]{64}\.(?:png|jpg|webp|gif|svg)$/.test(p.icon_data_uri||'')).length;
const iconLoadFailed=new Set();
document.getElementById('icon-summary').textContent=`已有扩展介绍 6378 项；部分详情仍未取得。本站同源图标 ${embeddedIconCount} 项，原图未取得 ${plugins.length-embeddedIconCount} 项。`;
function updateIconStatus(){document.getElementById('icon-status').textContent=`本站同源图标 ${embeddedIconCount} / ${plugins.length}（含公开原 SVG 安全转存）；原图未取得 ${plugins.length-embeddedIconCount}；本次页面资源加载失败 ${iconLoadFailed.size}。`;}
const prepared=plugins.map(p=>({plugin:p,haystack:[p.name_en,p.name_zh,p.description_zh,p.description_en,p.overview_zh,...(p.capabilities_zh||[]),...(p.use_cases_zh||[]),p.requirements_zh,...p.categories].join(' ').normalize('NFKC').toLocaleLowerCase()}));
function render(){
 const words=search.value.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 const found=prepared.filter(x=>(!chosen.size||x.plugin.categories.some(c=>chosen.has(c)))&&words.every(w=>x.haystack.includes(w))).map(x=>x.plugin);
 filters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category?chosen.has(b.dataset.category):chosen.size===0)));
 const pageCount=Math.max(1,Math.ceil(found.length/pageSize));currentPage=Math.min(Math.max(1,currentPage),pageCount);
 const pageItems=found.slice((currentPage-1)*pageSize,currentPage*pageSize);
 document.getElementById('result-count').textContent=`匹配 ${found.length} / ${plugins.length} 个插件 · 本页显示 ${pageItems.length} 个`;
 document.getElementById('page-status').textContent=`第 ${currentPage} / ${pageCount} 页 · 每页 ${pageSize} 项`;
 document.getElementById('page-prev').disabled=currentPage===1;document.getElementById('page-next').disabled=currentPage===pageCount;
 document.getElementById('empty').hidden=found.length!==0;
 const fragment=document.createDocumentFragment();
 pageItems.forEach(p=>{
  const article=node('article','card');
  const heading=node('div','card-heading');const slot=node('div','icon-slot');
  function placeholder(label){slot.replaceChildren(node('span','icon-placeholder',label));}
  function showIcon(src){
   const img=node('img');img.alt=p.name_en+' 图标';img.loading='lazy';img.decoding='async';
   const label=node('span','icon-placeholder','加载中');
   img.addEventListener('load',()=>{if(img.naturalWidth>0){iconLoadFailed.delete(src);label.remove();updateIconStatus();}else{iconLoadFailed.add(src);placeholder('图标载入失败');updateIconStatus();}});
   let retried=false;
   img.addEventListener('error',()=>{if(!img.isConnected)return;if(!retried){retried=true;img.src=src+'?retry=1';return;}iconLoadFailed.add(src);placeholder('图标载入失败');updateIconStatus();});
   img.src=src;slot.replaceChildren(img,label);
  }
  const embedded=/^assets\/[a-f0-9]{64}\.(?:png|jpg|webp|gif|svg)$/.test(p.icon_data_uri||'')?p.icon_data_uri:'';
  if(embedded)showIcon(embedded);
  else placeholder('原图未取得');
  const copy=node('div','heading-copy');copy.append(node('h2','',p.name_en),node('p','cn-name',p.name_zh||p.description_zh||'中文翻译待补充'));heading.append(slot,copy);article.append(heading);
  const tags=node('div','tags');p.categories.forEach(c=>tags.append(node('span','tag',c)));article.append(tags);if(p.name_zh)article.append(node('p','description',p.description_zh||'中文用途待补充。'));
  const hasDetail=Boolean(p.overview_zh||(p.capabilities_zh||[]).length||(p.use_cases_zh||[]).length||p.requirements_zh);
  if(hasDetail){
   const detail=node('details','long-detail');detail.append(node('summary','','详细介绍'));
   function section(title,value,list){if(!value||(list&&!value.length))return;detail.append(node('h3','detail-heading',title));if(list){const ul=node('ul','detail-list');value.forEach(v=>ul.append(node('li','',v)));detail.append(ul);}else detail.append(node('p','detail-body',value));}
   section('用途',p.overview_zh,false);section('能做什么',p.capabilities_zh,true);section('适用场景 · 使用示例',p.use_cases_zh,true);section('使用条件',p.requirements_zh,false);
   detail.append(node('p',p.detail_verified?'detail-source':'detail-pending',p.historical_recovery?'历史研究记录恢复（本次未重新核验）':(p.detail_verified?(p.rebuilt_source_verified?'公开同ID说明已核对（未实测功能或效果）':'旧基线来源已核对（不代表已实测功能或效果）'):'详情待核对')));
   if(p.description_truncated)detail.append(node('p','detail-pending','来源正文可能不完整，未读到的条件不能视为不存在。'));
   if(p.observed_public_name&&p.observed_public_name!==p.name_en)detail.append(node('p','detail-body','公开资料名称：'+p.observed_public_name+'（保留目录原名）'));
   if(p.detail_source_paraphrase_en){const en=node('details');en.append(node('summary','','英文概述（转述，非原文）'),node('p','english',p.detail_source_paraphrase_en));detail.append(en);}
   if(p.detail_source_type)detail.append(node('p','detail-body','来源类型：'+p.detail_source_type));
   if(p.historical_recovery)detail.append(node('p','detail-body','历史研究日2026-10-24，恢复未新核验'));
   else if(p.detail_verified_date)detail.append(node('p','detail-body','来源核对日期：'+p.detail_verified_date));
   if(p.detail_verification_scope)detail.append(node('p','detail-body',p.detail_verification_scope));
   if(p.detail_text_zh){const translated=node('details','translated-detail');translated.append(node('summary','','完整中文介绍'),node('p','detail-body',p.detail_text_zh));detail.append(translated);}
   if(p.original_detail){const original=node('details','source-detail');original.append(node('summary','','详情来源原文'),node('p','english',p.original_detail));detail.append(original);}
   if(/^https:\/\//i.test(p.detail_source_url||'')){const a=node('a','detail-source','查看详情来源');a.href=p.detail_source_url;a.target='_blank';a.rel='noopener noreferrer';detail.append(a);}
   article.append(detail);
  }else article.append(node('p','detail-pending',(p.latest_detail_attempt_status||'详情待核对')));
  const details=node('details');details.append(node('summary','','原文介绍 / Original'),node('p','english',p.description_en||'未提供原文介绍。'));
  if(p.official_product_supplement){const u=p.official_product_supplement;const box=node('details','long-detail');box.append(node('summary','','官方产品补充介绍，尚未确认本条插件一致性'),node('p','detail-pending',(u.verification_note||'历史片段恢复，未重新核验，不计本条插件详情。')),node('p','detail-body',u.overview_zh||''),node('p','detail-body',u.requirements_zh||''),node('p','detail-body',u.limitations_zh||''));if(/^https:\/\//i.test(u.source_url||'')){const a=node('a','','官方资料来源');a.href=u.source_url;a.target='_blank';a.rel='noopener noreferrer';box.append(a);}article.append(box); }
  if(!embedded)article.append(node('p','detail-pending','本站原图未取得，已显示占位。'));
  const info=[p.id?`插件 ID：${p.id}`:'插件 ID：尚未取得',p.sources.length?`来源：${p.sources.join('、')}`:'',p.verified_at?`目录基线核对：${p.verified_at}`:'',p.status?`目录状态：${p.status}`:''].filter(Boolean).join('\n');
  const dm=node('p','detail-meta',info);dm.style.whiteSpace='pre-wrap';details.append(dm);article.append(details);fragment.append(article);
 });
 cards.replaceChildren(fragment);
}
search.addEventListener('input',()=>{currentPage=1;render();});
document.getElementById('page-prev').addEventListener('click',()=>{if(currentPage>1){currentPage--;render();}});
document.getElementById('page-next').addEventListener('click',()=>{currentPage++;render();});
document.getElementById('reset').addEventListener('click',()=>{search.value='';chosen.clear();currentPage=1;render();search.focus();});
render();
updateIconStatus();

})().catch(()=>{document.getElementById('result-count').textContent='目录数据未能加载，请刷新或稍后再试。';document.getElementById('notice').textContent='目录数据未能加载，请刷新或稍后再试。';});
