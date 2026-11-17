'use client';

// Keep every imported field editable, but lead with the fields used by the sales team.
export function UnitContentEditor({fields,unit,Field}:any){
 const basic=fields.filter((f:any)=>f.shared?.startsWith('unit:'));
 const media=fields.filter((f:any)=>['image','gallery','document'].includes(f.kind)&&!f.value?.includes?.('csas.cz')&&!f.value?.includes?.('kb.cz'));
 const primary=new Set([...basic,...media].map((f:any)=>f.id));
 const other=fields.filter((f:any)=>!primary.has(f.id));
 const render=(items:any[])=>items.map(f=><div key={f.id}>{Field({f:f.shared?.startsWith('unit:')?{...f,label:unit.title+' · '+f.shared.split(':').at(-1)}:f})}</div>);
 return <div className="unit-content-editor">
  <section><div className="unit-editor-heading"><span className="eyebrow">{unit.title}</span><h2>Unit details</h2><p>These fields also appear in the price list. Save a draft and review the preview before publishing.</p></div><div className="fields">{render(basic)}</div></section>
  <section><div className="unit-editor-heading"><h2>Photos, floor plans and documents</h2><p>Review current assets and replace a file directly beside its preview.</p></div><div className="fields">{render(media)}</div></section>
  {!!other.length&&<details className="panel unit-editor-more"><summary>Additional page text and links <span>({other.length})</span></summary><p>Edit additional captions, links and search metadata. Use the search box above to find a specific field.</p><div className="fields">{render(other)}</div></details>}
 </div>;
}
