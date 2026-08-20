/*
 * chart.js — rendering and interaction only.
 *
 * This file owns: the D3 treemap layout, filtering/search state, tooltips, the detail
 * panel, and category color/label config (CATS — a presentation choice, not upstream
 * data, which is why it lives here rather than in data.json).
 *
 * This file does NOT own: what a major's exposure score is, which occupation backs a
 * citation, or how degree counts were sourced. All of that comes from data.json, built by
 * scripts/build_site_data.py. If a number here looks wrong, the fix belongs in data/ or
 * scripts/, not here — this file should never need to change for a data update, only for
 * a presentation or interaction change.
 */

const CATS = {
  business:      {label:"Business",                       color:"#C9A66B"},
  health:        {label:"Health & Medicine",               color:"#7C9885"},
  computing:     {label:"Computing & IT",                  color:"#5B7C99"},
  engineering:   {label:"Engineering",                     color:"#6E7F80"},
  sciences:      {label:"Biological & Physical Sciences",  color:"#8A9A5B"},
  social:        {label:"Social & Behavioral Sciences",    color:"#9B8AA6"},
  humanities:    {label:"Humanities & Languages",          color:"#A67C6D"},
  comm:          {label:"Communication & Media",           color:"#7C8FA6"},
  arts:          {label:"Arts & Design",                   color:"#B08AA0"},
  education:     {label:"Education",                       color:"#8FA6A0"},
  public:        {label:"Public Service & Safety",         color:"#6B7B8C"},
  ag:            {label:"Agriculture, Environment & Rec.", color:"#9CA66B"},
  interdisc:     {label:"Interdisciplinary & Other",       color:"#A3A099"}
};

/* ================= LOAD DATA ================= */
// Populated by init() below from data.json — the build output of
// scripts/build_exposure_scores.py + scripts/build_site_data.py. Never hand-edited.
let DATA = [];
let MOMENTUM = {};

const expColor = d3.scaleLinear()
  .domain([0,5,10])
  .range(["#E3DFD8","#C98A6E","#8C1515"])
  .interpolate(d3.interpolateRgb);

function fmt(n){return n.toLocaleString('en-US');}

/* ================= STATE ================= */
let state = { search:"", cat:"all", minExp:0, maxExp:10, colorMode:"exposure", pinned:null };

/* ================= UI: category filter ================= */
const catSel = d3.select("#catFilter");
catSel.append("option").attr("value","all").text("All fields");
Object.entries(CATS).forEach(([k,v])=>catSel.append("option").attr("value",k).text(v.label));
catSel.on("change",function(){ state.cat=this.value; render(); });

/* category legend */
const catLegend = d3.select("#catLegend");
Object.entries(CATS).forEach(([k,v])=>{
  const s = catLegend.append("span");
  s.append("i").style("background",v.color);
  s.append("span").text(v.label);
});

/* color mode toggle */
d3.selectAll("#colorSeg button").on("click",function(){
  d3.selectAll("#colorSeg button").classed("active",false);
  d3.select(this).classed("active",true);
  state.colorMode = this.dataset.mode;
  d3.select("#expLegend").style("display", state.colorMode==="exposure" ? "flex":"none");
  d3.select("#catLegend").style("display", state.colorMode==="category" ? "flex":"none");
  render();
});

/* search */
d3.select("#searchInput").on("input",function(){ state.search=this.value.trim().toLowerCase(); render(); });

/* exposure sliders */
const minExpI=d3.select("#minExp"), maxExpI=d3.select("#maxExp");
minExpI.on("input",function(){
  state.minExp=+this.value;
  if(state.minExp>state.maxExp){state.maxExp=state.minExp; maxExpI.property("value",state.maxExp);}
  d3.select("#minExpVal").text(state.minExp);
  d3.select("#maxExpVal").text(state.maxExp);
  render();
});
maxExpI.on("input",function(){
  state.maxExp=+this.value;
  if(state.maxExp<state.minExp){state.minExp=state.maxExp; minExpI.property("value",state.minExp);}
  d3.select("#minExpVal").text(state.minExp);
  d3.select("#maxExpVal").text(state.maxExp);
  render();
});

