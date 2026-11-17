export const roleOptions = [
  {id:'superadmin',label:'Administrator',description:'Full administration, users, permissions and backups.'},
  {id:'content_manager',label:'Content editor',description:'Manage website text, news, photos, videos and documents.'},
  {id:'sales_manager',label:'Sales manager',description:'Manage prices, availability, enquiries and reservations.'},
  {id:'viewer',label:'Viewer',description:'Read the apartment overview and public website.'},
];
export function permissions(role:string){
 const admin=['owner','superadmin'].includes(role),legacy=role==='publisher';
 return {admin,content:admin||legacy||['content_manager','editor'].includes(role),publishContent:admin||legacy||role==='content_manager',sales:admin||legacy||role==='sales_manager',units:admin||legacy||['sales_manager','viewer'].includes(role),readOnly:role==='viewer'};
}
export function requirePermission(user:any,key:keyof ReturnType<typeof permissions>){if(!permissions(user.role)[key])throw new Error('403|Your account does not have permission to use this section.');}
export function fieldAllowed(role:string,f:any){const p=permissions(role);if(p.admin)return true;const sale=f?.shared?.startsWith('unit:')&&/:(Cena|Stav)$/.test(f.shared);return sale?p.sales:p.content;}
export function roleLabel(role:string){return roleOptions.find(r=>r.id===role)?.label||({owner:'Administrator',publisher:'Website editor',editor:'Editor'} as any)[role]||'Access denied';}
