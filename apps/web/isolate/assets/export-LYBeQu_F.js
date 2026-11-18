import{c as i}from"./index-B0Q64y-C.js";const c=[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]],u=i("download",c);function p(t){const e=t==null?"":String(t);return/[",\n\r]/.test(e)?`"${e.replace(/"/g,'""')}"`:e}function l(t){return t.map(e=>e.map(p).join(",")).join(`\r
`)}function b(t,e){const s=new Blob(["\uFEFF"+l(e)],{type:"text/csv;charset=utf-8"}),r=URL.createObjectURL(s),o=document.createElement("a");o.href=r,o.download=t,o.click(),setTimeout(()=>URL.revokeObjectURL(r),1e3)}function h(t,e,s,r){const o=window.open("","_blank");if(!o){alert("Please allow pop-ups to print this report.");return}const n=a=>a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");o.document.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>${n(t)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; color:#111; margin:32px; }
  h1 { font-size:18px; margin:0 0 4px; }
  p.sub { color:#555; font-size:12px; margin:0 0 20px; }
  table { border-collapse: collapse; width:100%; font-size:12px; }
  th { text-align:left; background:#f4f4f5; padding:8px 10px; border-bottom:2px solid #ddd; }
  td { padding:7px 10px; border-bottom:1px solid #eee; }
</style></head><body>
<h1>${n(t)}</h1><p class="sub">${n(e)}</p>
<table><thead><tr>${s.map(a=>`<th>${n(a)}</th>`).join("")}</tr></thead>
<tbody>${r.map(a=>`<tr>${a.map(d=>`<td>${n(d)}</td>`).join("")}</tr>`).join("")}</tbody></table>
<script>window.onload = function(){ window.focus(); window.print(); };<\/script>
</body></html>`),o.document.close()}export{u as D,b as d,h as p};