/* reset */
d3.select("#resetBtn").on("click",()=>{
  state={search:"",cat:"all",minExp:0,maxExp:10,colorMode:state.colorMode,pinned:null};
  d3.select("#searchInput").property("value","");
  catSel.property("value","all");
  minExpI.property("value",0); maxExpI.property("value",10);
  d3.select("#minExpVal").text(0); d3.select("#maxExpVal").text(10);
  closeDetail();
  render();
});

/* ================= CHART ================= */
const svg = d3.select("#chart");
const tooltip = d3.select("#tooltip");
const W = 1268, H = 620;
svg.attr("viewBox",`0 0 ${W} ${H}`);

function textColorFor(hex){
  const c = d3.color(hex);
  const lum = 0.299*c.r + 0.587*c.g + 0.114*c.b;
  return lum > 165 ? "dark" : "";
}

function closeDetail(){
  state.pinned=null;
  d3.select("#detail").classed("open",false);
}
d3.select("#closeDetail").on("click",closeDetail);

function fillFor(d){
  return state.colorMode==="exposure" ? expColor(d.data.exposure) : CATS[d.data.cat].color;
}

function render(){
  const inRange = d => d.exposure>=state.minExp && d.exposure<=state.maxExp;
  const inCat = d => state.cat==="all" || d.cat===state.cat;
  const matchesSearch = d => !state.search || d.name.toLowerCase().includes(state.search);

  const filtered = DATA.filter(d=>inRange(d) && inCat(d));
  const visible = filtered.filter(matchesSearch);

  // stats (computed on visible-by-search-and-filter set)
  const statBase = state.search ? visible : filtered;
  const totalDeg = d3.sum(statBase, d=>d.degrees);
  const wAvg = totalDeg ? d3.sum(statBase, d=>d.degrees*d.exposure)/totalDeg : 0;
  const sortedHigh = [...statBase].sort((a,b)=>b.exposure-a.exposure);
  const sortedLow = [...statBase].sort((a,b)=>a.exposure-b.exposure);

  d3.select("#statMajors").text(statBase.length);
  d3.select("#statDegrees").html(fmt(totalDeg)+" <small>/yr</small>");
  d3.select("#statAvg").text(statBase.length? wAvg.toFixed(1):"–");
  d3.select("#statHigh").text(sortedHigh[0] ? sortedHigh[0].name.split(" (")[0] : "–");
  d3.select("#statLow").text(sortedLow[0] ? sortedLow[0].name.split(" (")[0] : "–");

  // build hierarchy from the category-and-range filtered set (search only dims, doesn't remove, to keep spatial memory)
  const byCat = d3.groups(filtered, d=>d.cat);
  const root = d3.hierarchy({children: byCat.map(([cat,items])=>({cat,children:items}))})
    .sum(d=>d.degrees || 0)
    .sort((a,b)=>b.value-a.value);

  d3.treemap()
    .size([W,H])
    .paddingOuter(3)
    .paddingTop(d=>d.depth===1?22:0)
    .paddingInner(2)
    .round(true)
    (root);

  // GROUP (category) rects
  const groups = root.children || [];
  const gSel = svg.selectAll("g.group").data(groups, d=>d.data.cat);
  gSel.exit().remove();
  const gEnter = gSel.enter().append("g").attr("class","group");
  gEnter.append("rect").attr("class","grp-rect");
  gEnter.append("text").attr("class","grp-label");
  gEnter.append("text").attr("class","grp-count");
  gEnter.append("text").attr("class","grp-momentum")
    .on("mousemove",(ev,d)=>{
      const m = MOMENTUM[d.data.cat];
      if(!m) return;
      tooltip.style("opacity",1).style("left",(ev.clientX+16)+"px").style("top",(ev.clientY+16)+"px")
        .html(`<div class="t-name">${CATS[d.data.cat].label}</div><div class="t-note">${m.note}</div>`);
    })
    .on("mouseleave",()=>{ if(!state.pinned) tooltip.style("opacity",0); });
  const gAll = gEnter.merge(gSel);

  gAll.select("rect.grp-rect")
    .attr("x",d=>d.x0).attr("y",d=>d.y0)
    .attr("width",d=>Math.max(0,d.x1-d.x0)).attr("height",d=>Math.max(0,d.y1-d.y0))
    .attr("fill","none").attr("stroke","#EDEAE3").attr("stroke-width",1);

  gAll.select("text.grp-label")
    .attr("x",d=>d.x0+4).attr("y",d=>d.y0+14)
    .text(d=> (d.x1-d.x0>70) ? CATS[d.data.cat].label : "");

  gAll.select("text.grp-count")
    .attr("x",d=>d.x0+4).attr("y",d=>d.y0+14)
    .attr("text-anchor",d=> (d.x1-d.x0>70) ? "start":"start")
    .attr("dx", d=> (d.x1-d.x0>70)? CATS[d.data.cat].label.length*6.1+8 : 0)
    .text(d=> (d.x1-d.x0>150) ? `· ${d.children.length}` : "");

  gAll.select("text.grp-momentum")
    .attr("x",d=>d.x1-4).attr("y",d=>d.y0+14)
    .attr("text-anchor","end")
    .attr("class",d=>{
      const m = MOMENTUM[d.data.cat];
      return "grp-momentum " + (m ? (m.dir==="up"?"mom-up":"mom-down") : "");
    })
    .style("cursor",d=>MOMENTUM[d.data.cat]?"help":"default")
    .text(d=>{
      const m = MOMENTUM[d.data.cat];
      if(!m || (d.x1-d.x0)<130) return "";
      return m.label;
    });

  // LEAF rects
  const leaves = root.leaves();
  const lSel = svg.selectAll("g.leaf").data(leaves, d=>d.data.name);
  lSel.exit().remove();
  const lEnter = lSel.enter().append("g").attr("class","leaf");
  lEnter.append("rect").attr("class","leaf-rect");
  lEnter.append("text").attr("class","leaf-label");
  lEnter.append("text").attr("class","leaf-sub");
  const lAll = lEnter.merge(lSel);

  lAll.select("rect.leaf-rect")
    .attr("x",d=>d.x0).attr("y",d=>d.y0)
    .attr("width",d=>Math.max(0,d.x1-d.x0)).attr("height",d=>Math.max(0,d.y1-d.y0))
    .attr("fill",d=>fillFor(d))
    .attr("rx",2.5)
    .classed("dim", d=> state.search && !matchesSearch(d.data))
    .classed("search-match", d=> state.search && matchesSearch(d.data))
    .classed("cited", d=> !!d.data.citation)
    .on("mousemove",(ev,d)=>showTip(ev,d))
    .on("mouseleave",()=>{ if(!state.pinned) tooltip.style("opacity",0); })
    .on("click",(ev,d)=>{ state.pinned=d.data; showDetail(d.data); });

  const dotSel = svg.selectAll("circle.cite-dot").data(leaves.filter(d=>d.data.citation && (d.x1-d.x0)>26 && (d.y1-d.y0)>18), d=>d.data.name);
  dotSel.exit().remove();
  dotSel.enter().append("circle").attr("class","cite-dot").attr("r",2.6)
    .merge(dotSel)
    .attr("cx",d=>d.x1-7).attr("cy",d=>d.y0+7);

  lAll.select("text.leaf-label")
    .attr("x",d=>d.x0+6).attr("y",d=>d.y0+16)
    .attr("class", d=> "leaf-label "+textColorFor(fillFor(d)))
    .attr("font-size", d=> (d.x1-d.x0)>140 ? 12.5:10.5)
    .text(d=>{
      const w=d.x1-d.x0, h=d.y1-d.y0;
      if(w<48||h<24) return "";
      const maxChars = Math.floor(w/6.4);
      return d.data.name.length>maxChars ? d.data.name.slice(0,maxChars-1)+"…" : d.data.name;
    });

  lAll.select("text.leaf-sub")
    .attr("x",d=>d.x0+6).attr("y",d=>d.y0+30)
    .attr("class", d=> "leaf-sub "+textColorFor(fillFor(d)))
    .attr("font-size",9.5)
    .text(d=>{
      const w=d.x1-d.x0, h=d.y1-d.y0;
      if(w<70||h<40) return "";
      return `${fmt(d.data.degrees)}/yr · exp ${d.data.exposure.toFixed(1)}`;
    });

  if(state.pinned){
    const still = leaves.find(d=>d.data.name===state.pinned.name);
    if(still) showDetail(state.pinned); else closeDetail();
  }
}

