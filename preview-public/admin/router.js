import {cancelAll} from './api.js';
import {dismissConfirmation} from './ui.js';
const SECTIONS=['overview','players','reports','content','operations','analytics','audit','patrons'];
const fields=['player','team','puzzle','case','kind'];
let listener=()=>{};
export function route(){const params=new URLSearchParams(location.search),r={section:SECTIONS.includes(params.get('section'))?params.get('section'):'overview'};for(const key of fields){const value=params.get(key);if(value&&/^[A-Za-z0-9_.:-]{1,120}$/.test(value))r[key]=value}return r}
export function href(r){return `${location.pathname}?${new URLSearchParams(r)}`}
export function navigate(r,{replace=false}={}){dismissConfirmation();cancelAll();history[replace?'replaceState':'pushState']({},'',href(r));listener(route());window.scrollTo(0,0)}
export function installRouter(callback){listener=callback;document.addEventListener('click',event=>{const a=event.target.closest('a[data-route],a[data-section]');if(!a||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button)return;event.preventDefault();const p=new URL(a.href).searchParams,next={};p.forEach((v,k)=>next[k]=v);navigate(next)});window.addEventListener('popstate',()=>{dismissConfirmation();cancelAll();listener(route())})}
