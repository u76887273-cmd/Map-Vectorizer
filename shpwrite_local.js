/* Local offline Shapefile writer for Map Vectorizer.
   Supports GeoJSON FeatureCollection of LineString features.
*/
(function(){
function u16(b,o,v){b[o]=v&255;b[o+1]=(v>>>8)&255}
function u32(b,o,v){b[o]=v&255;b[o+1]=(v>>>8)&255;b[o+2]=(v>>>16)&255;b[o+3]=(v>>>24)&255}
function i32(b,o,v){u32(b,o,v>>>0)}
function f64(b,o,v){new DataView(b.buffer).setFloat64(o,v,true)}
function be32(b,o,v){b[o]=(v>>>24)&255;b[o+1]=(v>>>16)&255;b[o+2]=(v>>>8)&255;b[o+3]=v&255}
function bbox(features){
 let xmin=Infinity,ymin=Infinity,xmax=-Infinity,ymax=-Infinity;
 features.forEach(f=>f.geometry.coordinates.forEach(p=>{
   xmin=Math.min(xmin,p[0]);ymin=Math.min(ymin,p[1]);
   xmax=Math.max(xmax,p[0]);ymax=Math.max(ymax,p[1]);
 }));
 if(!isFinite(xmin))xmin=ymin=xmax=ymax=0;
 return [xmin,ymin,xmax,ymax];
}
function shpFiles(fc){
 const fs=fc.features, box=bbox(fs), recs=[];
 let shpLen=100, shxLen=100;
 fs.forEach((f,i)=>{
   const pts=f.geometry.coordinates, parts=1;
   const contentWords=22+2*pts.length;
   recs.push({pts,contentWords,recNo:i+1});
   shpLen+=8+contentWords*2; shxLen+=8;
 });
 const shp=new Uint8Array(shpLen),shx=new Uint8Array(shxLen);
 function header(b,fileLenWords){
   be32(b,0,9994);be32(b,24,fileLenWords);i32(b,28,1000);i32(b,32,3);
   f64(b,36,box[0]);f64(b,44,box[1]);f64(b,52,box[2]);f64(b,60,box[3]);
   f64(b,68,0);f64(b,76,0);f64(b,84,0);f64(b,92,0);
 }
 header(shp,shpLen/2);header(shx,shxLen/2);
 let so=100, xo=100;
 recs.forEach((r,i)=>{
   const b=r.pts, cw=r.contentWords;
   be32(shp,so,r.recNo);be32(shp,so+4,cw);
   const p=so+8;
   i32(shp,p,3); // PolyLine
   f64(shp,p+4,box[0]);f64(shp,p+12,box[1]);f64(shp,p+20,box[2]);f64(shp,p+28,box[3]);
   i32(shp,p+36,1);i32(shp,p+40,b.length);
   i32(shp,p+44,0);
   let q=p+48;
   b.forEach(pt=>{f64(shp,q,pt[0]);f64(shp,q+8,pt[1]);q+=16});
   be32(shx,xo,so/2);be32(shx,xo+4,cw);so+=8+cw*2;xo+=8;
 });
 return {shp,shx};
}
function dbf(fc){
 const n=fc.features.length, fields=[{name:'id',type:'N',len:10,dec:0}];
 const headerLen=32+32*fields.length+1, recLen=1+10;
 const b=new Uint8Array(headerLen+n*recLen+1);b[0]=3;
 const d=new Date();b[1]=d.getFullYear()-1900;b[2]=d.getMonth()+1;b[3]=d.getDate();
 u32(b,4,n);u16(b,8,headerLen);u16(b,10,recLen);
 let p=32;
 fields.forEach(f=>{
   for(let i=0;i<11;i++)b[p+i]=i<f.name.length?f.name.charCodeAt(i):0;
   b[p+11]=f.type.charCodeAt(0);b[p+16]=f.len;b[p+17]=f.dec;p+=32;
 });
 b[headerLen-1]=13;p=headerLen;
 fc.features.forEach((f,i)=>{
   b[p]=32;const s=String(f.properties?.id??i+1);for(let j=0;j<10;j++)b[p+1+j]=32;
   for(let j=0;j<s.length&&j<10;j++)b[p+1+10-s.length+j]=s.charCodeAt(j);
   p+=recLen;
 }); b[b.length-1]=26; return b;
}
function crc32(bytes){
 let table=crc32.t||(crc32.t=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;}));
 let c=0xffffffff;for(const x of bytes)c=table[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;
}
function zip(entries){
 const local=[],central=[];let offset=0;
 entries.forEach(e=>{
   const name=new TextEncoder().encode(e.name), data=e.data, crc=crc32(data);
   const h=new Uint8Array(30+name.length);u32(h,0,0x04034b50);u16(h,4,20);u16(h,6,0);u16(h,8,0);
   u16(h,10,0);u16(h,12,0);u32(h,14,crc);u32(h,18,data.length);u32(h,22,data.length);u16(h,26,name.length);u16(h,28,0);h.set(name,30);
   local.push(h,data);
   const c=new Uint8Array(46+name.length);u32(c,0,0x02014b50);u16(c,4,20);u16(c,6,20);u16(c,8,0);u16(c,10,0);u16(c,12,0);u16(c,14,0);
   u32(c,16,crc);u32(c,20,data.length);u32(c,24,data.length);u16(c,28,name.length);u16(c,30,0);u16(c,32,0);u16(c,34,0);u16(c,36,0);u32(c,38,0);u32(c,42,offset);c.set(name,46);
   central.push(c);offset+=h.length+data.length;
 });
 const centralSize=central.reduce((s,x)=>s+x.length,0), centralOffset=offset;
 const end=new Uint8Array(22);u32(end,0,0x06054b50);u16(end,8,entries.length);u16(end,10,entries.length);u32(end,12,centralSize);u32(end,16,centralOffset);
 const total=offset+centralSize+22, out=new Uint8Array(total);let p=0;
 for(const x of local){out.set(x,p);p+=x.length}for(const x of central){out.set(x,p);p+=x.length}out.set(end,p);
 return new Blob([out],{type:'application/zip'});
}
window.shpwrite={zip:function(fc,options){
 const name=(options&&options.folder)||'map_vectors', files=shpFiles(fc), entries=[
  {name:name+'/'+name+'.shp',data:files.shp},
  {name:name+'/'+name+'.shx',data:files.shx},
  {name:name+'/'+name+'.dbf',data:dbf(fc)}
 ];
 if(options&&options.prj)entries.push({name:name+'/'+name+'.prj',data:new TextEncoder().encode(options.prj)});
 return zip(entries);
}};
})();