function citeHtml(dt){
  const c = dt.citation;
  if(!c) return `<div class="t-note prov-rubric">Too heterogeneous to map to one occupation — rubric estimate, uncited.</div>`;
  return `<div class="t-note"><span class="prov-cited">● Cited</span> — Eloundou et al. (2023), <i>${c.occ}</i> (${c.soc})<br><span style="color:rgba(255,255,255,.65)">human β ${c.human.toFixed(2)} · GPT-4 β ${c.gpt4.toFixed(2)} (0–1 scale)</span></div>`;
}

function showTip(ev,d){
  const dt = d.data;
  tooltip.style("opacity",1)
    .style("left",(ev.clientX+16)+"px")
    .style("top",(ev.clientY+16)+"px")
    .html(`
      <div class="t-name">${dt.name}</div>
      <div class="t-cat">${CATS[dt.cat].label}</div>
      <div class="t-row"><span>Degrees / year</span><b>${fmt(dt.degrees)}</b></div>
      <div class="t-row"><span>AI exposure</span><b>${dt.exposure.toFixed(1)} / 10</b></div>
      <div class="t-note">${dt.note}</div>
      ${citeHtml(dt)}
    `);
}

function showDetail(dt){
  const panel = d3.select("#detail").classed("open",true);
  const c = dt.citation;
  const provLine = !c
    ? `<div class="metric-block"><div class="m-label">Exposure source</div><div class="prov-rubric" style="font-size:12.5px;">Too heterogeneous — rubric estimate, uncited</div></div>`
    : `<div class="metric-block"><div class="m-label">Exposure source</div><div style="font-size:12.5px;" class="prov-cited">● Cited — ${c.occ}</div>
        <div style="font-size:11px;color:var(--ink-faint);margin-top:2px;">Eloundou et al. (2023), ${c.soc} · human β ${c.human.toFixed(2)} / GPT-4 β ${c.gpt4.toFixed(2)}</div></div>`;
  panel.html(`
    <button class="close-x" id="closeDetail">✕</button>
    <div class="d-main">
      <div class="d-cat">${CATS[dt.cat].label}</div>
      <h3>${dt.name}</h3>
      <p>${dt.note}</p>
    </div>
    <div class="d-metrics">
      <div class="metric-block">
        <div class="m-label">Degrees conferred / year</div>
        <div class="m-value">${fmt(dt.degrees)}</div>
      </div>
      <div class="metric-block">
        <div class="m-label">AI exposure score</div>
        <div class="m-value">${dt.exposure.toFixed(1)} / 10</div>
        <div class="m-bar-track"><div class="m-bar-fill" style="width:${dt.exposure*10}%"></div></div>
      </div>
      ${provLine}
    </div>
  `);
  d3.select("#closeDetail").on("click",closeDetail);
}

/* ================= INIT ================= */
async function init(){
  const res = await fetch('data.json');
  const payload = await res.json();
  DATA = payload.majors.map(m => ({
    name: m.name, cat: m.cat, degrees: m.degrees, exposure: m.exposure,
    note: m.note, citation: m.citation
  }));
  MOMENTUM = payload.momentum;
  render();
}

window.addEventListener("resize", ()=>{ /* viewBox handles scaling */ });
init();
