import test from 'node:test';
import assert from 'node:assert/strict';
import {publishedSiteData} from '../lib/public-site.ts';

test('anonymous website feed includes only published Verde II prices, availability and news',()=>{
 const catalog={units:[{key:'verde-B.3.3',project:'verde',price:'7 850 000 Kč',status:'volné',internal:'private'},{key:'borovskeho-B.3.3',project:'borovskeho',price:'private',status:'volné'}],cms:{draft:true,private:'secret'}};
 const article={title:'Czech title',body:'Czech text',date:'2026-11-18',images:['/files/photo.jpg','/web/assets/photo.webp','/verde-slany/assets/other.webp','https://example.test/a.webp','javascript:alert(1)'],translations:{en:{title:'English title',body:'English text'},secret:'private'}};
 const posts=[{id:'live',published:article,draft:{...article,title:'Private draft'},author:'private@example.test'},{id:'draft',published:null,draft:article},{id:'hidden',published:{...article,archived:true}}];
 const result=publishedSiteData(catalog,posts,'https://api.example.test','https://pages.example.test/verde-slany/');
 assert.deepEqual(result.units,[{key:'verde-B.3.3',price:'7 850 000 Kč',status:'volné'}]);
 assert.equal(result.posts.length,1);assert.equal(result.posts[0].title,'Czech title');assert.deepEqual(result.posts[0].translations,{en:{title:'English title',body:'English text'}});
 assert.deepEqual(result.posts[0].images,['https://api.example.test/files/photo.jpg','https://pages.example.test/verde-slany/assets/photo.webp','https://pages.example.test/verde-slany/assets/other.webp','https://example.test/a.webp']);
 assert(!JSON.stringify(result).includes('private'));assert.equal(result.demo,false);
 assert.equal(publishedSiteData(catalog,[], 'https://api.example.test','https://pages.example.test/verde-slany/',true).demo,true);
});
